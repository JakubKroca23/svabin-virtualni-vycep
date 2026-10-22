import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderBeerStrip } from '../src/ui/beerStrip.js';
import { renderCatalogView } from '../src/ui/catalogView.js';
import { updateCartDrawer } from '../src/ui/cartDrawer.js';

function rootStub() {
  return {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

const maliciousBeer = {
  id: `beer" onclick="alert(1)`,
  name: `<img src=x onerror=alert(1)>`,
  style: `Ležák <script>alert(1)</script>`,
  subtitle: `Světlý "ležák"`,
  description: `Hořké & svěží <svg onload=alert(1)>`,
  abv: `5 %`,
  ibu: `30 IBU`,
  epm: `12°`,
  priceOnce: 449,
  priceSub: 382,
  paperBg: '#ece3d2',
  inkPrimary: '#241e18',
  liquidTop: '#e8a828',
  liquidMid: '#c67810',
  inStock: true,
};

describe('UI renderer escaping', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('escapes catalog beer text and data attributes', () => {
    const root = rootStub();
    renderCatalogView(root, {
      catalog: {
        beers: [maliciousBeer],
        mixes: [{ name: `<b>mix</b>`, url: 'javascript:alert(1)', offers: [{ pack: `<img>`, price: 100 }] }],
      },
    });

    expect(root.innerHTML).not.toContain('<img src=x');
    expect(root.innerHTML).not.toContain('<script>');
    expect(root.innerHTML).not.toContain('javascript:alert');
    expect(root.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(root.innerHTML).toContain('data-open-beer="beer&quot; onclick=&quot;alert(1)"');
  });

  it('renders safe official catalog images with a name fallback', () => {
    const root = rootStub();
    renderCatalogView(root, {
      catalog: {
        beers: [
          {
            ...maliciousBeer,
            id: 'bard',
            name: 'Bard',
            image: 'https://svabin.com/assets/bard.png',
          },
        ],
        mixes: [],
      },
    });

    expect(root.innerHTML).toContain('src="https://svabin.com/assets/bard.png"');
    expect(root.innerHTML).toContain('alt="Bard"');
    expect(root.innerHTML).toContain('data-image-fallback');
    expect(root.innerHTML).not.toContain('src="javascript:');
  });

  it('renders a mix add-to-cart button while keeping the detail link', () => {
    const root = rootStub();
    renderCatalogView(root, {
      catalog: {
        beers: [],
        mixes: [{ id: 'mix-6', name: 'Mix 6', url: 'https://svabin.com/mix-6', offers: [{ pack: '6 cans', price: 499, in_stock: true }] }],
      },
    });

    expect(root.innerHTML).toContain('data-add-mix="mix-6"');
    expect(root.innerHTML).toContain('Do košíku');
    expect(root.innerHTML).toContain('Detail mixu na svabin.com');
  });

  it('escapes beer strip text and attributes', () => {
    const root = rootStub();
    renderBeerStrip(root, { beers: [maliciousBeer], selectedId: maliciousBeer.id });

    expect(root.innerHTML).not.toContain('<img src=x');
    expect(root.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(root.innerHTML).toContain('data-beer-id="beer&quot; onclick=&quot;alert(1)"');
  });

  it('escapes cart item names and keys', () => {
    const elements = new Map(
      ['cartItemsList', 'cartTotalPrice', 'shippingBar', 'shippingPctText', 'shippingStatusText'].map((id) => [
        id,
        { innerHTML: '', textContent: '', style: {}, querySelectorAll: () => [] },
      ]),
    );
    vi.stubGlobal('document', { getElementById: (id) => elements.get(id) || null });

    updateCartDrawer(
      {
        getItems: () => [
          { key: `beer" onclick="alert(1):sub`, name: `<img src=x onerror=alert(1)>`, mode: 'sub', price: 382, qty: 1 },
        ],
        total: () => 382,
      },
      {},
    );

    const html = elements.get('cartItemsList').innerHTML;
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('data-qty-key="beer&quot; onclick=&quot;alert(1):sub"');
  });
});
