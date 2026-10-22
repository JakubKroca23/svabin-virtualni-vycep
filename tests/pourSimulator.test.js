import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPourSimulator } from '../src/sim/pourSimulator.js';

function createMockContext() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {};
  [
    'arc',
    'beginPath',
    'bezierCurveTo',
    'clearRect',
    'clip',
    'closePath',
    'drawImage',
    'ellipse',
    'fill',
    'fillRect',
    'fillText',
    'lineTo',
    'moveTo',
    'quadraticCurveTo',
    'restore',
    'rotate',
    'roundRect',
    'save',
    'scale',
    'setTransform',
    'stroke',
    'translate',
  ].forEach((name) => {
    ctx[name] = vi.fn();
  });
  ctx.createLinearGradient = vi.fn(() => gradient);
  ctx.createRadialGradient = vi.fn(() => gradient);
  ctx.measureText = vi.fn((text) => ({ width: String(text).length * 8 }));
  return ctx;
}

function createMockCanvas() {
  const listeners = new Map();
  return {
    width: 0,
    height: 0,
    parentElement: {
      getBoundingClientRect: () => ({ width: 640, height: 480 }),
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
    getContext: vi.fn(() => createMockContext()),
    addEventListener: vi.fn((type, handler) => listeners.set(type, handler)),
    removeEventListener: vi.fn((type) => listeners.delete(type)),
    _listeners: listeners,
  };
}

const beer = {
  id: 'bard',
  name: 'Bard',
  subtitle: 'Svetly lezak 11',
  epm: '11',
  liquidTop: '#e8a828',
  liquidMid: '#c67810',
  liquidBottom: '#8c4904',
  foamTone: '#fbf6ea',
  paperBg: '#ece3d2',
  inkPrimary: '#241e18',
  inkAccent: '#9b6318',
  haziness: 0.22,
  carbonation: 1,
  foamStability: 0.94,
  illustration: 'bard',
};

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
      constructor(cb) {
        this.cb = cb;
      }
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
    for (let i = 0; i < 30; i += 1) rafCallbacks.shift()?.(16 * i);
    expect(sfx.startLoop).toHaveBeenCalledWith('pour-loop');
    expect(onHud).toHaveBeenLastCalledWith(expect.objectContaining({ canSip: true }));

    sim.setTilt(0);
    for (let i = 0; i < 20; i += 1) rafCallbacks.shift()?.(300 + 16 * i);
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
    for (let i = 0; i < 45; i += 1) rafCallbacks.shift()?.(16 * i);
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
