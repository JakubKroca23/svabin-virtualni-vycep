import * as THREE from 'three';
import {
  DEFAULT_BEER,
  applySip,
  buildHud,
  clamp,
  createInitialState,
  glassLathePoints,
  resetPourState,
  stepPhysics,
} from './pourPhysics.js';

function callSafely(fn, ...args) {
  if (typeof fn !== 'function') return;
  try {
    fn(...args);
  } catch {
    // ignore
  }
}

function safeImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && (host === 'svabin.com' || host.endsWith('.svabin.com'))) {
      return url.href;
    }
  } catch {
    // ignore
  }
  return '';
}

function hexColor(hex, fallback = 0xc67810) {
  try {
    return new THREE.Color(hex || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

function baseUrl() {
  return typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';
}

/**
 * Photorealistic Three.js pour simulator.
 * Glass sits upright (Y-up); positive glass tilt leans toward the vessel on the right.
 */
export function createPourSimulator({ canvas, sfx, onHud } = {}) {
  if (!canvas) throw new Error('createPourSimulator requires a canvas');

  const state = createInitialState();
  let destroyed = false;
  let frameId = null;
  let resizeObserver = null;
  const removeListeners = [];
  const textureLoader = new THREE.TextureLoader();
  const labelCache = new Map();

  const gl =
    canvas.getContext?.('webgl2', { alpha: true, antialias: true }) ||
    canvas.getContext?.('webgl', { alpha: true, antialias: true });
  const use3d = Boolean(gl);

  let renderer = null;
  let scene = null;
  let camera = null;
  let glassGroup = null;
  let liquidMesh = null;
  let foamMesh = null;
  let vesselGroup = null;
  let canMesh = null;
  let bottleMesh = null;
  let streamMesh = null;
  let streamMat = null;
  let tableMesh = null;
  let bgMesh = null;

  const GLASS_H = 0.24;
  const GLASS_HALF_W = 0.065;
  const VESSEL_POS = new THREE.Vector3(0.2, 0.2, 0);

  function emitHud() {
    callSafely(onHud, buildHud(state));
  }

  function updatePourLoop() {
    if (state.flowRate > 0.05) {
      if (!state.pourLoopPlaying) {
        callSafely(sfx?.startLoop, 'pour-loop');
        state.pourLoopPlaying = true;
      }
    } else if (state.pourLoopPlaying) {
      callSafely(sfx?.stopLoop, 'pour-loop');
      state.pourLoopPlaying = false;
      if (state.foamFinished) callSafely(sfx?.play, 'foam');
    }
  }

  function loadLabelTexture(url) {
    const safe = safeImageUrl(url);
    if (!safe) return null;
    if (labelCache.has(safe)) return labelCache.get(safe);
    const tex = textureLoader.load(safe);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    labelCache.set(safe, tex);
    return tex;
  }

  function makeGlassLathe(glassType) {
    const pts = glassLathePoints(glassType, GLASS_HALF_W, GLASS_H).map((p) => new THREE.Vector2(p.x, p.y));
    return new THREE.LatheGeometry(pts, 64);
  }

  function rebuildGlassMeshes() {
    if (!glassGroup) return;
    while (glassGroup.children.length) {
      const child = glassGroup.children[0];
      glassGroup.remove(child);
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
      else child.material?.dispose?.();
    }

    const glassGeo = makeGlassLathe(state.glassType);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8f2ff,
      metalness: 0,
      roughness: 0.05,
      transmission: 0.92,
      thickness: 0.35,
      ior: 1.5,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 1.2,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.castShadow = true;
    glassMesh.receiveShadow = true;
    glassGroup.add(glassMesh);

    // Inner liquid (slightly smaller lathe, scaled by fill)
    const liquidPts = glassLathePoints(state.glassType, GLASS_HALF_W * 0.92, GLASS_H * 0.96).map(
      (p) => new THREE.Vector2(p.x, p.y),
    );
    const liquidGeo = new THREE.LatheGeometry(liquidPts, 48);
    const beer = state.selectedBeer || DEFAULT_BEER;
    const liquidMat = new THREE.MeshStandardMaterial({
      color: hexColor(beer.liquidMid),
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 0.92,
    });
    liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    liquidMesh.scale.set(1, 0.001, 1);
    liquidMesh.visible = false;
    glassGroup.add(liquidMesh);

    const foamGeo = new THREE.CylinderGeometry(GLASS_HALF_W * 0.9, GLASS_HALF_W * 0.88, 0.018, 48);
    const foamMat = new THREE.MeshStandardMaterial({
      color: hexColor(beer.foamTone, 0xfbf6ea),
      roughness: 0.9,
      metalness: 0,
    });
    foamMesh = new THREE.Mesh(foamGeo, foamMat);
    foamMesh.visible = false;
    glassGroup.add(foamMesh);

    if (state.glassType === 'mug') {
      const handleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(GLASS_HALF_W * 0.85, GLASS_H * 0.72, 0),
        new THREE.Vector3(GLASS_HALF_W * 1.55, GLASS_H * 0.65, 0),
        new THREE.Vector3(GLASS_HALF_W * 1.55, GLASS_H * 0.3, 0),
        new THREE.Vector3(GLASS_HALF_W * 0.85, GLASS_H * 0.28, 0),
      ]);
      const handleGeo = new THREE.TubeGeometry(handleCurve, 24, 0.008, 12, false);
      const handleMat = new THREE.MeshPhysicalMaterial({
        color: 0xdde8f5,
        transmission: 0.85,
        roughness: 0.08,
        thickness: 0.2,
        transparent: true,
      });
      glassGroup.add(new THREE.Mesh(handleGeo, handleMat));
    }
  }

  function rebuildVesselMeshes() {
    if (!vesselGroup) return;
    while (vesselGroup.children.length) {
      const child = vesselGroup.children[0];
      vesselGroup.remove(child);
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
      else child.material?.dispose?.();
    }
    canMesh = null;
    bottleMesh = null;

    const beer = state.selectedBeer || DEFAULT_BEER;
    const labelTex = loadLabelTexture(beer.image);

    // Aluminum can
    const canH = 0.145;
    const canR = 0.033;
    const canGeo = new THREE.CylinderGeometry(canR, canR, canH, 48, 1, false);
    const canMat = new THREE.MeshStandardMaterial({
      color: 0xb0ada8,
      metalness: 0.85,
      roughness: 0.28,
      map: labelTex || null,
    });
    canMesh = new THREE.Mesh(canGeo, canMat);
    canMesh.castShadow = true;
    // Lid
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(canR * 0.98, canR * 0.98, 0.004, 48),
      new THREE.MeshStandardMaterial({ color: 0xd8d5d0, metalness: 0.9, roughness: 0.2 }),
    );
    lid.position.y = canH / 2 + 0.002;
    canMesh.add(lid);
    vesselGroup.add(canMesh);

    // Bottle lathe
    const bottlePts = [
      new THREE.Vector2(0.012, 0),
      new THREE.Vector2(0.034, 0.02),
      new THREE.Vector2(0.036, 0.09),
      new THREE.Vector2(0.03, 0.12),
      new THREE.Vector2(0.014, 0.16),
      new THREE.Vector2(0.012, 0.2),
      new THREE.Vector2(0.011, 0.215),
    ];
    const bottleGeo = new THREE.LatheGeometry(bottlePts, 48);
    const bottleMat = new THREE.MeshPhysicalMaterial({
      color: 0x5a2a0c,
      metalness: 0.1,
      roughness: 0.25,
      transmission: 0.35,
      thickness: 0.4,
      transparent: true,
      map: labelTex || null,
    });
    bottleMesh = new THREE.Mesh(bottleGeo, bottleMat);
    bottleMesh.castShadow = true;
    bottleMesh.position.y = -0.01;
    vesselGroup.add(bottleMesh);

    canMesh.visible = state.vesselType === 'can';
    bottleMesh.visible = state.vesselType === 'bottle';
  }

  function initScene() {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      context: gl || undefined,
    });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c0907, 0.55);

    camera = new THREE.PerspectiveCamera(36, 1, 0.01, 20);
    camera.position.set(0.05, 0.22, 0.62);
    camera.lookAt(0.06, 0.12, 0);

    const amb = new THREE.AmbientLight(0xffe2c0, 0.45);
    scene.add(amb);
    const key = new THREE.DirectionalLight(0xffd4a0, 1.35);
    key.position.set(-0.4, 0.8, 0.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.PointLight(0x88aaff, 0.35, 3);
    fill.position.set(0.5, 0.3, 0.4);
    scene.add(fill);
    const rim = new THREE.PointLight(0xffaa66, 0.55, 2.5);
    rim.position.set(-0.2, 0.35, -0.3);
    scene.add(rim);

    // Photoreal bar backdrop
    const bgTex = textureLoader.load(`${baseUrl()}images/bar-bg.jpg`);
    bgTex.colorSpace = THREE.SRGBColorSpace;
    bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.5),
      new THREE.MeshBasicMaterial({ map: bgTex }),
    );
    bgMesh.position.set(0.05, 0.35, -0.75);
    scene.add(bgMesh);

    // Darkening plane for contrast
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    );
    veil.position.set(0.05, 0.35, -0.74);
    scene.add(veil);

    // Bar counter
    tableMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.06, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.55, metalness: 0.05 }),
    );
    tableMesh.position.set(0.05, -0.03, 0.05);
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    glassGroup = new THREE.Group();
    glassGroup.position.set(0, 0, 0);
    scene.add(glassGroup);
    rebuildGlassMeshes();

    vesselGroup = new THREE.Group();
    vesselGroup.position.copy(VESSEL_POS);
    scene.add(vesselGroup);
    rebuildVesselMeshes();

    streamMat = new THREE.MeshPhysicalMaterial({
      color: hexColor(state.selectedBeer.liquidMid),
      roughness: 0.15,
      metalness: 0,
      transparent: true,
      opacity: 0.85,
      transmission: 0.2,
    });
    streamMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(),
      new THREE.Vector3(0, -0.05, 0),
    ]), 20, 0.004, 8, false), streamMat);
    streamMesh.visible = false;
    scene.add(streamMesh);
  }

  function syncBeerMaterials() {
    const beer = state.selectedBeer || DEFAULT_BEER;
    if (liquidMesh) {
      liquidMesh.material.color = hexColor(beer.liquidMid);
    }
    if (foamMesh) {
      foamMesh.material.color = hexColor(beer.foamTone, 0xfbf6ea);
    }
    if (streamMat) {
      streamMat.color = hexColor(beer.liquidTop);
    }
    rebuildVesselMeshes();
  }

  function updateStreamGeometry() {
    if (!streamMesh || !vesselGroup || !glassGroup) return;
    if (state.flowRate <= 0.05) {
      streamMesh.visible = false;
      return;
    }

    const beer = state.selectedBeer || DEFAULT_BEER;
    const fill = Math.min(1, (state.liquidMl + state.foamMl * 0.7) / state.maxGlassMl);
    const liquidTopY = Math.max(0.02, fill * GLASS_H * 0.96);

    // Spout in world space (top of tilted vessel, side toward glass)
    const spoutLocal = new THREE.Vector3(
      state.vesselType === 'can' ? -0.02 : -0.01,
      state.vesselType === 'can' ? 0.075 : 0.2,
      0,
    );
    const spoutWorld = spoutLocal.clone();
    vesselGroup.localToWorld(spoutWorld);

    const impactLocal = new THREE.Vector3(
      state.isGlassTiltedMode ? 0.02 : 0,
      liquidTopY,
      0,
    );
    const impactWorld = impactLocal.clone();
    glassGroup.localToWorld(impactWorld);

    const mid = spoutWorld.clone().lerp(impactWorld, 0.45);
    mid.y -= 0.04 + state.flowRate * 0.01;
    mid.x += Math.sin(performance.now() * 0.02) * 0.004;

    const curve = new THREE.CatmullRomCurve3([
      spoutWorld,
      mid,
      impactWorld,
    ]);
    const radius = Math.max(0.0025, Math.min(0.01, state.flowRate * 0.0032));
    const geo = new THREE.TubeGeometry(curve, 32, radius, 10, false);
    streamMesh.geometry.dispose();
    streamMesh.geometry = geo;
    streamMat.color = hexColor(beer.liquidTop);
    streamMesh.visible = true;
  }

  function updateSceneFromState() {
    if (!use3d || !glassGroup || !vesselGroup) return;

    // Glass: upright base, lean toward vessel (+X) with positive tilt angle mapped to -Z rotation
    const glassRad = THREE.MathUtils.degToRad(state.glassTiltAngle);
    glassGroup.rotation.z = -glassRad;
    glassGroup.rotation.x = 0;
    glassGroup.rotation.y = 0;

    const fillLiquid = Math.min(1, state.liquidMl / state.maxGlassMl);
    const fillFoam = Math.min(0.35, state.foamMl / state.maxGlassMl);
    if (liquidMesh) {
      const yScale = Math.max(0.001, fillLiquid);
      liquidMesh.scale.set(1, yScale, 1);
      liquidMesh.visible = state.liquidMl > 2;
      liquidMesh.position.y = 0;
    }
    if (foamMesh) {
      const top = fillLiquid * GLASS_H * 0.96;
      foamMesh.position.y = top + 0.008;
      const foamScale = 0.7 + fillFoam * 2.2;
      foamMesh.scale.set(foamScale, Math.max(0.4, fillFoam * 8), foamScale);
      foamMesh.visible = state.foamMl > 3;
    }

    // Vessel: hang above, tip toward glass (rotate +Z so top moves toward -X / glass)
    const vesselRad = THREE.MathUtils.degToRad(state.vesselAngle);
    vesselGroup.rotation.z = vesselRad;
    vesselGroup.position.set(
      VESSEL_POS.x - Math.sin(vesselRad) * 0.02,
      VESSEL_POS.y + Math.sin(vesselRad) * 0.04,
      0,
    );

    if (canMesh) canMesh.visible = state.vesselType === 'can';
    if (bottleMesh) bottleMesh.visible = state.vesselType === 'bottle';

    updateStreamGeometry();
  }

  function resize() {
    const parent = canvas.parentElement || canvas;
    const rect = parent.getBoundingClientRect?.() || { width: canvas.width || 640, height: canvas.height || 480 };
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    if (renderer && camera) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    } else {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function loop() {
    if (destroyed) return;
    stepPhysics(state);
    updatePourLoop();
    emitHud();
    if (use3d) {
      updateSceneFromState();
      renderer.render(scene, camera);
    }
    frameId = globalThis.requestAnimationFrame?.(loop) ?? null;
  }

  function triggerOpen() {
    if (state.isOpened) return;
    state.isOpened = true;
    callSafely(sfx?.play, state.vesselType === 'can' ? 'can-open' : 'bottle-open');
    emitHud();
  }

  function setTilt(angle) {
    state.targetVesselAngle = clamp(Number(angle) || 0, 0, 135);
    state.autoPourMode = null;
  }

  function selectBeer(beer) {
    state.selectedBeer = { ...DEFAULT_BEER, ...(beer || {}) };
    resetPourState(state);
    if (use3d) syncBeerMaterials();
    emitHud();
  }

  function setVesselType(type) {
    if (type !== 'can' && type !== 'bottle') return;
    state.vesselType = type;
    resetPourState(state);
    if (use3d) {
      if (canMesh) canMesh.visible = type === 'can';
      if (bottleMesh) bottleMesh.visible = type === 'bottle';
    }
    emitHud();
  }

  function setGlassType(type) {
    if (!['mug', 'teku', 'pint'].includes(type)) return;
    state.glassType = type;
    if (use3d) rebuildGlassMeshes();
    emitHud();
  }

  function toggleGlassTilt() {
    state.isGlassTiltedMode = !state.isGlassTiltedMode;
    state.targetGlassTiltAngle = state.isGlassTiltedMode ? 22 : 0;
    emitHud();
  }

  function startMasterPour(style) {
    if (state.liquidMl + state.foamMl >= state.maxGlassMl * 0.92 || state.vesselRemainingMl <= 20) {
      resetPourState(state);
    }
    if (!state.isOpened) triggerOpen();
    state.autoPourMode = ['hladinka', 'snyt', 'mliko'].includes(style) ? style : 'hladinka';
    state.foamFinished = false;
  }

  function takeSip() {
    if (!applySip(state)) return;
    callSafely(sfx?.play, 'sip');
    emitHud();
  }

  function reset() {
    callSafely(sfx?.stopLoop, 'pour-loop');
    resetPourState(state);
    emitHud();
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches?.[0] || e;
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    };
  }

  let dragging = false;
  let dragStartY = 0;
  let dragStartAngle = 0;

  function onPointerDown(e) {
    const pos = getPos(e);
    if (!state.isOpened && pos.y < pos.h * 0.62) triggerOpen();
    dragging = true;
    dragStartY = pos.y;
    dragStartAngle = state.targetVesselAngle;
  }

  function onPointerMove(e) {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    const pos = getPos(e);
    setTilt(dragStartAngle + (pos.y - dragStartY) * 0.55);
  }

  function onPointerUp() {
    dragging = false;
  }

  function addListener(target, type, handler, options) {
    target?.addEventListener?.(type, handler, options);
    removeListeners.push(() => target?.removeEventListener?.(type, handler, options));
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    callSafely(sfx?.stopLoop, 'pour-loop');
    if (frameId != null) globalThis.cancelAnimationFrame?.(frameId);
    resizeObserver?.disconnect?.();
    removeListeners.splice(0).forEach((fn) => fn());
    renderer?.dispose?.();
  }

  // Init
  if (use3d) {
    initScene();
  }
  addListener(canvas, 'mousedown', onPointerDown);
  addListener(globalThis.window, 'mousemove', onPointerMove);
  addListener(globalThis.window, 'mouseup', onPointerUp);
  addListener(canvas, 'touchstart', onPointerDown, { passive: true });
  addListener(globalThis.window, 'touchmove', onPointerMove, { passive: false });
  addListener(globalThis.window, 'touchend', onPointerUp);

  if (typeof globalThis.ResizeObserver === 'function') {
    resizeObserver = new globalThis.ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement || canvas);
  } else {
    addListener(globalThis.window, 'resize', resize);
  }
  resize();
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
