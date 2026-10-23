import { describe, expect, it, vi } from 'vitest';
import { updatePhysics } from '../src/sim/physics.js';
import { createInitialState, DEFAULT_BEER } from '../src/sim/state.js';

function pourState(overrides = {}) {
  const state = createInitialState();
  Object.assign(state, {
    isOpened: true,
    vesselAngle: 120,
    targetVesselAngle: 120,
    vesselRemainingMl: 400,
    liquidMl: 0,
    foamMl: 0,
    ...overrides,
  });
  return state;
}

describe('physics', () => {
  it('keeps flow at zero below min pour angle', () => {
    const state = pourState({ vesselAngle: 20, targetVesselAngle: 20 });
    updatePhysics(state);
    expect(state.flowRate).toBe(0);
  });

  it('grows more foam with higher carbonation', () => {
    const low = pourState();
    const high = pourState();
    const lowBeer = { ...DEFAULT_BEER, carbonation: 0.5 };
    const highBeer = { ...DEFAULT_BEER, carbonation: 1.4 };
    low.selectedBeer = lowBeer;
    high.selectedBeer = highBeer;

    for (let i = 0; i < 8; i += 1) {
      updatePhysics(low);
      updatePhysics(high);
    }
    expect(high.foamMl).toBeGreaterThan(low.foamMl);
  });

  it('settles foam faster when foamStability is low', () => {
    const stable = pourState({ liquidMl: 200, foamMl: 80 });
    const unstable = pourState({ liquidMl: 200, foamMl: 80 });
    stable.selectedBeer = { ...DEFAULT_BEER, foamStability: 0.98 };
    unstable.selectedBeer = { ...DEFAULT_BEER, foamStability: 0.4 };
    stable.flowRate = 0;
    unstable.flowRate = 0;

    for (let i = 0; i < 25; i += 1) {
      updatePhysics(stable);
      updatePhysics(unstable);
    }
    expect(unstable.foamMl).toBeLessThan(stable.foamMl);
  });

  it('routes overflow into spill instead of unbounded glass volume', () => {
    const state = pourState({
      liquidMl: 500,
      foamMl: 30,
      vesselAngle: 125,
      targetVesselAngle: 125,
    });
    const beforeTotal = state.liquidMl + state.foamMl;
    updatePhysics(state);
    const afterTotal = state.liquidMl + state.foamMl;
    expect(afterTotal).toBeLessThanOrEqual(state.maxGlassMl + 1);
    expect(state.spillMl).toBeGreaterThan(0);
    expect(beforeTotal).toBeGreaterThan(state.maxGlassMl * 0.95);
  });

  it('auto-tilts glass toward pour angle when not manually held', () => {
    const state = pourState({
      vesselAngle: 0,
      targetVesselAngle: 0,
      glassTiltAngle: 0,
      targetGlassTiltAngle: 0,
      liquidMl: 0,
      foamMl: 0,
      glassTiltManualHold: false,
      isGlassTiltedMode: true,
    });
    for (let i = 0; i < 20; i += 1) updatePhysics(state);
    expect(state.targetGlassTiltAngle).toBeGreaterThan(20);
  });
});
