import './style.css';
import { loadCatalog } from './data/catalog.js';
import { createCart } from './cart/cart.js';
import { createSfx } from './audio/sfx.js';
import { createPourSimulator } from './sim/pourSimulator.js';
import { hasAgeConsent, renderAgeGate } from './ui/ageGate.js';
import { renderBeerStrip } from './ui/beerStrip.js';
import { renderCartDrawer, toggleCartDrawer, updateCartDrawer } from './ui/cartDrawer.js';
import { renderCatalogView } from './ui/catalogView.js';
import { renderCheckoutView } from './ui/checkoutView.js';
import { renderHeader, updateCartBadge, updateSoundToggle } from './ui/header.js';
import { updateProductPanel, updatePurchaseMode } from './ui/productPanel.js';
import { renderStoryView } from './ui/storyView.js';
import { renderViews, showBanner, showToast, switchMainView } from './ui/views.js';

const app = document.querySelector('#app');
const cart = createCart();
const sfx = createSfx();

let catalog = null;
let sim = null;
let selectedBeer = null;
let purchaseMode = 'sub';
let activeCategory = 'all';
let vesselType = 'can';
let glassType = 'mug';
let glassTilted = true;

function enhanceBeer(beer) {
  return {
    ...beer,
    paperBg: beer.paperBg || '#ece3d2',
    inkPrimary: beer.inkPrimary || '#241e18',
    liquidTop: beer.liquidTop || '#e8a828',
    liquidMid: beer.liquidMid || '#c67810',
  };
}

function findBeer(id) {
  return catalog.beers.find((beer) => beer.id === id);
}

