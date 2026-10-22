import { updateHeaderView } from './header.js';

export function renderViews(root) {
  root.innerHTML = `
    <section id="viewSimulator" class="flex-1 flex flex-col gap-5"></section>
    <section id="viewCatalog" class="hidden flex-col gap-8 py-2"></section>
    <section id="viewStory" class="hidden flex-col gap-6 py-2"></section>
    <section id="viewCheckout" class="hidden flex-col gap-6 py-2"></section>
  `;
}

export function switchMainView(view) {
  const views = {
    simulator: document.getElementById('viewSimulator'),
    catalog: document.getElementById('viewCatalog'),
    story: document.getElementById('viewStory'),
    checkout: document.getElementById('viewCheckout'),
  };
  const next = views[view] ? view : 'simulator';

  Object.entries(views).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle('hidden', key !== next);
    el.classList.toggle('flex', key === next);
  });

  updateHeaderView(next);
  if (next === 'simulator') {
    setTimeout(() => globalThis.dispatchEvent?.(new Event('resize')), 30);
  }
}

export function showBanner(message) {
  const banner = document.getElementById('fallbackBanner');
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove('hidden');
}

export function showToast(message) {
  const box = document.getElementById('toastBox');
  const text = document.getElementById('toastText');
  if (!box || !text) return;
  text.textContent = message;
  box.classList.remove('opacity-0', 'translate-y-2');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => box.classList.add('opacity-0', 'translate-y-2'), 2400);
}
