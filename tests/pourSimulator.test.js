import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPourSimulator } from '../src/sim/pourSimulator.js';
import { createInitialState, getGlassProfile, stepPhysics } from '../src/sim/pourPhysics.js';

function createMockCanvas() {
  const listeners = new Map();
  return {
    width: 0,
    height: 0,
    parentElement: {
      getBoundingClientRect: () => ({ width: 640, height: 480 }),
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
    // Force physics-only path in Node tests (no WebGL)
    getContext: vi.fn((type) => (type === '2d' ? {} : null)),
    addEventListener: vi.fn((type, handler) => listeners.set(type, handler)),
    removeEventListener: vi.fn((type) => listeners.delete(type)),
    _listeners: listeners,
  };
}

const beer = {
  id: 'bard',
  name: 'Bard',
  liquidTop: '#e8a828',
  liquidMid: '#c67810',
  liquidBottom: '#8c4904',
  foamTone: '#fbf6ea',
  carbonation: 1,
  foamStability: 0.94,
};

describe('pourPhysics', () => {
  it('keeps glass profile wider toward the rim (upright Y-up)', () => {
    const bottom = getGlassProfile(0.05, 'mug', 0.065);
    const mid = getGlassProfile(0.5, 'mug', 0.065);
    const rim = getGlassProfile(0.95, 'mug', 0.065);
    expect(rim).toBeGreaterThan(bottom * 0.9);
    expect(mid).toBeGreaterThan(0);
  });

  it('pours when vessel is tilted past threshold', () => {
    const state = createInitialState();
    state.isOpened = true;
    state.targetVesselAngle = 110;
    state.vesselAngle = 110;
    for (let i = 0; i < 40; i += 1) stepPhysics(state);
    expect(state.liquidMl + state.foamMl).toBeGreaterThan(40);
    expect(state.vesselRemainingMl).toBeLessThan(500);
  });
});

describe('createPourSimulator', () => {
  let rafCallbacks;

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('ResizeObserver', class {
      observe = vi.fn();
      disconnect = vi.fn();
    });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      devicePixelRatio: 1,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the required control API and emits initial HUD state', () => {
    const onHud = vi.fn();
    const sim = createPourSimulator({ canvas: createMockCanvas(), onHud });

    expect(Object.keys(sim).sort()).toEqual([
      'destroy',
      'reset',
      'selectBeer',
      'setGlassType',
      'setTilt',
      'setVesselType',
      'startMasterPour',
      'takeSip',
      'toggleGlassTilt',
      'triggerOpen',
    ]);
    expect(onHud).toHaveBeenCalledWith(expect.objectContaining({
      liquidMl: '0 ml',
      foamPct: '0 %',
      pourStyle: 'Zavřeno',
      canSip: false,
    }));

    sim.destroy();
  });

  it('opens the selected vessel and starts/stops pouring loop from tilt physics', () => {
    const sfx = {
      play: vi.fn(),
      startLoop: vi.fn(),
      stopLoop: vi.fn(),
    };
    const onHud = vi.fn();
    const sim = createPourSimulator({ canvas: createMockCanvas(), sfx, onHud });

    sim.selectBeer(beer);
    sim.setVesselType('bottle');
    sim.triggerOpen();
    expect(sfx.play).toHaveBeenCalledWith('bottle-open');

    sim.setTilt(125);
    for (let i = 0; i < 40; i += 1) rafCallbacks.shift()?.(16 * i);
    expect(sfx.startLoop).toHaveBeenCalledWith('pour-loop');
    expect(onHud).toHaveBeenLastCalledWith(expect.objectContaining({ canSip: true }));

    sim.setTilt(0);
    for (let i = 0; i < 25; i += 1) rafCallbacks.shift()?.(300 + 16 * i);
    expect(sfx.stopLoop).toHaveBeenCalledWith('pour-loop');

    sim.destroy();
  });

  it('supports master pour, sip, reset, and destroy side effects', () => {
    const sfx = {
      play: vi.fn(),
      startLoop: vi.fn(),
      stopLoop: vi.fn(),
    };
    const canvas = createMockCanvas();
    const sim = createPourSimulator({ canvas, sfx, onHud: vi.fn() });
    sim.selectBeer(beer);

    sim.startMasterPour('mliko');
    for (let i = 0; i < 50; i += 1) rafCallbacks.shift()?.(16 * i);
    expect(sfx.play).toHaveBeenCalledWith('can-open');

    sim.takeSip();
    expect(sfx.play).toHaveBeenCalledWith('sip');

    sim.reset();
    expect(sfx.stopLoop).toHaveBeenCalledWith('pour-loop');

    sim.destroy();
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
    expect(canvas.removeEventListener).toHaveBeenCalled();
  });
});
