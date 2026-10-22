import { escapeHtml, safeCatalogImageUrl, safeSvabinUrl } from './dom.js';

function categoryFor(beer) {
  const text = `${beer.name} ${beer.style} ${beer.subtitle}`.toLowerCase();
  if (text.includes('sour') || text.includes('kysel')) return 'sour';
  if (text.includes('ipa') || text.includes('apa') || text.includes('ipl')) return 'ipa';
  return 'lager';
}

function filterButton(cat, label, active, count = '') {
  return `<button type="button" data-cat="${escapeHtml(cat)}" class="cat-btn px-3.5 py-2 rounded-md text-xs ${
    active
      ? 'font-semibold bg-svabin-amber text-svabin-bg'
      : 'font-medium bg-svabin-elevated text-svabin-sand hover:text-svabin-cream border border-svabin-border'
  } transition">${escapeHtml(label)}${escapeHtml(count)}</button>`;
}

function formatCzk(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('cs-CZ') : '0';
}

function imageOrPlaceholder(image, name) {
  const imageUrl = safeCatalogImageUrl(image);
  const safeName = escapeHtml(name || 'Pivo Švabín');
  const fallback = `<div data-image-fallback class="${
    imageUrl ? 'hidden ' : ''
  }absolute inset-0 flex items-center justify-center p-4 text-center font-serif font-bold text-xl leading-tight">${safeName}</div>`;
  return `
    <div class="relative rounded-md mb-3.5 border border-svabin-borderlight bg-svabin-elevated h-44 overflow-hidden text-svabin-cream">
      ${
        imageUrl
          ? `<img data-catalog-img src="${escapeHtml(imageUrl)}" alt="${safeName}" loading="lazy" decoding="async" class="w-full h-full object-contain p-3">`
          : ''
      }
      ${fallback}
    </div>
  `;
}

function beerCard(beer) {
  const id = escapeHtml(beer.id);
  const style = beer.style || 'Řemeslné pivo';
  const subtitle = beer.subtitle || beer.style;
  return `
    <article class="bg-svabin-surface border border-svabin-border hover:border-svabin-borderlight rounded-lg p-5 flex flex-col justify-between gap-4 transition">
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="text-[11px] font-medium px-2 py-0.5 rounded bg-svabin-elevated text-svabin-sand border border-svabin-borderlight">
            ${beer.inStock ? 'Skladem' : 'Vyprodáno'}
          </span>
          <span class="text-xs font-medium text-svabin-amber">${escapeHtml(beer.epm || '')}</span>
        </div>
        ${imageOrPlaceholder(beer.image, beer.name)}
        <h3 class="font-serif font-bold text-2xl leading-tight mt-0.5 text-svabin-cream">${escapeHtml(beer.name)}</h3>
        <p class="text-xs font-medium text-svabin-sand mt-0.5 mb-2">${escapeHtml(subtitle)}</p>
        <p class="text-xs font-medium text-svabin-cream mb-1">${escapeHtml(style)}</p>
        <p class="text-xs text-svabin-muted leading-relaxed">${escapeHtml(beer.description || '')}</p>
      </div>
      <div class="pt-3.5 border-t border-svabin-border space-y-2.5">
        <div class="flex items-baseline justify-between text-xs">
          <span class="text-svabin-muted">6 ks (předplatné −15 %)</span>
          <div>
            <span class="text-svabin-muted line-through mr-1">${formatCzk(beer.priceOnce)} Kč</span>
            <span class="font-bold text-sm text-svabin-cream">${formatCzk(beer.priceSub)} Kč</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" data-open-beer="${id}" class="py-2 px-3 rounded bg-svabin-elevated hover:bg-svabin-borderlight text-svabin-cream font-medium text-xs transition text-center">Otevřít a nalít</button>
          <button type="button" data-add-beer="${id}" ${beer.inStock ? '' : 'disabled'} class="py-2 px-3 rounded bg-svabin-amber hover:bg-svabin-amberhover disabled:opacity-40 disabled:pointer-events-none text-svabin-bg font-semibold text-xs transition text-center">${beer.inStock ? 'Do košíku' : 'Vyprodáno'}</button>
        </div>
      </div>
    </article>
  `;
}

