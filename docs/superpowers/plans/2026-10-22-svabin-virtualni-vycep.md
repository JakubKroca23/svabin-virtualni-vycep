# Švabín Virtuální výčep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profesionální Vite SPA pro GitHub Pages — virtuální výčep s canvas simulátorem, živý katalog ze svabin.com, reálné SFX, demo checkout do `localStorage`.

**Architecture:** Vanilla JS ES modules + Tailwind (PostCSS). Při startu `fetch` `https://svabin.com/catalog.json`, merge s pour profily, render tří pohledů + checkout. Canvas logiku portovat z referenčního HTML. Stav košíku/objednávek/age-gate v `localStorage`.

**Tech Stack:** Vite 6+, vanilla JS, Tailwind CSS 3+, Vitest, GitHub Actions → Pages. Reference UI: `/home/jakub/Downloads/pivovar_vab_n_virtu_ln_v_ep_a_simul_tor_nal_v_n.html`. Data: `https://svabin.com/catalog.json`.

## Global Constraints

- Jazyk UI: čeština.
- Checkout je demo: žádná platba, žádný e-mail na pivovar; disclaimer povinný.
- Primární katalog: živý `https://svabin.com/catalog.json`; fallback `public/data/catalog.fallback.json`.
- Obrázky: URL z katalogu (`https://svabin.com/assets/...`).
- Zvuky: reálné MP3/OGG v `public/sounds/`, mute v headeru, default off do unlock.
- Vite `base` musí fungovat na GitHub Pages path `/svabin-virtualni-vycep/`.
- Brand paleta a layout z referenčního HTML (tmavý grain, Fraunces, amber CTA).
- Commity jen když uživatel výslovně požádá v dané session; v plánu jsou jako volitelné checkpointy.

---

## File structure

```
svabin-virtualni-vycep/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .github/workflows/deploy-pages.yml
├── public/
│   ├── data/catalog.fallback.json
│   ├── sounds/
│   │   ├── can-open.mp3
│   │   ├── bottle-open.mp3
│   │   ├── pour-loop.mp3
│   │   ├── foam.mp3
│   │   └── sip.mp3
│   └── favicon.svg
├── src/
│   ├── main.js
│   ├── style.css
│   ├── data/
│   │   ├── catalog.js
│   │   └── pourProfiles.js
│   ├── audio/
│   │   └── sfx.js
│   ├── cart/
│   │   └── cart.js
│   ├── checkout/
│   │   └── checkout.js
│   ├── sim/
│   │   └── pourSimulator.js
│   └── ui/
│       ├── ageGate.js
│       ├── header.js
│       ├── views.js
│       ├── beerStrip.js
│       ├── productPanel.js
│       ├── catalogView.js
│       ├── storyView.js
│       ├── cartDrawer.js
│       └── checkoutView.js
└── tests/
    ├── catalog.test.js
    ├── pourProfiles.test.js
    ├── cart.test.js
    └── checkout.test.js
```

---

### Task 1: Scaffold Vite + Tailwind + Vitest

**Files:**
- Create: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.js`, `src/style.css`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test`; Vite `base` z env/`'/svabin-virtualni-vycep/'`

- [ ] **Step 1: Vytvoř `package.json`**

```json
{
  "name": "svabin-virtualni-vycep",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Vytvoř `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE || '/svabin-virtualni-vycep/',
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Vytvoř `tailwind.config.js` s paletou z reference**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,html}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        svabin: {
          bg: '#13110e',
          surface: '#1b1814',
          elevated: '#231f1a',
          border: '#2e2923',
          borderlight: '#3d362e',
          cream: '#f3ede2',
          sand: '#d8cfc0',
          muted: '#9a9083',
          amber: '#c88a36',
          amberhover: '#b57928',
          green: '#2d4a34',
          greentext: '#8ec099',
        },
      },
    },
  },
  plugins: [],
};
```

Poznámka: místo Inter použij **DM Sans** (stejná role, méně generický default).

- [ ] **Step 4: Vytvoř `postcss.config.js`, minimální `index.html`, `src/style.css`, `src/main.js`**

`postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`src/style.css` — zkopíruj grain, scrollbar, range slider styly z reference (řádky ~39–100) + `@tailwind` direktivy.

