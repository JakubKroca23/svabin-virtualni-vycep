import './style.css';
import { loadCatalog } from './data/catalog.js';
import { createSfx } from './audio/sfx.js';
import { createPourSimulator } from './sim/pourSimulator.js';
import { hasAgeConsent, renderAgeGate } from './ui/ageGate.js';
import { renderBeerStrip } from './ui/beerStrip.js';
import { showToast } from './ui/views.js';

const app = document.querySelector('#app');
const sfx = createSfx();

let catalog = null;
let sim = null;
let selectedBeer = null;
let vesselType = 'can';
let glassType = 'mug';
let glassTilted = true;
let soundOn = false;

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
  return catalog?.beers?.find((beer) => beer.id === id);
}

function updateHud(hud) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set('hudLiquidMl', hud.liquidMl);
  set('hudFoamPct', hud.foamPct);
  set('hudPourStyle', hud.pourStyle);
  set('stepTitle', hud.raw?.isOpened ? 'Nalévej náklonem · nebo zvol styl čepování' : 'Klikni na nádobu a otevři ji');
  set('sipCounterText', `Doušky: ${hud.sipsTaken ?? 0}`);
  set('beerTitle', selectedBeer?.name || 'Švabín');
  set('beerMeta', selectedBeer ? `${selectedBeer.subtitle || selectedBeer.style || ''} · ${selectedBeer.abv || ''}`.replace(/\s·\s$/, '') : '');
  const sip = document.getElementById('btnDrinkSip');
  if (sip) sip.disabled = !hud.canSip;
  const indicator = document.getElementById('statusIndicator');
  if (indicator) {
    indicator.className = `w-2 h-2 rounded-full ${hud.raw?.flowRate > 0.05 ? 'bg-svabin-greentext animate-pulse' : 'bg-svabin-amber'}`;
  }
}

function renderBeerSelectors() {
  renderBeerStrip(document.getElementById('beerStrip'), {
    beers: catalog.beers.filter((b) => b.inStock !== false),
    selectedId: selectedBeer.id,
    onSelect: (id) => selectBeer(id),
    hideCatalogLink: true,
  });
}

function selectBeer(id) {
  selectedBeer = findBeer(id) || selectedBeer;
  renderBeerSelectors();
  sim?.selectBeer(selectedBeer);
  document.getElementById('beerTitle').textContent = selectedBeer.name;
  document.getElementById('beerMeta').textContent =
    `${selectedBeer.subtitle || selectedBeer.style || ''} · ${selectedBeer.abv || ''}`.replace(/\s·\s$/, '');
  showToast(`${selectedBeer.name} — připraveno`);
}

function setPkg(type) {
  vesselType = type;
  sim?.setVesselType(type);
  document.getElementById('pkgCanBtn').className =
    `py-1.5 px-2.5 rounded font-medium transition ${type === 'can' ? 'bg-svabin-elevated text-svabin-cream' : 'text-svabin-muted hover:text-svabin-cream'}`;
  document.getElementById('pkgBottleBtn').className =
    `py-1.5 px-2.5 rounded font-medium transition ${type === 'bottle' ? 'bg-svabin-elevated text-svabin-cream' : 'text-svabin-muted hover:text-svabin-cream'}`;
  document.getElementById('btnOpenVesselText').textContent =
    type === 'can' ? 'Otevřít plechovku' : 'Otevřít láhev';
}

function setGlass(type) {
  glassType = type;
  sim?.setGlassType(type);
  ['mug', 'teku', 'pint'].forEach((key) => {
    const el = document.getElementById(
      key === 'mug' ? 'glassMugBtn' : key === 'teku' ? 'glassTekuBtn' : 'glassPintBtn',
    );
    if (!el) return;
    el.className = `py-1.5 px-2 rounded font-medium transition ${
      type === key ? 'bg-svabin-elevated text-svabin-cream' : 'text-svabin-muted hover:text-svabin-cream'
    }`;
  });
}

