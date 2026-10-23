import { rgbaFromHex } from '../color.js';

export function drawTableLayer(ctx, layout, state) {
  const { W, H, tableY, scale, glassCenterX, glassBottomY, glassHalfW, vesselPivotX, canW } = layout;
  const spillWet = Math.min(1, (state.spillMl || 0) / 120 + (state.spillDrops?.length || 0) * 0.012);

  const tableGrad = ctx.createLinearGradient(0, tableY - 14, 0, H);
  tableGrad.addColorStop(0, '#6b4a32');
  tableGrad.addColorStop(0.06, '#4a3020');
  tableGrad.addColorStop(0.22, '#2a1a12');
  tableGrad.addColorStop(0.55, '#160e0a');
  tableGrad.addColorStop(1, '#080504');
  ctx.fillStyle = tableGrad;
  ctx.fillRect(0, tableY, W, H - tableY);

  ctx.save();
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 14; i += 1) {
    const y = tableY + 4 + i * ((H - tableY) / 14);
    ctx.strokeStyle = i % 2 === 0 ? '#c49a6a' : '#0e0806';
    ctx.lineWidth = i % 3 === 0 ? 1.4 : 0.9;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(W * 0.35, y - 3, W * 0.68, y + 2.5, W, y - 1);
    ctx.stroke();
  }
  ctx.restore();

  if (spillWet > 0.02) {
    const wetX = glassCenterX + glassHalfW * 0.15;
    const wetGrad = ctx.createRadialGradient(wetX, tableY + 6 * scale, 4, wetX, tableY + 8 * scale, glassHalfW * 2.2);
    wetGrad.addColorStop(0, `rgba(90, 55, 28, ${0.35 + spillWet * 0.35})`);
    wetGrad.addColorStop(0.45, `rgba(40, 24, 14, ${0.2 + spillWet * 0.25})`);
    wetGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = wetGrad;
    ctx.fillRect(0, tableY, W, H - tableY);
    ctx.save();
    ctx.globalAlpha = 0.35 + spillWet * 0.4;
    ctx.strokeStyle = 'rgba(255, 220, 170, 0.55)';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.ellipse(wetX, tableY + 5 * scale, glassHalfW * (0.9 + spillWet * 0.5), 6 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const edgeGrad = ctx.createLinearGradient(0, tableY - 8, 0, tableY + 28 * scale);
  edgeGrad.addColorStop(0, 'rgba(255, 230, 190, 0.35)');
  edgeGrad.addColorStop(0.15, 'rgba(180, 130, 90, 0.22)');
  edgeGrad.addColorStop(0.5, 'rgba(30, 18, 12, 0.85)');
  edgeGrad.addColorStop(1, 'rgba(10, 6, 4, 0.95)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, tableY - 2, W, 22 * scale);
  ctx.fillStyle = 'rgba(255, 235, 200, 0.28)';
  ctx.fillRect(0, tableY, W, 2.5);

  const shadowGrad = ctx.createRadialGradient(
    glassCenterX,
    glassBottomY + 4 * scale,
    4,
    glassCenterX,
    glassBottomY + 4 * scale,
    glassHalfW * 1.75,
  );
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
  shadowGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.42)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(glassCenterX, glassBottomY + 5 * scale, glassHalfW * 1.55, 16 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const vShadow = ctx.createRadialGradient(
    vesselPivotX - 10 * scale,
    tableY + 2,
    4,
    vesselPivotX,
    tableY + 2,
    canW * 1.55,
  );
  vShadow.addColorStop(0, 'rgba(0,0,0,0.58)');
  vShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vShadow;
  ctx.beginPath();
  ctx.ellipse(vesselPivotX - 8 * scale, tableY + 3 * scale, canW * 1.15, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSpillOnTable(ctx, layout, state, beer, lod) {
  const drops = state.spillDrops;
  if (!drops?.length) return;
  const { glassCenterX, glassHalfW, scale, tableY } = layout;
  const spillBaseX = glassCenterX + glassHalfW * 0.2;
  const spillBaseY = tableY - 2 * scale;
  const maxDrops = lod === 'low' ? 22 : lod === 'medium' ? 48 : 100;
  const stride = lod === 'low' ? 2 : 1;

  for (let i = 0; i < Math.min(drops.length, maxDrops); i += stride) {
    const d = drops[i];
    const x = spillBaseX + d.x * glassHalfW * 2.2;
    const y = spillBaseY + d.y * 28 * scale;
    const isFoam = d.kind === 'foam';
    const baseColor = isFoam ? beer.foamTone : beer.liquidMid;

    ctx.save();
    ctx.globalAlpha = d.alpha * 0.85;
    const puddle = ctx.createRadialGradient(x, y, 0, x, y, d.r * scale * 1.8);
    puddle.addColorStop(0, rgbaFromHex(baseColor, 0.75));
    puddle.addColorStop(0.55, rgbaFromHex(beer.liquidBottom || baseColor, 0.45));
    puddle.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = puddle;
    ctx.beginPath();
    ctx.ellipse(x, y, d.r * scale * 1.15, d.r * scale * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    if (lod !== 'low') {
      ctx.globalAlpha = d.alpha * 0.65;
      ctx.fillStyle = 'rgba(255, 245, 220, 0.75)';
      ctx.beginPath();
      ctx.ellipse(x - d.r * scale * 0.35, y - d.r * scale * 0.2, d.r * scale * 0.35, d.r * scale * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