`index.html` — shell s Google Fonts (Fraunces + DM Sans), `<div id="app"></div>`, `<script type="module" src="/src/main.js">`.

`src/main.js`:
```js
import './style.css';
document.querySelector('#app').innerHTML = '<p class="text-svabin-cream p-8 font-serif text-2xl">Švabín</p>';
```

- [ ] **Step 5: Install + ověř**

```bash
cd /home/jakub/github/svabin-virtualni-vycep
npm install
npm run build
```

Expected: `dist/` vznikne bez chyb.

- [ ] **Step 6 (volitelný commit):** `chore: scaffold vite tailwind vitest`

---

### Task 2: Catalog fetch, merge, fallback

**Files:**
- Create: `src/data/catalog.js`, `public/data/catalog.fallback.json`, `tests/catalog.test.js`

**Interfaces:**
- Produces:
  - `export async function loadCatalog(): Promise<{ beers: Beer[]; mixes: Mix[]; seller: object; shipping: object; source: 'live'|'fallback' }>`
  - `export function normalizeBeer(raw, pourProfile): Beer`
- Consumes: `getPourProfile(beerId, style)` z Task 3 (zatím stub v testu mockovat)

Beer shape:
```ts
{
  id: string,
  name: string,
  style: string,
  subtitle: string,      // alias style
  description: string,
  image: string | null,
  abv: string,
  epm: string,
  ibu: string,
  url: string,
  offers: Array<{ pack: string, price: number, in_stock: boolean }>,
  priceOnce: number,     // prefer 6 cans/bottles pack
  priceSub: number,      // round(priceOnce * 0.85)
  inStock: boolean,
  // pour fields merged later
}
```

- [ ] **Step 1: Napiš failing test**

```js
// tests/catalog.test.js
import { describe, it, expect } from 'vitest';
import { pickPackPrice, applySubscription } from '../src/data/catalog.js';

describe('pickPackPrice', () => {
  it('prefers 6 cans pack when available', () => {
    const offers = [
      { pack: '1 can 0.5 l', price: 79, in_stock: true },
      { pack: '6 cans 0.5 l', price: 449, in_stock: true },
    ];
    expect(pickPackPrice(offers)).toBe(449);
  });
});

describe('applySubscription', () => {
  it('applies 15% discount rounded to int CZK', () => {
    expect(applySubscription(449)).toBe(382);
  });
});
```

- [ ] **Step 2: Run test — očekávej FAIL**

```bash
npm test
```

- [ ] **Step 3: Implementuj `pickPackPrice`, `applySubscription`, `loadCatalog`**

```js
// src/data/catalog.js
const LIVE_URL = 'https://svabin.com/catalog.json';
const FALLBACK_URL = `${import.meta.env.BASE_URL}data/catalog.fallback.json`;

export function pickPackPrice(offers = []) {
  const six = offers.find((o) => /6 cans/i.test(o.pack) && o.in_stock);
  if (six) return six.price;
  const sixB = offers.find((o) => /6 bottles/i.test(o.pack) && o.in_stock);
  if (sixB) return sixB.price;
  const any = offers.find((o) => o.in_stock) || offers[0];
  return any?.price ?? 0;
}

export function applySubscription(priceOnce) {
  return Math.round(priceOnce * 0.85);
}

export async function loadCatalog() {
  try {
    const res = await fetch(LIVE_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ...shapeCatalog(data), source: 'live' };
  } catch {
    const res = await fetch(FALLBACK_URL);
    const data = await res.json();
    return { ...shapeCatalog(data), source: 'fallback' };
  }
}

function shapeCatalog(data) {
  const beers = (data.beers || []).map((b) => {
    const priceOnce = pickPackPrice(b.offers);
    return {
      id: b.id,
      name: b.name,
      style: b.style || '',
      subtitle: b.style || '',
      description: b.description || '',
      image: b.image || null,
      abv: b.abv_percent != null ? `${String(b.abv_percent).replace('.', ',')} %` : '',
      epm: b.plato != null ? `${b.plato}°` : '',
      ibu: b.ibu != null ? `${b.ibu} IBU` : '',
      url: b.url || '',
      offers: b.offers || [],
      priceOnce,
      priceSub: applySubscription(priceOnce),
      inStock: (b.offers || []).some((o) => o.in_stock),
      markdown: b.markdown || null,
    };
  });
  return {
    beers,
    mixes: data.mixes || [],
    seller: data.seller || {},
    shipping: data.shipping || {},
    subscription: data.subscription || { discount_percent: 15 },
  };
}
```

