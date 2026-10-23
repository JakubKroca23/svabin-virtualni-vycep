import { randomBetween } from './util.js';

export const DEFAULT_BEER = {
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

export function createInitialState() {
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
    glassTiltManualHold: false,
    vesselRemainingMl: 500,
    liquidMl: 0,
    foamMl: 0,
    spillMl: 0,
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
    spillDrops: [],
    condensationDrops: [],
    flyingCap: null,
    isDraggingVessel: false,
    isDraggingGlass: false,
    dragStartY: 0,
    dragStartAngle: 0,
    dragStartGlassTilt: 0,
    pourLoopPlaying: false,
    foamFinished: false,
    renderLod: 'high',
    fpsSamples: [],
  };
}

export function initCondensation(state) {
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

export function initFoamCells(state) {
  state.foamCells = [];
  for (let i = 0; i < 75; i += 1) {
    state.foamCells.push({
      u: randomBetween(-0.925, 0.925),
      v: Math.random(),
      r: randomBetween(1.8, 5.6),
    });
  }
}

export function resetPourState(state) {
  state.isOpened = false;
  state.openProgress = 0;
  state.vesselAngle = 0;
  state.targetVesselAngle = 0;
  state.isGlassTiltedMode = true;
  state.glassTiltManualHold = false;
  state.glassTiltAngle = 28;
  state.targetGlassTiltAngle = 28;
  state.vesselRemainingMl = 500;
  state.liquidMl = 0;
  state.foamMl = 0;
  state.spillMl = 0;
  state.flowRate = 0;
  state.autoPourMode = null;
  state.sipsTaken = 0;
  state.lacingRings = [];
  state.bubbles = [];
  state.mistParticles = [];
  state.spillDrops = [];
  state.flyingCap = null;
  state.pourLoopPlaying = false;
  state.foamFinished = false;
  state.isDraggingVessel = false;
  state.isDraggingGlass = false;
  initCondensation(state);
  initFoamCells(state);
}
