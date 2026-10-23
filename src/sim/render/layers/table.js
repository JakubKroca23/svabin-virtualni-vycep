export function drawTableLayer(ctx, layout) {
  const { W, H, tableY, scale, glassCenterX, glassBottomY, glassHalfW, vesselPivotX, canW } = layout;

  const tableGrad = ctx.createLinearGradient(0, tableY - 10, 0, H);
  tableGrad.addColorStop(0, '#5a3d28');
  tableGrad.addColorStop(0.08, '#3a2618');
  tableGrad.addColorStop(0.35, '#22160f');
  tableGrad.addColorStop(1, '#0a0604');
  ctx.fillStyle = tableGrad;
  ctx.fillRect(0, tableY, W, H - tableY);
  ctx.save();
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 12; i += 1) {
    const y = tableY + 5 + i * ((H - tableY) / 12);
    ctx.strokeStyle = i % 2 === 0 ? '#a07850' : '#140c08';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(W * 0.4, y - 2, W * 0.7, y + 2, W, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 220, 170, 0.12)';
  ctx.fillRect(0, tableY, W, 1.5);

  const shadowGrad = ctx.createRadialGradient(
    glassCenterX,
    glassBottomY + 4 * scale,
    4,
    glassCenterX,
    glassBottomY + 4 * scale,
    glassHalfW * 1.55,
  );
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  shadowGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(glassCenterX, glassBottomY + 4 * scale, glassHalfW * 1.45, 14 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const vShadow = ctx.createRadialGradient(
    vesselPivotX - 10 * scale,
    tableY + 2,
    4,
    vesselPivotX,
    tableY + 2,
    canW * 1.4,
  );
  vShadow.addColorStop(0, 'rgba(0,0,0,0.45)');
  vShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vShadow;
  ctx.beginPath();
  ctx.ellipse(vesselPivotX - 8 * scale, tableY + 2, canW * 1.1, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSpillOnTable(ctx, layout, state, beer, lod) {
  if (!state.spillDrops?.length) return;
  const { glassCenterX, glassBottomY, glassHalfW, scale, tableY } = layout;
  const spillBaseX = glassCenterX + glassHalfW * 0.2;
  const spillBaseY = tableY - 2 * scale;
  const maxDrops = lod === 'low' ? 18 : lod === 'medium' ? 36 : 80;
  const stride = lod === 'low' ? 2 : 1;
  for (let i = 0; i < Math.min(state.spillDrops.length, maxDrops); i += stride) {
    const d = state.spillDrops[i];
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle = d.kind === 'foam' ? beer.foamTone : beer.liquidMid;
    ctx.beginPath();
    ctx.ellipse(
      spillBaseX + d.x * glassHalfW * 2.2,
      spillBaseY + d.y * 28 * scale,
      d.r * scale,
      d.r * scale * 0.65,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
