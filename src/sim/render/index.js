import { DEFAULT_BEER } from '../state.js';
import { getLabelImage } from './assets.js';
import { computeSceneLayout } from './layout.js';
import { lodStreamDetail, recordFrameTiming, updateRenderLod } from './lod.js';
import { drawBarLayer } from './layers/bar.js';
import { drawSceneBloom } from './layers/bloom.js';
import { drawGlassLayer } from './layers/glass.js';
import { drawHighlightsLayer } from './layers/highlights.js';
import { drawStreamLayer } from './layers/stream.js';
import { drawSpillOnTable, drawTableLayer } from './layers/table.js';
import { drawVesselLayer } from './layers/vessel.js';

let lastFrameTime = 0;

export function renderScene(ctx, canvas, state) {
  const rect = canvas.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  if (!W || !H) return;

  const now = globalThis.performance?.now?.() || Date.now();
  if (lastFrameTime) recordFrameTiming(state, now - lastFrameTime);
  lastFrameTime = now;
  const lod = updateRenderLod(state);

  const beer = state.selectedBeer || DEFAULT_BEER;
  getLabelImage(beer.image);

  ctx.clearRect(0, 0, W, H);
  const layout = computeSceneLayout(W, H, state);

  drawBarLayer(ctx, layout, lod);
  drawTableLayer(ctx, layout, state);
  drawSpillOnTable(ctx, layout, state, beer, lod);

  if (state.flowRate > 0.05) {
    drawStreamLayer(ctx, layout, state, beer, lodStreamDetail(lod));
  }
  drawGlassLayer(ctx, layout, state, beer, lod);
  drawVesselLayer(ctx, layout, state, beer);
  drawHighlightsLayer(ctx, layout, state, lod);
  drawSceneBloom(ctx, layout, state, lod);
}

export { computeSceneLayout } from './layout.js';
