# Pivovar Švabín — Virtuální výčep (design)

Datum: 2026-10-22  
Repo: `~/github/svabin-virtualni-vycep`  
Zdroj UI: `/home/jakub/Downloads/pivovar_vab_n_virtu_ln_v_ep_a_simul_tor_nal_v_n.html`  
Zdroj dat/grafiky: [https://svabin.com/](https://svabin.com/) (`catalog.json`, `assets/*`)

## Cíl

Profesionální webová aplikace pro GitHub Pages: virtuální výčep se simulátorem nalévání, e‑shop katalog, příběh pivovaru a demo checkout. Vizuál a copy vycházejí z oficiálního brandu Švabín a z dodaného návrhu.

## Rozhodnutí (schváleno)

| Téma | Volba |
|------|--------|
| Název projektu | `svabin-virtualni-vycep` |
| Checkout | Plný formulář, bez plateb; success + `localStorage` |
| Katalog / grafika | Živě z `https://svabin.com/catalog.json` a CDN obrázků |
| Simulátor | Plný canvas pro všechna piva (heuristika pro chybějící parametry) |
| Stack | Vite + vanilla JS (ES modules) + Tailwind (build) |
| Zvuky | Reálné SFX v `public/sounds/` (otevření, nalévání, pěna) |

## Architektura

- **Build:** Vite → `dist/` → GitHub Pages (Actions nebo `gh-pages`).
- **UI:** SPA bez router knihovny; přepínání pohledů (výčep / e‑shop / příběh / checkout).
- **Styly:** Tailwind + CSS proměnné palety z návrhu (`svabin.*`); font Fraunces + sans (brand z návrhu).
- **Moduly (návrh struktury):**
  - `src/main.js` — bootstrap, age gate, view switching
  - `src/data/catalog.js` — fetch katalogu, merge pour profilů, fallback snapshot
  - `src/data/pourProfiles.js` — curated mapa + heuristika ze stylu
  - `src/sim/pourSimulator.js` — canvas, otevření, náklon, hladinka/šnyt/mlíko, doušek
  - `src/audio/sfx.js` — načtení a přehrání SFX, mute toggle
  - `src/cart/cart.js` — košík + `localStorage`
  - `src/checkout/checkout.js` — validace, uložení objednávky, success UI
  - `src/ui/*` — render katalogu, strip piv, drawer, story

## Data flow

1. Při startu: `fetch('https://svabin.com/catalog.json')` (CORS `*`).
2. Merge každého piva s pour profilem (`id` → curated; jinak odhad ze `style` / barvy / IBU).
3. Obrázky: URL z katalogu (`image`); při chybě placeholder s názvem.
4. Košík: add/update/remove → badge + `localStorage`.
5. Checkout: validace → ulož objednávku do `localStorage` → vyprázdni košík → success.
6. Zvuky: unlock AudioContext na první interakci; přehrát při otevření nádoby a při proudu/pěně; respektovat mute.

### Fallback

Pokud živý katalog selže: banner „katalog dočasně nedostupný“ + lokální snapshot (`public/data/catalog.fallback.json`) pro dev/offline. Primární zdroj zůstává živý katalog.

## UI / funkce

- **Header:** Švabín · Virtuální výčep · E‑shop a piva · Náš příběh · Zvuk · Košík.
- **Virtuální výčep:** quick strip, produktový list (profil, varní list, předplatné −15 % / jednorázově), canvas, ovládání čepování, tipy sládka.
- **E‑shop:** grid piv (+ mixy z katalogu), filtry, srovnávací tabulka, Do košíku.
- **Košík drawer** → **Checkout formulář:** jméno, adresa, e‑mail, telefon, poznámka, potvrzení 18+.
- **Disclaimer:** jasně „demo objednávka — neodesílá se na pivovar / neprobíhá platba“.
- **Příběh:** historie 1567, obnova, metriky (Untappd, IBC, výstav).
- **Age gate:** jednorázový 18+ overlay (cookie/`localStorage`).

## Audio (SFX)

Soubory v `public/sounds/` (volně licencované, krátké):

- `can-open.mp3` / `bottle-open.mp3` — otevření
- `pour-loop.mp3` — smyčka proudu při nalévání
- `foam.mp3` — krátký šum pěny / dočepování
- `sip.mp3` — doušek (volitelně)

Ovládání: tlačítko Zvuk v headeru; default vypnuto do první aktivace (autoplay policy).

## Chyby a hrany

- Síť / 5xx katalogu → fallback + banner.
- Broken image → placeholder.
- Neplatný checkout → inline chyby u polí.
- Prázdný košík → checkout nepřístupný.
- Mute / chybějící SFX → ticho, bez pádu UI.

## Ověření „hotovo“

- `npm run build` projde.
- `vite preview`: katalog se načte, simulátor nalije, SFX hrají při unmuted, checkout uloží objednávku do `localStorage`.
- Responzivní: mobilní přepínač pohledů + desktop layout 12 sloupců.

## Mimo scope

- Reálné platby, e‑mail na pivovar, Formspree, admin, i18n (jen CS), PWA offline-first.

## Deploy

- GitHub Pages z `dist/` (base path podle repo name, např. `/svabin-virtualni-vycep/`).
- README: jak spustit lokálně a jak zapnout Pages.
