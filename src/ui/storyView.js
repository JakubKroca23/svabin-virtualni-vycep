export function renderStoryView(root, { onBack } = {}) {
  root.innerHTML = `
    <div class="bg-svabin-surface border border-svabin-border rounded-lg p-6 sm:p-10 max-w-4xl mx-auto w-full space-y-6">
      <div class="text-xs font-medium text-svabin-amber">Historický pivovar Švabín · Zbiroh, Plzeňský kraj</div>
      <h2 class="font-serif font-semibold text-3xl sm:text-4xl text-svabin-cream leading-tight">
        Pivovar z roku 1567 chátral sedmdesát let. Dnes znovu vaří.
      </h2>
      <p class="text-sm sm:text-base text-svabin-sand leading-relaxed">
        Vaříme na Plzeňsku, v kraji, který dal světu plzeňský ležák. V roce 1948 pivovar znárodnili, v roce 1952 zavřeli. Měděnou varnu rozebrali a odvezli do velkého plzeňského pivovaru. V roce 2018 jsme pivovar koupili a od roku 2022 ho dáváme dohromady.
      </p>
      <div class="bg-svabin-bg border border-svabin-border rounded-lg p-5 space-y-2.5">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <span class="text-xs font-semibold text-svabin-cream">Obnova historického výstavu</span>
          <span class="text-xs font-semibold text-svabin-amber">1 040 / 17 000 hl · cesta pokračuje</span>
        </div>
        <div class="h-2 bg-svabin-elevated rounded-sm overflow-hidden">
          <div class="h-full bg-svabin-amber" style="width:14%"></div>
        </div>
        <p class="text-xs text-svabin-muted">Každou objednávkou podporuješ obnovu pivovaru a vznik středověkého parku ve Zbiroze.</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div class="bg-svabin-elevated/60 border border-svabin-border rounded-lg p-4">
          <div class="font-serif font-semibold text-xl text-svabin-cream">Voda z Plzeňska</div>
          <p class="text-xs text-svabin-muted mt-1.5 leading-relaxed">Měkká voda pro poctivé české ležáky vařené tradičně na dva až tři rmuty.</p>
        </div>
        <div class="bg-svabin-elevated/60 border border-svabin-border rounded-lg p-4">
          <div class="font-serif font-semibold text-xl text-svabin-cream">Bronz IBC Londýn</div>
          <p class="text-xs text-svabin-muted mt-1.5 leading-relaxed">Leshy TDH Double IPA získal bronz na International Beer Challenge v degustaci naslepo.</p>
        </div>
        <div class="bg-svabin-elevated/60 border border-svabin-border rounded-lg p-4">
          <div class="font-serif font-semibold text-xl text-svabin-cream">Živé pivo</div>
          <p class="text-xs text-svabin-muted mt-1.5 leading-relaxed">Bez filtrace a pasterizace, stáčené čerstvě pro lidi, kteří chtějí chuť várky.</p>
        </div>
      </div>
      <div class="pt-4 border-t border-svabin-border flex items-center justify-between gap-4">
        <span class="text-xs text-svabin-muted">Máš žízeň po dobrodružství?</span>
        <button type="button" data-back class="px-5 py-2.5 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-xs sm:text-sm transition">Zpět do virtuálního výčepu →</button>
      </div>
    </div>
  `;
  root.querySelector('[data-back]')?.addEventListener('click', () => onBack?.());
}
