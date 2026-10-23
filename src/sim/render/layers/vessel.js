import { drawCoverImage, getLabelImage } from '../assets.js';

export function drawVesselLayer(ctx, layout, state, beer) {
  const { vesselPivotX: vx, vesselPivotY: vy, canW, canH, vesselTiltRad, scale } = layout;
  ctx.save();
  ctx.translate(vx, vy);
  ctx.rotate(vesselTiltRad);
  const halfW = canW * 0.5;
  const halfH = canH * 0.5;
  const labelImg = getLabelImage(beer.image);

  if (state.vesselType === 'can') {
    const bodyGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
    bodyGrad.addColorStop(0, '#1a1a1a');
    bodyGrad.addColorStop(0.18, '#6e6a66');
    bodyGrad.addColorStop(0.42, '#c8c4bf');
    bodyGrad.addColorStop(0.58, '#9a9691');
    bodyGrad.addColorStop(0.82, '#3a3835');
    bodyGrad.addColorStop(1, '#121110');
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, canW, canH, 7 * scale);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-halfW + 1.5 * scale, -halfH + 10 * scale, canW - 3 * scale, canH - 22 * scale, 4 * scale);
    ctx.clip();
    const drew = drawCoverImage(ctx, labelImg, -halfW, -halfH + 6 * scale, canW, canH - 14 * scale);
    if (!drew) {
      const fallback = ctx.createLinearGradient(0, -halfH, 0, halfH);
      fallback.addColorStop(0, beer.paperBg || '#e8dfd0');
      fallback.addColorStop(1, beer.liquidMid || '#c67810');
      ctx.fillStyle = fallback;
      ctx.fillRect(-halfW, -halfH, canW, canH);
      ctx.fillStyle = beer.inkPrimary || '#1a1510';
      ctx.font = `600 ${Math.round(14 * scale)}px Fraunces, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(beer.name || 'Švabín', 0, 4 * scale);
    }
    ctx.restore();

    const cylShadow = ctx.createLinearGradient(-halfW, 0, halfW, 0);
    cylShadow.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
    cylShadow.addColorStop(0.22, 'rgba(0, 0, 0, 0.12)');
    cylShadow.addColorStop(0.38, 'rgba(255, 255, 255, 0.22)');
    cylShadow.addColorStop(0.48, 'rgba(255, 255, 255, 0.05)');
    cylShadow.addColorStop(0.7, 'rgba(0, 0, 0, 0.18)');
    cylShadow.addColorStop(1, 'rgba(0, 0, 0, 0.68)');
    ctx.fillStyle = cylShadow;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, canW, canH, 7 * scale);
    ctx.fill();

    const lid = ctx.createLinearGradient(0, -halfH - 2 * scale, 0, -halfH + 10 * scale);
    lid.addColorStop(0, '#eceae7');
    lid.addColorStop(1, '#8a8681');
    ctx.fillStyle = lid;
    ctx.beginPath();
    ctx.ellipse(0, -halfH + 2 * scale, halfW * 0.92, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(-halfW * 0.28, -halfH - 1 * scale);
    ctx.rotate(-state.openProgress * 0.85);
    const tabGrad = ctx.createLinearGradient(0, -2, 0, 6);
    tabGrad.addColorStop(0, '#f0eeeb');
    tabGrad.addColorStop(1, '#7a7772');
    ctx.fillStyle = tabGrad;
    ctx.beginPath();
    ctx.roundRect(-6 * scale, -3 * scale, 16 * scale, 5 * scale, 1.5 * scale);
    ctx.fill();
    ctx.restore();
  } else {
    const bHalfW = canW * 0.52;
    const bottlePath = () => {
      ctx.beginPath();
      ctx.moveTo(-bHalfW * 0.3, -halfH);
      ctx.lineTo(bHalfW * 0.3, -halfH);
      ctx.bezierCurveTo(bHalfW * 0.34, -halfH + 42 * scale, bHalfW, -halfH + 62 * scale, bHalfW, -halfH + 92 * scale);
      ctx.lineTo(bHalfW, halfH - 10 * scale);
      ctx.quadraticCurveTo(bHalfW, halfH, bHalfW - 10 * scale, halfH);
      ctx.lineTo(-bHalfW + 10 * scale, halfH);
      ctx.quadraticCurveTo(-bHalfW, halfH, -bHalfW, halfH - 10 * scale);
      ctx.lineTo(-bHalfW, -halfH + 92 * scale);
      ctx.bezierCurveTo(-bHalfW, -halfH + 62 * scale, -bHalfW * 0.34, -halfH + 42 * scale, -bHalfW * 0.3, -halfH);
      ctx.closePath();
    };

    const bottleGrad = ctx.createLinearGradient(-bHalfW, 0, bHalfW, 0);
    bottleGrad.addColorStop(0, '#0a0502');
    bottleGrad.addColorStop(0.28, '#5a2a0c');
    bottleGrad.addColorStop(0.5, '#8a4518');
    bottleGrad.addColorStop(0.72, '#3a1808');
    bottleGrad.addColorStop(1, '#080401');
    bottlePath();
    ctx.fillStyle = bottleGrad;
    ctx.fill();

    ctx.save();
    bottlePath();
    ctx.clip();
    const bLabelY = -halfH + 78 * scale;
    const drew = drawCoverImage(ctx, labelImg, -bHalfW, bLabelY - 20 * scale, bHalfW * 2, 120 * scale);
    if (!drew) {
      ctx.fillStyle = beer.paperBg || '#e8dfd0';
      ctx.fillRect(-bHalfW + 3 * scale, bLabelY, bHalfW * 2 - 6 * scale, 78 * scale);
      ctx.fillStyle = beer.inkPrimary || '#1a1510';
      ctx.font = `700 ${Math.round(12 * scale)}px Fraunces, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(beer.name || 'Švabín', 0, bLabelY + 42 * scale);
    }
    const edge = ctx.createLinearGradient(-bHalfW, 0, bHalfW, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0.55)');
    edge.addColorStop(0.35, 'rgba(0,0,0,0)');
    edge.addColorStop(0.65, 'rgba(255,200,120,0.08)');
    edge.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = edge;
    ctx.fillRect(-bHalfW, -halfH, bHalfW * 2, canH);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 220, 160, 0.18)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(-bHalfW * 0.18, -halfH + 8 * scale);
    ctx.lineTo(-bHalfW * 0.18, -halfH + 55 * scale);
    ctx.stroke();

    if (!state.isOpened) {
      const cork = ctx.createLinearGradient(0, -halfH - 6 * scale, 0, -halfH + 4 * scale);
      cork.addColorStop(0, '#d4a574');
      cork.addColorStop(1, '#8a5a2e');
      ctx.fillStyle = cork;
      ctx.beginPath();
      ctx.roundRect(-bHalfW * 0.34, -halfH - 6 * scale, bHalfW * 0.68, 10 * scale, 2 * scale);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-bHalfW * 0.34, -halfH - 1 * scale, bHalfW * 0.68, 2 * scale);
    }
  }

  if (!state.isOpened) {
    ctx.fillStyle = 'rgba(20, 16, 12, 0.82)';
    ctx.strokeStyle = 'rgba(200, 138, 54, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-56 * scale, -halfH - 36 * scale, 112 * scale, 22 * scale, 5 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f3ede2';
    ctx.font = `500 ${Math.round(8.5 * scale)}px DM Sans, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Klikni pro otevření', 0, -halfH - 21 * scale);
  }
  ctx.restore();
}
