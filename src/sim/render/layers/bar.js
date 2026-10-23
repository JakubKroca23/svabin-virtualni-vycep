import { drawCoverImageFull, getBarBackground } from '../assets.js';

export function drawBarLayer(ctx, layout, lod = 'high') {
  const { W, H, tableY, glassCenterX, glassBottomY, glassH } = layout;
  const barBg = getBarBackground();
  if (barBg) {
    ctx.save();
    drawCoverImageFull(ctx, barBg, 0, 0, W, tableY + 20);
    const grade = ctx.createLinearGradient(0, 0, 0, tableY);
    grade.addColorStop(0, 'rgba(2, 1, 0, 0.82)');
    grade.addColorStop(0.32, 'rgba(8, 5, 2, 0.74)');
    grade.addColorStop(0.72, 'rgba(4, 2, 1, 0.8)');
    grade.addColorStop(1, 'rgba(2, 1, 0, 0.9)');
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, tableY + 20);

    const spotCx = glassCenterX + W * 0.04;
    const spotCy = glassBottomY - glassH * 0.55;
    const spotR = Math.max(W, H) * (lod === 'low' ? 0.38 : 0.48);
    const spotlight = ctx.createRadialGradient(spotCx, spotCy, 12, spotCx, spotCy + H * 0.02, spotR);
    spotlight.addColorStop(0, 'rgba(255, 205, 130, 0.22)');
    spotlight.addColorStop(0.25, 'rgba(255, 170, 90, 0.1)');
    spotlight.addColorStop(0.55, 'rgba(40, 22, 8, 0.35)');
    spotlight.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, W, tableY + 20);

    const rimLight = ctx.createLinearGradient(W * 0.55, 0, W, 0);
    rimLight.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rimLight.addColorStop(0.7, 'rgba(255, 160, 80, 0.04)');
    rimLight.addColorStop(1, 'rgba(255, 200, 120, 0.08)');
    ctx.fillStyle = rimLight;
    ctx.fillRect(0, 0, W, tableY * 0.65);

    const vignette = ctx.createRadialGradient(W * 0.5, H * 0.38, Math.min(W, H) * 0.2, W * 0.5, H * 0.42, Math.max(W, H) * 0.72);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.75, 'rgba(0, 0, 0, 0.35)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, tableY + 20);
    ctx.restore();
  } else {
    const wallGrad = ctx.createRadialGradient(W * 0.38, H * 0.22, 20, W * 0.42, H * 0.45, Math.max(W, H) * 0.85);
    wallGrad.addColorStop(0, '#4a3828');
    wallGrad.addColorStop(0.35, '#1c1612');
    wallGrad.addColorStop(1, '#070605');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, W, H);
  }
}
