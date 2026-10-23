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
    /** degrees from upright; 0 = upright, ~90+ pours */
    vesselAngle: 0,
    targetVesselAngle: 0,
    vesselAngularVel: 0,
    glassTiltAngle: 0,
    vesselCapacityMl: 500,
    vesselRemainingMl: 500,
    liquidMl: 0,
    foamMl: 0,
    maxGlassMl: 500,
    spillMl: 0,
    sipsTaken: 0,
    lacingRings: [],
    flowRate: 0, // ml per frame (~60fps), also used as ml/s approx via dt
    streamLagMl: 0, // liquid in flight
    autoPourMode: null,
    pourLoopPlaying: false,
    foamFinished: false,
    lastDt: 1 / 60,
  };
}

export function buildHud(state) {
  const total = Math.round(state.liquidMl + state.foamMl);
  const foamPct = total > 15 ? Math.round((state.foamMl / total) * 100) : 0;
  let pourStyle = state.isOpened ? 'Otevřeno' : 'Zavřeno';
  if (state.spillMl > 5) pourStyle = 'Přetečení';
  else if (total >= 30) {
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
      glassTiltAngle: 0,
      isOpened: state.isOpened,
      spillMl: state.spillMl,
    },
  };
}

/**
 * Minimum tip angle (deg) at which liquid reaches the lip.
 * Fuller can pours earlier; nearly empty needs more tip.
 */
export function pourThresholdDeg(state) {
  const fill = clamp(state.vesselRemainingMl / state.vesselCapacityMl, 0, 1);
  // Full: ~48°, empty: ~105°
  return 48 + (1 - fill) * 57;
}

/**
 * Orifice-style outflow (ml/s) once tipped past threshold.
 * Driven by tip excess + hydrostatic head from remaining fill.
 */
export function computeOutflowMlPerSec(state, beer) {
  if (!state.isOpened) return 0;
  const threshold = pourThresholdDeg(state);
  if (state.vesselAngle < threshold || state.vesselRemainingMl <= 0) return 0;

  const tip = (state.vesselAngle - threshold) / (140 - threshold);
  const tipFactor = Math.pow(clamp(tip, 0, 1), 1.35);
  const head = Math.sqrt(clamp(state.vesselRemainingMl / state.vesselCapacityMl, 0.02, 1));
  // ~0–180 ml/s typical hand pour
  const orifice = state.vesselType === 'bottle' ? 95 : 130;
  return orifice * tipFactor * head * (0.85 + beer.carbonation * 0.15);
}

/**
 * Foam fraction from impact energy: tip speed + fall + carbonation.
 */
export function foamFraction(state, beer, outflowMlPerSec) {
  const tip = clamp((state.vesselAngle - 50) / 90, 0, 1);
  const fall = 0.2 + tip * 0.55;
  const vigor = clamp(outflowMlPerSec / 140, 0, 1.4);
  const angularSplash = clamp(Math.abs(state.vesselAngularVel) / 180, 0, 0.35);
  return clamp(
    (0.08 + tip * 0.28 * fall + vigor * 0.22 + angularSplash) * beer.carbonation,
    0.05,
    0.85,
  );
}

/**
 * @param {ReturnType<typeof createInitialState>} state
 * @param {number} [dt=1/60] seconds
 */
