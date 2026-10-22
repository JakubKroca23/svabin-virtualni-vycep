const selectedBuyClass = 'p-2.5 rounded-md border text-left transition bg-svabin-elevated border-svabin-amber';
const idleBuyClass =
  'p-2.5 rounded-md border text-left transition bg-svabin-bg/60 border-svabin-border hover:border-svabin-borderlight';
const disabledAddClass =
  'w-full py-2.5 px-4 rounded-md bg-svabin-elevated text-svabin-muted border border-svabin-border font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 opacity-60 cursor-not-allowed';
const enabledAddClass =
  'w-full py-2.5 px-4 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2';

function numberFromText(value) {
  const n = Number(String(value || '').replace(',', '.').match(/[\d.]+/)?.[0] || 0);
  return Number.isFinite(n) ? n : 0;
}

function levelFromBeer(beer, key, fallback) {
  if (typeof beer[key] === 'number') return beer[key];
  if (key === 'bitterLevel') return Math.min(5, Math.max(1, numberFromText(beer.ibu) / 15));
  if (key === 'maltLevel') return Math.min(5, Math.max(2.5, numberFromText(beer.epm) / 3));
  return fallback;
}

export function updateProductPanel(beer, mode = 'sub') {
  if (!beer) return;
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const hop = levelFromBeer(beer, 'hopLevel', 3.6);
  const bitter = levelFromBeer(beer, 'bitterLevel', 3.2);
  const malt = levelFromBeer(beer, 'maltLevel', 3.4);

  setText('infoTag', beer.inStock ? 'Skladem · Čerstvá várka' : 'Momentálně vyprodáno');
  setText('infoName', beer.name);
  setText('infoTagline', beer.style || beer.subtitle || 'Řemeslné pivo ze Švabína');
  setText('infoStyleLine', `${beer.subtitle || beer.style} | ${beer.abv || 'alk.'} | ${beer.ibu || 'IBU'} | plechovka / lahev`);
  setText('infoRating', beer.rating || '4.2');
  setText('infoDesc', beer.description || 'Poctivá malá várka z historického pivovaru Švabín.');
  setText('infoHops', beer.hops || 'Vybrané české a světové chmele');
  setText('infoMalts', beer.malts || 'Plzeňský a speciální slady');
  setText('infoParams', `${beer.epm || ''} EPM · ${beer.abv || ''} · ${beer.ibu || ''}`);
  setText('infoEnergy', beer.energy || 'Dle stylu a várky');
  setText('profileHopVal', `${hop.toFixed(1).replace('.', ',')} / 5`);
  setText('profileBitterVal', `${bitter.toFixed(1).replace('.', ',')} / 5`);
  setText('profileMaltVal', `${malt.toFixed(1).replace('.', ',')} / 5`);
  setText('priceSubText', `${beer.priceSub.toLocaleString('cs-CZ')} Kč`);
  setText('priceOnceText', `${beer.priceOnce.toLocaleString('cs-CZ')} Kč`);
  setText('pricePerUnitText', `${(beer.priceOnce / 6).toFixed(2).replace('.', ',')} Kč / ks`);
  setText('tapsterQuote', `„${beer.description || 'Nalévej pomalu po stěně sklenice a nech pivo dýchat.'}“`);
  setText('stockPurchaseStatus', beer.inStock ? 'Skladem' : 'Vyprodáno');

  const hopBar = document.getElementById('profileHopBar');
  const bitterBar = document.getElementById('profileBitterBar');
  const maltBar = document.getElementById('profileMaltBar');
  if (hopBar) hopBar.style.width = `${(hop / 5) * 100}%`;
  if (bitterBar) bitterBar.style.width = `${(bitter / 5) * 100}%`;
  if (maltBar) maltBar.style.width = `${(malt / 5) * 100}%`;
  const stockStatus = document.getElementById('stockPurchaseStatus');
  if (stockStatus) {
    stockStatus.className = beer.inStock ? 'text-[11px] text-svabin-greentext' : 'text-[11px] text-svabin-amber';
  }
  updatePurchaseMode(mode, beer);
}

export function updatePurchaseMode(mode, beer) {
  const subBtn = document.getElementById('buySubBtn');
  const onceBtn = document.getElementById('buyOnceBtn');
  const addBtn = document.getElementById('addSelectedBtn');
  const label = document.getElementById('btnBuyPriceLabel');
  const addText = document.getElementById('btnBuyText');
  const addDivider = document.getElementById('btnBuyDivider');
  const inStock = beer?.inStock !== false;
  if (subBtn) subBtn.className = mode === 'sub' ? selectedBuyClass : idleBuyClass;
  if (onceBtn) onceBtn.className = mode === 'once' ? selectedBuyClass : idleBuyClass;
  if (addBtn) {
    addBtn.disabled = !inStock;
    addBtn.className = inStock ? enabledAddClass : disabledAddClass;
  }
  if (addText) addText.textContent = inStock ? 'Do košíku' : 'Vyprodáno';
  if (addDivider) addDivider.classList.toggle('hidden', !inStock);
  if (label && beer) {
    label.textContent = inStock
      ? mode === 'sub'
        ? `${beer.priceSub.toLocaleString('cs-CZ')} Kč (předplatné)`
        : `${beer.priceOnce.toLocaleString('cs-CZ')} Kč`
      : 'Momentálně není skladem';
  }
}
