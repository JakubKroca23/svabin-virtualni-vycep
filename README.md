# Švabín — virtuální výčep

Interaktivní demo pivovaru Švabín: virtuální nalévání, e‑shop s živým katalogem a demo objednávka (bez platby).

## Spuštění lokálně

```bash
npm install
npm run dev
```

Pro build jako na GitHub Pages (subpath `/svabin-virtualni-vycep/`):

```bash
VITE_BASE=/svabin-virtualni-vycep/ npm run build
npm run preview
```

Testy: `npm test`.

## Katalog

Při startu aplikace načte pivní katalog z **https://svabin.com/catalog.json**. Pokud živý feed není dostupný, použije se záložní soubor `public/data/catalog.fallback.json`.

## Demo checkout

Objednávka v košíku je **jen simulace** — formulář se neodesílá do pivovaru, neprobíhá platba. Úspěšné „objednávky“ se ukládají do `localStorage` (`svabin.orders.v1`). Text upozornění je v aplikaci u checkoutu.

## Zvukové efekty

Licence a zdroje SFX: [`public/sounds/ATTRIBUTION.md`](public/sounds/ATTRIBUTION.md) (Mixkit).

## GitHub Pages

1. V repozitáři: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Po merge do větve `main` workflow `.github/workflows/deploy-pages.yml` spustí `npm test`, build s `VITE_BASE=/svabin-virtualni-vycep/` a nasadí `dist/`.
3. Veřejná URL bude ve tvaru `https://<user>.github.io/svabin-virtualni-vycep/` (přesně podle názvu repozitáře a Pages nastavení).
