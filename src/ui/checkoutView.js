import { DEMO_DISCLAIMER, saveOrder, validateCheckoutForm } from '../checkout/checkout.js';
import { escapeHtml } from './dom.js';

let lastOrderId = null;

function formatCzk(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('cs-CZ') : '0';
}

function fieldClass(hasError) {
  return `mt-1 w-full rounded-md bg-svabin-bg border px-3 py-2 text-sm text-svabin-cream ${
    hasError ? 'border-red-500/70' : 'border-svabin-border'
  }`;
}

function readFormFields(form) {
  return {
    name: form.name.value,
    email: form.email.value,
    phone: form.phone.value,
    street: form.street.value,
    city: form.city.value,
    zip: form.zip.value,
    note: form.note.value,
    ageConfirmed: form.ageConfirmed.checked,
  };
}

function renderSuccessPanel(root, orderId, { onBackToCatalog } = {}) {
  root.innerHTML = `
    <div class="bg-svabin-surface border border-svabin-border rounded-lg p-6 sm:p-8 max-w-3xl mx-auto w-full text-center">
      <div class="text-xs font-medium text-svabin-greentext mb-2">Objednávka přijata</div>
      <h2 class="font-serif font-semibold text-3xl text-svabin-cream">Děkujeme!</h2>
      <p class="text-sm text-svabin-muted mt-3 leading-relaxed">
        Demo objednávka je uložená lokálně. Číslo objednávky:
        <strong class="text-svabin-amber font-semibold">${escapeHtml(orderId)}</strong>
      </p>
      <p class="text-xs text-svabin-muted mt-4">${escapeHtml(DEMO_DISCLAIMER)}</p>
      <button type="button" data-back-catalog class="mt-6 py-2.5 px-5 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-sm transition">
        Zpět do e‑shopu
      </button>
    </div>
  `;
  root.querySelector('[data-back-catalog]')?.addEventListener('click', () => {
    lastOrderId = null;
    onBackToCatalog?.();
  });
}

function renderEmptyCart(root, { onBackToCatalog } = {}) {
  root.innerHTML = `
    <div class="bg-svabin-surface border border-svabin-border rounded-lg p-6 sm:p-8 max-w-3xl mx-auto w-full">
      <h2 class="font-serif font-semibold text-3xl text-svabin-cream">Pokladna</h2>
      <p class="text-sm text-svabin-muted mt-2">Košík je prázdný — nejdřív přidej pivo z e‑shopu.</p>
      <p class="text-xs text-svabin-muted mt-4 border border-svabin-border rounded-md p-3 bg-svabin-bg">${escapeHtml(DEMO_DISCLAIMER)}</p>
      <button type="button" data-back-catalog class="mt-6 py-2.5 px-4 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-sm transition">
        Zpět do e‑shopu
      </button>
    </div>
  `;
  root.querySelector('[data-back-catalog]')?.addEventListener('click', () => onBackToCatalog?.());
}

