const ACTIVE_DESKTOP =
  'px-3.5 py-1.5 rounded-md font-medium text-svabin-cream bg-svabin-elevated transition';
const INACTIVE_DESKTOP =
  'px-3.5 py-1.5 rounded-md font-medium text-svabin-muted hover:text-svabin-cream transition';
const ACTIVE_MOBILE = 'px-2.5 py-1 rounded bg-svabin-elevated text-svabin-cream font-medium';
const INACTIVE_MOBILE = 'px-2.5 py-1 rounded text-svabin-muted font-medium';

export function renderHeader(root, { onNavigate, onToggleSound, onOpenCart } = {}) {
  root.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      <div class="flex items-center gap-6">
        <button type="button" data-view-link="simulator" class="text-left group flex items-baseline gap-2.5">
          <span class="font-serif font-semibold text-2xl tracking-tight text-svabin-cream">Švabín</span>
          <span class="text-xs text-svabin-muted hidden sm:inline">Zal. roku 1567</span>
        </button>
        <nav class="hidden md:flex items-center gap-1 text-sm">
          <button id="navTapBtn" type="button" data-view-link="simulator" class="${ACTIVE_DESKTOP}">Virtuální výčep</button>
          <button id="navEshopBtn" type="button" data-view-link="catalog" class="${INACTIVE_DESKTOP}">E-shop a piva</button>
          <button id="navStoryBtn" type="button" data-view-link="story" class="${INACTIVE_DESKTOP}">Náš příběh</button>
          <button id="navCheckoutBtn" type="button" data-view-link="checkout" class="${INACTIVE_DESKTOP}">Pokladna</button>
        </nav>
      </div>
      <div class="flex items-center gap-2.5">
        <div class="flex md:hidden bg-svabin-surface border border-svabin-border rounded-md p-0.5 text-xs">
          <button id="mobTapBtn" type="button" data-view-link="simulator" class="${ACTIVE_MOBILE}">Výčep</button>
          <button id="mobEshopBtn" type="button" data-view-link="catalog" class="${INACTIVE_MOBILE}">Piva</button>
          <button id="mobStoryBtn" type="button" data-view-link="story" class="${INACTIVE_MOBILE}">Příběh</button>
          <button id="mobCheckoutBtn" type="button" data-view-link="checkout" class="${INACTIVE_MOBILE}">Platba</button>
        </div>
        <button id="soundToggleBtn" type="button" title="Zvuk otevírání a nalévání" class="h-9 px-3 rounded-md bg-svabin-surface hover:bg-svabin-elevated border border-svabin-border text-xs text-svabin-sand flex items-center gap-1.5 transition">
          <span id="soundIconOn" class="w-4 h-4 text-svabin-muted">♪</span>
          <span id="soundLabel" class="hidden sm:inline">Zvuk vyp.</span>
        </button>
        <button id="cartOpenBtn" type="button" class="h-9 px-3.5 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-xs sm:text-sm flex items-center gap-2 transition">
          <span>Košík</span>
          <span id="cartBadge" class="px-1.5 py-0.2 rounded bg-svabin-bg/20 text-svabin-bg font-bold text-xs">0</span>
        </button>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-view-link]').forEach((button) => {
    button.addEventListener('click', () => onNavigate?.(button.dataset.viewLink));
  });
  root.querySelector('#soundToggleBtn').addEventListener('click', () => onToggleSound?.());
  root.querySelector('#cartOpenBtn').addEventListener('click', () => onOpenCart?.());
}

export function updateHeaderView(view) {
  const navIds = { simulator: 'navTapBtn', catalog: 'navEshopBtn', story: 'navStoryBtn', checkout: 'navCheckoutBtn' };
  const mobIds = { simulator: 'mobTapBtn', catalog: 'mobEshopBtn', story: 'mobStoryBtn', checkout: 'mobCheckoutBtn' };
  Object.entries(navIds).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.className = key === view ? ACTIVE_DESKTOP : INACTIVE_DESKTOP;
  });
  Object.entries(mobIds).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.className = key === view ? ACTIVE_MOBILE : INACTIVE_MOBILE;
  });
}

export function updateSoundToggle(enabled) {
  const icon = document.getElementById('soundIconOn');
  const label = document.getElementById('soundLabel');
  if (icon) icon.className = `w-4 h-4 ${enabled ? 'text-svabin-amber' : 'text-svabin-muted'}`;
  if (label) label.textContent = enabled ? 'Zvuk zap.' : 'Zvuk vyp.';
}

export function updateCartBadge(count) {
  const badge = document.getElementById('cartBadge');
  if (badge) badge.textContent = String(count);
}
