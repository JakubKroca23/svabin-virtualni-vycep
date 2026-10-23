import { clamp, randomBetween } from './util.js';
import { DEFAULT_BEER } from './state.js';

// HUD pour-style thresholds (calibrated after foam physics tweak):
// Mlíko foamPct > 68; Šnyt total < 360 && foamPct >= 25; Hladinka 14–34 %; Bez čepice < 14 %
export function evaluatePourStyle(state) {
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
  return { total, foamPct, pourStyle, canSip: total >= 40 };
}

const GLASS_STRAIGHTEN_START = 0.78;
const GLASS_STRAIGHTEN_END = 0.96;
const DEFAULT_GLASS_TILT = 28;

function updateAutoPour(state, fillRatio, onFoamFinish) {
  if (!state.autoPourMode) return;

  if (state.autoPourMode === 'hladinka') {
    if (fillRatio < 0.72) {
      state.targetGlassTiltAngle = DEFAULT_GLASS_TILT;
      state.targetVesselAngle = 86;
    } else if (fillRatio < 0.96 && state.vesselRemainingMl > 10) {
      state.targetGlassTiltAngle = 0;
      state.targetVesselAngle = 112;
    } else {
      state.targetVesselAngle = 0;
      state.targetGlassTiltAngle = 0;
      state.autoPourMode = null;
      onFoamFinish?.();
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
      onFoamFinish?.();
    }
  } else if (state.autoPourMode === 'mliko') {
    if (fillRatio < 0.92 && state.vesselRemainingMl > 40) {
      state.targetGlassTiltAngle = 0;
      state.targetVesselAngle = 130;
    } else {
      state.targetVesselAngle = 0;
      state.targetGlassTiltAngle = 0;
      state.autoPourMode = null;
      onFoamFinish?.();
    }
  }
}

function updateAutoGlassTilt(state, fillRatio) {
  if (state.autoPourMode || state.glassTiltManualHold) return;
  if (!state.isGlassTiltedMode) return;

  if (fillRatio > GLASS_STRAIGHTEN_START) {
    const straightenFactor = Math.min(
      1,
      (fillRatio - GLASS_STRAIGHTEN_START) / (GLASS_STRAIGHTEN_END - GLASS_STRAIGHTEN_START),
    );
    state.targetGlassTiltAngle = DEFAULT_GLASS_TILT * (1 - straightenFactor);
  } else {
    state.targetGlassTiltAngle = DEFAULT_GLASS_TILT;
  }
}

function spawnSpillVisuals(state, spilledMl, flowRate) {
  if (spilledMl <= 0) return;
  state.spillMl += spilledMl;
  const dropCount = Math.min(12, Math.ceil(spilledMl * 0.08 + flowRate * 2));
  for (let i = 0; i < dropCount && state.spillDrops.length < 80; i += 1) {
    state.spillDrops.push({
      x: randomBetween(-0.35, 0.35),
      y: 0,
      vx: randomBetween(-0.4, 0.4),
      vy: randomBetween(0.2, 0.9),
      r: randomBetween(2, 6),
      alpha: randomBetween(0.35, 0.75),
      kind: Math.random() < 0.55 ? 'foam' : 'liquid',
    });
  }
  if (state.mistParticles.length < 60) {
    state.mistParticles.push({
      xOffset: randomBetween(-12, 12),
      yOffset: randomBetween(0, 8),
      vx: randomBetween(-0.5, 0.5),
      vy: randomBetween(-0.3, 0.4),
      r: randomBetween(5, 16),
      alpha: randomBetween(0.25, 0.5),
    });
  }
}

function applyGlassCapacity(state, addedLiquid, addedFoam, flowRate) {
  const cap = state.maxGlassMl;
  let liquidMl = state.liquidMl + addedLiquid;
  let foamMl = state.foamMl + addedFoam;
  let total = liquidMl + foamMl;

  if (total > cap) {
    let excess = total - cap;
    const foamSpill = Math.min(foamMl, excess * 0.72);
    const liquidSpill = excess - foamSpill;
    foamMl -= foamSpill;
    liquidMl -= liquidSpill;
    if (liquidMl + foamMl > cap) {
      const trim = liquidMl + foamMl - cap;
      foamMl = Math.max(0, foamMl - trim);
    }
    spawnSpillVisuals(state, excess, flowRate);
  }

  state.liquidMl = Math.max(0, liquidMl);
  state.foamMl = Math.max(0, foamMl);
}

