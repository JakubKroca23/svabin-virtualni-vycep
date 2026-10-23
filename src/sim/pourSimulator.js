import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
 * Glass stays upright; tip the vessel to pour; click/hold glass to sip.
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
  let spillMesh = null;
  let raycaster = null;
  let pointerNdc = new THREE.Vector2();
  let dragTarget = null; // 'vessel' | 'glass' | null
  let lastFrameTime = null;
  let sipHold = 0;

  // Compact scene so glass + vessel fit on phone and desktop
  const GLASS_H = 0.2;
  const GLASS_HALF_W = 0.052;
  const CAN_H = 0.12;
  const CAN_R = 0.028;
  /** Upright vessel center (held beside glass, fully in frame) */
  const VESSEL_UPRIGHT = new THREE.Vector3(0.125, 0.105, 0.015);
  let pmrem = null;
  let envRT = null;

  /** Local spout (lip) relative to vessel group origin (mesh centers). */
  function spoutLocal() {
    if (state.vesselType === 'can') {
      return new THREE.Vector3(-CAN_R * 0.55, CAN_H * 0.5 - 0.002, 0);
    }
    // Bottle lip (matches lathe top)
    return new THREE.Vector3(-0.009, 0.116, 0);
  }

  /**
   * Place vessel so its lip tracks over the glass mouth when tipped.
   * Rotation +Z tips the top toward -X (into the glass).
   */
  function placeVessel(angleDeg) {
    const rad = THREE.MathUtils.degToRad(clamp(angleDeg, 0, 145));
    const tip = clamp(angleDeg / 70, 0, 1); // engage lip-tracking early once pouring
    vesselGroup.rotation.set(0, 0, rad);

    const local = spoutLocal();
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Rotated spout offset from vessel origin
    const rx = local.x * cos - local.y * sin;
    const ry = local.x * sin + local.y * cos;

    // Target world lip: just inside the rim, above liquid
    const lipX = GLASS_HALF_W * 0.25;
    const lipY = GLASS_H * 0.98;
    const pourOrigin = new THREE.Vector3(lipX - rx, lipY - ry, VESSEL_UPRIGHT.z);

    vesselGroup.position.lerpVectors(VESSEL_UPRIGHT, pourOrigin, tip);
    vesselGroup.updateMatrixWorld(true);
  }

  function emitHud() {
    callSafely(onHud, buildHud(state));
  }

  function updatePourLoop() {
    if (state.flowRate > 4) {
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
      color: 0xffffff,
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      thickness: 0.55,
      ior: 1.52,
      transparent: true,
      opacity: 1,
      side: THREE.FrontSide,
      envMapIntensity: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      specularIntensity: 1,
      attenuationColor: new THREE.Color(0xdce9ff),
      attenuationDistance: 0.6,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.castShadow = true;
    glassMesh.receiveShadow = true;
    glassGroup.add(glassMesh);

    const liquidPts = glassLathePoints(state.glassType, GLASS_HALF_W * 0.93, GLASS_H * 0.97).map(
      (p) => new THREE.Vector2(p.x, p.y),
    );
    const liquidGeo = new THREE.LatheGeometry(liquidPts, 64);
    const beer = state.selectedBeer || DEFAULT_BEER;
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: hexColor(beer.liquidMid),
      roughness: 0.22,
      metalness: 0.0,
      transmission: 0.35,
      thickness: 0.8,
      ior: 1.35,
      transparent: true,
      opacity: 0.96,
      attenuationColor: hexColor(beer.liquidBottom),
      attenuationDistance: 0.35,
      envMapIntensity: 0.6,
    });
    liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    liquidMesh.scale.set(1, 0.001, 1);
    liquidMesh.visible = false;
    glassGroup.add(liquidMesh);

    const foamGeo = new THREE.CylinderGeometry(GLASS_HALF_W * 0.9, GLASS_HALF_W * 0.86, 0.022, 64);
    const foamMat = new THREE.MeshStandardMaterial({
      color: hexColor(beer.foamTone, 0xfbf6ea),
      roughness: 0.95,
      metalness: 0,
      flatShading: false,
    });
    foamMesh = new THREE.Mesh(foamGeo, foamMat);
    foamMesh.visible = false;
    glassGroup.add(foamMesh);

    if (state.glassType === 'mug') {
      const handleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(GLASS_HALF_W * 0.88, GLASS_H * 0.74, 0),
        new THREE.Vector3(GLASS_HALF_W * 1.62, GLASS_H * 0.66, 0),
        new THREE.Vector3(GLASS_HALF_W * 1.62, GLASS_H * 0.28, 0),
        new THREE.Vector3(GLASS_HALF_W * 0.88, GLASS_H * 0.26, 0),
      ]);
      const handleGeo = new THREE.TubeGeometry(handleCurve, 40, 0.009, 16, false);
      const handleMat = glassMat.clone();
      handleMat.thickness = 0.25;
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

    // Aluminum can (centered on vessel origin)
    const canGeo = new THREE.CylinderGeometry(CAN_R, CAN_R, CAN_H, 64, 1, false);
    if (labelTex) {
      labelTex.wrapS = THREE.RepeatWrapping;
      labelTex.repeat.set(1, 1);
      labelTex.center.set(0.5, 0.5);
    }
    const canMat = new THREE.MeshPhysicalMaterial({
      color: labelTex ? 0xffffff : 0xb0ada8,
      metalness: labelTex ? 0.55 : 0.9,
      roughness: labelTex ? 0.32 : 0.22,
      map: labelTex || null,
      clearcoat: 0.4,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.1,
    });
    canMesh = new THREE.Mesh(canGeo, canMat);
    canMesh.castShadow = true;
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(CAN_R * 0.98, CAN_R * 0.98, 0.003, 48),
      new THREE.MeshStandardMaterial({ color: 0xd8d5d0, metalness: 0.9, roughness: 0.2 }),
    );
    lid.position.y = CAN_H / 2 + 0.0015;
    canMesh.add(lid);
    // Opening tab hint on pour side
    const tab = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.0015, 0.008),
      new THREE.MeshStandardMaterial({ color: 0xc8c5c0, metalness: 0.95, roughness: 0.18 }),
    );
    tab.position.set(-CAN_R * 0.35, CAN_H / 2 + 0.003, 0);
    canMesh.add(tab);
    vesselGroup.add(canMesh);

    // Bottle — origin near mid-body so tip rotation feels natural
    const bottlePts = [
      new THREE.Vector2(0.01, -0.09),
      new THREE.Vector2(0.028, -0.07),
      new THREE.Vector2(0.03, 0.0),
      new THREE.Vector2(0.026, 0.035),
      new THREE.Vector2(0.012, 0.075),
      new THREE.Vector2(0.01, 0.105),
      new THREE.Vector2(0.009, 0.118),
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
    vesselGroup.add(bottleMesh);

    canMesh.visible = state.vesselType === 'can';
    bottleMesh.visible = state.vesselType === 'bottle';
  }

  function initScene() {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      context: gl || undefined,
    });
    renderer.setClearColor(0x070504, 1);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090705, 0.12);

    // Image-based lighting for glass reflections
    pmrem = new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;

    // Wider FOV + pulled back so can + glass stay in frame on mobile
    camera = new THREE.PerspectiveCamera(42, 1, 0.01, 30);
    camera.position.set(0.04, 0.16, 0.62);
    camera.lookAt(0.04, 0.1, 0);

    const amb = new THREE.AmbientLight(0xffe6cc, 0.25);
    scene.add(amb);
    const key = new THREE.DirectionalLight(0xffe0b8, 2.1);
    key.position.set(-0.55, 1.1, 0.65);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 4;
    key.shadow.camera.left = -0.6;
    key.shadow.camera.right = 0.6;
    key.shadow.camera.top = 0.6;
    key.shadow.camera.bottom = -0.6;
    key.shadow.bias = -0.0002;
    scene.add(key);
    const fill = new THREE.PointLight(0xa8c4ff, 0.55, 4);
    fill.position.set(0.55, 0.35, 0.45);
    scene.add(fill);
    const warm = new THREE.SpotLight(0xffb070, 18, 3.5, Math.PI / 5, 0.45, 1.2);
    warm.position.set(0.1, 0.95, 0.35);
    warm.target.position.set(0.08, 0.05, 0);
    scene.add(warm);
    scene.add(warm.target);

    const bgTex = textureLoader.load(`${baseUrl()}images/bar-bg.jpg`);
    bgTex.colorSpace = THREE.SRGBColorSpace;
    bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.0),
      new THREE.MeshStandardMaterial({ map: bgTex, roughness: 0.9, metalness: 0, emissive: 0x22180f, emissiveIntensity: 0.15 }),
    );
    bgMesh.position.set(0.05, 0.35, -1.05);
    scene.add(bgMesh);

    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(3.3, 2.1),
      new THREE.MeshBasicMaterial({ color: 0x050302, transparent: true, opacity: 0.22 }),
    );
    veil.position.set(0.05, 0.35, -1.04);
    scene.add(veil);

    // Thick wooden bar top
    tableMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.06, 0.65),
      new THREE.MeshStandardMaterial({
        color: 0x4a2e1c,
        roughness: 0.42,
        metalness: 0.08,
        envMapIntensity: 0.35,
      }),
    );
    tableMesh.position.set(0.05, -0.03, 0.06);
    tableMesh.receiveShadow = true;
    tableMesh.castShadow = true;
    scene.add(tableMesh);

    const contact = new THREE.Mesh(
      new THREE.CircleGeometry(0.09, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(0, 0.001, 0);
    scene.add(contact);

    spillMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.08, 48),
      new THREE.MeshBasicMaterial({
        color: 0xc47820,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    spillMesh.rotation.x = -Math.PI / 2;
    spillMesh.position.set(0.02, 0.002, 0.04);
    spillMesh.visible = false;
    scene.add(spillMesh);

    glassGroup = new THREE.Group();
    glassGroup.position.set(0, 0, 0);
    glassGroup.name = 'glass';
    scene.add(glassGroup);
    rebuildGlassMeshes();

    vesselGroup = new THREE.Group();
    vesselGroup.name = 'vessel';
    scene.add(vesselGroup);
    rebuildVesselMeshes();
    placeVessel(0);

    raycaster = new THREE.Raycaster();

    streamMat = new THREE.MeshPhysicalMaterial({
      color: hexColor(state.selectedBeer.liquidMid),
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.9,
      transmission: 0.45,
      thickness: 0.5,
      ior: 1.33,
    });
    streamMesh = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, -0.05, 0)]),
        20,
        0.004,
        8,
        false,
      ),
      streamMat,
    );
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
    if (state.flowRate <= 2 && state.streamLagMl < 0.5) {
      streamMesh.visible = false;
      return;
    }

    const beer = state.selectedBeer || DEFAULT_BEER;
    const fill = Math.min(1, (state.liquidMl + state.foamMl * 0.7) / state.maxGlassMl);
    // Aim into the glass mouth (inner wall toward vessel), never outside the rim
    const liquidTopY = Math.max(0.02, Math.min(GLASS_H * 0.92, fill * GLASS_H * 0.96 + 0.01));
    const aimX = Math.min(GLASS_HALF_W * 0.35, 0.018);

    vesselGroup.updateMatrixWorld(true);
    glassGroup.updateMatrixWorld(true);

    const spoutWorld = spoutLocal();
    vesselGroup.localToWorld(spoutWorld);

    const impactWorld = new THREE.Vector3(aimX, liquidTopY, 0);
    glassGroup.localToWorld(impactWorld);

    // If lip somehow ends past the glass, still pull impact inside rim
    const glassOrigin = new THREE.Vector3();
    glassGroup.getWorldPosition(glassOrigin);
    const rim = GLASS_HALF_W * 0.85;
    impactWorld.x = clamp(impactWorld.x, glassOrigin.x - rim, glassOrigin.x + rim);
    impactWorld.z = clamp(impactWorld.z, glassOrigin.z - rim * 0.4, glassOrigin.z + rim * 0.4);

    const drop = Math.max(0.008, spoutWorld.y - impactWorld.y);
    const t1 = spoutWorld.clone().lerp(impactWorld, 0.28);
    t1.y = spoutWorld.y - drop * 0.22;
    const t2 = spoutWorld.clone().lerp(impactWorld, 0.62);
    t2.y = spoutWorld.y - drop * 0.72;
    // Tiny wobble only on Z so X stays aimed into glass
    const wobble = Math.sin(performance.now() * 0.02) * 0.0015;
    t1.z += wobble;
    t2.z -= wobble * 0.6;

    const curve = new THREE.CatmullRomCurve3([spoutWorld, t1, t2, impactWorld]);
    const radius = Math.max(0.002, Math.min(0.009, 0.002 + state.flowRate * 0.000045));
    const geo = new THREE.TubeGeometry(curve, 48, radius, 10, false);
    streamMesh.geometry.dispose();
    streamMesh.geometry = geo;
    streamMat.color = hexColor(beer.liquidTop);
    streamMesh.visible = true;
  }

  function updateSceneFromState() {
    if (!use3d || !glassGroup || !vesselGroup) return;

    glassGroup.rotation.set(0, 0, 0);

    const fillLiquid = Math.min(1, state.liquidMl / state.maxGlassMl);
    const fillFoam = Math.min(0.4, state.foamMl / state.maxGlassMl);
    if (liquidMesh) {
      liquidMesh.scale.set(1, Math.max(0.001, fillLiquid), 1);
      liquidMesh.visible = state.liquidMl > 2;
      liquidMesh.position.y = 0;
    }
    if (foamMesh) {
      const top = fillLiquid * GLASS_H * 0.96;
      foamMesh.position.y = top + 0.008;
      const foamScale = 0.7 + fillFoam * 2.0;
      foamMesh.scale.set(foamScale, Math.max(0.35, fillFoam * 7), foamScale);
      foamMesh.visible = state.foamMl > 3;
    }

    placeVessel(state.vesselAngle);

    if (canMesh) canMesh.visible = state.vesselType === 'can';
    if (bottleMesh) bottleMesh.visible = state.vesselType === 'bottle';

    if (spillMesh) {
      const spill = clamp(state.spillMl / 80, 0, 1);
      spillMesh.scale.setScalar(0.35 + spill * 1.2);
      spillMesh.material.opacity = spill * 0.5;
      spillMesh.visible = spill > 0.02;
    }

    updateStreamGeometry();
  }

  function resize() {
    const parent = canvas.parentElement || canvas;
    const rect = parent.getBoundingClientRect?.() || { width: canvas.width || 640, height: canvas.height || 480 };
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    if (renderer && camera) {
      renderer.setSize(w, h, false);
      const aspect = w / h;
      camera.aspect = aspect;
      // Tall mobile: pull back + lower look so vessel stays on screen
      if (aspect < 0.75) {
        camera.fov = 48;
        camera.position.set(0.035, 0.14, 0.72);
        camera.lookAt(0.035, 0.095, 0);
      } else if (aspect < 1.1) {
        camera.fov = 44;
        camera.position.set(0.04, 0.15, 0.65);
        camera.lookAt(0.04, 0.1, 0);
      } else {
        camera.fov = 40;
        camera.position.set(0.05, 0.155, 0.58);
        camera.lookAt(0.05, 0.1, 0);
      }
      camera.updateProjectionMatrix();
    } else {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function loop(now) {
    if (destroyed) return;
    const t = typeof now === 'number' ? now : performance.now();
    const dt = lastFrameTime == null ? 1 / 60 : (t - lastFrameTime) / 1000;
    lastFrameTime = t;

    if (dragTarget === 'glass' && (state.liquidMl + state.foamMl) >= 25) {
      sipHold += dt;
      if (sipHold >= 0.28) {
        sipHold = 0;
        if (applySip(state, 55)) callSafely(sfx?.play, 'sip');
      }
    }

    stepPhysics(state, dt);
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
    state.targetVesselAngle = clamp(Number(angle) || 0, 0, 145);
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
    // Glass tilt removed — kept as no-op for API compatibility
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
      clientX: point.clientX,
      clientY: point.clientY,
    };
  }

  function setPointerNdc(pos) {
    pointerNdc.x = (pos.x / pos.w) * 2 - 1;
    pointerNdc.y = -(pos.y / pos.h) * 2 + 1;
  }

  function hitInteractive() {
    if (!use3d || !raycaster || !camera) return null;
    raycaster.setFromCamera(pointerNdc, camera);
    const roots = [vesselGroup, glassGroup].filter(Boolean);
    const hits = raycaster.intersectObjects(roots, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj) {
      if (obj.name === 'vessel' || obj === vesselGroup) return 'vessel';
      if (obj.name === 'glass' || obj === glassGroup) return 'glass';
      obj = obj.parent;
    }
    return null;
  }

  let dragStartY = 0;
  let dragStartAngle = 0;

  function onPointerDown(e) {
    const pos = getPos(e);
    setPointerNdc(pos);
    const hit = hitInteractive();

    if (hit === 'vessel') {
      dragTarget = 'vessel';
      if (!state.isOpened) triggerOpen();
      dragStartY = pos.y;
      dragStartAngle = state.targetVesselAngle;
      if (canvas.style) canvas.style.cursor = 'grabbing';
      return;
    }

    if (hit === 'glass') {
      dragTarget = 'glass';
      sipHold = 0.25; // immediate first sip on press if enough beer
      if (state.liquidMl + state.foamMl >= 25) {
        if (applySip(state, 70)) callSafely(sfx?.play, 'sip');
      }
      return;
    }

    // Empty space: still allow vessel tip drag (fallback UX)
    dragTarget = 'vessel';
    dragStartY = pos.y;
    dragStartAngle = state.targetVesselAngle;
  }

  function onPointerMove(e) {
    const pos = getPos(e);
    setPointerNdc(pos);

    if (!dragTarget) {
      const hit = hitInteractive();
      if (canvas.style) canvas.style.cursor = hit ? 'pointer' : 'grab';
      return;
    }

    if (e.cancelable) e.preventDefault();

    if (dragTarget === 'vessel') {
      // Drag down = tip more (natural pour gesture)
      setTilt(dragStartAngle + (pos.y - dragStartY) * 0.62);
    }
  }

  function onPointerUp() {
    if (dragTarget === 'vessel') {
      // Slight spring-back if barely tipped and not pouring
      if (state.targetVesselAngle < 35 && !state.autoPourMode) {
        state.targetVesselAngle = 0;
      }
    }
    dragTarget = null;
    sipHold = 0;
    if (canvas.style) canvas.style.cursor = 'grab';
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
    envRT?.dispose?.();
    pmrem?.dispose?.();
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