function bindControls() {
  document.getElementById('btnOpenVessel').addEventListener('click', () => sim?.triggerOpen());
  document.getElementById('btnHladinka').addEventListener('click', () => sim?.startMasterPour('hladinka'));
  document.getElementById('btnDrinkSip').addEventListener('click', () => sim?.takeSip());
  document.getElementById('btnResetSim').addEventListener('click', () => sim?.reset());
  document.getElementById('pkgCanBtn').addEventListener('click', () => setPkg('can'));
  document.getElementById('pkgBottleBtn').addEventListener('click', () => setPkg('bottle'));
  document.getElementById('glassMugBtn').addEventListener('click', () => setGlass('mug'));
  document.getElementById('glassTekuBtn').addEventListener('click', () => setGlass('teku'));
  document.getElementById('glassPintBtn').addEventListener('click', () => setGlass('pint'));
  document.getElementById('glassTiltBtn').addEventListener('click', () => {
    glassTilted = !glassTilted;
    sim?.toggleGlassTilt();
    document.getElementById('glassTiltBtn').textContent = glassTilted ? 'Nakloněná' : 'Postavená';
  });
  document.getElementById('pourAngleSlider').addEventListener('input', (event) => {
    const value = event.target.value;
    document.getElementById('pourAngleVal').textContent = `${value}°`;
    sim?.setTilt(value);
  });
  document.querySelectorAll('[data-pour-style]').forEach((button) => {
    button.addEventListener('click', () => sim?.startMasterPour(button.dataset.pourStyle));
  });
  document.getElementById('soundBtn').addEventListener('click', async () => {
    soundOn = !soundOn;
    if (soundOn) await sfx.unlock();
    sfx.setEnabled(soundOn);
    document.getElementById('soundBtn').textContent = soundOn ? 'Zvuk zap.' : 'Zvuk vyp.';
  });
}

