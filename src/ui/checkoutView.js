export function renderCheckoutView(root, { cart, onBackToCart } = {}) {
  const total = cart?.total?.() || 0;
  root.innerHTML = `
    <div class="bg-svabin-surface border border-svabin-border rounded-lg p-6 sm:p-8 max-w-3xl mx-auto w-full">
      <div class="text-xs font-medium text-svabin-amber mb-2">Pokladna · připraveno pro Task 9</div>
      <h2 class="font-serif font-semibold text-3xl text-svabin-cream">Dokončení objednávky</h2>
      <p class="text-sm text-svabin-muted mt-2 leading-relaxed">
        Tohle je zatím pouze UI shell. Odeslání objednávky, validace a platební tok budou dopojené v Tasku 9.
      </p>
      <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label class="text-xs text-svabin-sand">E-mail
          <input disabled placeholder="zakaznik@example.cz" class="mt-1 w-full rounded-md bg-svabin-bg border border-svabin-border px-3 py-2 text-sm text-svabin-muted" />
        </label>
        <label class="text-xs text-svabin-sand">Telefon
          <input disabled placeholder="+420 ..." class="mt-1 w-full rounded-md bg-svabin-bg border border-svabin-border px-3 py-2 text-sm text-svabin-muted" />
        </label>
        <label class="sm:col-span-2 text-xs text-svabin-sand">Doručovací adresa
          <textarea disabled rows="3" placeholder="Packeta / adresa domů" class="mt-1 w-full rounded-md bg-svabin-bg border border-svabin-border px-3 py-2 text-sm text-svabin-muted"></textarea>
        </label>
      </div>
      <div class="mt-6 bg-svabin-bg border border-svabin-border rounded-md p-4 flex items-center justify-between">
        <span class="text-sm text-svabin-muted">Aktuální mezisoučet</span>
        <strong class="text-lg text-svabin-cream">${total.toLocaleString('cs-CZ')} Kč</strong>
      </div>
      <div class="mt-6 flex flex-wrap gap-2">
        <button type="button" data-back-cart class="py-2.5 px-4 rounded-md bg-svabin-elevated hover:bg-svabin-borderlight text-svabin-cream font-semibold text-sm transition">Zpět ke košíku</button>
        <button type="button" disabled class="py-2.5 px-4 rounded-md bg-svabin-amber text-svabin-bg font-semibold text-sm opacity-45 cursor-not-allowed">Odeslání bude v Tasku 9</button>
      </div>
    </div>
  `;
  root.querySelector('[data-back-cart]')?.addEventListener('click', () => onBackToCart?.());
}
