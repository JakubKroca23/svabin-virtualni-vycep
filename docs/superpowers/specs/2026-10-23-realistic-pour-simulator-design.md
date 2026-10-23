# Realistický simulátor nalévání — redesign (design)

Datum: 2026-10-23  
Repo: `svabin-virtualni-vycep`  
Vztah: rozšiřuje `docs/superpowers/specs/2026-10-22-svabin-virtualni-vycep-design.md` (sekce simulátor)  
Rozhodnutí: Jakub (product owner)

## Kontext

Virtuální výčep dnes používá jeden monolit `src/sim/pourSimulator.js` (~47 KB), který drží stav, fyziku, vstup, vykreslování a orchestraci smyčky v jednom souboru. Veřejné API `createPourSimulator({ canvas, sfx, onHud })` je stabilní kontrakt pro `src/main.js` a testy.

Nedávný experiment s plným Three.js byl vrácen; cílem je maximální realismus **bez** přechodu na 3D engine — zůstat na Canvas 2D s **2,5D** vzhledem (vrstvy, stíny, perspektiva, specular).

Současná implementace už obsahuje auto-náklon sklenice (`isGlassTiltedMode`, vyrovnání při plnění podle `fillRatio`, auto-pour režimy mění `targetGlassTiltAngle`). Redesign tuto UX linii **zachová a vylepší**: sklenice se při čepování jemně naklání podle výšky nalévání a proudu (jako v původním návrhu), s plynulou interpolací k `targetGlassTiltAngle`. Ruční přepsání náklonu (PC drag / mobilní gesto na skle) zůstává volitelné — po skončení interakce může fyzika znovu sledovat auto-cíle, pokud uživatel neudržuje „manual hold“ (implementační detail v `input.js` + `physics.js`).

## Cíl

Udělat virtuální zážitek z čepování maximálně realistický v **fyzice**, **vzhledu** a **ovládání**, vhodný pro PC i mobil, při zachování:

- stabilního veřejného API `createPourSimulator`,
- deploye na GitHub Pages (`VITE_BASE=/svabin-virtualni-vycep/`),
- českých HUD štýlů nalévání (šnyt, hladinka, mlíko, …) — vylepšit čísla pod kapotou, ne nutně nové labely.

Fyzika, vzhled a ovládání mají **stejnou prioritu**; uvnitř fyziky jsou explicitní priority níže.

## Mimo scope (non-goals)

- Kompletní přepis na Three.js nebo jiný 3D engine.
- Gyroskop / device orientation pro náklon.
- Změny katalogu, checkoutu nebo e-shopu kromě **read-only** čtení parametrů piva pro fyziku (`pourProfiles.js`, merge v `catalog.js`).
- Nové platební nebo backendové integrace.

## Architektura (volba B — modularizace)

Monolit rozdělit na moduly pod `src/sim/`, orchestrátor zůstane tenký soubor `pourSimulator.js` s existujícím exportem.

```
src/sim/
  state.js              # počáteční stav, reset, merge beer profilu
  physics.js            # náklon nádoby, proud, pěna, přetečení
  input.js              # myš + dotyk (PC + mobil)
  render/
    index.js            # sestavení scény, volání vrstev
    layers/             # bar, table, vessel, liquid, foam, stream, …
    lod.js              # FPS → detail / počty částic
  pourSimulator.js      # createPourSimulator, rAF, resize, export metod
```

**Stabilní API** (beze změny signatur pro spotřebitele):

```js
createPourSimulator({ canvas, sfx, onHud })
  → { setBeer, setVesselType, setGlassType, setTilt, startAutoPour, reset, destroy }
```

Interní helpery (`clamp`, `callSafely`, cache obrázků) přesunout do modulů, kde se používají, nebo do malého `src/sim/util.js` pouze pokud je sdílení mezi ≥3 moduly — preferovat lokální funkce před novým souborem.

### Tok dat (jedna smyčka)

1. **Input** (události) → aktualizuje `state.targetVesselAngle`, `state.targetGlassTiltAngle`, `isOpened`, drag stav.
2. **Physics** (`physics.js`) → z `state` + `selectedBeer` dopočítá `flowRate`, objemy, pěnu, částice, spill; nevolá canvas.
3. **Render** (`render/`) → čte `state` + `beer`, kreslí vrstvy; LOD může zmenšit počty částic, ne měnit fyzikální integraci.
4. **Orchestrátor** → `requestAnimationFrame`: input smoothing (volitelně v physics), `updatePhysics`, `renderScene`, `emitHud`, SFX hooky (`pour-loop`, `foam`, otevření).