export function stepPhysics(state, dt = 1 / 60) {
  const beer = state.selectedBeer || DEFAULT_BEER;
  const previousFlowRate = state.flowRate;
  const safeDt = clamp(dt, 1 / 240, 1 / 20);
  state.lastDt = safeDt;

  // Angular spring toward target with damping (natural hand feel)
  const stiffness = state.autoPourMode ? 9 : 14;
  const damping = state.autoPourMode ? 5.5 : 8;
  const accel = (state.targetVesselAngle - state.vesselAngle) * stiffness - state.vesselAngularVel * damping;
  state.vesselAngularVel += accel * safeDt;
  state.vesselAngle += state.vesselAngularVel * safeDt;
  state.vesselAngle = clamp(state.vesselAngle, 0, 145);
  state.glassTiltAngle = 0;

  if (state.isOpened) state.openProgress = Math.min(1, state.openProgress + safeDt * 3.5);

  if (state.autoPourMode) {
    const targets = {
      hladinka: { angle: 72, foamMax: 0.26, volume: 430 },
      snyt: { angle: 92, foamMax: 0.55, volume: 300 },
      mliko: { angle: 118, foamMax: 0.85, volume: 380 },
    };
    const goal = targets[state.autoPourMode] || targets.hladinka;
    // Ease tip up, then hold / ease down when foam/volume hit
    const total = state.liquidMl + state.foamMl;
    const foamPct = total > 1 ? state.foamMl / total : 0;
    const reached = total >= goal.volume * 0.92 || state.vesselRemainingMl < 12;
    const foamOk =
      (state.autoPourMode === 'hladinka' && foamPct <= goal.foamMax && total > goal.volume * 0.85) ||
      (state.autoPourMode === 'snyt' && foamPct >= 0.32 && total > 240) ||
      (state.autoPourMode === 'mliko' && foamPct >= 0.7);

    if (!reached && !foamOk) {
      state.targetVesselAngle = goal.angle;
    } else if (state.autoPourMode === 'hladinka' && foamPct > goal.foamMax) {
      state.targetVesselAngle = Math.max(55, goal.angle - 18);
    } else {
      state.targetVesselAngle = 0;
      if (reached || foamOk || state.vesselRemainingMl < 12) {
        state.autoPourMode = null;
        state.foamFinished = true;
      }
    }
  }

  const outflow = computeOutflowMlPerSec(state, beer);
  // Convert to this frame; keep flowRate as ml/s for HUD/SFX
  state.flowRate = outflow;

  let leaving = outflow * safeDt;
  leaving = Math.min(leaving, state.vesselRemainingMl);

  // Stream lag: liquid takes ~0.12s to fall
  const lagTau = 0.12;
  state.streamLagMl += leaving;
  state.vesselRemainingMl -= leaving;
  const arrive = state.streamLagMl * (1 - Math.exp(-safeDt / lagTau));
  state.streamLagMl -= arrive;

  const totalBefore = state.liquidMl + state.foamMl;
  if (arrive > 0 && totalBefore < state.maxGlassMl * 1.02) {
    const foamRatio = foamFraction(state, beer, outflow);
    let addFoam = arrive * foamRatio;
    let addLiquid = arrive * (1 - foamRatio * 0.72);

    const room = Math.max(0, state.maxGlassMl - state.liquidMl - state.foamMl * 0.85);
    const accepted = Math.min(addLiquid + addFoam, room + state.maxGlassMl * 0.02);
    if (addLiquid + addFoam > accepted + 0.01) {
      const scale = accepted / (addLiquid + addFoam);
      addLiquid *= scale;
      addFoam *= scale;
      state.spillMl += arrive - accepted;
    }

    state.liquidMl += addLiquid;
    state.foamMl += addFoam;
  } else if (arrive > 0) {
    state.spillMl += arrive;
  }

  // Cap glass contents
  if (state.liquidMl + state.foamMl > state.maxGlassMl) {
    const over = state.liquidMl + state.foamMl - state.maxGlassMl;
    state.foamMl = Math.max(0, state.foamMl - over);
    if (state.liquidMl + state.foamMl > state.maxGlassMl) {
      state.liquidMl = state.maxGlassMl;
      state.foamMl = 0;
    }
    state.spillMl += over;
  }

  // Foam collapse → beer
  if (state.foamMl > 2) {
    const settleRate = ((1 - beer.foamStability) * 18 + 2.5) * safeDt; // ml/s scaled
    const settled = Math.min(state.foamMl, settleRate);
    state.foamMl -= settled;
    state.liquidMl = Math.min(state.maxGlassMl, state.liquidMl + settled * 0.4);
  }

  // Spill evaporates from counter visually (decay)
  state.spillMl = Math.max(0, state.spillMl - 8 * safeDt);

  if (previousFlowRate > 8 && outflow < 2 && totalBefore > 80) {
    state.foamFinished = true;
  }

  return previousFlowRate;
}

export function applySip(state, amountMl = 90) {
  const total = state.liquidMl + state.foamMl;
  if (total < 25) return false;
  state.sipsTaken += 1;
  const fillRatio = Math.min(1, (state.liquidMl + state.foamMl * 0.85) / state.maxGlassMl);
  if (fillRatio > 0.12) state.lacingRings.push(fillRatio);

  const take = Math.min(amountMl, total);
  const foamShare = clamp(state.foamMl / Math.max(total, 1), 0.05, 0.45);
  const foamTake = take * foamShare;
  const liquidTake = take - foamTake;
  state.foamMl = Math.max(0, state.foamMl - foamTake);
  state.liquidMl = Math.max(0, state.liquidMl - liquidTake);
  return true;
}

export function resetPourState(state) {
  state.isOpened = false;
  state.openProgress = 0;
  state.vesselAngle = 0;
  state.targetVesselAngle = 0;
  state.vesselAngularVel = 0;
  state.glassTiltAngle = 0;
  state.vesselRemainingMl = state.vesselCapacityMl;
  state.liquidMl = 0;
  state.foamMl = 0;
  state.spillMl = 0;
  state.flowRate = 0;
  state.streamLagMl = 0;
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
