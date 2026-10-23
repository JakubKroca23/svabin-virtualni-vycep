import { attachInput } from './input.js';
import { evaluatePourStyle, shouldPlayFoamFinish, updatePhysics } from './physics.js';
import { preloadBarBackground, getLabelImage } from './render/assets.js';
import { renderScene } from './render/index.js';
import {
  DEFAULT_BEER,
  createInitialState,
  initCondensation,
  initFoamCells,
  resetPourState,
} from './state.js';
import { markBurpPlayed, shouldPlayBurpAfterSip } from './sipEffects.js';
import { callSafely, clamp, randomBetween } from './util.js';

export function createPourSimulator({ canvas, sfx, onHud } = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('createPourSimulator requires a canvas');
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('createPourSimulator could not get a 2d context');

  const state = createInitialState();
  const container = canvas.parentElement || canvas;
  let destroyed = false;
  let frameId = null;
  let resizeObserver = null;
  let detachInput = null;
  let removeResizeListener = null;

  function emitHud() {
    const { total, foamPct, pourStyle, canSip } = evaluatePourStyle(state);
    callSafely(onHud, {
      liquidMl: `${Math.min(500, Math.round(state.liquidMl))} ml`,
      foamPct: `${foamPct} %`,
      pourStyle,
      canSip,
      vesselRemainingMl: Math.max(0, Math.round(state.vesselRemainingMl)),
      sipsTaken: state.sipsTaken,
      raw: {
        liquidMl: state.liquidMl,
        foamMl: state.foamMl,
        flowRate: state.flowRate,
        vesselAngle: state.vesselAngle,
        glassTiltAngle: state.glassTiltAngle,
        isOpened: state.isOpened,
      },
    });
  }

  function playFoamFinish() {
    if (state.foamFinished) return;
    if (!shouldPlayFoamFinish(state)) return;
    state.foamFinished = true;
    callSafely(sfx?.play, 'foam');
  }

  function resizeCanvas() {
    const rect = container.getBoundingClientRect?.() || canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || 1);
    const height = Math.max(1, rect.height || 1);
    const dpr = Math.min(globalThis.devicePixelRatio || globalThis.window?.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0);
    renderScene(ctx, canvas, state);
  }

  function triggerOpen() {
    if (state.isOpened) {
      setTilt(state.targetVesselAngle < 50 ? 84 : 0);
      return;
    }

    state.isOpened = true;
    callSafely(sfx?.play, state.vesselType === 'can' ? 'can-open' : 'bottle-open');
    for (let i = 0; i < 32; i += 1) {
      state.mistParticles.push({
        xOffset: randomBetween(-8, 8),
        yOffset: -Math.random() * 10,
        vx: randomBetween(-0.9, 0.9),
        vy: randomBetween(-3.7, -1.2),
        r: randomBetween(4, 14),
        alpha: randomBetween(0.45, 0.75),
      });
    }
    if (state.vesselType === 'bottle') {
      state.flyingCap = {
        x: 0,
        y: 0,
        vx: randomBetween(4, 6.5),
        vy: randomBetween(-10, -8),
        angle: 0,
        vAngle: 0.25,
      };
    }
    emitHud();
  }

  function setTilt(value) {
    const numeric = clamp(Number(value) || 0, 0, 135);
    if (!state.isOpened && numeric > 10) triggerOpen();
    state.autoPourMode = null;
    state.targetVesselAngle = numeric;
    if (numeric > 5) state.foamFinished = false;
    emitHud();
  }

  function loop(timestamp) {
    if (destroyed) return;
    updatePhysics(state, {
      onPourLoopStart: () => callSafely(sfx?.startLoop, 'pour-loop'),
      onPourLoopStop: () => callSafely(sfx?.stopLoop, 'pour-loop'),
      onFoamFinish: playFoamFinish,
    });
    renderScene(ctx, canvas, state);
    emitHud();
    frameId = globalThis.requestAnimationFrame?.(loop) ?? null;
  }

  function reset() {
    callSafely(sfx?.stopLoop, 'pour-loop');
    resetPourState(state);
    emitHud();
    renderScene(ctx, canvas, state);
  }

  function selectBeer(beer) {
    state.selectedBeer = { ...DEFAULT_BEER, ...(beer || {}) };
    getLabelImage(state.selectedBeer.image);
    reset();
  }

  function setVesselType(type) {
    if (type !== 'can' && type !== 'bottle') return;
    state.vesselType = type;
    reset();
  }

  function setGlassType(type) {
    if (!['mug', 'teku', 'pint'].includes(type)) return;
    state.glassType = type;
    renderScene(ctx, canvas, state);
  }

  function toggleGlassTilt() {
    state.isGlassTiltedMode = !state.isGlassTiltedMode;
    state.targetGlassTiltAngle = state.isGlassTiltedMode ? 28 : 0;
    state.glassTiltManualHold = false;
    emitHud();
  }

  function startMasterPour(style) {
    if (state.liquidMl + state.foamMl >= state.maxGlassMl * 0.92 || state.vesselRemainingMl <= 20) reset();
    if (!state.isOpened) triggerOpen();
    state.autoPourMode = ['hladinka', 'snyt', 'mliko'].includes(style) ? style : 'hladinka';
    state.foamFinished = false;
    state.glassTiltManualHold = false;
  }

  function takeSip() {
    const total = state.liquidMl + state.foamMl;
    if (total < 30) return;
    callSafely(sfx?.play, 'sip');
    state.sipsTaken += 1;
    const fillRatio = Math.min(1, (state.liquidMl + state.foamMl * 0.85) / state.maxGlassMl);
    if (fillRatio > 0.15) state.lacingRings.push(fillRatio);
    if (state.liquidMl >= 95) {
      state.liquidMl -= 95;
      state.foamMl = Math.max(8, state.foamMl * 0.88);
    } else {
      state.liquidMl = 0;
      state.foamMl = Math.max(0, state.foamMl - 60);
    }
    for (let i = 0; i < state.waveCount; i += 1) {
      state.waveVelocities[i] += Math.sin(i * 0.6) * 2.2;
    }
    const totalAfter = state.liquidMl + state.foamMl;
    if (shouldPlayBurpAfterSip(state, totalAfter)) {
      markBurpPlayed(state);
      callSafely(sfx?.play, 'burp');
    }
    emitHud();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    callSafely(sfx?.stopLoop, 'pour-loop');
    if (frameId != null) globalThis.cancelAnimationFrame?.(frameId);
    resizeObserver?.disconnect?.();
    detachInput?.();
    detachInput = null;
    removeResizeListener?.();
    removeResizeListener = null;
  }

  initCondensation(state);
  initFoamCells(state);
  preloadBarBackground();
  detachInput = attachInput(canvas, state, {
    setTilt,
    triggerOpen,
    takeSip,
    emitHud,
  });

  if (typeof globalThis.ResizeObserver === 'function') {
    resizeObserver = new globalThis.ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
  } else if (globalThis.window?.addEventListener) {
    globalThis.window.addEventListener('resize', resizeCanvas);
    removeResizeListener = () => globalThis.window.removeEventListener('resize', resizeCanvas);
  }
  resizeCanvas();
  emitHud();
  frameId = globalThis.requestAnimationFrame?.(loop) ?? null;

  return {
    selectBeer,
    setVesselType,
    setGlassType,
    triggerOpen,
    setTilt,
    toggleGlassTilt,
    startMasterPour,
    takeSip,
    reset,
    destroy,
  };
}