function renderSimulatorView(root) {
  root.innerHTML = `
    <div class="bg-svabin-surface border border-svabin-border rounded-lg p-3" id="beerStrip"></div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div class="lg:col-span-4 flex flex-col gap-4 order-2 lg:order-1">
        <div class="bg-svabin-surface border border-svabin-border rounded-lg p-5 flex flex-col gap-4">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span id="infoTag" class="text-[11px] font-medium px-2.5 py-0.5 rounded bg-svabin-elevated text-svabin-sand border border-svabin-borderlight">Skladem</span>
              <span class="text-xs font-medium text-svabin-amber">★ <span id="infoRating">4.2</span> / 5</span>
            </div>
            <h1 id="infoName" class="font-serif font-semibold text-3xl text-svabin-cream tracking-tight"></h1>
            <p id="infoTagline" class="text-sm font-medium text-svabin-sand mt-0.5"></p>
            <p id="infoStyleLine" class="text-xs text-svabin-muted mt-1"></p>
          </div>
          <p id="infoDesc" class="text-xs sm:text-sm text-svabin-sand/90 leading-relaxed border-t border-svabin-border pt-3.5"></p>
          <div class="border-t border-svabin-border pt-3.5 space-y-2.5">
            <div class="text-xs font-semibold text-svabin-cream">Chuťový profil</div>
            <div class="space-y-2 text-xs">
              <div><div class="flex justify-between text-svabin-muted mb-1"><span>Chmelovost</span><span id="profileHopVal" class="text-svabin-sand"></span></div><div class="h-1.5 bg-svabin-elevated rounded-sm overflow-hidden"><div id="profileHopBar" class="h-full bg-svabin-amber transition-all duration-300"></div></div></div>
              <div><div class="flex justify-between text-svabin-muted mb-1"><span>Hořkost</span><span id="profileBitterVal" class="text-svabin-sand"></span></div><div class="h-1.5 bg-svabin-elevated rounded-sm overflow-hidden"><div id="profileBitterBar" class="h-full bg-svabin-amber transition-all duration-300"></div></div></div>
              <div><div class="flex justify-between text-svabin-muted mb-1"><span>Sladovost</span><span id="profileMaltVal" class="text-svabin-sand"></span></div><div class="h-1.5 bg-svabin-elevated rounded-sm overflow-hidden"><div id="profileMaltBar" class="h-full bg-svabin-amber transition-all duration-300"></div></div></div>
            </div>
          </div>
          <div class="border-t border-svabin-border pt-3.5">
            <div class="text-xs font-semibold text-svabin-cream mb-2">Varní list</div>
            <dl class="divide-y divide-svabin-border text-xs">
              <div class="py-1.5 flex justify-between gap-4"><dt class="text-svabin-muted">Chmele</dt><dd id="infoHops" class="text-svabin-cream text-right font-medium"></dd></div>
              <div class="py-1.5 flex justify-between gap-4"><dt class="text-svabin-muted">Slady</dt><dd id="infoMalts" class="text-svabin-cream text-right font-medium"></dd></div>
              <div class="py-1.5 flex justify-between gap-4"><dt class="text-svabin-muted">Parametry</dt><dd id="infoParams" class="text-svabin-cream text-right font-medium"></dd></div>
              <div class="py-1.5 flex justify-between gap-4"><dt class="text-svabin-muted">Energie (100 ml)</dt><dd id="infoEnergy" class="text-svabin-sand text-right"></dd></div>
            </dl>
          </div>
          <div class="border-t border-svabin-border pt-4 space-y-3">
            <div class="flex items-center justify-between"><span class="text-xs font-semibold text-svabin-cream">Vezmi si ho domů (balení 6 ks)</span><span id="stockPurchaseStatus" class="text-[11px] text-svabin-greentext">Skladem</span></div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <button id="buySubBtn" type="button"><div class="flex items-center justify-between"><span class="font-semibold text-svabin-cream">Předplatné</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-svabin-amber/20 text-svabin-amber font-semibold">-15 %</span></div><div id="priceSubText" class="text-sm font-bold text-svabin-cream mt-1"></div><div class="text-[10px] text-svabin-muted">+ doprava zdarma</div></button>
              <button id="buyOnceBtn" type="button"><div class="font-semibold text-svabin-sand">Jednorázově</div><div id="priceOnceText" class="text-sm font-bold text-svabin-cream mt-1"></div><div id="pricePerUnitText" class="text-[10px] text-svabin-muted"></div></button>
            </div>
            <button id="addSelectedBtn" type="button" class="w-full py-2.5 px-4 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2"><span id="btnBuyText">Do košíku</span><span id="btnBuyDivider">·</span><span id="btnBuyPriceLabel"></span></button>
          </div>
        </div>
      </div>
      <div class="lg:col-span-5 flex flex-col order-1 lg:order-2">
        <div class="bg-svabin-surface border border-svabin-border rounded-lg overflow-hidden flex flex-col">
          <div class="px-4 py-2.5 bg-svabin-elevated/70 border-b border-svabin-border flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2"><span id="statusIndicator" class="w-2 h-2 rounded-full bg-svabin-amber"></span><span id="stepTitle" class="font-medium text-svabin-cream">Krok 1: Klikni na pivo pro otevření</span></div>
            <div class="flex items-center gap-3 text-svabin-muted"><span>Objem: <strong id="hudLiquidMl" class="text-svabin-cream font-medium">0 ml</strong></span><span>·</span><span>Pěna: <strong id="hudFoamPct" class="text-svabin-cream font-medium">0 %</strong></span><span>·</span><span id="hudPourStyle" class="text-svabin-sand font-medium">Připraveno</span></div>
          </div>
          <div id="canvasContainer" class="relative w-full h-[430px] sm:h-[500px] cursor-grab active:cursor-grabbing touch-none"><canvas id="beerCanvas" class="block w-full h-full"></canvas></div>
          <div class="p-3 bg-svabin-elevated border-t border-svabin-border flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2"><button id="btnOpenVessel" type="button" class="px-4 py-2 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-xs sm:text-sm transition"><span id="btnOpenVesselText">Otevřít plechovku</span></button><button id="btnHladinka" type="button" class="px-3.5 py-2 rounded-md bg-svabin-surface hover:bg-svabin-bg text-svabin-cream border border-svabin-borderlight font-medium text-xs sm:text-sm transition">Načepovat Hladinku</button></div>
            <div class="flex items-center gap-2"><button id="btnDrinkSip" type="button" disabled class="px-3.5 py-2 rounded-md bg-svabin-green hover:brightness-110 disabled:opacity-35 disabled:pointer-events-none text-svabin-cream font-medium text-xs sm:text-sm transition">Napít se</button><button id="btnResetSim" type="button" class="px-3 py-2 rounded-md bg-svabin-surface hover:bg-svabin-bg text-svabin-muted hover:text-svabin-cream border border-svabin-border text-xs sm:text-sm transition">Čisté sklo</button></div>
          </div>
        </div>
      </div>
      <div class="lg:col-span-3 flex flex-col gap-4 order-3">
        <div class="bg-svabin-surface border border-svabin-border rounded-lg p-4 flex flex-col gap-4">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-svabin-muted">Nastavení čepování</h2>
          <div><label class="text-xs text-svabin-sand block mb-1.5">Obal piva</label><div class="grid grid-cols-2 gap-1.5 p-1 bg-svabin-bg rounded-md border border-svabin-border text-xs"><button id="pkgCanBtn" type="button" class="py-1.5 px-2.5 rounded font-medium transition bg-svabin-elevated text-svabin-cream">Plechovka 0,5 l</button><button id="pkgBottleBtn" type="button" class="py-1.5 px-2.5 rounded font-medium transition text-svabin-muted hover:text-svabin-cream">Skleněná lahev</button></div></div>
          <div><label class="text-xs text-svabin-sand block mb-1.5">Pivní sklo</label><div class="grid grid-cols-3 gap-1.5 p-1 bg-svabin-bg rounded-md border border-svabin-border text-xs"><button id="glassMugBtn" type="button" class="py-1.5 px-2 rounded font-medium transition bg-svabin-elevated text-svabin-cream">Krigl</button><button id="glassTekuBtn" type="button" class="py-1.5 px-2 rounded font-medium transition text-svabin-muted hover:text-svabin-cream">Teku</button><button id="glassPintBtn" type="button" class="py-1.5 px-2 rounded font-medium transition text-svabin-muted hover:text-svabin-cream">Štucl</button></div></div>
          <div class="pt-1 border-t border-svabin-border"><div class="flex justify-between text-xs mb-2"><span class="text-svabin-sand">Náklon při nalévání</span><span id="pourAngleVal" class="font-semibold text-svabin-cream">0°</span></div><input id="pourAngleSlider" type="range" min="0" max="135" value="0" class="w-full"></div>
          <div class="pt-3 border-t border-svabin-border flex items-center justify-between gap-2"><div><span class="text-xs text-svabin-sand block">Držení sklenice</span><span class="text-[11px] text-svabin-muted">Po skle tvoří jemnou pěnu</span></div><button id="glassTiltBtn" type="button" class="px-3 py-1.5 rounded bg-svabin-elevated border border-svabin-borderlight text-xs font-medium text-svabin-cream transition">Nakloněná (30°)</button></div>
          <div class="pt-3 border-t border-svabin-border"><label class="text-xs text-svabin-sand block mb-2">Automatické načepování sládkem</label><div class="grid grid-cols-3 gap-1.5 text-xs"><button data-pour-style="hladinka" type="button" class="py-2 px-2 rounded bg-svabin-bg hover:bg-svabin-elevated border border-svabin-border text-svabin-cream font-medium transition">Hladinka</button><button data-pour-style="snyt" type="button" class="py-2 px-2 rounded bg-svabin-bg hover:bg-svabin-elevated border border-svabin-border text-svabin-cream font-medium transition">Šnyt</button><button data-pour-style="mliko" type="button" class="py-2 px-2 rounded bg-svabin-bg hover:bg-svabin-elevated border border-svabin-border text-svabin-cream font-medium transition">Mlíko</button></div></div>
        </div>
        <div class="bg-svabin-surface border border-svabin-border rounded-lg p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between border-b border-svabin-border pb-2.5"><div><div class="text-xs font-semibold text-svabin-cream">Takhle to vidí náš sládek</div><div class="text-[11px] text-svabin-muted">Zdeněk Sirůček · Sládek pivovaru Švabín</div></div><span id="tapsterScoreBadge" class="text-[11px] font-medium px-2 py-0.5 rounded bg-svabin-elevated text-svabin-amber border border-svabin-borderlight">Připraveno</span></div>
          <p id="tapsterQuote" class="text-xs text-svabin-sand leading-relaxed italic"></p>
          <div class="pt-2 border-t border-svabin-border flex items-center justify-between text-[11px] text-svabin-muted"><span>Nefiltrované · Živé pivo</span><span id="sipCounterText">Odebrané doušky: 0</span></div>
        </div>
      </div>
    </div>
  `;
}

