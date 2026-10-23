import { drawCoverImageFull, getBarBackground } from '../assets.js';

export function drawBarLayer(ctx, layout) {
  const { W, H, tableY } = layout;
  const barBg = getBarBackground();
  if (barBg) {
    ctx.save();
    drawCoverImageFull(ctx, barBg, 0, 0, W, tableY + 20);
    const grade = ctx.createLinearGradient(0, 0, 0, tableY);
    grade.addColorStop(0, 'rgba(4, 2, 1, 0.78)');
    grade.addColorStop(0.4, 'rgba(6, 4, 2, 0.7)');
    grade.addColorStop(1, 'rgba(3, 2, 1, 0.86)');
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, tableY + 20);
    const spotlight = ctx.createRadialGradient(
      W * 0.38,
      H * 0.42,
      20,
      W * 0.4,
      H * 0.45,
      Math.max(W, H) * 0.5,
    );
    spotlight.addColorStop(0, 'rgba(255, 190, 110, 0.05)');
    spotlight.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
    spotlight.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, W, tableY + 20);
    ctx.restore();
  } else {
    const wallGrad = ctx.createRadialGradient(
      W * 0.38,
      H * 0.22,
      20,
      W * 0.42,
      H * 0.45,
      Math.max(W, H) * 0.85,
    );
    wallGrad.addColorStop(0, '#3a2c20');
    wallGrad.addColorStop(0.35, '#1c1612');
    wallGrad.addColorStop(1, '#070605');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, W, H);
  }
}
