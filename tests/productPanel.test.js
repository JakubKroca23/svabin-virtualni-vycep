import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateProductPanel } from '../src/ui/productPanel.js';

function elementStub() {
  const classes = new Set();
  return {
    textContent: '',
    className: '',
    disabled: false,
    style: {},
    classList: {
      toggle: (name, force) => {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
    },
  };
}

function beer(overrides = {}) {
  return {
    name: 'Bard',
    style: 'Ležák',
    subtitle: 'Světlý ležák',
    description: 'Hořký ležák',
    abv: '5 %',
    ibu: '30 IBU',
    epm: '12°',
    priceSub: 382,
    priceOnce: 449,
    inStock: true,
    ...overrides,
  };
}

describe('updateProductPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows and disables the add button when selected beer is out of stock', () => {
    const elements = new Map(
      [
        'infoTag',
        'infoName',
        'infoTagline',
        'infoStyleLine',
        'infoRating',
        'infoDesc',
        'infoHops',
        'infoMalts',
        'infoParams',
        'infoEnergy',
        'profileHopVal',
        'profileBitterVal',
        'profileMaltVal',
        'priceSubText',
        'priceOnceText',
        'pricePerUnitText',
        'tapsterQuote',
        'stockPurchaseStatus',
        'profileHopBar',
        'profileBitterBar',
        'profileMaltBar',
        'buySubBtn',
        'buyOnceBtn',
        'addSelectedBtn',
        'btnBuyPriceLabel',
        'btnBuyText',
        'btnBuyDivider',
      ].map((id) => [id, elementStub()]),
    );
    vi.stubGlobal('document', { getElementById: (id) => elements.get(id) || null });

    updateProductPanel(beer({ inStock: false }), 'sub');

    expect(elements.get('stockPurchaseStatus').textContent).toBe('Vyprodáno');
    expect(elements.get('addSelectedBtn').disabled).toBe(true);
    expect(elements.get('btnBuyText').textContent).toBe('Vyprodáno');
    expect(elements.get('btnBuyPriceLabel').textContent).toBe('Momentálně není skladem');
    expect(elements.get('btnBuyDivider').classList.contains('hidden')).toBe(true);
  });
});