function renderBeerSelectors() {
  renderBeerStrip(document.getElementById('beerStrip'), {
    beers: catalog.beers,
    selectedId: selectedBeer.id,
    onSelect: (id) => selectBeer(id),
    onCatalog: () => switchMainView('catalog'),
  });
}

function selectBeer(id) {
  selectedBeer = findBeer(id) || selectedBeer;
  updateProductPanel(selectedBeer, purchaseMode);
  renderBeerSelectors();
  sim?.selectBeer(selectedBeer);
  showToast(`${selectedBeer.name} připraven k otevření`);
}

function addBeerToCart(id = selectedBeer.id) {
  const beer = findBeer(id);
  if (!beer || !beer.inStock) {
    showToast('Tohle pivo teď není skladem.');
    return;
  }
  cart.add(beer, purchaseMode);
  showToast(`${beer.name} přidán do košíku`);
}

function renderCatalog() {
  renderCatalogView(document.getElementById('viewCatalog'), {
    catalog,
    activeCategory,
    onFilter: (cat) => {
      activeCategory = cat;
      renderCatalog();
    },
    onOpenBeer: (id) => {
      selectBeer(id);
      switchMainView('simulator');
    },
    onAddBeer: (id) => addBeerToCart(id),
  });
}

function setVessel(type) {
  vesselType = type;
  sim?.setVesselType(type);
  document.getElementById('btnOpenVesselText').textContent = type === 'can' ? 'Otevřít plechovku' : 'Otevřít lahev';
  document.getElementById('pkgCanBtn').className =
    type === 'can'
      ? 'py-1.5 px-2.5 rounded font-medium transition bg-svabin-elevated text-svabin-cream'
      : 'py-1.5 px-2.5 rounded font-medium transition text-svabin-muted hover:text-svabin-cream';
  document.getElementById('pkgBottleBtn').className =
    type === 'bottle'
      ? 'py-1.5 px-2.5 rounded font-medium transition bg-svabin-elevated text-svabin-cream'
      : 'py-1.5 px-2.5 rounded font-medium transition text-svabin-muted hover:text-svabin-cream';
}