- [ ] **Step 4: Stáhni snapshot fallback**

```bash
curl -sL https://svabin.com/catalog.json -o public/data/catalog.fallback.json
```

- [ ] **Step 5: `npm test` — PASS; `npm run build` — PASS**

- [ ] **Step 6 (volitelný commit):** `feat: load live svabin catalog with fallback`

---

### Task 3: Pour profiles (curated + heuristika)

**Files:**
- Create: `src/data/pourProfiles.js`, `tests/pourProfiles.test.js`
- Modify: `src/data/catalog.js` — volat `attachPourProfiles(beers)`

**Interfaces:**
- Produces: `export function getPourProfile(id: string, style: string): PourProfile`
- PourProfile musí obsahovat pole používaná simulátorem z reference: `liquidTop`, `liquidMid`, `liquidBottom`, `foamTone`, `paperBg`, `inkPrimary`, `inkAccent`, `haziness`, `carbonation`, `foamStability`, `hopLevel`, `bitterLevel`, `maltLevel`, `hops`, `malts`, `energy`, `rating`, `tag`, `tagline`, `sladekQuote`, `category`, `illustration`

- [ ] **Step 1: Failing test**

```js
import { describe, it, expect } from 'vitest';
import { getPourProfile } from '../src/data/pourProfiles.js';

describe('getPourProfile', () => {
  it('returns curated bard profile', () => {
    const p = getPourProfile('bard', 'Světlý ležák 11°');
    expect(p.liquidTop).toBe('#e8a828');
    expect(p.illustration).toBe('bard');
  });

  it('infers sour-like colors for unknown sour style', () => {
    const p = getPourProfile('unknown-sour', 'Sour Ale 11°');
    expect(p.category).toBe('sour');
    expect(p.haziness).toBeGreaterThan(0.4);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement** — zkopíruj curated objekty z `SVABIN_BEERS` v reference (řádky ~629–900+) do `CURATED` mapy keyed by `id`. Pro unknown:

```js
export function getPourProfile(id, style = '') {
  if (CURATED[id]) return { ...CURATED[id] };
  const s = style.toLowerCase();
  if (/sour|kysel/.test(s)) return heuristic('sour', style);
  if (/ipa|neipa|apa|ipl/.test(s)) return heuristic('ipa', style);
  if (/polotmav|tmav|stout|porter/.test(s)) return heuristic('dark', style);
  return heuristic('lager', style);
}

