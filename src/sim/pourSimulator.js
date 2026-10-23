const DEFAULT_BEER = {
  id: 'svabin',
  name: 'Svabin',
  subtitle: 'Remeslne pivo',
  epm: '11',
  liquidTop: '#e8a828',
  liquidMid: '#c67810',
  liquidBottom: '#8c4904',
  foamTone: '#fbf6ea',
  paperBg: '#ece3d2',
  inkPrimary: '#241e18',
  inkAccent: '#9b6318',
  haziness: 0.2,
  carbonation: 1,
  foamStability: 0.94,
  illustration: 'generic',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function callSafely(fn, ...args) {
  if (typeof fn !== 'function') return;
  try {
    fn(...args);
  } catch {
    // SFX is best-effort; rendering/physics should continue without audio.
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
    // ignore invalid URLs
  }
  return '';
}

const labelImageCache = new Map();

function getLabelImage(url) {
  const safe = safeImageUrl(url);
  if (!safe || typeof Image === 'undefined') return null;
  const cached = labelImageCache.get(safe);
  if (cached) return cached.ready ? cached.img : null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const entry = { img, ready: false };
  labelImageCache.set(safe, entry);
  img.onload = () => {
    entry.ready = true;
  };
  img.onerror = () => {
    labelImageCache.delete(safe);
  };
  img.src = safe;
  return null;
}

function drawCoverImage(ctx, img, x, y, w, h) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return false;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) * 0.5;
  const dy = y + (h - dh) * 0.42;
  ctx.drawImage(img, dx, dy, dw, dh);
  return true;
}

function drawCoverImageFull(ctx, img, x, y, w, h) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return false;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) * 0.5, y + (h - dh) * 0.5, dw, dh);
  return true;
}

let barBgEntry = null;

function getBarBackground() {
  if (typeof Image === 'undefined') return null;
  if (barBgEntry?.ready) return barBgEntry.img;
  if (barBgEntry) return null;
  const img = new Image();
  barBgEntry = { img, ready: false };
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';
  img.onload = () => {
    barBgEntry.ready = true;
  };
  img.onerror = () => {
    barBgEntry = null;
  };
  img.src = `${base}images/bar-bg.jpg`;
  return null;
}

