import { buildGlassPath, getGlassProfile } from '../geometry.js';
import { lodBubbleStride, lodFoamCellStride, lodShowCondensation } from '../lod.js';

function drawGlassContents(ctx, state, glassH, glassHalfW, glassTiltRad, scale, beer, lod) {
  const minBowlY = state.glassType === 'teku' ? 0.31 : 0.065;
  const usableH = glassH * (0.96 - minBowlY);
  const baseBowlPx = -minBowlY * glassH;
  const liquidRatio = Math.min(1, state.liquidMl / state.maxGlassMl);
  const foamRatio = Math.min(1 - liquidRatio * 0.85, state.foamMl / state.maxGlassMl);
  const liquidTopY = baseBowlPx - liquidRatio * usableH;
  const foamTopY = liquidTopY - foamRatio * usableH;
  const surfaceSlope = Math.tan(-glassTiltRad * 0.78) * glassHalfW;

  if (state.lacingRings.length > 0) {
    ctx.strokeStyle = 'rgba(250, 244, 232, 0.42)';
    ctx.lineWidth = 3 * scale;
    state.lacingRings.forEach((rRatio) => {
      const ringY = baseBowlPx - rRatio * usableH;
      ctx.beginPath();
      ctx.moveTo(-glassHalfW * 1.2, ringY);
      ctx.quadraticCurveTo(0, ringY + 4 * scale, glassHalfW * 1.2, ringY);
      ctx.stroke();
    });
  }

  if (state.liquidMl > 2) {
    const liqGrad = ctx.createLinearGradient(0, foamTopY, 0, baseBowlPx);
    liqGrad.addColorStop(0, beer.liquidTop);
    liqGrad.addColorStop(0.5, beer.liquidMid);
    liqGrad.addColorStop(1, beer.liquidBottom);
    ctx.fillStyle = liqGrad;
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 1.3, baseBowlPx + 20);
    ctx.lineTo(-glassHalfW * 1.3, liquidTopY - surfaceSlope);
    for (let i = 0; i < state.waveCount; i += 1) {
      const t = i / (state.waveCount - 1);
      const wx = (-1.2 + t * 2.4) * glassHalfW;
      const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
      const wy = liquidTopY + tiltOffset + state.waveHeights[i] * scale;
      ctx.lineTo(wx, wy);
    }
    ctx.lineTo(glassHalfW * 1.3, baseBowlPx + 20);
    ctx.closePath();
    ctx.fill();

    const sssGrad = ctx.createRadialGradient(
      0,
      (liquidTopY + baseBowlPx) * 0.52,
      4,
      0,
      (liquidTopY + baseBowlPx) * 0.52,
      glassHalfW * 0.95,
    );
    sssGrad.addColorStop(0, `rgba(255, 220, 120, ${0.24 + beer.haziness * 0.18})`);
    sssGrad.addColorStop(0.7, 'rgba(255, 190, 70, 0.05)');
    sssGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
    ctx.fillStyle = sssGrad;
    ctx.fillRect(-glassHalfW * 1.2, foamTopY, glassHalfW * 2.4, usableH);

    ctx.fillStyle = 'rgba(255, 248, 230, 0.42)';
    const bubbleStride = lodBubbleStride(lod);
    state.bubbles.forEach((b, idx) => {
      if (idx % bubbleStride !== 0) return;
      const bx = b.u * glassHalfW * 0.85;
      const by = baseBowlPx - b.v * (liquidRatio * usableH);
      if (by > liquidTopY) {
        ctx.beginPath();
        ctx.arc(bx, by, b.r * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  if (state.foamMl > 2) {
    const foamGrad = ctx.createLinearGradient(0, foamTopY - 10 * scale, 0, liquidTopY + 8 * scale);
    foamGrad.addColorStop(0, '#ffffff');
    foamGrad.addColorStop(0.65, beer.foamTone);
    foamGrad.addColorStop(1, '#dfd3be');
    ctx.fillStyle = foamGrad;
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 1.3, liquidTopY - surfaceSlope + 4 * scale);
    for (let i = 0; i < state.waveCount; i += 1) {
      const t = i / (state.waveCount - 1);
      const wx = (-1.2 + t * 2.4) * glassHalfW;
      const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
      const dome = Math.sin(t * Math.PI) * 7 * scale;
      const wy = foamTopY + tiltOffset - dome + state.waveHeights[i] * 0.6 * scale;
      ctx.lineTo(wx, wy);
    }
    for (let i = state.waveCount - 1; i >= 0; i -= 1) {
      const t = i / (state.waveCount - 1);
      const wx = (-1.2 + t * 2.4) * glassHalfW;
      const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
      const wy = liquidTopY + tiltOffset + state.waveHeights[i] * scale + 3 * scale;
      ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(195, 178, 150, 0.18)';
    const foamHeightPx = Math.max(4, liquidTopY - foamTopY);
    const cellStride = lodFoamCellStride(lod);
    state.foamCells.forEach((cell, idx) => {
      if (idx % cellStride !== 0) return;
      const cx = cell.u * glassHalfW * 0.85;
      const cy = foamTopY + cell.u * 0.5 * surfaceSlope + cell.v * foamHeightPx;
      ctx.beginPath();
      ctx.arc(cx, cy, cell.r * scale * 0.65, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (lodShowCondensation(lod) && state.liquidMl + state.foamMl > 40) {
    const dewAlpha = Math.min(0.32, ((state.liquidMl + state.foamMl) / state.maxGlassMl) * 0.32);
    ctx.fillStyle = `rgba(255, 252, 245, ${dewAlpha})`;
    state.condensationDrops.forEach((drop) => {
      if (drop.slipSpeed > 0) {
        drop.v -= drop.slipSpeed;
        if (drop.v < 0.08) drop.v = 0.88;
      }
      const dx = drop.u * glassHalfW * 0.88;
      const dy = baseBowlPx - drop.v * usableH;
      if (dy > foamTopY) {
        ctx.beginPath();
        ctx.arc(dx, dy, drop.r * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

export function drawGlassLayer(ctx, layout, state, beer, lod) {
  const { glassCenterX: gx, glassBottomY: gy, glassH, glassHalfW, glassTiltRad, scale } = layout;

  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(glassTiltRad);

  const thickness = 5.5 * scale;
  const rimY = -glassH * 0.985;
  const rimOuterW = getGlassProfile(0.985, state.glassType, glassHalfW);
  const rimInnerW = Math.max(6, rimOuterW - thickness * 0.85);
  const rimEllipseH = 7.5 * scale;
  const baseY = 0;
  const baseOuterW = getGlassProfile(0.02, state.glassType, glassHalfW);

  ctx.save();
  const footGrad = ctx.createRadialGradient(0, baseY, 2, 0, baseY, baseOuterW * 1.15);
  footGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
  footGrad.addColorStop(0.55, 'rgba(200,200,200,0.08)');
  footGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = footGrad;
  ctx.beginPath();
  ctx.ellipse(0, baseY + 2 * scale, baseOuterW * 1.08, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (state.glassType === 'mug') {
    ctx.save();
    ctx.strokeStyle = 'rgba(220, 220, 220, 0.22)';
    ctx.lineWidth = 14 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 0.9, -glassH * 0.74);
    ctx.bezierCurveTo(-glassHalfW * 1.58, -glassH * 0.76, -glassHalfW * 1.58, -glassH * 0.28, -glassHalfW * 0.88, -glassH * 0.3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3.5 * scale;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 0.92, -glassH * 0.72);
    ctx.bezierCurveTo(-glassHalfW * 1.48, -glassH * 0.72, -glassHalfW * 1.48, -glassH * 0.32, -glassHalfW * 0.9, -glassH * 0.32);
    ctx.stroke();
    ctx.restore();
  }

  buildGlassPath(ctx, glassH, glassHalfW, state.glassType);
  const shellGrad = ctx.createLinearGradient(-glassHalfW, 0, glassHalfW, 0);
  shellGrad.addColorStop(0, 'rgba(210, 230, 255, 0.16)');
  shellGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0.05)');
  shellGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
  shellGrad.addColorStop(0.82, 'rgba(255, 255, 255, 0.06)');
  shellGrad.addColorStop(1, 'rgba(180, 200, 230, 0.18)');
  ctx.fillStyle = shellGrad;
  ctx.fill();

  ctx.save();
  buildGlassPath(ctx, glassH, glassHalfW, state.glassType, thickness);
  ctx.clip();
  drawGlassContents(ctx, state, glassH, glassHalfW, glassTiltRad, scale, beer, lod);
  const innerTint = ctx.createLinearGradient(-glassHalfW, 0, glassHalfW, 0);
  innerTint.addColorStop(0, 'rgba(255,255,255,0.08)');
  innerTint.addColorStop(0.5, 'rgba(255,255,255,0)');
  innerTint.addColorStop(1, 'rgba(120,160,200,0.1)');
  ctx.fillStyle = innerTint;
  ctx.fillRect(-glassHalfW * 1.2, -glassH, glassHalfW * 2.4, glassH + 20);
  ctx.restore();

  buildGlassPath(ctx, glassH, glassHalfW, state.glassType);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.6 * scale;
  ctx.stroke();
  buildGlassPath(ctx, glassH, glassHalfW, state.glassType, thickness);
  ctx.strokeStyle = 'rgba(180, 200, 220, 0.22)';
  ctx.lineWidth = 1.1 * scale;
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.ellipse(0, rimY, rimOuterW, rimEllipseH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10, 12, 16, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, rimY + 0.8 * scale, rimInnerW, rimEllipseH * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 2.2 * scale;
  ctx.beginPath();
  ctx.ellipse(0, rimY, rimOuterW, rimEllipseH, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1.4 * scale;
  ctx.beginPath();
  ctx.ellipse(0, rimY + 1.2 * scale, rimInnerW, rimEllipseH * 0.7, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.restore();

  if (lod !== 'low') {
    const reflGrad = ctx.createLinearGradient(0, -glassH * 0.95, 0, -glassH * 0.15);
    reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    reflGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.18)');
    reflGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = reflGrad;
    ctx.lineWidth = 6 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 0.7, -glassH * 0.9);
    ctx.quadraticCurveTo(-glassHalfW * 0.74, -glassH * 0.55, -glassHalfW * 0.62, -glassH * 0.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(glassHalfW * 0.58, -glassH * 0.82);
    ctx.lineTo(glassHalfW * 0.55, -glassH * 0.28);
    ctx.stroke();
  }

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#f5f0e6';
  ctx.font = `500 ${Math.round(11 * scale)}px Fraunces, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Švabín', 0, -glassH * 0.58);
  ctx.restore();
  ctx.restore();
}
