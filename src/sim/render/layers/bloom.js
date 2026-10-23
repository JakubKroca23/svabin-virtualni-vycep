/** Warm spotlight bloom over the pour zone (high/medium LOD only). */
export function drawSceneBloom(ctx, layout, state, lod) {
  if (lod === 'low') return;
  const { W, H, glassCenterX, glassBottomY, glassH, scale, tableY } = layout;
  const fill = Math.min(1, (state.liquidMl + state.foamMl * 0.6) / state.maxGlassMl);
  const pourGlow = state.flowRate > 0.08 ? 0.22 + state.flowRate * 0.018 : 0;
  const beerGlow = 0.06 + fill * 0.14 + pourGlow;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const cx = glassCenterX + W * 0.06;
  const cy = glassBottomY - glassH * 0.42;
  const r = Math.max(W, H) * (0.28 + fill * 0.08);
  const bloom = ctx.createRadialGradient(cx, cy, 8 * scale, cx, cy, r);
  bloom.addColorStop(0, `rgba(255, 210, 120, ${beerGlow})`);
  bloom.addColorStop(0.35, `rgba(255, 160, 70, ${beerGlow * 0.45})`);
  bloom.addColorStop(0.72, 'rgba(255, 120, 40, 0)');
  bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, tableY + 4);

  if (state.flowRate > 0.05) {
    const streamBloom = ctx.createRadialGradient(
      layout.spoutWorldX,
      layout.spoutWorldY + 40 * scale,
      4,
      layout.spoutWorldX,
      layout.spoutWorldY + 80 * scale,
      90 * scale,
    );
    streamBloom.addColorStop(0, 'rgba(255, 230, 180, 0.35)');
    streamBloom.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = streamBloom;
    ctx.fillRect(0, 0, W, tableY);
  }
  ctx.restore();
}