## Hranice modulů a odpovědnosti

| Modul | Odpovědnost | Nevolí |
|-------|-------------|--------|
| `state.js` | `createInitialState()`, `resetState(state)`, konstanty `DEFAULT_BEER`, typové pole stavu (kapalina, pěna, částice, úhly, flags) | Canvas, DOM |
| `physics.js` | `updatePhysics(state, beer, dt?)`, `updateParticles`, spill při přetečení, růst a sednutí pěny, proud z úhlu nádoby a `vesselRemainingMl`, **auto-náklon sklenice** (`targetGlassTiltAngle` z fill/proud/auto-pour), `evaluatePourStyle` pro HUD | Kreslení, event listenery |
| `input.js` | Hit zóny (nádoba, víčko, sklenice, sip), pointer/touch mapování, `preventDefault` kde třeba na mobilu; export `attachInput(canvas, state, api)` a `detach` | Fyzikální integrace |
| `render/*` | Všechny `draw*` funkce, načítání `bar-bg`, label cache (nebo `assets.js` v render/) | Změna objemů kromě vizuálních odvozenin |
| `pourSimulator.js` | Lifecycle, `ResizeObserver`, `emitHud`, SFX, veřejné metody, propojení modulů | Nová business logika mimo delegaci |

### Stávající stav → cílové chování (sklenice)

| Chování dnes | Po redesignu |
|--------------|--------------|
| Po otevření / v `isGlassTiltedMode` cíl ~28° k nádobě | Zachovat jako **výchozí auto**; vyladit easing a vazbu na typ skla (`glassType`) |
| Při `fillRatio > 0.78` postupné vyrovnání sklenice | Zachovat a zpřesnit (plynulejší křivka, konfigurovatelné prahy v `physics.js`) |
| `startAutoPour('hladinka'|…)` nastavuje `targetGlassTiltAngle` + nádobu | Zachovat orchestraci **nádoby i sklenice**; zrefaktorovat do `physics.js`, ne mazat |
| Ruční gesto na skle (nové / rozšířené) | Volitelný override `targetGlassTiltAngle`; při aktivním dragu pozastavit auto-cíle |
| `setTilt` pro nádobu | Beze změny sémantiky |

Volitelný **soft snap** při ručním náklonu sklenice: pokud je úhel blízko rozsahu pro hladinku (např. 24–32°), může input mírně „přichytit“ — uživatel to může překonat dalším tahem; funguje vedle auto-náklonu, není náhradou.

## Model fyziky

Vše v **2D objemových jednotkách** (ml v logice sklenice, zbytek v nádobě), úhly ve stupních. Časový krok: fixní per frame s možností budoucího `dt` clampu; při refactoru zachovat současné chování jako baseline, pak upravit podle priorit.

### Proud

- Podmínky: `isOpened`, `vesselAngle` nad dynamickým `minPourAngle` (závisí na `vesselRemainingMl`), sklenice nepřeplněná nad spill práh.
- `flowRate` z přebytku úhlu (nelinearita ~`pow(tiltExcess, 1.15)`), clamp horní/dolní.
- Odtok z nádoby: `actualOut = min(vesselRemainingMl, flowRate)`; rozdělení na kapalinu a pěnu podle vigor faktorů (úhel nádoby, výška pádu, **aktuální `glassTiltAngle`** — auto nebo ruční, `beer.carbonation`).

### Pěna (priorita 1)

- **Růst:** při nalévání `addedFoam` závisí na `carbonation`, agresivitě proudu, úhlu sklenice (mírnější proud pod sklem = více pěny), `foamStability` (stabilnější pivo = pomalejší přeměna pěny zpět na kapalinu).
- **Sednutí:** kontinuální `settleRate` z `(1 - foamStability)` plus malá konstanta; převod části pěny na kapalinu (jako dnes, s vyladěnými koeficienty).
- **Bubliny / foam cells:** spawn rate vázaný na `carbonation` a `flowRate`; horní limity řízené LOD při vykreslení, fyzikální stav může držet plný seznam s řídkým vzorkováním pro render na mobilu.

### Přetečení / spill (priorita 2)