function heuristic(kind, style) {
  const presets = {
    lager: { liquidTop: '#e8a828', liquidMid: '#c67810', liquidBottom: '#8c4904', foamTone: '#fbf6ea', haziness: 0.2, carbonation: 1, foamStability: 0.94, category: 'lager', hopLevel: 3.5, bitterLevel: 3.5, maltLevel: 3.5 },
    ipa: { liquidTop: '#d97b14', liquidMid: '#9c4a06', liquidBottom: '#592302', foamTone: '#f8efe0', haziness: 0.45, carbonation: 0.9, foamStability: 0.9, category: 'ipa', hopLevel: 4.8, bitterLevel: 4.5, maltLevel: 3.8 },
    sour: { liquidTop: '#b8253f', liquidMid: '#851428', liquidBottom: '#470713', foamTone: '#f7dce2', haziness: 0.6, carbonation: 1.2, foamStability: 0.75, category: 'sour', hopLevel: 1.5, bitterLevel: 1.2, maltLevel: 3.2 },
    dark: { liquidTop: '#a83c14', liquidMid: '#6e1e08', liquidBottom: '#2b0902', foamTone: '#efe2cb', haziness: 0.28, carbonation: 0.92, foamStability: 0.95, category: 'lager', hopLevel: 3.2, bitterLevel: 3.0, maltLevel: 4.5 },
  };
  const base = presets[kind];
  return {
    ...base,
    paperBg: '#ece3d2',
    inkPrimary: '#241e18',
    inkAccent: '#9b6318',
    hops: '—',
    malts: '—',
    energy: '—',
    rating: '—',
    tag: style || 'Řemeslné pivo',
    tagline: style || '',
    sladekQuote: '„Nalévej po stěně nakloněné sklenice, ať vznikne jemná pěna.“',
    illustration: 'generic',
  };
}
```

Curated hodnoty (bard, satyr, stinovlk, leshy, faun, puk, kodama, minipuk, …) vezmi 1:1 z reference HTML.

- [ ] **Step 4: `attachPourProfiles` v catalog.js**

```js
import { getPourProfile } from './pourProfiles.js';

export function attachPourProfiles(beers) {
  return beers.map((b) => ({ ...b, ...getPourProfile(b.id, b.style) }));
}
```

V `shapeCatalog` vrať `attachPourProfiles(beers)`.

- [ ] **Step 5: `npm test` PASS**

- [ ] **Step 6 (volitelný commit):** `feat: pour profiles curated and heuristic`

---

### Task 4: Cart module

**Files:**
- Create: `src/cart/cart.js`, `tests/cart.test.js`

**Interfaces:**
- Produces:
  - `createCart(storage = localStorage): { getItems(), add(beer, mode), changeQty(key, delta), clear(), subscribe(fn), total() }`
  - key = `${beer.id}:${mode}` (`sub`|`once`)
  - persist key: `svabin.cart.v1`

- [ ] **Step 1: Failing tests** — add, qty, total, persist roundtrip (použij in-memory mock storage objekt `{ getItem, setItem }`).

- [ ] **Step 2: Implement**

```js
const STORAGE_KEY = 'svabin.cart.v1';

