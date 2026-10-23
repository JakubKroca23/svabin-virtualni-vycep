import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/sim/state.js';
import {
  BURP_COOLDOWN_MS,
  BURP_EMPTY_THRESHOLD_ML,
  shouldPlayBurpAfterSip,
} from '../src/sim/sipEffects.js';

describe('sip burp after dopití', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays burp when glass is nearly empty after sip', () => {
    const state = createInitialState();
    expect(shouldPlayBurpAfterSip(state, BURP_EMPTY_THRESHOLD_ML - 1)).toBe(true);
    expect(shouldPlayBurpAfterSip(state, BURP_EMPTY_THRESHOLD_ML)).toBe(false);
    expect(shouldPlayBurpAfterSip(state, 120)).toBe(false);
  });

  it('respects cooldown so burp does not spam', () => {
    vi.stubGlobal('performance', { now: () => 10_000 });
    const state = createInitialState();
    state.lastBurpAt = 10_000;
    expect(shouldPlayBurpAfterSip(state, 5)).toBe(false);
    state.lastBurpAt = 10_000 - BURP_COOLDOWN_MS - 1;
    expect(shouldPlayBurpAfterSip(state, 5)).toBe(true);
  });
});