function renderShell() {
  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-black">
      <header class="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <div>
          <div class="font-serif text-xl sm:text-2xl text-svabin-cream tracking-tight">Švabín</div>
          <div class="text-[11px] text-svabin-muted">Virtuální výčep · zal. 1567</div>
        </div>
        <button id="soundBtn" type="button" class="h-9 px-3 rounded-md bg-black/50 border border-white/10 text-xs text-svabin-sand hover:bg-black/70 transition">Zvuk vyp.</button>
      </header>

      <div id="canvasStage" class="relative flex-1 min-h-[70vh] sm:min-h-[78vh] cursor-grab active:cursor-grabbing touch-none">
        <canvas id="beerCanvas" class="absolute inset-0 w-full h-full block"></canvas>
        <div class="pointer-events-none absolute inset-x-0 top-16 sm:top-20 flex flex-col items-center text-center px-4">
          <h1 id="beerTitle" class="font-serif text-3xl sm:text-4xl text-svabin-cream drop-shadow-lg"></h1>
          <p id="beerMeta" class="text-sm text-svabin-sand/90 mt-1 drop-shadow"></p>
        </div>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          <div class="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-svabin-sand">
            <div class="flex items-center gap-2"><span id="statusIndicator" class="w-2 h-2 rounded-full bg-svabin-amber"></span><span id="stepTitle">Načítám výčep…</span></div>
            <div class="flex items-center gap-3 text-svabin-muted"><span>Objem <strong id="hudLiquidMl" class="text-svabin-cream">0 ml</strong></span><span>Pěna <strong id="hudFoamPct" class="text-svabin-cream">0 %</strong></span><span id="hudPourStyle" class="text-svabin-sand">—</span><span id="sipCounterText">Doušky: 0</span></div>
          </div>
        </div>
      </div>

      <div class="border-t border-svabin-border bg-svabin-bg/95 backdrop-blur-md">
        <div class="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex flex-col gap-3">
          <div id="beerStrip"></div>
          <div class="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div class="flex flex-wrap gap-2">
              <button id="btnOpenVessel" type="button" class="px-4 py-2.5 rounded-md bg-svabin-amber hover:bg-svabin-amberhover text-svabin-bg font-semibold text-sm transition"><span id="btnOpenVesselText">Otevřít plechovku</span></button>
              <button id="btnHladinka" type="button" class="px-3.5 py-2.5 rounded-md bg-svabin-elevated border border-svabin-borderlight text-svabin-cream text-sm font-medium transition hover:bg-svabin-surface">Hladinka</button>
              <button data-pour-style="snyt" type="button" class="px-3.5 py-2.5 rounded-md bg-svabin-elevated border border-svabin-border text-svabin-cream text-sm font-medium transition hover:bg-svabin-surface">Šnyt</button>
              <button data-pour-style="mliko" type="button" class="px-3.5 py-2.5 rounded-md bg-svabin-elevated border border-svabin-border text-svabin-cream text-sm font-medium transition hover:bg-svabin-surface">Mlíko</button>
              <button id="btnDrinkSip" type="button" disabled class="px-3.5 py-2.5 rounded-md bg-svabin-green hover:brightness-110 disabled:opacity-35 disabled:pointer-events-none text-svabin-cream text-sm font-medium transition">Napít se</button>
              <button id="btnResetSim" type="button" class="px-3 py-2.5 rounded-md border border-svabin-border text-svabin-muted hover:text-svabin-cream text-sm transition">Čisté sklo</button>
            </div>
            <div class="flex flex-wrap gap-3 items-center lg:ml-auto text-xs">
              <div class="flex bg-svabin-surface border border-svabin-border rounded-md p-0.5">
                <button id="pkgCanBtn" type="button" class="py-1.5 px-2.5 rounded font-medium bg-svabin-elevated text-svabin-cream">Plechovka</button>
                <button id="pkgBottleBtn" type="button" class="py-1.5 px-2.5 rounded font-medium text-svabin-muted hover:text-svabin-cream">Láhev</button>
              </div>
              <div class="flex bg-svabin-surface border border-svabin-border rounded-md p-0.5">
                <button id="glassMugBtn" type="button" class="py-1.5 px-2 rounded font-medium bg-svabin-elevated text-svabin-cream">Krigl</button>
                <button id="glassTekuBtn" type="button" class="py-1.5 px-2 rounded font-medium text-svabin-muted hover:text-svabin-cream">Teku</button>
                <button id="glassPintBtn" type="button" class="py-1.5 px-2 rounded font-medium text-svabin-muted hover:text-svabin-cream">Štucl</button>
              </div>
              <button id="glassTiltBtn" type="button" class="px-3 py-1.5 rounded bg-svabin-elevated border border-svabin-borderlight text-svabin-cream font-medium">Nakloněná</button>
              <div class="min-w-[140px]"><div class="flex justify-between mb-1 text-svabin-muted"><span>Náklon</span><span id="pourAngleVal" class="text-svabin-cream font-semibold">0°</span></div><input id="pourAngleSlider" type="range" min="0" max="135" value="0" class="w-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="toastBox" class="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 translate-y-2 transition-all duration-200 bg-svabin-elevated border border-svabin-borderlight px-4 py-2.5 rounded-md shadow-xl text-xs sm:text-sm text-svabin-cream"><span id="toastText"></span></div>
  `;
}

async function startApp() {
  renderShell();
  catalog = await loadCatalog();
  catalog.beers = catalog.beers.map(enhanceBeer);
  selectedBeer = catalog.beers.find((beer) => beer.inStock) || catalog.beers[0];

  renderBeerSelectors();
  bindControls();
  document.getElementById('beerTitle').textContent = selectedBeer.name;
  document.getElementById('beerMeta').textContent =
    `${selectedBeer.subtitle || selectedBeer.style || ''} · ${selectedBeer.abv || ''}`.replace(/\s·\s$/, '');

  sim = createPourSimulator({
    canvas: document.getElementById('beerCanvas'),
    sfx,
    onHud: updateHud,
  });
  sim.selectBeer(selectedBeer);
  setPkg('can');
  setGlass('mug');
}

if (!hasAgeConsent()) {
  renderAgeGate(app, {
    onConfirm: () => {
      startApp().catch((error) => {
        console.error(error);
        app.innerHTML = '<p class="p-8 text-svabin-cream">Nepodařilo se spustit výčep.</p>';
      });
    },
  });
} else {
  startApp().catch((error) => {
    console.error(error);
    app.innerHTML = '<p class="p-8 text-svabin-cream">Nepodařilo se spustit výčep.</p>';
  });
}
