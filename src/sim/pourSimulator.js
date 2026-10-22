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
    glassTiltAngle: -28,
    targetGlassTiltAngle: -28,
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
        state.targetGlassTiltAngle = -28;
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
        state.targetGlassTiltAngle = -20;
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
        state.targetGlassTiltAngle = -28 * (1 - straightenFactor);
      } else if (state.isGlassTiltedMode) {
        state.targetGlassTiltAngle = -28;
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

    ctx.clearRect(0, 0, W, H);
    const wallGrad = ctx.createRadialGradient(W * 0.45, H * 0.48, 30, W * 0.45, H * 0.48, Math.max(W, H) * 0.7);
    wallGrad.addColorStop(0, '#27211b');
    wallGrad.addColorStop(0.55, '#191512');
    wallGrad.addColorStop(1, '#110e0c');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, W, H);

    const tableY = H * 0.85;
    const tableGrad = ctx.createLinearGradient(0, tableY, 0, H);
    tableGrad.addColorStop(0, '#332419');
    tableGrad.addColorStop(0.08, '#261a11');
    tableGrad.addColorStop(0.4, '#1b120c');
    tableGrad.addColorStop(1, '#0f0a06');
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, tableY, W, H - tableY);
    ctx.fillStyle = 'rgba(243, 237, 226, 0.06)';
    ctx.fillRect(0, tableY, W, 1.5);

    const scale = Math.min(1.1, Math.max(0.7, Math.min(W / 540, H / 540)));
    const glassCenterX = W * 0.41;
    const glassBottomY = tableY - 10 * scale;
    const glassH = 248 * scale;
    const glassHalfW = 67 * scale;
    const glassTiltRad = (state.glassTiltAngle * Math.PI) / 180;

    const shadowGrad = ctx.createRadialGradient(glassCenterX, glassBottomY + 4 * scale, 5, glassCenterX, glassBottomY + 4 * scale, glassHalfW * 1.35);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(glassCenterX, glassBottomY + 4 * scale, glassHalfW * 1.3, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const vesselPivotX = glassCenterX + 126 * scale;
    const vesselPivotY = glassBottomY - glassH - 52 * scale;
    const vesselTiltRad = (-state.vesselAngle * Math.PI) / 180;
    const canW = (state.vesselType === 'can' ? 76 : 68) * scale;
    const canH = (state.vesselType === 'can' ? 146 : 196) * scale;
    const localSpoutX = -canW * 0.28;
    const localSpoutY = -canH * 0.5;
    const spoutWorldX = vesselPivotX + (localSpoutX * Math.cos(vesselTiltRad) - localSpoutY * Math.sin(vesselTiltRad));
    const spoutWorldY = vesselPivotY + (localSpoutX * Math.sin(vesselTiltRad) + localSpoutY * Math.cos(vesselTiltRad));

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
    const streamWidth = Math.max(2.5, Math.min(11, state.flowRate * 3.4)) * scale;
    const time = (globalThis.performance?.now?.() || Date.now()) * 0.014;

    ctx.save();
    const streamGrad = ctx.createLinearGradient(sx, sy, targetX, targetY);
    streamGrad.addColorStop(0, beer.liquidMid);
    streamGrad.addColorStop(0.65, beer.liquidTop);
    streamGrad.addColorStop(1, beer.foamTone);
    ctx.strokeStyle = streamGrad;
    ctx.lineWidth = streamWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const cpX = sx + (targetX - sx) * 0.55 + Math.sin(time) * 2.5;
    const cpY = sy + (targetY - sy) * 0.25;
    ctx.quadraticCurveTo(cpX, cpY, targetX, targetY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.38)';
    ctx.lineWidth = streamWidth * 0.26;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cpX, cpY, targetX, targetY);
    ctx.stroke();
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

    if (state.glassType === 'mug') {
      ctx.save();
      ctx.strokeStyle = 'rgba(243, 237, 226, 0.16)';
      ctx.lineWidth = 13 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(glassHalfW * 0.88, -glassH * 0.76);
      ctx.bezierCurveTo(glassHalfW * 1.52, -glassH * 0.78, glassHalfW * 1.52, -glassH * 0.24, glassHalfW * 0.86, -glassH * 0.26);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
      ctx.restore();
    }

    buildGlassPath(glassH, glassHalfW);
    const glassBodyGrad = ctx.createLinearGradient(-glassHalfW, 0, glassHalfW, 0);
    glassBodyGrad.addColorStop(0, 'rgba(255, 252, 245, 0.13)');
    glassBodyGrad.addColorStop(0.2, 'rgba(255, 252, 245, 0.03)');
    glassBodyGrad.addColorStop(0.8, 'rgba(255, 252, 245, 0.03)');
    glassBodyGrad.addColorStop(1, 'rgba(255, 252, 245, 0.16)');
    ctx.fillStyle = glassBodyGrad;
    ctx.fill();

    ctx.save();
    buildGlassPath(glassH, glassHalfW, 4.5 * scale);
    ctx.clip();
    drawGlassContents(glassH, glassHalfW, glassTiltRad, scale, beer);
    ctx.restore();

    buildGlassPath(glassH, glassHalfW);
    ctx.strokeStyle = 'rgba(243, 237, 226, 0.22)';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    const reflGrad = ctx.createLinearGradient(0, -glassH * 0.9, 0, -glassH * 0.25);
    reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    reflGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
    reflGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = reflGrad;
    ctx.lineWidth = 6 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 0.68, -glassH * 0.86);
    ctx.lineTo(-glassHalfW * 0.63, -glassH * 0.28);
    ctx.stroke();

    ctx.fillStyle = 'rgba(243, 237, 226, 0.55)';
    ctx.font = `600 ${Math.round(13.5 * scale)}px Fraunces, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Svabin', 0, -glassH * 0.68);
    ctx.font = `500 ${Math.round(7 * scale)}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(243, 237, 226, 0.38)';
    ctx.fillText('ZAL. 1567 - 0,5 l', 0, -glassH * 0.68 + 10 * scale);
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

    if (state.vesselType === 'can') {
      ctx.beginPath();
      ctx.roundRect(-halfW, -halfH, canW, canH, 8 * scale);
      ctx.fillStyle = '#262421';
      ctx.fill();
      const labelTop = -halfH + 8 * scale;
      const labelH = canH - 16 * scale;
      ctx.fillStyle = beer.paperBg;
      ctx.fillRect(-halfW, labelTop, canW, labelH);
      drawWoodcutCharacterIllustration(0, -6 * scale, 24 * scale, beer.illustration, beer.inkPrimary, beer.inkAccent);
      ctx.fillStyle = beer.inkPrimary;
      ctx.font = `600 ${Math.round(8.5 * scale)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('PIVOVAR SVABIN', 0, labelTop + 16 * scale);
      ctx.font = `700 ${Math.round(13.5 * scale)}px Fraunces, Georgia, serif`;
      ctx.fillText(beer.name, 0, halfH - 28 * scale);
      ctx.fillStyle = beer.inkAccent;
      ctx.font = `600 ${Math.round(7.5 * scale)}px Inter, sans-serif`;
      ctx.fillText(`${beer.subtitle} - ${beer.epm}`, 0, halfH - 16 * scale);
      const cylShadow = ctx.createLinearGradient(-halfW, 0, halfW, 0);
      cylShadow.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
      cylShadow.addColorStop(0.38, 'rgba(255, 252, 245, 0.16)');
      cylShadow.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      ctx.fillStyle = cylShadow;
      ctx.fillRect(-halfW, -halfH, canW, canH);
      ctx.fillStyle = '#d6d3d1';
      ctx.save();
      ctx.translate(-halfW * 0.35, -halfH - 4 * scale);
      ctx.rotate(-state.openProgress * 0.72);
      ctx.fillRect(-5 * scale, -4 * scale, 14 * scale, 4 * scale);
      ctx.restore();
    } else {
      const bHalfW = canW * 0.52;
      const bottleGrad = ctx.createLinearGradient(-bHalfW, 0, bHalfW, 0);
      bottleGrad.addColorStop(0, '#140b05');
      bottleGrad.addColorStop(0.32, '#42200b');
      bottleGrad.addColorStop(0.68, '#261206');
      bottleGrad.addColorStop(1, '#0d0602');
      ctx.fillStyle = bottleGrad;
      ctx.beginPath();
      ctx.moveTo(-bHalfW * 0.33, -halfH);
      ctx.lineTo(bHalfW * 0.33, -halfH);
      ctx.bezierCurveTo(bHalfW * 0.37, -halfH + 45 * scale, bHalfW, -halfH + 65 * scale, bHalfW, -halfH + 95 * scale);
      ctx.lineTo(bHalfW, halfH - 10 * scale);
      ctx.quadraticCurveTo(bHalfW, halfH, bHalfW - 10 * scale, halfH);
      ctx.lineTo(-bHalfW + 10 * scale, halfH);
      ctx.quadraticCurveTo(-bHalfW, halfH, -bHalfW, halfH - 10 * scale);
      ctx.lineTo(-bHalfW, -halfH + 95 * scale);
      ctx.bezierCurveTo(-bHalfW, -halfH + 65 * scale, -bHalfW * 0.37, -halfH + 45 * scale, -bHalfW * 0.33, -halfH);
      ctx.closePath();
      ctx.fill();
      const bLabelY = -halfH + 94 * scale;
      const bLabelH = 82 * scale;
      ctx.fillStyle = beer.paperBg;
      ctx.fillRect(-bHalfW + 2 * scale, bLabelY, bHalfW * 2 - 4 * scale, bLabelH);
      drawWoodcutCharacterIllustration(0, bLabelY + 30 * scale, 16 * scale, beer.illustration, beer.inkPrimary, beer.inkAccent);
      ctx.fillStyle = beer.inkPrimary;
      ctx.font = `700 ${Math.round(11.5 * scale)}px Fraunces, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(beer.name, 0, bLabelY + 62 * scale);
      ctx.fillStyle = beer.inkAccent;
      ctx.font = `600 ${Math.round(7 * scale)}px Inter, sans-serif`;
      ctx.fillText(`SVABIN - ${beer.epm}`, 0, bLabelY + 73 * scale);
      if (!state.isOpened) {
        ctx.fillStyle = '#c88a36';
        ctx.beginPath();
        ctx.roundRect(-bHalfW * 0.38, -halfH - 5 * scale, bHalfW * 0.76, 8 * scale, 2 * scale);
        ctx.fill();
      }
    }

    if (!state.isOpened) {
      ctx.fillStyle = '#231f1a';
      ctx.strokeStyle = '#c88a36';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-52 * scale, -halfH - 33 * scale, 104 * scale, 20 * scale, 4 * scale);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f3ede2';
      ctx.font = `600 ${Math.round(8.5 * scale)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Klikni pro otevreni', 0, -halfH - 20 * scale);
    }
    ctx.restore();
  }

  function drawWoodcutCharacterIllustration(x, y, r, type, inkColor, accentColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = `${accentColor}18`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = inkColor;
    ctx.lineWidth = 1.4;

    if (type === 'wolf') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.65);
      ctx.lineTo(-r * 0.2, -r * 0.25);
      ctx.lineTo(r * 0.2, -r * 0.25);
      ctx.lineTo(r * 0.55, -r * 0.65);
      ctx.lineTo(r * 0.48, r * 0.15);
      ctx.lineTo(0, r * 0.68);
      ctx.lineTo(-r * 0.48, r * 0.15);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'leshy' || type === 'satyr') {
      ctx.beginPath();
      ctx.arc(0, r * 0.22, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.18, -r * 0.02);
      ctx.quadraticCurveTo(-r * 0.65, -r * 0.25, -r * 0.55, -r * 0.68);
      ctx.moveTo(r * 0.18, -r * 0.02);
      ctx.quadraticCurveTo(r * 0.65, -r * 0.25, r * 0.55, -r * 0.68);
      ctx.stroke();
    } else if (type === 'bard') {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.22, r * 0.36, r * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-r * 0.09, -r * 0.68, r * 0.18, r * 0.6);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.34, r * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ece3d2';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, -r * 0.15);
      ctx.lineTo(0, r * 0.05);
      ctx.lineTo(r * 0.25, -r * 0.15);
      ctx.moveTo(-r * 0.25, r * 0.12);
      ctx.lineTo(0, r * 0.32);
      ctx.lineTo(r * 0.25, r * 0.12);
      ctx.stroke();
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
    state.glassTiltAngle = -28;
    state.targetGlassTiltAngle = -28;
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
    state.targetGlassTiltAngle = state.isGlassTiltedMode ? -28 : 0;
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