- Dnes: nalévání se zastaví při `totalInGlass < maxGlassMl * 1.03` bez explicitního přelití na stůl.
- Cíl: při `liquidMl + foamMl > maxGlassMl` přesunout přebytek do **spill** stavu — růst `spillMl` nebo částic na stole, vizuální mlha/kapky (`mistParticles` rozšířit), **fyzika nepřidává objem do sklenice** nad cap; uživatel vidí a slyší přetečení (SFX volitelně rozšířit, ne breaking change).
- Spill rychlost závisí na `flowRate` a zaplnění; pěna může přetékat rychleji než kapalina.

### Parametry piva (priorita 3)

Číst z `state.selectedBeer` (merge katalog + `pourProfiles.js`):

| Parametr | Vliv |
|----------|------|
| `carbonation` | proud bublin, vigor pěny při nalévání |
| `foamStability` | rychlost sednutí pěny |
| `haziness` | vizuál kapaliny (mlžnost gradientu), méně čisté okraje |
| `liquidTop/Mid/Bottom`, `foamTone` | render |
| `illustration`, label URL | vessel label |

Žádné nové povinné pole v katalogu; chybějící hodnoty doplňuje stávající heuristika.

### HUD štýly nalévání

Logika klasifikace zůstává koncepčně stejná (práh `foamPct`, `total` ml):

- Mlíko, Šnyt, Hladinka, Bez čepice, Vysoká pěna, Otevřeno/Zavřeno.

Po úpravě fyziky **zkalibrovat prahy** tak, aby odpovídaly realističtější pěně; dokumentovat nové referenční hodnoty v komentáři v `physics.js` (ne v tomto souboru). Sémantika českých názvů se nemění.

## Model vstupu (ovládání)

### PC

- **Tažení nádoby** (vertikální osa): mapuje na `targetVesselAngle` (0–135°), stejně jako dnes slider/drag.
- **Klik na víčko / horní nádoby:** otevření (`triggerOpen`); opakované kliknutí může přepínat tilt jako dnes.
- **Klik na sklenici** (když `canSip`): doušek, snížení objemu, `sfx.play('sip')`.
- **Náklon sklenice:** **default auto** (physics řídí `targetGlassTiltAngle` podle plnění a režimu). Volitelný **ruční override** — drag na těle sklenice nebo handle; rozsah např. −15° až +45° (clamp v `input.js`).

### Mobil

- **Jeden prst** na nádobě: stejná osa náklonu jako na PC; větší hit boxy (min ~44 CSS px).
- **Druhý prst nebo gesto na sklenici:** ruční náklon sklenice (override auto; ne gyro). Bez gesta platí stejný auto-náklon jako na PC.
- `touch-action: none` na canvas kontejneru kde je potřeba; žádný gyroskop.

### Auto-pour

- `startAutoPour(style)` zůstává **volitelná zkratka**, ne default při výběru piva.
- Automatizuje **sekvenční cíle `targetVesselAngle` a `targetGlassTiltAngle`** podle stylu (hladinka / šnyt / mlíko), stejně jako dnes v monolitu.
- Ukončení auto-pour: dosažení cílového objemu/pěny nebo ruční `setTilt` / reset (ruční zásah zruší auto-pour režim jako dnes).

### Sip a reset

- Zachovat `reset()` a chování `destroy()` (odstranění listenerů, cancel rAF) — testy na to existují.

## Vykreslování: 2D fyzika + 2,5D vzhled

Nepoužívat WebGL. Scéna se kreslí transformacemi 2D kontextu (scale, rotate, gradienty, stíny simulované vrstvami).

### Vrstvy (zadní → přední)

1. **bar** — pozadí hospody (`bar-bg.jpg`), ambient + jeden „spot“ (radial gradient overlay).
2. **table** — deska stolu, kontaktní stín pod sklenicí/nádobou.
3. **vessel/glass** — obrys nádoby, víčko, label (woodcut / cover image).
4. **liquid** — tělo piva, gradient podle `haziness`, vlnění (`waveHeights`).
5. **foam** — čepice, `foamCells`, okrajové bubliny.
6. **stream** — proud při `flowRate > 0`, křivka podle pozic hubice a ústí.
7. **condensation/lacing** — kondenzace na skle, `lacingRings` po doušku.
8. **highlights / HUD overlays** — specular na skle, letící víčko, debug vypnuto v produkci.

### LOD podle FPS

- Měřit klouzavý průměr FPS (okno ~30 snímků).
- Pásma (příklad implementace):
  - **high** (≥ 55 FPS): plné bubliny, kondenzace, všechny foam cells, plné rozlišení částic spill.
  - **medium** (40–54): poloviční spawn render bublin, zjednodušená kondenzace.
  - **low** (< 40): minimální částice, jednoduchý proud (tlustší čára), vypnuté drobné highlighty; **physics tick beze změny** (stejné ml, stejný spill).

