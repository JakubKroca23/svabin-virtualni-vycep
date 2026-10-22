// tests/catalog.test.js
import { describe, it, expect } from 'vitest';
import { pickPackPrice, applySubscription } from '../src/data/catalog.js';

describe('pickPackPrice', () => {
  it('prefers 6 cans pack when available', () => {
    const offers = [
      { pack: '1 can 0.5 l', price: 79, in_stock: true },
      { pack: '6 cans 0.5 l', price: 449, in_stock: true },
    ];
    expect(pickPackPrice(offers)).toBe(449);
  });
});

describe('applySubscription', () => {
  it('applies 15% discount rounded to int CZK', () => {
    expect(applySubscription(449)).toBe(382);
  });
});
