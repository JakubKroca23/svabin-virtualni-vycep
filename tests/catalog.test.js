// tests/catalog.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickPackPrice, applySubscription, loadCatalog } from '../src/data/catalog.js';

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

describe('loadCatalog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses fallback when live fetch is not ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ beers: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadCatalog();

    expect(result.source).toBe('fallback');
    expect(result.beers).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
