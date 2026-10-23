import { drawCoverImage, getLabelImage } from '../assets.js';
import { rgbaFromHex } from '../color.js';

export function drawVesselLayer(ctx, layout, state, beer) {
  const { vesselPivotX: vx, vesselPivotY: vy, canW, canH, vesselTiltRad, scale } = layout;
  ctx.save();
  ctx.translate(vx, vy);
  ctx.rotate(vesselTiltRad);
  const halfW = canW * 0.5;
  const halfH = canH * 0.5;
  const labelImg = getLabelImage(beer.image);

  if (state.vesselType === 'can') {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18 * scale;
    ctx.shadowOffsetY = 6 * scale;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, canW, canH, 8 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.restore();

    const bodyGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
    bodyGrad.addColorStop(0, '#141312');
    bodyGrad.addColorStop(0.12, '#5a5652');
    bodyGrad.addColorStop(0.32, '#d8d4cf');
    bodyGrad.addColorStop(0.48, '#f2efea');
    bodyGrad.addColorStop(0.52, '#a8a49f');
    bodyGrad.addColorStop(0.78, '#3a3835');
    bodyGrad.addColorStop(1, '#0c0b0a');
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, canW, canH, 8 * scale);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-halfW + 2 * scale, -halfH + 10 * scale, canW - 4 * scale, canH - 24 * scale, 5 * scale);
    ctx.clip();
    const drew = drawCoverImage(ctx, labelImg, -halfW, -halfH + 6 * scale, canW, canH - 14 * scale);
    if (!drew) {
      const fallback = ctx.createLinearGradient(0, -halfH, 0, halfH);
      fallback.addColorStop(0, beer.paperBg || '#e8dfd0');
      fallback.addColorStop(0.5, beer.liquidMid || '#c67810');
      fallback.addColorStop(1, beer.liquidBottom || '#8c4904');
      ctx.fillStyle = fallback;
      ctx.fillRect(-halfW, -halfH, canW, canH);
      ctx.fillStyle = beer.inkPrimary || '#1a1510';
      ctx.font = `600 ${Math.round(15 * scale)}px Fraunces, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(beer.name || 'Švabín', 0, 4 * scale);
      ctx.font = `500 ${Math.round(9 * scale)}px DM Sans, system-ui, sans-serif`;
      ctx.fillStyle = beer.inkAccent || '#9b6318';
      ctx.fillText(beer.subtitle || '', 0, 18 * scale);
    }
    const labelGloss = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
    labelGloss.addColorStop(0, 'rgba(255,255,255,0.18)');
    labelGloss.addColorStop(0.35, 'rgba(255,255,255,0)');
    labelGloss.addColorStop(0.65, 'rgba(0,0,0,0.08)');
    labelGloss.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = labelGloss;
    ctx.fillRect(-halfW, -halfH, canW, canH);
    ctx.restore();

    const cylShadow = ctx.createLinearGradient(-halfW, 0, halfW, 0);
    cylShadow.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    cylShadow.addColorStop(0.2, 'rgba(0, 0, 0, 0.15)');
    cylShadow.addColorStop(0.38, 'rgba(255, 255, 255, 0.32)');
    cylShadow.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
    cylShadow.addColorStop(0.72, 'rgba(0, 0, 0, 0.22)');
    cylShadow.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
    ctx.fillStyle = cylShadow;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, canW, canH, 8 * scale);
    ctx.fill();

    const lid = ctx.createLinearGradient(0, -halfH - 3 * scale, 0, -halfH + 12 * scale);
    lid.addColorStop(0, '#f5f3f0');
    lid.addColorStop(0.45, '#c8c4bf');
    lid.addColorStop(1, '#6a6661');
    ctx.fillStyle = lid;
    ctx.beginPath();
    ctx.ellipse(0, -halfH + 2 * scale, halfW * 0.94, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();

    ctx.save();
    ctx.translate(-halfW * 0.28, -halfH - 1 * scale);
    ctx.rotate(-state.openProgress * 0.85);
    const tabGrad = ctx.createLinearGradient(0, -2, 0, 6);
    tabGrad.addColorStop(0, '#f4f2ef');
    tabGrad.addColorStop(1, '#6e6a65');
    ctx.fillStyle = tabGrad;
    ctx.beginPath();
    ctx.roundRect(-7 * scale, -3 * scale, 18 * scale, 6 * scale, 2 * scale);
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
    bottleGrad.addColorStop(0, 'rgba(5,2,1,0.95)');
    bottleGrad.addColorStop(0.22, '#4a2208');
    bottleGrad.addColorStop(0.42, '#9a5018');
    bottleGrad.addColorStop(0.55, rgbaFromHex(beer.liquidMid || '#8a4518', 0.85));
    bottleGrad.addColorStop(0.72, '#2a1006');
    bottleGrad.addColorStop(1, 'rgba(4,1,0,0.98)');
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
    edge.addColorStop(0, 'rgba(0,0,0,0.62)');
    edge.addColorStop(0.32, 'rgba(0,0,0,0)');
    edge.addColorStop(0.55, 'rgba(255,220,150,0.15)');
    edge.addColorStop(0.72, 'rgba(255,200,120,0.06)');
    edge.addColorStop(1, 'rgba(0,0,0,0.68)');
    ctx.fillStyle = edge;
    ctx.fillRect(-bHalfW, -halfH, bHalfW * 2, canH);
    const glassSheen = ctx.createLinearGradient(-bHalfW * 0.3, -halfH, bHalfW * 0.15, halfH);
    glassSheen.addColorStop(0, 'rgba(255,255,255,0.22)');
    glassSheen.addColorStop(0.4, 'rgba(255,255,255,0)');
    glassSheen.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = glassSheen;
    ctx.fillRect(-bHalfW, -halfH, bHalfW * 2, canH);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 230, 180, 0.28)';
    ctx.lineWidth = 2.4 * scale;
    ctx.beginPath();
    ctx.moveTo(-bHalfW * 0.18, -halfH + 8 * scale);
    ctx.lineTo(-bHalfW * 0.18, -halfH + 55 * scale);
    ctx.stroke();

    if (!state.isOpened) {
      const cork = ctx.createLinearGradient(0, -halfH - 6 * scale, 0, -halfH + 4 * scale);
      cork.addColorStop(0, '#e0b888');
      cork.addColorStop(0.5, '#c48850');
      cork.addColorStop(1, '#7a4a22');
      ctx.fillStyle = cork;
      ctx.beginPath();
      ctx.roundRect(-bHalfW * 0.34, -halfH - 6 * scale, bHalfW * 0.68, 11 * scale, 2 * scale);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-bHalfW * 0.34, -halfH - 1 * scale, bHalfW * 0.68, 2.5 * scale);
    }
  }

  if (!state.isOpened) {
    ctx.fillStyle = 'rgba(12, 10, 8, 0.88)';
    ctx.strokeStyle = 'rgba(220, 150, 60, 0.85)';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.roundRect(-58 * scale, -halfH - 36 * scale, 116 * scale, 24 * scale, 6 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8f2e8';
    ctx.font = `600 ${Math.round(8.5 * scale)}px DM Sans, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Klikni pro otevření', 0, -halfH - 20 * scale);
  }
  ctx.restore();
}