function mixCard(mix) {
  const offer = (mix.offers || []).find((item) => item.in_stock) || (mix.offers || [])[0];
  const inStock = Boolean((mix.offers || []).find((item) => item.in_stock));
  const url = safeSvabinUrl(mix.url);
  const id = escapeHtml(mix.id);
  return `
    <article class="bg-svabin-bg border border-svabin-border rounded-lg p-5 flex flex-col gap-3">
      <div class="text-[11px] font-semibold text-svabin-amber">Namíchaný box</div>
      <h3 class="font-serif font-semibold text-xl text-svabin-cream">${escapeHtml(mix.name)}</h3>
      <p class="text-xs text-svabin-muted">${escapeHtml(offer?.pack || 'Výběr piv ze Švabína')} · ${formatCzk(offer?.price)} Kč</p>
      <div class="mt-auto grid grid-cols-2 gap-2">
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="py-2 px-3 rounded bg-svabin-elevated hover:bg-svabin-borderlight text-svabin-cream font-medium text-xs transition text-center">
          Detail mixu na svabin.com
        </a>
        <button type="button" data-add-mix="${id}" ${inStock ? '' : 'disabled'} class="py-2 px-3 rounded bg-svabin-amber hover:bg-svabin-amberhover disabled:opacity-40 disabled:pointer-events-none text-svabin-bg font-semibold text-xs transition text-center">${inStock ? 'Do košíku' : 'Vyprodáno'}</button>
      </div>
    </article>
  `;
}

export function renderCatalogView(root, { catalog, activeCategory = 'all', onFilter, onOpenBeer, onAddBeer, onAddMix } = {}) {
  const beers = catalog.beers || [];
  const filtered = activeCategory === 'all' ? beers : beers.filter((beer) => categoryFor(beer) === activeCategory);
  root.innerHTML = `
    <div class="bg-svabin-surface border border-svabin-border rounded-lg p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
      <div class="max-w-2xl">
        <div class="text-xs font-medium text-svabin-amber mb-2">Zal. roku 1567 · Zbiroh, Plzeňský kraj</div>
        <h2 class="font-serif font-semibold text-3xl sm:text-4xl text-svabin-cream tracking-tight">Řemeslné pivo z Plzeňska. Každé s vlastní chutí, příběhem a charakterem.</h2>
        <p class="text-sm text-svabin-muted mt-2.5 leading-relaxed">Malé várky, živé nefiltrované pivo a etikety s vlastním příběhem. Vyber pivo do simulátoru nebo rovnou do košíku.</p>
      </div>
      <div class="flex flex-wrap gap-1.5">
        ${filterButton('all', 'Všechna piva ', activeCategory === 'all', `(${beers.length})`)}
        ${filterButton('lager', 'České ležáky', activeCategory === 'lager')}
        ${filterButton('ipa', 'Speciály & IPA', activeCategory === 'ipa')}
        ${filterButton('sour', 'Kyseláče', activeCategory === 'sour')}
      </div>
    </div>
    <div id="catalogGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">${filtered.map(beerCard).join('')}</div>
    <div class="bg-svabin-surface border border-svabin-border rounded-lg p-6 sm:p-8">
      <div class="max-w-3xl mb-6">
        <div class="text-xs font-medium text-svabin-amber mb-1">Mixy a ochutnávky</div>
        <h3 class="font-serif font-semibold text-2xl text-svabin-cream">Když chceš zkusit víc najednou</h3>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">${(catalog.mixes || []).map(mixCard).join('')}</div>
    </div>
  `;
  root.querySelectorAll('[data-cat]').forEach((button) => button.addEventListener('click', () => onFilter?.(button.dataset.cat)));
  root.querySelectorAll('[data-open-beer]').forEach((button) => button.addEventListener('click', () => onOpenBeer?.(button.dataset.openBeer)));
  root.querySelectorAll('[data-add-beer]').forEach((button) => button.addEventListener('click', () => onAddBeer?.(button.dataset.addBeer)));
  root.querySelectorAll('[data-add-mix]').forEach((button) => button.addEventListener('click', () => onAddMix?.(button.dataset.addMix)));
  root.querySelectorAll('[data-catalog-img]').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        img.classList.add('hidden');
        img.nextElementSibling?.classList.remove('hidden');
      },
      { once: true },
    );
  });
}