function renderCheckoutForm(root, { cart, onBackToCart, onBackToCatalog } = {}) {
  const items = cart?.getItems?.() || [];
  const total = cart?.total?.() || 0;
  const itemSummary = items
    .map((item) => `<li class="text-xs text-svabin-sand">${escapeHtml(item.qty)}× ${escapeHtml(item.name)}</li>`)
    .join('');

  root.innerHTML = `
    <div class="bg-svabin-surface border border-svabin-border rounded-lg p-6 sm:p-8 max-w-3xl mx-auto w-full">
      <div class="text-xs font-medium text-svabin-amber mb-2">Pokladna · demo</div>
      <h2 class="font-serif font-semibold text-3xl text-svabin-cream">Dokončení objednávky</h2>
      <p class="text-xs text-svabin-muted mt-3 border border-svabin-border rounded-md p-3 bg-svabin-bg leading-relaxed">${escapeHtml(DEMO_DISCLAIMER)}</p>

      <form id="checkoutForm" class="mt-6 space-y-4" novalidate>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="text-xs text-svabin-sand sm:col-span-2">Jméno a příjmení
            <input name="name" type="text" autocomplete="name" class="${fieldClass(false)}" />
          </label>
          <label class="text-xs text-svabin-sand">E-mail
            <input name="email" type="email" autocomplete="email" required class="${fieldClass(false)}" data-field="email" />
            <span data-error="email" class="hidden text-[11px] text-red-400 mt-1 block"></span>
          </label>
          <label class="text-xs text-svabin-sand">Telefon
            <input name="phone" type="tel" autocomplete="tel" required class="${fieldClass(false)}" data-field="phone" />
            <span data-error="phone" class="hidden text-[11px] text-red-400 mt-1 block"></span>
          </label>
          <label class="text-xs text-svabin-sand sm:col-span-2">Ulice a číslo
            <input name="street" type="text" autocomplete="street-address" class="${fieldClass(false)}" />
          </label>
          <label class="text-xs text-svabin-sand">Město
            <input name="city" type="text" autocomplete="address-level2" class="${fieldClass(false)}" />
          </label>
          <label class="text-xs text-svabin-sand">PSČ
            <input name="zip" type="text" autocomplete="postal-code" required class="${fieldClass(false)}" data-field="zip" />
            <span data-error="zip" class="hidden text-[11px] text-red-400 mt-1 block"></span>
          </label>
          <label class="text-xs text-svabin-sand sm:col-span-2">Poznámka k doručení
            <textarea name="note" rows="2" class="${fieldClass(false)}"></textarea>
          </label>
        </div>
        <label class="flex items-start gap-2 text-xs text-svabin-sand cursor-pointer">
          <input name="ageConfirmed" type="checkbox" class="mt-0.5 rounded border-svabin-border" data-field="ageConfirmed" />
          <span>Potvrzuji, že jsem starší 18 let a beru na vědomí, že jde o demo objednávku bez platby.</span>
        </label>
        <span data-error="ageConfirmed" class="hidden text-[11px] text-red-400 block -mt-2"></span>

        <div class="bg-svabin-bg border border-svabin-border rounded-md p-4">
          <div class="text-xs font-semibold text-svabin-cream mb-2">Obsah košíku</div>
          <ul class="space-y-1">${itemSummary}</ul>
          <div class="mt-3 pt-3 border-t border-svabin-border flex items-center justify-between">
            <span class="text-sm text-svabin-muted">Celkem</span>
            <strong class="text-lg text-svabin-cream">${escapeHtml(formatCzk(total))} Kč</strong>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 pt-2">
          <button type="button" data-back-cart class="py-2.5 px-4 rounded-md bg-svabin-elevated hover:bg-svabin-borderlight text-svabin-cream font-semibold text-sm transition">Zpět ke košíku</button>
          <button type="submit" data-submit class="py-2.5 px-4 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-sm transition">Odeslat demo objednávku</button>
        </div>
      </form>
    </div>
  `;

  root.querySelector('[data-back-cart]')?.addEventListener('click', () => onBackToCart?.());

  const form = root.querySelector('#checkoutForm');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = readFormFields(form);
    const { ok, errors } = validateCheckoutForm(fields);
    showFieldErrors(root, errors);
    if (!ok) return;

    const orderId = saveOrder({
      ...fields,
      items: cart.getItems(),
      total: cart.total(),
      createdAt: new Date().toISOString(),
    });
    lastOrderId = orderId;
    cart.clear();
    renderCheckoutView(root, { cart, onBackToCart, onBackToCatalog });
  });
}

function showFieldErrors(root, errors) {
  root.querySelectorAll('[data-field]').forEach((input) => {
    const key = input.dataset.field;
    const message = errors[key];
    const errEl = root.querySelector(`[data-error="${key}"]`);
    input.classList.toggle('border-red-500/70', Boolean(message));
    if (errEl) {
      if (message) {
        errEl.textContent = message;
        errEl.classList.remove('hidden');
      } else {
        errEl.textContent = '';
        errEl.classList.add('hidden');
      }
    }
  });
}

export function renderCheckoutView(root, { cart, onBackToCart, onBackToCatalog } = {}) {
  if (!root) return;

  const items = cart?.getItems?.() || [];
  if (items.length > 0) lastOrderId = null;

  if (lastOrderId) {
    renderSuccessPanel(root, lastOrderId, { onBackToCatalog });
    return;
  }

  if (items.length === 0) {
    renderEmptyCart(root, { onBackToCatalog });
    return;
  }

  renderCheckoutForm(root, { cart, onBackToCart, onBackToCatalog });
}
