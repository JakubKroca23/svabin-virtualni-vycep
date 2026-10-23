import { clamp } from './util.js';
import { computeSceneLayout } from './render/layout.js';

const MIN_HIT_PX = 44;
const GLASS_TILT_MIN = -15;
const GLASS_TILT_MAX = 45;
const HLADINKA_SNAP_CENTER = 28;
const HLADINKA_SNAP_BAND = 4;

export function applySoftGlassTiltSnap(angle) {
  if (angle >= HLADINKA_SNAP_CENTER - HLADINKA_SNAP_BAND && angle <= HLADINKA_SNAP_CENTER + HLADINKA_SNAP_BAND) {
    const pull = (HLADINKA_SNAP_CENTER - angle) * 0.35;
    return angle + pull;
  }
  return angle;
}

function expandRect(x, y, w, h, minPx) {
  const padX = Math.max(0, (minPx - w) * 0.5);
  const padY = Math.max(0, (minPx - h) * 0.5);
  return { x: x - padX, y: y - padY, w: w + padX * 2, h: h + padY * 2 };
}

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/** @internal exported for tests */
export function hitTestZones(canvas, state, pos) {
  const layout = computeSceneLayout(pos.w, pos.h, state);
  const {
    glassCenterX,
    glassBottomY,
    glassH,
    glassHalfW,
    vesselPivotX,
    vesselPivotY,
    canW,
    canH,
    scale,
    W,
    H,
  } = layout;

  const glassRect = expandRect(
    glassCenterX - glassHalfW * 1.15,
    glassBottomY - glassH,
    glassHalfW * 2.3,
    glassH,
    MIN_HIT_PX,
  );
  const vesselRect = expandRect(
    vesselPivotX - canW * 0.65,
    vesselPivotY - canH * 0.55,
    canW * 1.3,
    canH * 1.1,
    MIN_HIT_PX,
  );
  const lidRect = expandRect(
    vesselPivotX - canW * 0.35,
    vesselPivotY - canH * 0.62,
    canW * 0.7,
    canH * 0.25,
    MIN_HIT_PX,
  );
  const openHintRect = expandRect(W * 0.35, 0, W * 0.65, H * 0.58, MIN_HIT_PX);

  const inGlass = pointInRect(pos.x, pos.y, glassRect);
  const inVessel = pointInRect(pos.x, pos.y, vesselRect);
  const inLid = pointInRect(pos.x, pos.y, lidRect);
  const inOpenHint = !state.isOpened && pointInRect(pos.x, pos.y, openHintRect);

  return { inGlass, inVessel, inLid, inOpenHint, layout };
}

function getPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const point = e.touches?.[0] || e.changedTouches?.[0] || e;
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
    w: rect.width,
    h: rect.height,
  };
}

/**
 * @param {object} api
 * @param {(value: number) => void} api.setTilt
 * @param {() => void} api.triggerOpen
 * @param {() => void} api.takeSip
 * @param {() => void} [api.emitHud]
 */
export function attachInput(canvas, state, api) {
  const removeListeners = [];
  const activeTouchId = { vessel: null, glass: null };

  function addListener(target, type, handler, options) {
    target?.addEventListener?.(type, handler, options);
    removeListeners.push(() => target?.removeEventListener?.(type, handler, options));
  }

  let glassPointerStart = null;
  let vesselPointerStart = null;

  function onPointerDown(e) {
    const pos = getPos(canvas, e);
    const hits = hitTestZones(canvas, state, pos);

    if (hits.inOpenHint || hits.inLid) api.triggerOpen();

    if (hits.inGlass && !hits.inVessel) {
      glassPointerStart = { x: pos.x, y: pos.y, canSip: state.liquidMl + state.foamMl >= 40 };
      state.isDraggingGlass = true;
      state.glassTiltManualHold = true;
      state.dragStartY = pos.y;
      state.dragStartGlassTilt = state.targetGlassTiltAngle;
      state.autoPourMode = null;
      if (e.type === 'touchstart' && e.touches?.[0]) activeTouchId.glass = e.touches[0].identifier;
      return;
    }

    if (hits.inVessel || hits.inOpenHint) {
      vesselPointerStart = { x: pos.x, y: pos.y };
      state.isDraggingVessel = true;
      state.dragStartY = pos.y;
      state.dragStartAngle = state.targetVesselAngle;
      if (e.type === 'touchstart' && e.touches?.[0]) activeTouchId.vessel = e.touches[0].identifier;
    }
  }

  function onPointerMove(e) {
    const pos = getPos(canvas, e);
    if (state.isDraggingGlass) {
      if (e.cancelable) e.preventDefault();
      let next = state.dragStartGlassTilt + (pos.y - state.dragStartY) * 0.35;
      next = applySoftGlassTiltSnap(clamp(next, GLASS_TILT_MIN, GLASS_TILT_MAX));
      state.targetGlassTiltAngle = next;
      api.emitHud?.();
      return;
    }
    if (!state.isDraggingVessel) return;
    if (e.cancelable) e.preventDefault();
    api.setTilt(state.dragStartAngle + (pos.y - state.dragStartY) * 0.55);
  }

  function finishGlassPointer(pos) {
    if (glassPointerStart && glassPointerStart.canSip) {
      const dx = pos.x - glassPointerStart.x;
      const dy = pos.y - glassPointerStart.y;
      if (dx * dx + dy * dy < 12 * 12) api.takeSip();
    }
    glassPointerStart = null;
    state.isDraggingGlass = false;
    state.glassTiltManualHold = false;
  }

  function onPointerUp(e) {
    const pos = getPos(canvas, e);
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      const id = e.changedTouches?.[0]?.identifier;
      if (id === activeTouchId.glass) {
        finishGlassPointer(pos);
        activeTouchId.glass = null;
      }
      if (id === activeTouchId.vessel) {
        state.isDraggingVessel = false;
        vesselPointerStart = null;
        activeTouchId.vessel = null;
      }
      return;
    }
    state.isDraggingVessel = false;
    vesselPointerStart = null;
    if (state.isDraggingGlass) finishGlassPointer(pos);
  }

  addListener(canvas, 'mousedown', onPointerDown);
  addListener(globalThis.window, 'mousemove', onPointerMove);
  addListener(globalThis.window, 'mouseup', onPointerUp);
  addListener(canvas, 'touchstart', onPointerDown, { passive: true });
  addListener(globalThis.window, 'touchmove', onPointerMove, { passive: false });
  addListener(globalThis.window, 'touchend', onPointerUp);
  addListener(globalThis.window, 'touchcancel', onPointerUp);

  return () => {
    removeListeners.splice(0).forEach((remove) => remove());
  };
}
