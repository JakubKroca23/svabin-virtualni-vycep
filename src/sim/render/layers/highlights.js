export function drawHighlightsLayer(ctx, layout, state) {
  const { spoutWorldX: spoutX, spoutWorldY: spoutY } = layout;
  state.mistParticles.forEach((m) => {
    ctx.fillStyle = `rgba(243, 237, 226, ${m.alpha})`;
    ctx.beginPath();
    ctx.arc(spoutX + m.xOffset, spoutY + m.yOffset, m.r, 0, Math.PI * 2);
    ctx.fill();
  });
  if (state.flyingCap) {
    ctx.save();
    ctx.translate(spoutX + state.flyingCap.x, spoutY + state.flyingCap.y);
    ctx.rotate(state.flyingCap.angle);
    ctx.fillStyle = '#c88a36';
    ctx.fillRect(-11, -4, 22, 7);
    ctx.restore();
  }
}
