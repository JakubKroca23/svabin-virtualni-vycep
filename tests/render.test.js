import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/sim/state.js';
import { updatePhysics } from '../src/sim/physics.js';
import { renderScene } from '../src/sim/render/index.js';

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

describe('render smoke', () => {
  it('renders one frame after physics without throwing', () => {
    const state = createInitialState();
    state.isOpened = true;
    state.vesselAngle = 100;
    state.targetVesselAngle = 100;
    updatePhysics(state);
    const ctx = createMockContext();
    const canvas = {
      getBoundingClientRect: () => ({ width: 640, height: 480, left: 0, top: 0 }),
    };
    renderScene(ctx, canvas, state);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});
