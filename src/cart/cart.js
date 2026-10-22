const STORAGE_KEY = 'svabin.cart.v1';

export function createCart(storage = globalThis.localStorage) {
  let items = load();
  const listeners = new Set();

  function load() {
    try {
      return JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function save() {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
    listeners.forEach((fn) => fn(items));
  }

  return {
    getItems: () => items.slice(),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    add(beer, mode = 'sub') {
      const key = `${beer.id}:${mode}`;
      const price = mode === 'sub' ? beer.priceSub : beer.priceOnce;
      const existing = items.find((i) => i.key === key);
      if (existing) existing.qty += 1;
      else
        items.push({
          key,
          beerId: beer.id,
          name: beer.name,
          mode,
          price,
          qty: 1,
          image: beer.image,
        });
      save();
    },
    changeQty(key, delta) {
      const it = items.find((i) => i.key === key);
      if (!it) return;
      it.qty += delta;
      if (it.qty <= 0) items = items.filter((i) => i.key !== key);
      save();
    },
    clear() {
      items = [];
      save();
    },
    total() {
      return items.reduce((s, i) => s + i.price * i.qty, 0);
    },
  };
}
