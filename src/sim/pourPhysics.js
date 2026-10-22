export const DEFAULT_BEER = {
  id: 'svabin',
  name: 'Švabín',
  subtitle: 'Řemeslné pivo',
  epm: '11°',
  liquidTop: '#e8a828',
  liquidMid: '#c67810',
  liquidBottom: '#8c4904',
  foamTone: '#fbf6ea',
  haziness: 0.2,
  carbonation: 1,
  foamStability: 0.94,
  image: null,
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createInitialState() {
  return {
    selectedBeer: { ...DEFAULT_BEER },
    vesselType: 'can',
    glassType: 'mug',
    isOpened: false,
    openProgress: 0,
    vesselAngle: 0,
    targetVesselAngle: 0,
    // Positive = lean toward vessel (vessel sits to the right of the glass)
    glassTiltAngle: 22,
    targetGlassTiltAngle: 22,
    isGlassTiltedMode: true,
    vesselRemainingMl: 500,
    liquidMl: 0,
    foamMl: 0,
    maxGlassMl: 520,
    sipsTaken: 0,
    lacingRings: [],
    flowRate: 0,
    autoPourMode: null,
    pourLoopPlaying: false,
    foamFinished: false,
  };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function buildHud(state) {
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
  return {
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
  };
}

export function stepPhysics(state) {
  const beer = state.selectedBeer || DEFAULT_BEER;
  const previousFlowRate = state.flowRate;
  state.vesselAngle += (state.targetVesselAngle - state.vesselAngle) * 0.18;
  state.glassTiltAngle += (state.targetGlassTiltAngle - state.glassTiltAngle) * 0.14;
  if (state.isOpened) state.openProgress = Math.min(1, state.openProgress + 0.08);

  if (state.autoPourMode) {
    const targets = {
      hladinka: { angle: 78, glass: 24 },
      snyt: { angle: 96, glass: 18 },
      mliko: { angle: 118, glass: 8 },
    };
    const goal = targets[state.autoPourMode] || targets.hladinka;
    state.targetVesselAngle = goal.angle;
    state.targetGlassTiltAngle = goal.glass;
    const total = state.liquidMl + state.foamMl;
    const foamPct = total > 1 ? state.foamMl / total : 0;
    const done =
      (state.autoPourMode === 'hladinka' && total > 420 && foamPct < 0.28) ||
      (state.autoPourMode === 'snyt' && total > 280 && foamPct > 0.35) ||
      (state.autoPourMode === 'mliko' && foamPct > 0.72) ||
      state.vesselRemainingMl < 15;
    if (done) {
      state.autoPourMode = null;
      state.targetVesselAngle = 0;
      state.foamFinished = true;
    }
  }

  const minPourAngle = 42;
  const totalInGlass = state.liquidMl + state.foamMl;
  const fillRatio = Math.min(1, totalInGlass / state.maxGlassMl);

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
  } else {
    if (previousFlowRate > 0.1 && totalInGlass > 80) state.foamFinished = true;
    state.flowRate = 0;
  }

  if (state.foamMl > 2) {
    const settleRate = (1 - beer.foamStability) * 0.25 + 0.012;
    const settled = Math.min(state.foamMl, settleRate);
    state.foamMl -= settled;
    state.liquidMl = Math.min(state.maxGlassMl, state.liquidMl + settled * 0.35);
  }

  return previousFlowRate;
}

export function applySip(state) {
  const total = state.liquidMl + state.foamMl;
  if (total < 30) return false;
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
  return true;
}

export function resetPourState(state) {
  state.isOpened = false;
  state.openProgress = 0;
  state.vesselAngle = 0;
  state.targetVesselAngle = 0;
  state.isGlassTiltedMode = true;
  state.glassTiltAngle = 22;
  state.targetGlassTiltAngle = 22;
  state.vesselRemainingMl = 500;
  state.liquidMl = 0;
  state.foamMl = 0;
  state.flowRate = 0;
  state.autoPourMode = null;
  state.sipsTaken = 0;
  state.lacingRings = [];
  state.pourLoopPlaying = false;
  state.foamFinished = false;
}

/** Radius profile: t=0 bottom, t=1 rim (Y-up). */
export function getGlassProfile(t, glassType, halfW) {
  if (glassType === 'teku') {
    if (t < 0.05) return halfW * (0.55 + t * 2);
    if (t < 0.28) return halfW * 0.16;
    if (t < 0.55) {
      const u = (t - 0.28) / 0.27;
      return halfW * (0.16 + Math.sin(u * Math.PI * 0.5) * 0.9);
    }
    const u = (t - 0.55) / 0.45;
    return halfW * (1.06 - u * 0.22);
  }
  if (glassType === 'pint') {
    return halfW * (0.7 + t * 0.32);
  }
  // mug / krigl — wider bowl, slight taper to rim
  return halfW * (0.78 + Math.sin(t * Math.PI) * 0.12 + t * 0.08);
}

export function glassLathePoints(glassType, halfW, height, steps = 36) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    pts.push({ x: Math.max(0.004, getGlassProfile(t, glassType, halfW)), y: t * height });
  }
  return pts;
}
