import { escapeHtml, safeCatalogImageUrl, safeCssColor } from './dom.js';

function cardClass(active) {
  return active
    ? 'bg-svabin-elevated border-svabin-amber text-svabin-cream'
    : 'bg-svabin-bg/60 border-svabin-border hover:border-svabin-borderlight text-svabin-sand';
}

function stripImage(beer) {
  const imageUrl = safeCatalogImageUrl(beer.image);
  if (imageUrl) {
    return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(beer.name)}" loading="lazy" decoding="async" class="w-7 h-9 rounded-sm shrink-0 object-contain bg-svabin-elevated border border-svabin-borderlight">`;
  }

  return `
    <div class="w-7 h-9 rounded-sm shrink-0 flex items-center justify-center font-serif font-semibold text-xs border border-black/30 shadow-sm" style="background:${safeCssColor(beer.paperBg, '#ece3d2')}; color:${safeCssColor(beer.inkPrimary, '#241e18')};">
      ${escapeHtml(beer.epm || 'Š')}
    </div>
  `;
}

export function renderBeerStrip(root, { beers, selectedId, onSelect, onCatalog } = {}) {
  root.innerHTML = `
    <div class="flex items-center justify-between mb-2 px-1 gap-3">
      <span class="text-xs font-medium text-svabin-muted">Vyber své pivo k otevření a načepování (${beers.length} várek v katalogu)</span>
      <button type="button" data-catalog class="text-xs font-medium text-svabin-amber hover:underline shrink-0">Zobrazit celý e-shop →</button>
    </div>
    <div class="flex gap-2 overflow-x-auto pb-1">
      ${beers
        .map(
          (beer) => `
            <button type="button" data-beer-id="${escapeHtml(beer.id)}" class="shrink-0 w-40 text-left px-3 py-2 rounded-md border transition flex items-center gap-2.5 ${cardClass(
              beer.id === selectedId,
            )}">
              ${stripImage(beer)}
              <div class="min-w-0 flex-1">
                <div class="font-serif font-semibold text-sm text-svabin-cream truncate">${escapeHtml(beer.name)}</div>
                <div class="text-[11px] text-svabin-muted truncate">${escapeHtml(beer.subtitle)}</div>
              </div>
            </button>
          `,
        )
        .join('')}
    </div>
  `;
  root.querySelector('[data-catalog]')?.addEventListener('click', () => onCatalog?.());
  root.querySelectorAll('[data-beer-id]').forEach((button) => {
    button.addEventListener('click', () => onSelect?.(button.dataset.beerId));
  });
}
