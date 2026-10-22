import { describe, it, expect } from 'vitest';
import { getPourProfile } from '../src/data/pourProfiles.js';

describe('getPourProfile', () => {
  it('returns curated bard profile', () => {
    const p = getPourProfile('bard', 'Světlý ležák 11°');
    expect(p.liquidTop).toBe('#e8a828');
    expect(p.illustration).toBe('bard');
  });

  it('infers sour-like colors for unknown sour style', () => {
    const p = getPourProfile('unknown-sour', 'Sour Ale 11°');
    expect(p.category).toBe('sour');
    expect(p.haziness).toBeGreaterThan(0.4);
  });
});
