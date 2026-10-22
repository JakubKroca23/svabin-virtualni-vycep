export function renderCartDrawer(root, { cart, shipping = {}, onClose, onCheckout } = {}) {
  root.innerHTML = `
    <div id="cartDrawerBackdrop" class="fixed inset-0 bg-black/65 z-50 hidden opacity-0 transition-opacity"></div>
    <aside id="cartDrawer" class="fixed top-0 right-0 bottom-0 w-full max-w-md bg-svabin-surface border-l border-svabin-border z-50 translate-x-full transition-transform duration-300 flex flex-col justify-between p-5">
      <div>
        <div class="flex items-center justify-between pb-4 border-b border-svabin-border">
          <div>
            <h3 class="font-serif font-semibold text-lg text-svabin-cream">Tvůj košík</h3>
            <p class="text-xs text-svabin-muted">Stáčíme a posíláme čerstvé 2× týdně</p>
          </div>
          <button type="button" data-cart-close class="w-8 h-8 rounded-md bg-svabin-elevated text-svabin-muted hover:text-svabin-cream flex items-center justify-center text-sm">x</button>
        </div>
        <div class="my-3.5 bg-svabin-bg p-3 rounded-md border border-svabin-border">
          <div class="flex justify-between text-xs mb-1.5">
            <span id="shippingStatusText" class="text-svabin-sand">Doprava zdarma od 1 500 Kč (nebo s předplatným)</span>
            <span id="shippingPctText" class="text-svabin-amber font-semibold">0 %</span>
          </div>
          <div class="h-1.5 bg-svabin-elevated rounded-sm overflow-hidden">
            <div id="shippingBar" class="h-full bg-svabin-amber transition-all duration-300" style="width:0%"></div>
          </div>
        </div>
        <div id="cartItemsList" class="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1"></div>
      </div>
      <div class="pt-4 border-t border-svabin-border space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-svabin-muted">Mezisoučet:</span>
          <span id="cartTotalPrice" class="font-bold text-lg text-svabin-cream">0 Kč</span>
        </div>
        <button type="button" data-checkout class="block w-full py-3 px-4 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-sm text-center transition">Pokračovat do pokladny →</button>
      </div>
    </aside>
  `;
  root.querySelector('#cartDrawerBackdrop')?.addEventListener('click', () => onClose?.());
  root.querySelector('[data-cart-close]')?.addEventListener('click', () => onClose?.());
  root.querySelector('[data-checkout]')?.addEventListener('click', () => onCheckout?.());
  updateCartDrawer(cart, shipping);
}

export function updateCartDrawer(cart, shipping = {}) {
  const list = document.getElementById('cartItemsList');
  const totalEl = document.getElementById('cartTotalPrice');
  const shipBar = document.getElementById('shippingBar');
  const shipPctText = document.getElementById('shippingPctText');
  const shipStatus = document.getElementById('shippingStatusText');
  if (!list || !cart) return;

  const items = cart.getItems();
  const total = cart.total();
  const threshold = shipping.free_from || 1500;
  const hasSub = items.some((item) => item.mode === 'sub');
  const pct = hasSub ? 100 : Math.min(100, Math.round((total / threshold) * 100));

  if (totalEl) totalEl.textContent = `${total.toLocaleString('cs-CZ')} Kč`;
  if (shipBar) shipBar.style.width = `${pct}%`;
  if (shipPctText) shipPctText.textContent = `${pct} %`;
  if (shipStatus) {
    shipStatus.textContent =
      hasSub || total >= threshold
        ? 'Doprava Zásilkovnou zdarma'
        : `Do dopravy zdarma zbývá ${(threshold - total).toLocaleString('cs-CZ')} Kč`;
  }

  if (items.length === 0) {
    list.innerHTML = '<div class="text-center py-10 text-xs text-svabin-muted">Košík je zatím prázdný. Vyber své pivo a přidej balení 6 ks.</div>';
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
        <div class="bg-svabin-bg border border-svabin-border rounded-md p-3 flex items-center justify-between gap-2">
          <div>
            <div class="font-serif font-semibold text-sm text-svabin-cream">${item.name}</div>
            <div class="text-xs text-svabin-muted">6 ks · ${item.mode === 'sub' ? 'Předplatné (-15 %)' : 'Jednorázově'} · <strong class="text-svabin-sand">${item.price.toLocaleString('cs-CZ')} Kč</strong></div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" data-qty-key="${item.key}" data-delta="-1" class="w-7 h-7 rounded bg-svabin-surface border border-svabin-border text-xs font-bold text-svabin-cream">-</button>
            <span class="text-xs font-semibold w-4 text-center">${item.qty}</span>
            <button type="button" data-qty-key="${item.key}" data-delta="1" class="w-7 h-7 rounded bg-svabin-surface border border-svabin-border text-xs font-bold text-svabin-cream">+</button>
          </div>
        </div>
      `,
    )
    .join('');

  list.querySelectorAll('[data-qty-key]').forEach((button) => {
    button.addEventListener('click', () => cart.changeQty(button.dataset.qtyKey, Number(button.dataset.delta)));
  });
}

export function toggleCartDrawer(open) {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartDrawerBackdrop');
  if (!drawer || !backdrop) return;
  if (open) {
    backdrop.classList.remove('hidden');
    setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
    drawer.classList.remove('translate-x-full');
  } else {
    backdrop.classList.add('opacity-0');
    drawer.classList.add('translate-x-full');
    setTimeout(() => backdrop.classList.add('hidden'), 300);
  }
}