function createInitialState() {
  const waveCount = 28;
  return {
    selectedBeer: DEFAULT_BEER,
    vesselType: 'can',
    glassType: 'mug',
    isOpened: false,
    openProgress: 0,
    vesselAngle: 0,
    targetVesselAngle: 0,
    glassTiltAngle: 28,
    targetGlassTiltAngle: 28,
    isGlassTiltedMode: true,
    vesselRemainingMl: 500,
    liquidMl: 0,
    foamMl: 0,
    maxGlassMl: 520,
    sipsTaken: 0,
    lacingRings: [],
    flowRate: 0,
    autoPourMode: null,
    waveCount,
    waveHeights: new Array(waveCount).fill(0),
    waveVelocities: new Array(waveCount).fill(0),
    bubbles: [],
    foamCells: [],
    mistParticles: [],
    condensationDrops: [],
    flyingCap: null,
    isDragging: false,
    dragStartY: 0,
    dragStartAngle: 0,
    pourLoopPlaying: false,
    foamFinished: false,
  };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

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
  const removeListeners = [];

  function emitHud() {
    const total = Math.round(state.liquidMl + state.foamMl);
    const foamPct = total > 15 ? Math.round((state.foamMl / total) * 100) : 0;
    let pourStyle = state.isOpened ? 'Otevřeno' : 'Zavřeno';
    if (total >= 30) {
      if (foamPct > 68) pourStyle = 'Mlíko';
      else if (total < 360 && foamPct >= 25) pourStyle = 'Šnyt';
      else if (foamPct >= 14 && foamPct <= 34) pourStyle = 'Hladinka';
      else if (foamPct < 14) pourStyle = 'Bez čepice';
      else pourStyle = 'Vysoká pěna';
    }

    callSafely(onHud, {
      liquidMl: `${Math.min(500, Math.round(state.liquidMl))} ml`,
      foamPct: `${foamPct} %`,
      pourStyle,
      canSip: total >= 40,
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

  function updatePourLoop() {
    if (state.flowRate > 0.05) {
      if (!state.pourLoopPlaying) {
        callSafely(sfx?.startLoop, 'pour-loop');
        state.pourLoopPlaying = true;
      }
    } else if (state.pourLoopPlaying) {
      callSafely(sfx?.stopLoop, 'pour-loop');
      state.pourLoopPlaying = false;
    }
  }

  function playFoamFinish() {
    if (state.foamFinished) return;
    state.foamFinished = true;
    callSafely(sfx?.play, 'foam');
  }

  function initCondensation() {
    state.condensationDrops = [];
    for (let i = 0; i < 48; i += 1) {
      state.condensationDrops.push({
        u: randomBetween(-0.825, 0.825),
        v: Math.random(),
        r: randomBetween(1, 3.1),
        slipSpeed: Math.random() < 0.15 ? randomBetween(0.0002, 0.0008) : 0,
      });
    }
  }

  function initFoamCells() {
    state.foamCells = [];
    for (let i = 0; i < 75; i += 1) {
      state.foamCells.push({
        u: randomBetween(-0.925, 0.925),
        v: Math.random(),
        r: randomBetween(1.8, 5.6),
      });
    }
  }

  function resizeCanvas() {
    const rect = container.getBoundingClientRect?.() || canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || 1);
    const height = Math.max(1, rect.height || 1);
    const dpr = Math.min(globalThis.devicePixelRatio || globalThis.window?.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0);
    renderScene();
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

  function evaluateTapsterPour() {
    const total = state.liquidMl + state.foamMl;
    if (total >= 80) playFoamFinish();
  }

  function updateAutoPour(fillRatio) {
    if (!state.autoPourMode) return;

    if (state.autoPourMode === 'hladinka') {
      if (fillRatio < 0.72) {
        state.targetGlassTiltAngle = 28;
        state.targetVesselAngle = 86;
      } else if (fillRatio < 0.96 && state.vesselRemainingMl > 10) {
        state.targetGlassTiltAngle = 0;
        state.targetVesselAngle = 112;
      } else {
        state.targetVesselAngle = 0;
        state.targetGlassTiltAngle = 0;
        state.autoPourMode = null;
        evaluateTapsterPour();
      }
    } else if (state.autoPourMode === 'snyt') {
      if (fillRatio < 0.42) {
        state.targetGlassTiltAngle = 20;
        state.targetVesselAngle = 92;
      } else if (fillRatio < 0.68) {
        state.targetGlassTiltAngle = 0;
        state.targetVesselAngle = 122;
      } else {
        state.targetVesselAngle = 0;
        state.targetGlassTiltAngle = 0;
        state.autoPourMode = null;
        evaluateTapsterPour();
      }
    } else if (state.autoPourMode === 'mliko') {
      if (fillRatio < 0.92 && state.vesselRemainingMl > 40) {
        state.targetGlassTiltAngle = 0;
        state.targetVesselAngle = 130;
      } else {
        state.targetVesselAngle = 0;
        state.targetGlassTiltAngle = 0;
        state.autoPourMode = null;
        evaluateTapsterPour();
      }
    }
  }

  function updatePhysics() {
    const beer = state.selectedBeer || DEFAULT_BEER;
    const totalInGlass = state.liquidMl + state.foamMl;
    const fillRatio = Math.min(1, totalInGlass / state.maxGlassMl);
    const previousFlowRate = state.flowRate;

    updateAutoPour(fillRatio);
    if (!state.autoPourMode) {
      if (fillRatio > 0.78 && state.isGlassTiltedMode) {
        const straightenFactor = Math.min(1, (fillRatio - 0.78) / 0.18);
        state.targetGlassTiltAngle = 28 * (1 - straightenFactor);
      } else if (state.isGlassTiltedMode) {
        state.targetGlassTiltAngle = 28;
      }
    }

    state.vesselAngle += (state.targetVesselAngle - state.vesselAngle) * 0.14;
    state.glassTiltAngle += (state.targetGlassTiltAngle - state.glassTiltAngle) * 0.12;
    if (state.isOpened && state.openProgress < 1) {
      state.openProgress = Math.min(1, state.openProgress + 0.12);
    }

    const minPourAngle = 42 + (1 - state.vesselRemainingMl / 500) * 38;
    if (
      state.isOpened &&
      state.vesselAngle > minPourAngle &&
      state.vesselRemainingMl > 0 &&
      totalInGlass < state.maxGlassMl * 1.03
    ) {
      const tiltExcess = (state.vesselAngle - minPourAngle) / (135 - minPourAngle);
      state.flowRate = clamp(Math.pow(tiltExcess, 1.15) * 3.4, 0.2, 3.4);
      const actualOut = Math.min(state.vesselRemainingMl, state.flowRate);
      state.vesselRemainingMl -= actualOut;

      const glassWallGentleFactor = Math.abs(state.glassTiltAngle) / 28;
      const pourHeightFactor = 1 - fillRatio * 0.55;
      const vigorFoamRatio = Math.min(
        0.82,
        (0.14 + tiltExcess * 0.36 * pourHeightFactor) *
          (1 - glassWallGentleFactor * 0.55) *
          beer.carbonation,
      );

      const addedFoam = actualOut * vigorFoamRatio * 1.35;
      const addedLiquid = actualOut * (1 - vigorFoamRatio * 0.65);
      state.liquidMl = Math.min(state.maxGlassMl, state.liquidMl + addedLiquid);
      state.foamMl = Math.min(state.maxGlassMl - state.liquidMl * 0.85, state.foamMl + addedFoam);

      const centerWave = Math.floor(state.waveCount / 2);
      state.waveVelocities[centerWave] -= state.flowRate * 0.5;
      const bubbleSpawnCount = Math.ceil(state.flowRate * 1.6 * beer.carbonation);
      for (let i = 0; i < bubbleSpawnCount && state.bubbles.length < 200; i += 1) {
        state.bubbles.push({
          u: randomBetween(-0.65, 0.65),
          v: Math.random() * 0.85,
          r: randomBetween(0.9, 3.3),
          vy: randomBetween(0.007, 0.021),
          wobble: Math.random() * Math.PI * 2,
        });
      }
    } else {
      if (previousFlowRate > 0.1 && totalInGlass > 80) evaluateTapsterPour();
      state.flowRate = 0;
    }

    updatePourLoop();
    updateParticles(beer);
    emitHud();
  }

  function updateParticles(beer) {
    if (state.foamMl > 2) {
      const settleRate = (1 - beer.foamStability) * 0.25 + 0.012;
      const settled = Math.min(state.foamMl, settleRate);
      state.foamMl -= settled;
      state.liquidMl = Math.min(state.maxGlassMl, state.liquidMl + settled * 0.35);
    }

    if (state.liquidMl > 40 && Math.random() < 0.4 * beer.carbonation && state.bubbles.length < 200) {
      state.bubbles.push({
        u: randomBetween(-0.6, 0.6),
        v: 0.02,
        r: randomBetween(0.8, 2.7),
        vy: randomBetween(0.006, 0.016),
        wobble: Math.random() * Math.PI * 2,
      });
    }

    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const b = state.bubbles[i];
      b.v += b.vy;
      b.wobble += 0.1;
      b.u += Math.sin(b.wobble) * 0.0035;
      if (b.v >= 1) state.bubbles.splice(i, 1);
    }

    for (let i = 0; i < state.waveCount; i += 1) {
      const force = -0.08 * state.waveHeights[i];
      state.waveVelocities[i] = (state.waveVelocities[i] + force) * 0.9;
      state.waveHeights[i] += state.waveVelocities[i];
    }
    for (let i = 0; i < state.waveCount; i += 1) {
      if (i > 0) state.waveVelocities[i - 1] += (state.waveHeights[i] - state.waveHeights[i - 1]) * 0.06;
      if (i < state.waveCount - 1) state.waveVelocities[i + 1] += (state.waveHeights[i] - state.waveHeights[i + 1]) * 0.06;
    }

    for (let i = state.mistParticles.length - 1; i >= 0; i -= 1) {
      const m = state.mistParticles[i];
      m.xOffset += m.vx;
      m.yOffset += m.vy;
      m.r += 0.3;
      m.alpha -= 0.014;
      if (m.alpha <= 0) state.mistParticles.splice(i, 1);
    }

    if (state.flyingCap) {
      state.flyingCap.x += state.flyingCap.vx;
      state.flyingCap.y += state.flyingCap.vy;
      state.flyingCap.vy += 0.46;
      state.flyingCap.angle += state.flyingCap.vAngle;
      if (state.flyingCap.y > 600) state.flyingCap = null;
    }
  }

  function getGlassProfile(normY, glassType, halfW) {
    if (glassType === 'teku') {
      if (normY < 0.05) return halfW * (0.66 - normY * 6);
      if (normY < 0.3) return halfW * 0.14;
      if (normY < 0.56) {
        const t = (normY - 0.3) / 0.26;
        return halfW * (0.14 + Math.sin(t * Math.PI * 0.5) * 0.92);
      }
      const t = (normY - 0.56) / 0.44;
      return halfW * (1.06 - t * 0.26);
    }
    if (glassType === 'pint') {
      const swell = Math.sin(Math.max(0, (normY - 0.6) / 0.4) * Math.PI) * 0.07;
      return halfW * (0.72 + normY * 0.27 + swell);
    }
    const barrelCurve = Math.sin(normY * Math.PI) * 0.14;
    return halfW * (0.86 + barrelCurve);
  }

  function renderScene() {
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    if (!W || !H) return;
    const beer = state.selectedBeer || DEFAULT_BEER;
    getLabelImage(beer.image);

    ctx.clearRect(0, 0, W, H);

    const tableY = H * 0.84;
    const barBg = getBarBackground();
    if (barBg) {
      ctx.save();
      drawCoverImageFull(ctx, barBg, 0, 0, W, tableY + 20);
      // Darken + warm grade so glass/vessel stay readable
      const grade = ctx.createLinearGradient(0, 0, 0, tableY);
      grade.addColorStop(0, 'rgba(8, 5, 3, 0.55)');
      grade.addColorStop(0.45, 'rgba(12, 8, 5, 0.42)');
      grade.addColorStop(1, 'rgba(6, 4, 2, 0.72)');
      ctx.fillStyle = grade;
      ctx.fillRect(0, 0, W, tableY + 20);
      const spotlight = ctx.createRadialGradient(W * 0.4, H * 0.35, 30, W * 0.4, H * 0.4, Math.max(W, H) * 0.55);
      spotlight.addColorStop(0, 'rgba(255, 200, 120, 0.08)');
      spotlight.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
      ctx.fillStyle = spotlight;
      ctx.fillRect(0, 0, W, tableY + 20);
      ctx.restore();
    } else {
      const wallGrad = ctx.createRadialGradient(W * 0.38, H * 0.22, 20, W * 0.42, H * 0.45, Math.max(W, H) * 0.85);
      wallGrad.addColorStop(0, '#3a2c20');
      wallGrad.addColorStop(0.35, '#1c1612');
      wallGrad.addColorStop(1, '#070605');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // Bar counter / table in front of photo
    const tableGrad = ctx.createLinearGradient(0, tableY - 10, 0, H);
    tableGrad.addColorStop(0, '#5a3d28');
    tableGrad.addColorStop(0.08, '#3a2618');
    tableGrad.addColorStop(0.35, '#22160f');
    tableGrad.addColorStop(1, '#0a0604');
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, tableY, W, H - tableY);
    ctx.save();
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 12; i += 1) {
      const y = tableY + 5 + i * ((H - tableY) / 12);
      ctx.strokeStyle = i % 2 === 0 ? '#a07850' : '#140c08';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.4, y - 2, W * 0.7, y + 2, W, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 220, 170, 0.12)';
    ctx.fillRect(0, tableY, W, 1.5);

    const scale = Math.min(1.12, Math.max(0.72, Math.min(W / 540, H / 540)));
    const glassCenterX = W * 0.39;
    const glassBottomY = tableY - 8 * scale;
    const glassH = 248 * scale;
    const glassHalfW = 67 * scale;
    const glassTiltRad = (state.glassTiltAngle * Math.PI) / 180;

    const shadowGrad = ctx.createRadialGradient(glassCenterX, glassBottomY + 4 * scale, 4, glassCenterX, glassBottomY + 4 * scale, glassHalfW * 1.55);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
    shadowGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(glassCenterX, glassBottomY + 4 * scale, glassHalfW * 1.45, 14 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const vesselPivotX = glassCenterX + 132 * scale;
    const vesselPivotY = glassBottomY - glassH - 48 * scale;
    const vesselTiltRad = (-state.vesselAngle * Math.PI) / 180;
    const canW = (state.vesselType === 'can' ? 78 : 70) * scale;
    const canH = (state.vesselType === 'can' ? 150 : 200) * scale;
    const localSpoutX = -canW * 0.28;
    const localSpoutY = -canH * 0.5;
    const spoutWorldX = vesselPivotX + (localSpoutX * Math.cos(vesselTiltRad) - localSpoutY * Math.sin(vesselTiltRad));
    const spoutWorldY = vesselPivotY + (localSpoutX * Math.sin(vesselTiltRad) + localSpoutY * Math.cos(vesselTiltRad));

    // Vessel shadow on table
    const vShadow = ctx.createRadialGradient(vesselPivotX - 10 * scale, tableY + 2, 4, vesselPivotX, tableY + 2, canW * 1.4);
    vShadow.addColorStop(0, 'rgba(0,0,0,0.45)');
    vShadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vShadow;
    ctx.beginPath();
    ctx.ellipse(vesselPivotX - 8 * scale, tableY + 2, canW * 1.1, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (state.flowRate > 0.05) {
      drawPourStream(spoutWorldX, spoutWorldY, glassCenterX, glassBottomY, glassH, glassTiltRad, scale, beer);
    }
    drawBeerGlass(glassCenterX, glassBottomY, glassH, glassHalfW, glassTiltRad, scale, beer);
    drawBeerVessel(vesselPivotX, vesselPivotY, canW, canH, vesselTiltRad, scale, beer);
    drawParticlesAndCap(spoutWorldX, spoutWorldY);
  }

  function drawPourStream(sx, sy, gx, gy, glassH, glassTiltRad, scale, beer) {
    const totalFill = Math.min(1, (state.liquidMl + state.foamMl * 0.7) / state.maxGlassMl);
    const minLevel = state.glassType === 'teku' ? 0.3 : 0.05;
    const currentNormY = minLevel + totalFill * (0.94 - minLevel);
    const localTargetY = -currentNormY * glassH;
    const localTargetX = state.isGlassTiltedMode ? 18 * scale : 0;
    const targetX = gx + (localTargetX * Math.cos(glassTiltRad) - localTargetY * Math.sin(glassTiltRad));
    const targetY = gy + (localTargetX * Math.sin(glassTiltRad) + localTargetY * Math.cos(glassTiltRad));
    const baseWidth = Math.max(2.2, Math.min(13, state.flowRate * 3.8)) * scale;
    const time = (globalThis.performance?.now?.() || Date.now()) * 0.001;

    const pointOnStream = (t, wobbleAmp) => {
      const wobble = Math.sin(time * 18 + t * 9) * wobbleAmp + Math.sin(time * 31 + t * 14) * wobbleAmp * 0.35;
      const x = sx + (targetX - sx) * t + wobble;
      const y = sy + (targetY - sy) * (t * t * 0.35 + t * 0.65);
      return { x, y };
    };

    ctx.save();
    // Soft shadow under stream
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = baseWidth * 1.35;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + 3);
    for (let i = 1; i <= 16; i += 1) {
      const p = pointOnStream(i / 16, 1.2 * scale);
      ctx.lineTo(p.x + 2, p.y + 3);
    }
    ctx.stroke();

    // Core amber body (multiple filaments)
    const filaments = [
      { offset: 0, width: 1, alpha: 0.95 },
      { offset: -0.55, width: 0.45, alpha: 0.55 },
      { offset: 0.5, width: 0.4, alpha: 0.5 },
    ];
    filaments.forEach((f) => {
      const grad = ctx.createLinearGradient(sx, sy, targetX, targetY);
      grad.addColorStop(0, beer.liquidBottom);
      grad.addColorStop(0.4, beer.liquidMid);
      grad.addColorStop(0.8, beer.liquidTop);
      grad.addColorStop(1, beer.foamTone);
      ctx.strokeStyle = grad;
      ctx.globalAlpha = f.alpha;
      ctx.lineWidth = baseWidth * f.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const start = pointOnStream(0, 0);
      ctx.moveTo(start.x + f.offset * baseWidth, start.y);
      for (let i = 1; i <= 20; i += 1) {
        const p = pointOnStream(i / 20, (2.4 + state.flowRate * 0.6) * scale);
        ctx.lineTo(p.x + f.offset * baseWidth, p.y);
      }
      ctx.stroke();
    });

    // Specular ribbon
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = 'rgba(255, 250, 235, 0.7)';
    ctx.lineWidth = Math.max(1, baseWidth * 0.18);
    ctx.beginPath();
    ctx.moveTo(sx - baseWidth * 0.15, sy);
    for (let i = 1; i <= 18; i += 1) {
      const p = pointOnStream(i / 18, 1.6 * scale);
      ctx.lineTo(p.x - baseWidth * 0.18, p.y);
    }
    ctx.stroke();

    // Droplet spray near spout + splash at impact
    ctx.globalAlpha = 1;
    const dropletCount = Math.min(18, Math.floor(state.flowRate * 6));
    for (let i = 0; i < dropletCount; i += 1) {
      const t = 0.05 + Math.random() * 0.35;
      const p = pointOnStream(t, 3.5 * scale);
      const r = (0.6 + Math.random() * 1.8) * scale;
      ctx.fillStyle = Math.random() > 0.45 ? beer.liquidTop : beer.foamTone;
      ctx.globalAlpha = 0.35 + Math.random() * 0.45;
      ctx.beginPath();
      ctx.arc(p.x + (Math.random() - 0.5) * 8 * scale, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Impact splash crown
    ctx.globalAlpha = Math.min(0.75, state.flowRate * 0.22);
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI / 2 + (i - 3) * 0.22;
      const len = (6 + state.flowRate * 3 + Math.sin(time * 40 + i) * 2) * scale;
      ctx.strokeStyle = beer.foamTone;
      ctx.lineWidth = 1.4 * scale;
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX + Math.cos(a) * len, targetY + Math.sin(a) * len * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  }

  function buildGlassPath(glassH, glassHalfW, inset = 0) {
    const steps = 40;
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const normY = i / steps;
      const w = Math.max(4, getGlassProfile(normY, state.glassType, glassHalfW) - inset);
      const y = -normY * glassH;
      if (i === 0) ctx.moveTo(-w, y);
      else ctx.lineTo(-w, y);
    }
    for (let i = steps; i >= 0; i -= 1) {
      const normY = i / steps;
      const w = Math.max(4, getGlassProfile(normY, state.glassType, glassHalfW) - inset);
      const y = -normY * glassH;
      ctx.lineTo(w, y);
    }
    ctx.closePath();
  }

  function drawBeerGlass(gx, gy, glassH, glassHalfW, glassTiltRad, scale, beer) {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(glassTiltRad);

    const thickness = 5.5 * scale;
    const rimY = -glassH * 0.985;
    const rimOuterW = getGlassProfile(0.985, state.glassType, glassHalfW);
    const rimInnerW = Math.max(6, rimOuterW - thickness * 0.85);
    const rimEllipseH = 7.5 * scale;
    const baseY = 0;
    const baseOuterW = getGlassProfile(0.02, state.glassType, glassHalfW);

    // Foot / base ellipse (3D contact with table)
    ctx.save();
    const footGrad = ctx.createRadialGradient(0, baseY, 2, 0, baseY, baseOuterW * 1.15);
    footGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
    footGrad.addColorStop(0.55, 'rgba(200,200,200,0.08)');
    footGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = footGrad;
    ctx.beginPath();
    ctx.ellipse(0, baseY + 2 * scale, baseOuterW * 1.08, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mug handle on the left
    if (state.glassType === 'mug') {
      ctx.save();
      ctx.strokeStyle = 'rgba(220, 220, 220, 0.22)';
      ctx.lineWidth = 14 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-glassHalfW * 0.9, -glassH * 0.74);
      ctx.bezierCurveTo(-glassHalfW * 1.58, -glassH * 0.76, -glassHalfW * 1.58, -glassH * 0.28, -glassHalfW * 0.88, -glassH * 0.3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 3.5 * scale;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(-glassHalfW * 0.92, -glassH * 0.72);
      ctx.bezierCurveTo(-glassHalfW * 1.48, -glassH * 0.72, -glassHalfW * 1.48, -glassH * 0.32, -glassHalfW * 0.9, -glassH * 0.32);
      ctx.stroke();
      ctx.restore();
    }

    // Outer glass shell (translucent volume)
    buildGlassPath(glassH, glassHalfW);
    const shellGrad = ctx.createLinearGradient(-glassHalfW, 0, glassHalfW, 0);
    shellGrad.addColorStop(0, 'rgba(210, 230, 255, 0.16)');
    shellGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0.05)');
    shellGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    shellGrad.addColorStop(0.82, 'rgba(255, 255, 255, 0.06)');
    shellGrad.addColorStop(1, 'rgba(180, 200, 230, 0.18)');
    ctx.fillStyle = shellGrad;
    ctx.fill();

    // Inner cavity + liquid (clipped to inner wall for thickness)
    ctx.save();
    buildGlassPath(glassH, glassHalfW, thickness);
    ctx.clip();
    drawGlassContents(glassH, glassHalfW, glassTiltRad, scale, beer);
    // Inner wall refraction tint
    const innerTint = ctx.createLinearGradient(-glassHalfW, 0, glassHalfW, 0);
    innerTint.addColorStop(0, 'rgba(255,255,255,0.08)');
    innerTint.addColorStop(0.5, 'rgba(255,255,255,0)');
    innerTint.addColorStop(1, 'rgba(120,160,200,0.1)');
    ctx.fillStyle = innerTint;
    ctx.fillRect(-glassHalfW * 1.2, -glassH, glassHalfW * 2.4, glassH + 20);
    ctx.restore();

    // Glass wall thickness band (outer stroke vs inner)
    buildGlassPath(glassH, glassHalfW);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.6 * scale;
    ctx.stroke();
    buildGlassPath(glassH, glassHalfW, thickness);
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.22)';
    ctx.lineWidth = 1.1 * scale;
    ctx.stroke();

    // 3D rim: outer + inner ellipses (looks into the glass)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.ellipse(0, rimY, rimOuterW, rimEllipseH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10, 12, 16, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, rimY + 0.8 * scale, rimInnerW, rimEllipseH * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.ellipse(0, rimY, rimOuterW, rimEllipseH, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.ellipse(0, rimY + 1.2 * scale, rimInnerW, rimEllipseH * 0.7, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();

    // Primary specular (left) + secondary (right) for 3D cylinder
    const reflGrad = ctx.createLinearGradient(0, -glassH * 0.95, 0, -glassH * 0.15);
    reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    reflGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.18)');
    reflGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = reflGrad;
    ctx.lineWidth = 6 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 0.7, -glassH * 0.9);
    ctx.quadraticCurveTo(-glassHalfW * 0.74, -glassH * 0.55, -glassHalfW * 0.62, -glassH * 0.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(glassHalfW * 0.58, -glassH * 0.82);
    ctx.lineTo(glassHalfW * 0.55, -glassH * 0.28);
    ctx.stroke();

    // Etched brand
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#f5f0e6';
    ctx.font = `500 ${Math.round(11 * scale)}px Fraunces, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Švabín', 0, -glassH * 0.58);
    ctx.restore();
    ctx.restore();
  }

  function drawGlassContents(glassH, glassHalfW, glassTiltRad, scale, beer) {
    const minBowlY = state.glassType === 'teku' ? 0.31 : 0.065;
    const usableH = glassH * (0.96 - minBowlY);
    const baseBowlPx = -minBowlY * glassH;
    const liquidRatio = Math.min(1, state.liquidMl / state.maxGlassMl);
    const foamRatio = Math.min(1 - liquidRatio * 0.85, state.foamMl / state.maxGlassMl);
    const liquidTopY = baseBowlPx - liquidRatio * usableH;
    const foamTopY = liquidTopY - foamRatio * usableH;
    const surfaceSlope = Math.tan(-glassTiltRad * 0.78) * glassHalfW;

    if (state.lacingRings.length > 0) {
      ctx.strokeStyle = 'rgba(250, 244, 232, 0.42)';
      ctx.lineWidth = 3 * scale;
      state.lacingRings.forEach((rRatio) => {
        const ringY = baseBowlPx - rRatio * usableH;
        ctx.beginPath();
        ctx.moveTo(-glassHalfW * 1.2, ringY);
        ctx.quadraticCurveTo(0, ringY + 4 * scale, glassHalfW * 1.2, ringY);
        ctx.stroke();
      });
    }

    if (state.liquidMl > 2) {
      const liqGrad = ctx.createLinearGradient(0, foamTopY, 0, baseBowlPx);
      liqGrad.addColorStop(0, beer.liquidTop);
      liqGrad.addColorStop(0.5, beer.liquidMid);
      liqGrad.addColorStop(1, beer.liquidBottom);
      ctx.fillStyle = liqGrad;
      ctx.beginPath();
      ctx.moveTo(-glassHalfW * 1.3, baseBowlPx + 20);
      ctx.lineTo(-glassHalfW * 1.3, liquidTopY - surfaceSlope);
      for (let i = 0; i < state.waveCount; i += 1) {
        const t = i / (state.waveCount - 1);
        const wx = (-1.2 + t * 2.4) * glassHalfW;
        const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
        const wy = liquidTopY + tiltOffset + state.waveHeights[i] * scale;
        ctx.lineTo(wx, wy);
      }
      ctx.lineTo(glassHalfW * 1.3, baseBowlPx + 20);
      ctx.closePath();
      ctx.fill();

      const sssGrad = ctx.createRadialGradient(0, (liquidTopY + baseBowlPx) * 0.52, 4, 0, (liquidTopY + baseBowlPx) * 0.52, glassHalfW * 0.95);
      sssGrad.addColorStop(0, `rgba(255, 220, 120, ${0.24 + beer.haziness * 0.18})`);
      sssGrad.addColorStop(0.7, 'rgba(255, 190, 70, 0.05)');
      sssGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
      ctx.fillStyle = sssGrad;
      ctx.fillRect(-glassHalfW * 1.2, foamTopY, glassHalfW * 2.4, usableH);

      ctx.fillStyle = 'rgba(255, 248, 230, 0.42)';
      state.bubbles.forEach((b) => {
        const bx = b.u * glassHalfW * 0.85;
        const by = baseBowlPx - b.v * (liquidRatio * usableH);
        if (by > liquidTopY) {
          ctx.beginPath();
          ctx.arc(bx, by, b.r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    if (state.foamMl > 2) {
      const foamGrad = ctx.createLinearGradient(0, foamTopY - 10 * scale, 0, liquidTopY + 8 * scale);
      foamGrad.addColorStop(0, '#ffffff');
      foamGrad.addColorStop(0.65, beer.foamTone);
      foamGrad.addColorStop(1, '#dfd3be');
      ctx.fillStyle = foamGrad;
      ctx.beginPath();
      ctx.moveTo(-glassHalfW * 1.3, liquidTopY - surfaceSlope + 4 * scale);
      for (let i = 0; i < state.waveCount; i += 1) {
        const t = i / (state.waveCount - 1);
        const wx = (-1.2 + t * 2.4) * glassHalfW;
        const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
        const dome = Math.sin(t * Math.PI) * 7 * scale;
        const wy = foamTopY + tiltOffset - dome + state.waveHeights[i] * 0.6 * scale;
        ctx.lineTo(wx, wy);
      }
      for (let i = state.waveCount - 1; i >= 0; i -= 1) {
        const t = i / (state.waveCount - 1);
        const wx = (-1.2 + t * 2.4) * glassHalfW;
        const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
        const wy = liquidTopY + tiltOffset + state.waveHeights[i] * scale + 3 * scale;
        ctx.lineTo(wx, wy);
      }
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(195, 178, 150, 0.18)';
      const foamHeightPx = Math.max(4, liquidTopY - foamTopY);
      state.foamCells.forEach((cell) => {
        const cx = cell.u * glassHalfW * 0.85;
        const cy = foamTopY + cell.u * 0.5 * surfaceSlope + cell.v * foamHeightPx;
        ctx.beginPath();
        ctx.arc(cx, cy, cell.r * scale * 0.65, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (state.liquidMl + state.foamMl > 40) {
      const dewAlpha = Math.min(0.32, ((state.liquidMl + state.foamMl) / state.maxGlassMl) * 0.32);
      ctx.fillStyle = `rgba(255, 252, 245, ${dewAlpha})`;
      state.condensationDrops.forEach((drop) => {
        if (drop.slipSpeed > 0) {
          drop.v -= drop.slipSpeed;
          if (drop.v < 0.08) drop.v = 0.88;
        }
        const dx = drop.u * glassHalfW * 0.88;
        const dy = baseBowlPx - drop.v * usableH;
        if (dy > foamTopY) {
          ctx.beginPath();
          ctx.arc(dx, dy, drop.r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }

  function drawBeerVessel(vx, vy, canW, canH, vesselTiltRad, scale, beer) {
    ctx.save();
    ctx.translate(vx, vy);
    ctx.rotate(vesselTiltRad);
    const halfW = canW * 0.5;
    const halfH = canH * 0.5;
    const labelImg = getLabelImage(beer.image);

    if (state.vesselType === 'can') {
      // Aluminum body
      const bodyGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
      bodyGrad.addColorStop(0, '#1a1a1a');
      bodyGrad.addColorStop(0.18, '#6e6a66');
      bodyGrad.addColorStop(0.42, '#c8c4bf');
      bodyGrad.addColorStop(0.58, '#9a9691');
      bodyGrad.addColorStop(0.82, '#3a3835');
      bodyGrad.addColorStop(1, '#121110');
      ctx.beginPath();
      ctx.roundRect(-halfW, -halfH, canW, canH, 7 * scale);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Product wrap (real packshot)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-halfW + 1.5 * scale, -halfH + 10 * scale, canW - 3 * scale, canH - 22 * scale, 4 * scale);
      ctx.clip();
      const drew = drawCoverImage(ctx, labelImg, -halfW, -halfH + 6 * scale, canW, canH - 14 * scale);
      if (!drew) {
        const fallback = ctx.createLinearGradient(0, -halfH, 0, halfH);
        fallback.addColorStop(0, beer.paperBg || '#e8dfd0');
        fallback.addColorStop(1, beer.liquidMid || '#c67810');
        ctx.fillStyle = fallback;
        ctx.fillRect(-halfW, -halfH, canW, canH);
        ctx.fillStyle = beer.inkPrimary || '#1a1510';
        ctx.font = `600 ${Math.round(14 * scale)}px Fraunces, Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText(beer.name || 'Švabín', 0, 4 * scale);
      }
      ctx.restore();

      // Cylindrical specular / rim occlusion
      const cylShadow = ctx.createLinearGradient(-halfW, 0, halfW, 0);
      cylShadow.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
      cylShadow.addColorStop(0.22, 'rgba(0, 0, 0, 0.12)');
      cylShadow.addColorStop(0.38, 'rgba(255, 255, 255, 0.22)');
      cylShadow.addColorStop(0.48, 'rgba(255, 255, 255, 0.05)');
      cylShadow.addColorStop(0.7, 'rgba(0, 0, 0, 0.18)');
      cylShadow.addColorStop(1, 'rgba(0, 0, 0, 0.68)');
      ctx.fillStyle = cylShadow;
      ctx.beginPath();
      ctx.roundRect(-halfW, -halfH, canW, canH, 7 * scale);
      ctx.fill();

      // Top lid ring
      const lid = ctx.createLinearGradient(0, -halfH - 2 * scale, 0, -halfH + 10 * scale);
      lid.addColorStop(0, '#eceae7');
      lid.addColorStop(1, '#8a8681');
      ctx.fillStyle = lid;
      ctx.beginPath();
      ctx.ellipse(0, -halfH + 2 * scale, halfW * 0.92, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stay-tab
      ctx.save();
      ctx.translate(-halfW * 0.28, -halfH - 1 * scale);
      ctx.rotate(-state.openProgress * 0.85);
      const tabGrad = ctx.createLinearGradient(0, -2, 0, 6);
      tabGrad.addColorStop(0, '#f0eeeb');
      tabGrad.addColorStop(1, '#7a7772');
      ctx.fillStyle = tabGrad;
      ctx.beginPath();
      ctx.roundRect(-6 * scale, -3 * scale, 16 * scale, 5 * scale, 1.5 * scale);
      ctx.fill();
      ctx.restore();
    } else {
      const bHalfW = canW * 0.52;
      const bottlePath = () => {
        ctx.beginPath();
        ctx.moveTo(-bHalfW * 0.3, -halfH);
        ctx.lineTo(bHalfW * 0.3, -halfH);
        ctx.bezierCurveTo(bHalfW * 0.34, -halfH + 42 * scale, bHalfW, -halfH + 62 * scale, bHalfW, -halfH + 92 * scale);
        ctx.lineTo(bHalfW, halfH - 10 * scale);
        ctx.quadraticCurveTo(bHalfW, halfH, bHalfW - 10 * scale, halfH);
        ctx.lineTo(-bHalfW + 10 * scale, halfH);
        ctx.quadraticCurveTo(-bHalfW, halfH, -bHalfW, halfH - 10 * scale);
        ctx.lineTo(-bHalfW, -halfH + 92 * scale);
        ctx.bezierCurveTo(-bHalfW, -halfH + 62 * scale, -bHalfW * 0.34, -halfH + 42 * scale, -bHalfW * 0.3, -halfH);
        ctx.closePath();
      };

      const bottleGrad = ctx.createLinearGradient(-bHalfW, 0, bHalfW, 0);
      bottleGrad.addColorStop(0, '#0a0502');
      bottleGrad.addColorStop(0.28, '#5a2a0c');
      bottleGrad.addColorStop(0.5, '#8a4518');
      bottleGrad.addColorStop(0.72, '#3a1808');
      bottleGrad.addColorStop(1, '#080401');
      bottlePath();
      ctx.fillStyle = bottleGrad;
      ctx.fill();

      // Label / packshot on shoulder+body
      ctx.save();
      bottlePath();
      ctx.clip();
      const bLabelY = -halfH + 78 * scale;
      const drew = drawCoverImage(ctx, labelImg, -bHalfW, bLabelY - 20 * scale, bHalfW * 2, 120 * scale);
      if (!drew) {
        ctx.fillStyle = beer.paperBg || '#e8dfd0';
        ctx.fillRect(-bHalfW + 3 * scale, bLabelY, bHalfW * 2 - 6 * scale, 78 * scale);
        ctx.fillStyle = beer.inkPrimary || '#1a1510';
        ctx.font = `700 ${Math.round(12 * scale)}px Fraunces, Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText(beer.name || 'Švabín', 0, bLabelY + 42 * scale);
      }
      // Glass edge darkening
      const edge = ctx.createLinearGradient(-bHalfW, 0, bHalfW, 0);
      edge.addColorStop(0, 'rgba(0,0,0,0.55)');
      edge.addColorStop(0.35, 'rgba(0,0,0,0)');
      edge.addColorStop(0.65, 'rgba(255,200,120,0.08)');
      edge.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = edge;
      ctx.fillRect(-bHalfW, -halfH, bHalfW * 2, canH);
      ctx.restore();

      // Neck highlight
      ctx.strokeStyle = 'rgba(255, 220, 160, 0.18)';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(-bHalfW * 0.18, -halfH + 8 * scale);
      ctx.lineTo(-bHalfW * 0.18, -halfH + 55 * scale);
      ctx.stroke();

      if (!state.isOpened) {
        const cork = ctx.createLinearGradient(0, -halfH - 6 * scale, 0, -halfH + 4 * scale);
        cork.addColorStop(0, '#d4a574');
        cork.addColorStop(1, '#8a5a2e');
        ctx.fillStyle = cork;
        ctx.beginPath();
        ctx.roundRect(-bHalfW * 0.34, -halfH - 6 * scale, bHalfW * 0.68, 10 * scale, 2 * scale);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(-bHalfW * 0.34, -halfH - 1 * scale, bHalfW * 0.68, 2 * scale);
      }
    }

    if (!state.isOpened) {
      ctx.fillStyle = 'rgba(20, 16, 12, 0.82)';
      ctx.strokeStyle = 'rgba(200, 138, 54, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-56 * scale, -halfH - 36 * scale, 112 * scale, 22 * scale, 5 * scale);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f3ede2';
      ctx.font = `500 ${Math.round(8.5 * scale)}px DM Sans, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Klikni pro otevření', 0, -halfH - 21 * scale);
    }
    ctx.restore();
  }

  function drawParticlesAndCap(spoutX, spoutY) {
    state.mistParticles.forEach((m) => {
      ctx.fillStyle = `rgba(243, 237, 226, ${m.alpha})`;
      ctx.beginPath();
      ctx.arc(spoutX + m.xOffset, spoutY + m.yOffset, m.r, 0, Math.PI * 2);
      ctx.fill();
    });
    if (state.flyingCap) {
      ctx.save();
      ctx.translate(spoutX + state.flyingCap.x, spoutY + state.flyingCap.y);
      ctx.rotate(state.flyingCap.angle);
      ctx.fillStyle = '#c88a36';
      ctx.fillRect(-11, -4, 22, 7);
      ctx.restore();
    }
  }

  function loop() {
    if (destroyed) return;
    updatePhysics();
    renderScene();
    frameId = globalThis.requestAnimationFrame?.(loop) ?? null;
  }

  function reset() {
    callSafely(sfx?.stopLoop, 'pour-loop');
    state.isOpened = false;
    state.openProgress = 0;
    state.vesselAngle = 0;
    state.targetVesselAngle = 0;
    state.isGlassTiltedMode = true;
    state.glassTiltAngle = 28;
    state.targetGlassTiltAngle = 28;
    state.vesselRemainingMl = 500;
    state.liquidMl = 0;
    state.foamMl = 0;
    state.flowRate = 0;
    state.autoPourMode = null;
    state.sipsTaken = 0;
    state.lacingRings = [];
    state.bubbles = [];
    state.mistParticles = [];
    state.flyingCap = null;
    state.pourLoopPlaying = false;
    state.foamFinished = false;
    initCondensation();
    initFoamCells();
    emitHud();
    renderScene();
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
    renderScene();
  }

  function toggleGlassTilt() {
    state.isGlassTiltedMode = !state.isGlassTiltedMode;
    state.targetGlassTiltAngle = state.isGlassTiltedMode ? 28 : 0;
    emitHud();
  }

  function startMasterPour(style) {
    if (state.liquidMl + state.foamMl >= state.maxGlassMl * 0.92 || state.vesselRemainingMl <= 20) reset();
    if (!state.isOpened) triggerOpen();
    state.autoPourMode = ['hladinka', 'snyt', 'mliko'].includes(style) ? style : 'hladinka';
    state.foamFinished = false;
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

  function onPointerDown(e) {
    const pos = getPos(e);
    if (!state.isOpened && pos.y < pos.h * 0.58) triggerOpen();
    state.isDragging = true;
    state.dragStartY = pos.y;
    state.dragStartAngle = state.targetVesselAngle;
  }

  function onPointerMove(e) {
    if (!state.isDragging) return;
    if (e.cancelable) e.preventDefault();
    const pos = getPos(e);
    setTilt(state.dragStartAngle + (pos.y - state.dragStartY) * 0.55);
  }

  function onPointerUp() {
    state.isDragging = false;
  }

  function addListener(target, type, handler, options) {
    target?.addEventListener?.(type, handler, options);
    removeListeners.push(() => target?.removeEventListener?.(type, handler, options));
  }

  function setupEvents() {
    addListener(canvas, 'mousedown', onPointerDown);
    addListener(globalThis.window, 'mousemove', onPointerMove);
    addListener(globalThis.window, 'mouseup', onPointerUp);
    addListener(canvas, 'touchstart', onPointerDown, { passive: true });
    addListener(globalThis.window, 'touchmove', onPointerMove, { passive: false });
    addListener(globalThis.window, 'touchend', onPointerUp);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    callSafely(sfx?.stopLoop, 'pour-loop');
    if (frameId != null) globalThis.cancelAnimationFrame?.(frameId);
    resizeObserver?.disconnect?.();
    removeListeners.splice(0).forEach((remove) => remove());
  }

  initCondensation();
  initFoamCells();
  getBarBackground();
  setupEvents();
  if (typeof globalThis.ResizeObserver === 'function') {
    resizeObserver = new globalThis.ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
  } else {
    addListener(globalThis.window, 'resize', resizeCanvas);
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
