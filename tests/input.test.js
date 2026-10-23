import { describe, expect, it } from 'vitest';
import { applySoftGlassTiltSnap, hitTestZones } from '../src/sim/input.js';
import { createInitialState } from '../src/sim/state.js';

describe('input hit zones', () => {
  const canvas = {};

  it('detects vessel lid zone near pivot', () => {
    const state = createInitialState();
    const pos = { x: 640 * 0.32 + 195, y: 120, w: 640, h: 480 };
    const hits = hitTestZones(canvas, state, pos);
    expect(hits.inVessel || hits.inLid).toBe(true);
  });

  it('detects glass body for sip/tilt', () => {
    const state = createInitialState();
    const pos = { x: 640 * 0.32, y: 480 * 0.84 - 100, w: 640, h: 480 };
    const hits = hitTestZones(canvas, state, pos);
    expect(hits.inGlass).toBe(true);
  });

  it('maps soft snap toward hladinka angle', () => {
    expect(applySoftGlassTiltSnap(26)).toBeGreaterThan(26);
    expect(applySoftGlassTiltSnap(30)).toBeLessThan(30);
    expect(applySoftGlassTiltSnap(10)).toBe(10);
  });
});

describe('input touch idempotence', () => {
  it('attachInput returns a detach function', async () => {
    const { attachInput } = await import('../src/sim/input.js');
    const canvas = {
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
    };
    const state = createInitialState();
    const detach = attachInput(canvas, state, {
      setTilt: () => {},
      triggerOpen: () => {},
      takeSip: () => {},
    });
    expect(typeof detach).toBe('function');
    detach();
  });
});