Přepínání pásma s hysterézí, aby nedocházelo k blikání.

## Testování a kritéria úspěchu

### Unit testy (Vitest)

- **`physics.js`:** růst pěny při nalévání s vysokou vs nízkou `carbonation`; sednutí při nízké `foamStability`; spill při překročení `maxGlassMl`; proud = 0 pod `minPourAngle`.
- **`input.js`:** hit test víčka, nádoby, sklenice (sip), mapování drag → úhel; mobilní touch idempotence.
- **`pourSimulator.js`:** stávající integrační testy v `tests/pourSimulator.test.js` musí projít bez změny veřejného API.

### Smoke / render

- Lehký test: mock canvas context, jedno volání `renderScene` po `updatePhysics` — žádný throw, očekávané volání `clearRect` / hlavních draw path.
- Nepřidávat screenshot golden files do CI (křehké); volitelně lokální manual QA.

### Úspěch (release)

- Plynulost ~60 FPS na běžném desktopu; na mobilu udržitelných 45–60 FPS s LOD.
- `npm run build` a `npm test` zelené; `VITE_BASE=/svabin-virtualni-vycep/` build pro Pages.
- Veřejné API beze změny pro `main.js`.
- Auto-náklon sklenice plynulý a viditelný v default interakci (bez nutnosti ručního gesta).

## Migrační plán z monolitu

Fáze v jednom implementačním PR (doporučené pořadí):

1. **Extrakce bez chování:** přesunout `createInitialState`, `DEFAULT_BEER`, utility do `state.js` / util; `pourSimulator.js` importuje; testy zelené.
2. **Physics:** přesunout `updatePhysics`, `updateParticles`, `updateAutoPour`, logiku auto-náklonu sklenice (`isGlassTiltedMode`, fill-based straighten), spill; čisté exportované funkce `(state, beer, hooks)`.
3. **Input:** vyextrahovat listenery z dna monolitu; zachovat stejné chování myši, přidat explicitní glass drag.
4. **Render:** postupně přesunout `draw*` do `render/layers/*.js`; `render/index.js` volá v pořadí vrstev.
5. **LOD:** přidat `lod.js` a napojit na částice/stream po stabilizaci FPS.
6. **Úpravy fyziky a spill:** po modularizaci — snadnější review; kalibrace HUD prahů.
7. **Úklid:** odstranit duplicity po extrakci, zkrátit orchestrátor na ~150–250 řádků; **ne** mazat auto-náklon sklenice.

Každý krok = commit; preferovat jeden souvislý PR s design odkazem na tento dokument.

## Rizika a mitigace

| Riziko | Důsledek | Mitigace |
|--------|----------|----------|
| Regrese HUD štýlů po změně pěny | Uživatelé vidí „špatný“ šnyt/hladinku | Unit testy na klasifikaci s fixture objemy; manuální checklist 3 piv |
| Mobilní výkon | Drop pod 30 FPS | LOD agresivní na low; cap DPR 2 (už dnes) |
| Konflikt auto-náklon vs ruční override | Trhání sklenice mezi dvěma cíli | Flag `glassTiltManualUntilRelease`; po puštění prstu návrat k auto s krátkým blendem |
| Rozbití SFX timing | `foam`/`pour-loop` | Zachovat hooky v orchestrátoru; testy mock sfx |
| Velký diff při přesunu renderu | Konflikty v git | Pořadí migrace podle tabulky; neměnit chování v kroku 1–4 |
| Spill vizuál bez zvuku | Méně realistické | Fáze 2: krátký SFX spill pokud soubor v `public/sounds/` |

## Otevřené produktové detaily (uzavřeno pro implementaci)

Následující body jsou **rozhodnuté** pro implementaci — nejsou TBD:

- Architektura: modularizace (B), ne rewrite.
- Rendering: 2,5D vrstvy, ne Three.js.
- Sklenice: **auto-náklon jako default** (výška nalévání / proud / auto-pour); ruční override povolen; žádný gyro.
- Auto-pour: volitelný, řídí nádobu **a** sklenici (sekvenční cíle úhlů).
- Soft snap hladinky: povolen jako jemná pomůcka při ručním držení, vypnutelný přetažením mimo pásmo.

---

*Implementační PR by měl v popisu odkazovat na tento soubor.*