export function createCart(storage = globalThis.localStorage) {
  let items = load();
  const listeners = new Set();

  function load() {
    try {
      return JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }
  function save() {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
    listeners.forEach((fn) => fn(items));
  }

  return {
    getItems: () => items.slice(),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    add(beer, mode = 'sub') {
      const key = `${beer.id}:${mode}`;
      const price = mode === 'sub' ? beer.priceSub : beer.priceOnce;
      const existing = items.find((i) => i.key === key);
      if (existing) existing.qty += 1;
      else items.push({ key, beerId: beer.id, name: beer.name, mode, price, qty: 1, image: beer.image });
      save();
    },
    changeQty(key, delta) {
      const it = items.find((i) => i.key === key);
      if (!it) return;
      it.qty += delta;
      if (it.qty <= 0) items = items.filter((i) => i.key !== key);
      save();
    },
    clear() { items = []; save(); },
    total() { return items.reduce((s, i) => s + i.price * i.qty, 0); },
  };
}
```

- [ ] **Step 3: `npm test` PASS**

---

### Task 5: Checkout validation + persist orders

**Files:**
- Create: `src/checkout/checkout.js`, `tests/checkout.test.js`

**Interfaces:**
- Produces:
  - `validateCheckoutForm(fields): { ok: boolean, errors: Record<string,string> }`
  - `saveOrder(order, storage): string` // returns orderId
  - fields: `name, email, phone, street, city, zip, note, ageConfirmed`

- [ ] **Step 1–4: TDD** — email regex, ageConfirmed required, phone non-empty, zip 3–10 chars; `saveOrder` píše do `svabin.orders.v1` pole a vrací `id` typu `SV-` + Date.now().

Disclaimer text (UI později): „Toto je demo objednávka. Neodesílá se do pivovaru a neprobíhá platba.“

---

### Task 6: Audio SFX engine + assets

**Files:**
- Create: `src/audio/sfx.js`, `public/sounds/*.mp3`

**Interfaces:**
- Produces: `createSfx(): { unlock(), setEnabled(bool), isEnabled(), play(name), startLoop(name), stopLoop(name) }`
- Names: `can-open`, `bottle-open`, `pour-loop`, `foam`, `sip`

- [ ] **Step 1: Stáhni volně licencované SFX** (CC0 / Pixabay / Freesound s licencí umožňující použití). Přejmenuj do přesných jmen výše. Pokud download selže, vygeneruj krátké placeholder WAV přes `ffmpeg` sine burst (dočasně) a v README uveď nutnost nahradit reálnými — preferuj ale skutečné nahrávky otevření plechovky a lítí tekutiny.

Příklad zdrojů (ověř licenci před commitnutím binárek):
- can open / bottle cork
- liquid pour loop
- short fizz

- [ ] **Step 2: Implement `sfx.js`**

```js
export function createSfx(baseUrl = `${import.meta.env.BASE_URL}sounds/`) {
  let enabled = false;
  let ctx = null;
  const buffers = new Map();
  const loops = new Map();

  async function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async function load(name) {
    if (buffers.has(name)) return buffers.get(name);
    const res = await fetch(`${baseUrl}${name}.mp3`);
    const arr = await res.arrayBuffer();
    await ensure();
    const buf = await ctx.decodeAudioData(arr.slice(0));
    buffers.set(name, buf);
    return buf;
  }

  return {
    async unlock() { await ensure(); },
    setEnabled(v) { enabled = v; if (!v) this.stopLoop('pour-loop'); },
    isEnabled: () => enabled,
    async play(name) {
      if (!enabled) return;
      await ensure();
      const buf = await load(name);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
    },
    async startLoop(name) {
      if (!enabled || loops.has(name)) return;
      await ensure();
      const buf = await load(name);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(ctx.destination);
      src.start();
      loops.set(name, src);
    },
    stopLoop(name) {
      const src = loops.get(name);
      if (src) { try { src.stop(); } catch {} loops.delete(name); }
    },
  };
}
```

- [ ] **Step 3: Manuálně ověř v konzoli po Task 8** (zatím build projde).

---

### Task 7: Port pour simulator

**Files:**
- Create: `src/sim/pourSimulator.js`
- Reference: HTML řádky ~1048–2425 (`state`, physics, render, events)

**Interfaces:**
- Produces: `createPourSimulator({ canvas, sfx, onHud }): { selectBeer(beer), setVesselType, setGlassType, triggerOpen, setTilt, toggleGlassTilt, startMasterPour(style), takeSip, reset, destroy }`
- Při open: `sfx.play(vesselType === 'can' ? 'can-open' : 'bottle-open')`
- Při proudu: `sfx.startLoop('pour-loop')` / `stopLoop` když `pourRate === 0`
- Při dočepování pěny: `sfx.play('foam')`
- Při doušku: `sfx.play('sip')`

- [ ] **Step 1: Vytvoř modul** — přenes `state`, `updatePhysics`, `renderScene`, `drawBeerGlass`, `drawBeerVessel`, `drawPourStream`, `drawWoodcutCharacterIllustration`, event handlery. Nahraď globály injekcí. `selectedBeer` přichází jako merged Beer+PourProfile.

- [ ] **Step 2: Napoj resize (`ResizeObserver` na container)** a `requestAnimationFrame` loop s `destroy()` cancel.

- [ ] **Step 3: `npm run build` PASS; manuální smoke v Task 10.**

---

### Task 8: UI shell — header, views, age gate, product panels

**Files:**
- Create: `src/ui/ageGate.js`, `header.js`, `views.js`, `beerStrip.js`, `productPanel.js`, `catalogView.js`, `storyView.js`, `cartDrawer.js`, `checkoutView.js`
- Modify: `index.html` (struktura markup z reference: header, 3 views, cart drawer, checkout section), `src/main.js`

**Interfaces:**
- `switchMainView('simulator'|'catalog'|'story'|'checkout')`
- Age gate: `svabin.age.ok` v localStorage; blokuje app dokud nepotvrdí 18+

- [ ] **Step 1: Přenes HTML strukturu z reference do `index.html`** (header, viewSimulator, viewCatalog, viewStory, cart drawer). Přidej `#viewCheckout` s formulářem a disclaimerem.

- [ ] **Step 2: Implementuj render funkce** — strip, catalog grid (včetně mixů jako karty s odkazem/add), story text z reference, cart drawer napojený na `createCart`, product panel updatuje DOM id z reference (`infoName`, …).

- [ ] **Step 3: Age gate overlay** před main.

- [ ] **Step 4: Wire `main.js`**

```js
import './style.css';
import { loadCatalog } from './data/catalog.js';
import { createCart } from './cart/cart.js';
import { createSfx } from './audio/sfx.js';
import { createPourSimulator } from './sim/pourSimulator.js';
// ... UI mounts

const cart = createCart();
const sfx = createSfx();
// after DOM ready + age ok:
const catalog = await loadCatalog();
if (catalog.source === 'fallback') showBanner('Katalog ze svabin.com teď nejde načíst — ukazujeme záložní data.');
const sim = createPourSimulator({ canvas: $('#beerCanvas'), sfx, onHud: updateHud });
sim.selectBeer(catalog.beers[0]);
// bind nav, cart, checkout...
```

---

### Task 9: Checkout view end-to-end

**Files:**
- Modify: `src/ui/checkoutView.js`, `src/main.js`

- [ ] **Step 1: Formulář → `validateCheckoutForm` → při ok `saveOrder({ ...fields, items: cart.getItems(), total: cart.total(), createdAt })` → `cart.clear()` → success panel s číslem objednávky.**

- [ ] **Step 2: Prázdný košík → CTA „Zpět do e‑shopu“, submit disabled.**

- [ ] **Step 3: Manuální ověření:** objednávka v DevTools `localStorage['svabin.orders.v1']`.

---

### Task 10: GitHub Pages deploy + README

**Files:**
- Create: `.github/workflows/deploy-pages.yml`, `README.md`
- Modify: `vite.config.js` pokud potřeba

- [ ] **Step 1: Workflow**

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_BASE: /svabin-virtualni-vycep/
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README** — jak spustit (`npm i && npm run dev`), že katalog je živý ze svabin.com, demo checkout, licence SFX, jak zapnout Pages.

- [ ] **Step 3: Finální ověření**

```bash
npm test && npm run build && npm run preview -- --host
```

Checklist:
- [ ] Katalog live
- [ ] Simulátor otevře + nalije
- [ ] SFX při unmuted
- [ ] Košík + checkout + localStorage
- [ ] Age gate
- [ ] Mobilní nav

---

## Self-review (plan vs spec)

| Spec požadavek | Task |
|----------------|------|
| Vite + vanilla + Tailwind | 1 |
| Live catalog + fallback | 2 |
| Pour all beers + heuristic | 3 |
| Cart localStorage | 4 |
| Mock checkout form + success | 5, 9 |
| Real SFX files | 6 |
| Canvas simulator | 7 |
| Views: výčep / e‑shop / příběh | 8 |
| Age gate + disclaimer | 8, 9 |
| GH Pages | 10 |
| Mixy z katalogu | 8 (catalogView) |

Placeholdery: žádné TBD. Typy `Beer` / `PourProfile` / cart API konzistentní napříč tasky.
