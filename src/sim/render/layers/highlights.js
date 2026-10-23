export function drawHighlightsLayer(ctx, layout, state, lod) {
  const { spoutWorldX: spoutX, spoutWorldY: spoutY, scale } = layout;
  const time = (globalThis.performance?.now?.() || Date.now()) * 0.001;
  const mistStride = lod === 'low' ? 2 : 1;

  state.mistParticles.forEach((m, idx) => {
    if (idx % mistStride !== 0) return;
    const pulse = 0.85 + Math.sin(time * 8 + idx) * 0.15;
    ctx.fillStyle = `rgba(255, 248, 235, ${m.alpha * pulse * 0.9})`;
    ctx.beginPath();
    ctx.arc(spoutX + m.xOffset, spoutY + m.yOffset, m.r * (1 + pulse * 0.08), 0, Math.PI * 2);
    ctx.fill();
    if (lod !== 'low') {
      ctx.fillStyle = `rgba(255, 255, 255, ${m.alpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(spoutX + m.xOffset - m.r * 0.3, spoutY + m.yOffset - m.r * 0.35, m.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  if (state.flowRate > 0.08 && lod !== 'low') {
    for (let i = 0; i < 6; i += 1) {
      const t = (time * 2.2 + i * 0.4) % 1;
      const mx = spoutX + (Math.sin(time * 3 + i) * 12 - 8) * scale;
      const my = spoutY + t * 55 * scale;
      ctx.fillStyle = `rgba(255, 240, 210, ${(1 - t) * 0.25})`;
      ctx.beginPath();
      ctx.arc(mx, my, (2 + i * 0.3) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (state.flyingCap) {
    ctx.save();
    ctx.translate(spoutX + state.flyingCap.x, spoutY + state.flyingCap.y);
    ctx.rotate(state.flyingCap.angle);
    const capGrad = ctx.createLinearGradient(-11, -4, 11, 4);
    capGrad.addColorStop(0, '#e8a040');
    capGrad.addColorStop(0.5, '#c87828');
    capGrad.addColorStop(1, '#8a5018');
    ctx.fillStyle = capGrad;
    ctx.fillRect(-11, -4, 22, 7);
    ctx.restore();
  }
}
