import { describe, it, expect, vi } from 'vitest';
import { createCart } from '../src/cart/cart.js';

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    _store: store,
  };
}

const beer = {
  id: 'bard',
  name: 'Bard',
  priceSub: 382,
  priceOnce: 449,
  image: '/img/bard.png',
};

describe('createCart', () => {
  it('adds item with sub mode and key beerId:mode', () => {
    const cart = createCart(createMockStorage());
    cart.add(beer, 'sub');
    const [item] = cart.getItems();
    expect(item.key).toBe('bard:sub');
    expect(item.qty).toBe(1);
    expect(item.price).toBe(382);
    expect(item.mode).toBe('sub');
  });

  it('uses priceOnce for once mode', () => {
    const cart = createCart(createMockStorage());
    cart.add(beer, 'once');
    expect(cart.getItems()[0].price).toBe(449);
  });

  it('increments qty when adding same key', () => {
    const cart = createCart(createMockStorage());
    cart.add(beer, 'sub');
    cart.add(beer, 'sub');
    expect(cart.getItems()).toHaveLength(1);
    expect(cart.getItems()[0].qty).toBe(2);
  });

  it('totals price * qty across lines', () => {
    const cart = createCart(createMockStorage());
    cart.add(beer, 'sub');
    cart.add(beer, 'once');
    cart.add(beer, 'sub');
    expect(cart.total()).toBe(382 * 2 + 449);
  });

  it('changeQty adjusts and removes at zero', () => {
    const cart = createCart(createMockStorage());
    cart.add(beer, 'sub');
    cart.changeQty('bard:sub', 2);
    expect(cart.getItems()[0].qty).toBe(3);
    cart.changeQty('bard:sub', -3);
    expect(cart.getItems()).toHaveLength(0);
  });

  it('clear removes all items', () => {
    const cart = createCart(createMockStorage());
    cart.add(beer, 'sub');
    cart.clear();
    expect(cart.getItems()).toEqual([]);
    expect(cart.total()).toBe(0);
  });

  it('persists to svabin.cart.v1 and reloads', () => {
    const storage = createMockStorage();
    const cart1 = createCart(storage);
    cart1.add(beer, 'sub');
    cart1.add(beer, 'sub');

    const cart2 = createCart(storage);
    expect(cart2.getItems()).toHaveLength(1);
    expect(cart2.getItems()[0].qty).toBe(2);
    expect(cart2.total()).toBe(764);
  });

  it('subscribe notifies on changes and unsubscribes', () => {
    const cart = createCart(createMockStorage());
    const fn = vi.fn();
    const unsub = cart.subscribe(fn);
    cart.add(beer, 'sub');
    expect(fn).toHaveBeenCalledWith(cart.getItems());
    unsub();
    fn.mockClear();
    cart.add(beer, 'once');
    expect(fn).not.toHaveBeenCalled();
  });
});