function setGlass(type) {
  glassType = type;
  sim?.setGlassType(type);
  ['mug', 'teku', 'pint'].forEach((key) => {
    const el = document.getElementById({ mug: 'glassMugBtn', teku: 'glassTekuBtn', pint: 'glassPintBtn' }[key]);
    el.className =
      key === glassType
        ? 'py-1.5 px-2 rounded font-medium transition bg-svabin-elevated text-svabin-cream'
        : 'py-1.5 px-2 rounded font-medium transition text-svabin-muted hover:text-svabin-cream';
  });
}

function updateHud(hud) {
  document.getElementById('hudLiquidMl').textContent = hud.liquidMl;
  document.getElementById('hudFoamPct').textContent = hud.foamPct;
  document.getElementById('hudPourStyle').textContent = hud.pourStyle;
  document.getElementById('btnDrinkSip').disabled = !hud.canSip;
  document.getElementById('sipCounterText').textContent = `Odebrané doušky: ${hud.sipsTaken}`;
  document.getElementById('tapsterScoreBadge').textContent = hud.pourStyle;
  document.getElementById('stepTitle').textContent = hud.raw.isOpened ? 'Nalévej tažením nebo tlačítkem sládka' : 'Krok 1: Klikni na pivo pro otevření';
}

function bindSimulatorControls() {
  document.getElementById('buySubBtn').addEventListener('click', () => {
    purchaseMode = 'sub';
    updatePurchaseMode(purchaseMode, selectedBeer);
  });
  document.getElementById('buyOnceBtn').addEventListener('click', () => {
    purchaseMode = 'once';
    updatePurchaseMode(purchaseMode, selectedBeer);
  });
  document.getElementById('addSelectedBtn').addEventListener('click', () => addBeerToCart());
  document.getElementById('btnOpenVessel').addEventListener('click', () => sim?.triggerOpen());
  document.getElementById('btnHladinka').addEventListener('click', () => sim?.startMasterPour('hladinka'));
  document.getElementById('btnDrinkSip').addEventListener('click', () => sim?.takeSip());
  document.getElementById('btnResetSim').addEventListener('click', () => sim?.reset());
  document.getElementById('pkgCanBtn').addEventListener('click', () => setVessel('can'));
  document.getElementById('pkgBottleBtn').addEventListener('click', () => setVessel('bottle'));
  document.getElementById('glassMugBtn').addEventListener('click', () => setGlass('mug'));
  document.getElementById('glassTekuBtn').addEventListener('click', () => setGlass('teku'));
  document.getElementById('glassPintBtn').addEventListener('click', () => setGlass('pint'));
  document.getElementById('glassTiltBtn').addEventListener('click', () => {
    glassTilted = !glassTilted;
    sim?.toggleGlassTilt();
    const btn = document.getElementById('glassTiltBtn');
    btn.textContent = glassTilted ? 'Nakloněná (30°)' : 'Postavená (0°)';
  });
  document.getElementById('pourAngleSlider').addEventListener('input', (event) => {
    const value = event.target.value;
    document.getElementById('pourAngleVal').textContent = `${value}°`;
    sim?.setTilt(value);
  });
  document.querySelectorAll('[data-pour-style]').forEach((button) => {
    button.addEventListener('click', () => sim?.startMasterPour(button.dataset.pourStyle));
  });
}

