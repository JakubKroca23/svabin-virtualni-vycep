// src/data/catalog.js
const LIVE_URL = 'https://svabin.com/catalog.json';
const FALLBACK_URL = `${import.meta.env.BASE_URL}data/catalog.fallback.json`;

export function pickPackPrice(offers = []) {
  const six = offers.find((o) => /6 cans/i.test(o.pack) && o.in_stock);
  if (six) return six.price;
  const sixB = offers.find((o) => /6 bottles/i.test(o.pack) && o.in_stock);
  if (sixB) return sixB.price;
  const any = offers.find((o) => o.in_stock) || offers[0];
  return any?.price ?? 0;
}

export function applySubscription(priceOnce) {
  return Math.round(priceOnce * 0.85);
}

export async function loadCatalog() {
  try {
    const res = await fetch(LIVE_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ...shapeCatalog(data), source: 'live' };
  } catch {
    const res = await fetch(FALLBACK_URL);
    const data = await res.json();
    return { ...shapeCatalog(data), source: 'fallback' };
  }
}

function shapeCatalog(data) {
  const beers = (data.beers || []).map((b) => {
    const priceOnce = pickPackPrice(b.offers);
    return {
      id: b.id,
      name: b.name,
      style: b.style || '',
      subtitle: b.style || '',
      description: b.description || '',
      image: b.image || null,
      abv: b.abv_percent != null ? `${String(b.abv_percent).replace('.', ',')} %` : '',
      epm: b.plato != null ? `${b.plato}°` : '',
      ibu: b.ibu != null ? `${b.ibu} IBU` : '',
      url: b.url || '',
      offers: b.offers || [],
      priceOnce,
      priceSub: applySubscription(priceOnce),
      inStock: (b.offers || []).some((o) => o.in_stock),
      markdown: b.markdown || null,
    };
  });
  return {
    beers,
    mixes: data.mixes || [],
    seller: data.seller || {},
    shipping: data.shipping || {},
    subscription: data.subscription || { discount_percent: 15 },
  };
}