export function updateParticles(state, beer) {
  const profile = beer || DEFAULT_BEER;

  if (state.foamMl > 2) {
    const settleRate = (1 - profile.foamStability) * 0.32 + 0.009;
    const settled = Math.min(state.foamMl, settleRate);
    state.foamMl -= settled;
    state.liquidMl = Math.min(state.maxGlassMl, state.liquidMl + settled * 0.38);
  }

  if (state.liquidMl > 40 && Math.random() < 0.42 * profile.carbonation && state.bubbles.length < 200) {
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
    if (i < state.waveCount - 1) {
      state.waveVelocities[i + 1] += (state.waveHeights[i] - state.waveHeights[i + 1]) * 0.06;
    }
  }

  for (let i = state.mistParticles.length - 1; i >= 0; i -= 1) {
    const m = state.mistParticles[i];
    m.xOffset += m.vx;
    m.yOffset += m.vy;
    m.r += 0.3;
    m.alpha -= 0.014;
    if (m.alpha <= 0) state.mistParticles.splice(i, 1);
  }

  for (let i = state.spillDrops.length - 1; i >= 0; i -= 1) {
    const d = state.spillDrops[i];
    d.x += d.vx * 0.02;
    d.y += d.vy;
    d.vy += 0.04;
    d.alpha -= 0.006;
    if (d.alpha <= 0 || d.y > 1.2) state.spillDrops.splice(i, 1);
  }

  if (state.flyingCap) {
    state.flyingCap.x += state.flyingCap.vx;
    state.flyingCap.y += state.flyingCap.vy;
    state.flyingCap.vy += 0.46;
    state.flyingCap.angle += state.flyingCap.vAngle;
    if (state.flyingCap.y > 600) state.flyingCap = null;
  }
}

/**
 * @param {object} hooks
 * @param {() => void} [hooks.onPourLoopChange]
 * @param {() => void} [hooks.onFoamFinish]
 */
export function updatePhysics(state, hooks = {}) {
  const beer = state.selectedBeer || DEFAULT_BEER;
  const totalInGlass = state.liquidMl + state.foamMl;
  const fillRatio = Math.min(1, totalInGlass / state.maxGlassMl);
  const previousFlowRate = state.flowRate;

  updateAutoPour(state, fillRatio, () => {
    if (totalInGlass >= 80) hooks.onFoamFinish?.();
  });
  updateAutoGlassTilt(state, fillRatio);

  state.vesselAngle += (state.targetVesselAngle - state.vesselAngle) * 0.14;
  state.glassTiltAngle += (state.targetGlassTiltAngle - state.glassTiltAngle) * 0.12;
  if (state.isOpened && state.openProgress < 1) {
    state.openProgress = Math.min(1, state.openProgress + 0.12);
  }

  const minPourAngle = 42 + (1 - state.vesselRemainingMl / 500) * 38;
  const canPour =
    state.isOpened && state.vesselAngle > minPourAngle && state.vesselRemainingMl > 0;

  if (canPour) {
    const tiltExcess = (state.vesselAngle - minPourAngle) / (135 - minPourAngle);
    const carbonationBoost = 0.85 + beer.carbonation * 0.22;
    state.flowRate = clamp(Math.pow(tiltExcess, 1.15) * 3.55 * carbonationBoost, 0.2, 3.8);
    const actualOut = Math.min(state.vesselRemainingMl, state.flowRate);
    state.vesselRemainingMl -= actualOut;

    const glassWallGentleFactor = Math.abs(state.glassTiltAngle) / DEFAULT_GLASS_TILT;
    const pourHeightFactor = 1 - fillRatio * 0.55;
    const stabilityDamp = 0.92 + (beer.foamStability || 0.9) * 0.06;
    const vigorFoamRatio = Math.min(
      0.88,
      (0.16 + tiltExcess * 0.4 * pourHeightFactor) *
        (1 - glassWallGentleFactor * 0.58) *
        beer.carbonation *
        stabilityDamp,
    );

    const addedFoam = actualOut * vigorFoamRatio * 1.42;
    const addedLiquid = actualOut * (1 - vigorFoamRatio * 0.62);
    applyGlassCapacity(state, addedLiquid, addedFoam, state.flowRate);

    const centerWave = Math.floor(state.waveCount / 2);
    state.waveVelocities[centerWave] -= state.flowRate * 0.5;
    const bubbleSpawnCount = Math.ceil(state.flowRate * 1.75 * beer.carbonation);
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
    if (previousFlowRate > 0.1 && totalInGlass > 80) hooks.onFoamFinish?.();
    state.flowRate = 0;
  }

  if (state.flowRate > 0.05) {
    if (!state.pourLoopPlaying) {
      hooks.onPourLoopStart?.();
      state.pourLoopPlaying = true;
    }
  } else if (state.pourLoopPlaying) {
    hooks.onPourLoopStop?.();
    state.pourLoopPlaying = false;
  }

  updateParticles(state, beer);
}

export function shouldPlayFoamFinish(state) {
  return state.liquidMl + state.foamMl >= 80;
}
