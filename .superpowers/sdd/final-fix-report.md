## Important Findings Fix

- Rendered official Svabin catalog images from `beer.image` through `safeCatalogImageUrl`, with a name placeholder fallback on image load error.
- Added safe product thumbnails in the beer strip when official images are available.
- Added mix add-to-cart buttons while keeping the external mix detail links.
- Mix cart lines now use the first in-stock offer price as `priceOnce`, `applySubscription(priceOnce)` as `priceSub`, `mix.name`, `mix.id`, and the selected `sub`/`once` mode.

Verification:
- `npm test`
- `npm run build`