async function startApp() {
  app.innerHTML = `
    <header id="siteHeader" class="sticky top-0 z-40 bg-svabin-bg/95 backdrop-blur-md border-b border-svabin-border"></header>
    <div id="fallbackBanner" class="hidden bg-svabin-amber text-svabin-bg text-center text-xs font-semibold px-4 py-2"></div>
    <main id="mainViews" class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col"></main>
    <div id="drawerRoot"></div>
    <div id="toastBox" class="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 translate-y-2 transition-all duration-200 bg-svabin-elevated border border-svabin-borderlight px-4 py-2.5 rounded-md shadow-xl text-xs sm:text-sm text-svabin-cream"><span id="toastText">Pivo připraveno</span></div>
  `;

  renderHeader(document.getElementById('siteHeader'), {
    onNavigate: (view) => {
      if (view === 'checkout')
        renderCheckoutView(document.getElementById('viewCheckout'), {
          cart,
          onBackToCart: () => toggleCartDrawer(true),
          onBackToCatalog: () => switchMainView('catalog'),
        });
      switchMainView(view);
    },
    onToggleSound: async () => {
      const enabled = !sfx.isEnabled();
      if (enabled) await sfx.unlock();
      sfx.setEnabled(enabled);
      updateSoundToggle(enabled);
    },
    onOpenCart: () => toggleCartDrawer(true),
  });

  renderViews(document.getElementById('mainViews'));
  catalog = await loadCatalog();
  catalog.beers = catalog.beers.map(enhanceBeer);
  selectedBeer = catalog.beers.find((beer) => beer.inStock) || catalog.beers[0];
  if (catalog.source === 'fallback') showBanner('Katalog ze svabin.com teď nejde načíst — ukazujeme záložní data.');

  renderSimulatorView(document.getElementById('viewSimulator'));
  renderBeerSelectors();
  renderCatalog();
  renderStoryView(document.getElementById('viewStory'), { onBack: () => switchMainView('simulator') });
  const checkoutOpts = {
    cart,
    onBackToCart: () => toggleCartDrawer(true),
    onBackToCatalog: () => switchMainView('catalog'),
  };
  renderCheckoutView(document.getElementById('viewCheckout'), checkoutOpts);
  renderCartDrawer(document.getElementById('drawerRoot'), {
    cart,
    shipping: catalog.shipping,
    onClose: () => toggleCartDrawer(false),
    onCheckout: () => {
      toggleCartDrawer(false);
      renderCheckoutView(document.getElementById('viewCheckout'), checkoutOpts);
      switchMainView('checkout');
    },
  });

  bindSimulatorControls();
  updateProductPanel(selectedBeer, purchaseMode);
  sim = createPourSimulator({ canvas: document.getElementById('beerCanvas'), sfx, onHud: updateHud });
  sim.selectBeer(selectedBeer);
  cart.subscribe((items) => {
    updateCartBadge(items.reduce((sum, item) => sum + item.qty, 0));
    updateCartDrawer(cart, catalog.shipping);
    renderCheckoutView(document.getElementById('viewCheckout'), checkoutOpts);
  });
  updateCartBadge(cart.getItems().reduce((sum, item) => sum + item.qty, 0));
  switchMainView('simulator');
}

if (hasAgeConsent()) {
  startApp();
} else {
  app.innerHTML = '<div class="min-h-screen"></div>';
  renderAgeGate({ onAccept: startApp });
}
