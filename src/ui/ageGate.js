const AGE_KEY = 'svabin.age.ok';

export function hasAgeConsent(storage = globalThis.localStorage) {
  try {
    return storage.getItem(AGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function renderAgeGate({ onAccept } = {}) {
  const gate = document.createElement('div');
  gate.id = 'ageGate';
  gate.className =
    'fixed inset-0 z-[70] bg-svabin-bg/95 backdrop-blur-md flex items-center justify-center p-5';
  gate.innerHTML = `
    <div class="max-w-md w-full bg-svabin-surface border border-svabin-borderlight rounded-xl p-6 sm:p-8 shadow-2xl text-center">
      <div class="text-xs font-semibold text-svabin-amber mb-2">Pivovar Švabín · Virtuální výčep</div>
      <h1 class="font-serif font-semibold text-3xl text-svabin-cream">Je ti 18 let?</h1>
      <p class="text-sm text-svabin-sand mt-3 leading-relaxed">
        Tahle stránka pracuje s pivem a je určena pouze dospělým. Potvrzením souhlasíš se vstupem do virtuálního výčepu.
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
        <button type="button" data-age-accept class="py-3 px-4 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-sm transition">
          Ano, je mi 18+
        </button>
        <a href="https://svabin.com/" class="py-3 px-4 rounded-md bg-svabin-elevated hover:bg-svabin-border text-svabin-sand font-semibold text-sm transition">
          Odejit na svabin.com
        </a>
      </div>
    </div>
  `;

  gate.querySelector('[data-age-accept]').addEventListener('click', () => {
    try {
      globalThis.localStorage?.setItem(AGE_KEY, '1');
    } catch {}
    gate.remove();
    onAccept?.();
  });

  document.body.append(gate);
  return gate;
}
