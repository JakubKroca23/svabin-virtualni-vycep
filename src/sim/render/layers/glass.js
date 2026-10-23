import { buildGlassPath, getGlassProfile } from '../geometry.js';
import { rgbaFromHex } from '../color.js';
import { lodBubbleStride, lodFoamCellStride, lodShowCondensation } from '../lod.js';

function drawMeniscusAndWalls(ctx, liquidTopY, surfaceSlope, glassHalfW, scale, beer, haziness) {
  ctx.save();
  ctx.strokeStyle = rgbaFromHex(beer.liquidBottom, 0.55);
  ctx.lineWidth = 2.8 * scale;
  ctx.beginPath();
  ctx.moveTo(-glassHalfW * 1.05, liquidTopY - surfaceSlope);
  for (let t = 0; t <= 1; t += 0.08) {
    const wx = (-1.05 + t * 2.1) * glassHalfW;
    const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
    ctx.lineTo(wx, liquidTopY + tiltOffset);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 252, 240, 0.55)';
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-glassHalfW * 0.95, liquidTopY - surfaceSlope - 1.5 * scale);
  for (let t = 0; t <= 1; t += 0.1) {
    const wx = (-0.95 + t * 1.9) * glassHalfW;
    const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
    ctx.lineTo(wx, liquidTopY + tiltOffset - 2 * scale);
  }
  ctx.stroke();

  const wallShade = ctx.createLinearGradient(-glassHalfW, 0, glassHalfW, 0);
  wallShade.addColorStop(0, `rgba(0, 0, 0, ${0.22 + haziness * 0.12})`);
  wallShade.addColorStop(0.22, 'rgba(0, 0, 0, 0.05)');
  wallShade.addColorStop(0.78, 'rgba(0, 0, 0, 0.04)');
  wallShade.addColorStop(1, `rgba(0, 0, 0, ${0.2 + haziness * 0.1})`);
  ctx.fillStyle = wallShade;
  ctx.fillRect(-glassHalfW * 1.15, liquidTopY - 8 * scale, glassHalfW * 2.3, 40 * scale);
  ctx.restore();
}

function drawGlassContents(ctx, state, glassH, glassHalfW, glassTiltRad, scale, beer, lod) {
  const minBowlY = state.glassType === 'teku' ? 0.31 : 0.065;
  const usableH = glassH * (0.96 - minBowlY);
  const baseBowlPx = -minBowlY * glassH;
  const liquidRatio = Math.min(1, state.liquidMl / state.maxGlassMl);
  const foamRatio = Math.min(1 - liquidRatio * 0.85, state.foamMl / state.maxGlassMl);
  const liquidTopY = baseBowlPx - liquidRatio * usableH;
  const foamTopY = liquidTopY - foamRatio * usableH;
  const surfaceSlope = Math.tan(-glassTiltRad * 0.78) * glassHalfW;
  const haziness = beer.haziness ?? 0.2;

  if (state.lacingRings.length > 0) {
    state.lacingRings.forEach((rRatio, idx) => {
      const ringY = baseBowlPx - rRatio * usableH;
      const fade = 0.55 + (idx / Math.max(1, state.lacingRings.length)) * 0.35;
      ctx.strokeStyle = `rgba(255, 248, 235, ${0.35 * fade})`;
      ctx.lineWidth = 5.5 * scale;
      ctx.beginPath();
      ctx.moveTo(-glassHalfW * 1.15, ringY);
      ctx.quadraticCurveTo(0, ringY + 5 * scale, glassHalfW * 1.15, ringY);
      ctx.stroke();
      ctx.strokeStyle = `rgba(210, 185, 150, ${0.55 * fade})`;
      ctx.lineWidth = 2.2 * scale;
      ctx.beginPath();
      ctx.moveTo(-glassHalfW * 1.05, ringY + 1.5 * scale);
      ctx.quadraticCurveTo(0, ringY + 6 * scale, glassHalfW * 1.05, ringY + 1.5 * scale);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 250, ${0.12 * fade})`;
      ctx.beginPath();
      ctx.ellipse(0, ringY + 3 * scale, glassHalfW * 0.35, 2.5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (state.liquidMl > 2) {
    const depthGrad = ctx.createLinearGradient(-glassHalfW, 0, glassHalfW, 0);
    depthGrad.addColorStop(0, rgbaFromHex(beer.liquidBottom, 0.95));
    depthGrad.addColorStop(0.35, rgbaFromHex(beer.liquidMid, 0.92));
    depthGrad.addColorStop(0.65, rgbaFromHex(beer.liquidMid, 0.88));
    depthGrad.addColorStop(1, rgbaFromHex(beer.liquidBottom, 0.98));
    ctx.fillStyle = depthGrad;
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

    const liqGrad = ctx.createLinearGradient(0, foamTopY, 0, baseBowlPx);
    liqGrad.addColorStop(0, beer.liquidTop);
    liqGrad.addColorStop(0.35, beer.liquidMid);
    liqGrad.addColorStop(0.75, beer.liquidMid);
    liqGrad.addColorStop(1, beer.liquidBottom);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = liqGrad;
    ctx.fill();
    ctx.globalAlpha = 1;

    const sssGrad = ctx.createRadialGradient(
      glassHalfW * 0.15,
      (liquidTopY + baseBowlPx) * 0.5,
      6,
      0,
      (liquidTopY + baseBowlPx) * 0.55,
      glassHalfW * 1.05,
    );
    sssGrad.addColorStop(0, `rgba(255, 230, 140, ${0.32 + haziness * 0.22})`);
    sssGrad.addColorStop(0.55, `rgba(255, 180, 70, ${0.08 + haziness * 0.12})`);
    sssGrad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    ctx.fillStyle = sssGrad;
    ctx.fillRect(-glassHalfW * 1.2, foamTopY, glassHalfW * 2.4, usableH);

    if (haziness > 0.12) {
      ctx.fillStyle = `rgba(255, 220, 160, ${haziness * 0.15})`;
      for (let h = 0; h < 6; h += 1) {
        const hx = (h - 2.5) * glassHalfW * 0.22;
        ctx.beginPath();
        ctx.ellipse(hx, baseBowlPx - liquidRatio * usableH * (0.3 + h * 0.1), glassHalfW * 0.18, usableH * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawMeniscusAndWalls(ctx, liquidTopY, surfaceSlope, glassHalfW, scale, beer, haziness);

    ctx.fillStyle = 'rgba(255, 252, 245, 0.55)';
    const bubbleStride = lodBubbleStride(lod);
    state.bubbles.forEach((b, idx) => {
      if (idx % bubbleStride !== 0) return;
      const bx = b.u * glassHalfW * 0.85;
      const by = baseBowlPx - b.v * (liquidRatio * usableH);
      if (by > liquidTopY) {
        ctx.beginPath();
        ctx.arc(bx, by, b.r * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 0.6 * scale;
        ctx.stroke();
      }
    });
  }

  if (state.foamMl > 2) {
    const foamGrad = ctx.createLinearGradient(0, foamTopY - 14 * scale, 0, liquidTopY + 10 * scale);
    foamGrad.addColorStop(0, '#ffffff');
    foamGrad.addColorStop(0.35, beer.foamTone);
    foamGrad.addColorStop(0.78, '#efe4d0');
    foamGrad.addColorStop(1, '#c8b89a');
    ctx.fillStyle = foamGrad;
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 1.3, liquidTopY - surfaceSlope + 4 * scale);
    for (let i = 0; i < state.waveCount; i += 1) {
      const t = i / (state.waveCount - 1);
      const wx = (-1.2 + t * 2.4) * glassHalfW;
      const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
      const dome = Math.sin(t * Math.PI) * 9 * scale;
      const wy = foamTopY + tiltOffset - dome + state.waveHeights[i] * 0.55 * scale;
      ctx.lineTo(wx, wy);
    }
    for (let i = state.waveCount - 1; i >= 0; i -= 1) {
      const t = i / (state.waveCount - 1);
      const wx = (-1.2 + t * 2.4) * glassHalfW;
      const tiltOffset = (t - 0.5) * 2 * surfaceSlope;
      const wy = liquidTopY + tiltOffset + state.waveHeights[i] * scale + 3.5 * scale;
      ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    ctx.fill();

    const foamHeightPx = Math.max(4, liquidTopY - foamTopY);
    const cellStride = lodFoamCellStride(lod);
    state.foamCells.forEach((cell, idx) => {
      if (idx % cellStride !== 0) return;
      const cx = cell.u * glassHalfW * 0.85;
      const cy = foamTopY + cell.u * 0.5 * surfaceSlope + cell.v * foamHeightPx;
      const cr = cell.r * scale * 0.72;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.beginPath();
      ctx.arc(cx - cr * 0.2, cy - cr * 0.25, cr * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(170, 150, 120, 0.22)';
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 0.8 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.8 * scale;
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 0.9, foamTopY - surfaceSlope * 0.5);
    for (let t = 0; t <= 1; t += 0.06) {
      const wx = (-0.9 + t * 1.8) * glassHalfW;
      ctx.lineTo(wx, foamTopY + (t - 0.5) * surfaceSlope - Math.sin(t * Math.PI) * 4 * scale);
    }
    ctx.stroke();
  }

  if (lodShowCondensation(lod) && state.liquidMl + state.foamMl > 40) {
    const dewAlpha = Math.min(0.42, ((state.liquidMl + state.foamMl) / state.maxGlassMl) * 0.42);
    state.condensationDrops.forEach((drop) => {
      if (drop.slipSpeed > 0) {
        drop.v -= drop.slipSpeed;
        if (drop.v < 0.08) drop.v = 0.88;
      }
      const dx = drop.u * glassHalfW * 0.88;
      const dy = baseBowlPx - drop.v * usableH;
      if (dy > foamTopY) {
        const trail = ctx.createLinearGradient(dx, dy - drop.r * scale * 3, dx, dy);
        trail.addColorStop(0, 'rgba(255, 252, 245, 0)');
        trail.addColorStop(0.6, `rgba(255, 252, 245, ${dewAlpha * 0.35})`);
        trail.addColorStop(1, `rgba(255, 252, 245, ${dewAlpha})`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = drop.r * scale * 0.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(dx, dy - drop.r * scale * 2.5);
        ctx.lineTo(dx, dy);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 252, 245, ${dewAlpha + 0.08})`;
        ctx.beginPath();
        ctx.ellipse(dx, dy, drop.r * scale * 0.85, drop.r * scale * 1.1, 0, 0, Math.PI * 2);
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

  const thickness = 7 * scale;
  const rimY = -glassH * 0.985;
  const rimOuterW = getGlassProfile(0.985, state.glassType, glassHalfW);
  const rimInnerW = Math.max(6, rimOuterW - thickness * 0.88);
  const rimEllipseH = 9 * scale;
  const baseY = 0;
  const baseOuterW = getGlassProfile(0.02, state.glassType, glassHalfW);
  const fillLevel = (state.liquidMl + state.foamMl) / state.maxGlassMl;

  ctx.save();
  const footGrad = ctx.createRadialGradient(0, baseY, 2, 0, baseY, baseOuterW * 1.2);
  footGrad.addColorStop(0, 'rgba(255,255,255,0.28)');
  footGrad.addColorStop(0.45, 'rgba(200,200,200,0.12)');
  footGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = footGrad;
  ctx.beginPath();
  ctx.ellipse(0, baseY + 2 * scale, baseOuterW * 1.1, 9 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (state.glassType === 'mug') {
    ctx.save();
    ctx.strokeStyle = 'rgba(40, 40, 45, 0.35)';
    ctx.lineWidth = 16 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 0.9, -glassH * 0.74);
    ctx.bezierCurveTo(-glassHalfW * 1.62, -glassH * 0.78, -glassHalfW * 1.62, -glassH * 0.26, -glassHalfW * 0.88, -glassH * 0.28);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220, 225, 235, 0.28)';
    ctx.lineWidth = 13 * scale;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 4 * scale;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 0.92, -glassH * 0.72);
    ctx.bezierCurveTo(-glassHalfW * 1.52, -glassH * 0.74, -glassHalfW * 1.52, -glassH * 0.3, -glassHalfW * 0.9, -glassH * 0.32);
    ctx.stroke();
    ctx.restore();
  }

  buildGlassPath(ctx, glassH, glassHalfW, state.glassType);
  const shellGrad = ctx.createLinearGradient(-glassHalfW, 0, glassHalfW, 0);
  shellGrad.addColorStop(0, 'rgba(200, 225, 255, 0.22)');
  shellGrad.addColorStop(0.15, 'rgba(255, 255, 255, 0.08)');
  shellGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
  shellGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.1)');
  shellGrad.addColorStop(1, 'rgba(170, 195, 235, 0.24)');
  ctx.fillStyle = shellGrad;
  ctx.fill();

  ctx.save();
  buildGlassPath(ctx, glassH, glassHalfW, state.glassType, thickness);
  ctx.clip();
  drawGlassContents(ctx, state, glassH, glassHalfW, glassTiltRad, scale, beer, lod);
  const innerTint = ctx.createLinearGradient(-glassHalfW, 0, glassHalfW, 0);
  innerTint.addColorStop(0, 'rgba(255,255,255,0.12)');
  innerTint.addColorStop(0.5, 'rgba(255,255,255,0)');
  innerTint.addColorStop(1, 'rgba(100,150,210,0.14)');
  ctx.fillStyle = innerTint;
  ctx.fillRect(-glassHalfW * 1.2, -glassH, glassHalfW * 2.4, glassH + 20);
  ctx.restore();

  if (fillLevel > 0.08) {
    const wetSheen = ctx.createLinearGradient(-glassHalfW, -glassH * 0.2, glassHalfW, -glassH * 0.75);
    wetSheen.addColorStop(0, 'rgba(255,255,255,0.06)');
    wetSheen.addColorStop(0.5, `rgba(255,255,255,${0.14 + fillLevel * 0.12})`);
    wetSheen.addColorStop(1, 'rgba(200,230,255,0.08)');
    ctx.fillStyle = wetSheen;
    buildGlassPath(ctx, glassH, glassHalfW, state.glassType, thickness * 0.3);
    ctx.fill();
  }

  buildGlassPath(ctx, glassH, glassHalfW, state.glassType);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 2.2 * scale;
  ctx.stroke();
  buildGlassPath(ctx, glassH, glassHalfW, state.glassType, thickness);
  ctx.strokeStyle = 'rgba(160, 190, 220, 0.28)';
  ctx.lineWidth = 1.4 * scale;
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, rimY, rimOuterW, rimEllipseH, 0, 0, Math.PI * 2);
  ctx.fill();
  const rimHole = ctx.createRadialGradient(0, rimY + 1 * scale, 2, 0, rimY, rimInnerW);
  rimHole.addColorStop(0, 'rgba(8, 10, 14, 0.55)');
  rimHole.addColorStop(0.7, 'rgba(20, 24, 30, 0.4)');
  rimHole.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
  ctx.fillStyle = rimHole;
  ctx.beginPath();
  ctx.ellipse(0, rimY + 1 * scale, rimInnerW, rimEllipseH * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.ellipse(0, rimY, rimOuterW, rimEllipseH, 0, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.ellipse(0, rimY + 1.5 * scale, rimInnerW, rimEllipseH * 0.72, 0, 0.12, Math.PI - 0.12);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.ellipse(0, rimY - 0.5 * scale, rimOuterW * 0.98, rimEllipseH * 0.92, 0, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();

  if (lod !== 'low') {
    const reflGrad = ctx.createLinearGradient(0, -glassH * 0.95, 0, -glassH * 0.12);
    reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    reflGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.28)');
    reflGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = reflGrad;
    ctx.lineWidth = 7.5 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-glassHalfW * 0.72, -glassH * 0.92);
    ctx.quadraticCurveTo(-glassHalfW * 0.78, -glassH * 0.52, -glassHalfW * 0.64, -glassH * 0.18);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(glassHalfW * 0.6, -glassH * 0.85);
    ctx.lineTo(glassHalfW * 0.56, -glassH * 0.25);
    ctx.stroke();
    const caustic = ctx.createRadialGradient(glassHalfW * 0.2, -glassH * 0.45, 4, 0, -glassH * 0.5, glassHalfW);
    caustic.addColorStop(0, 'rgba(255, 240, 200, 0.12)');
    caustic.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.fillStyle = caustic;
    ctx.fillRect(-glassHalfW, -glassH, glassHalfW * 2, glassH);
  }

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#f5f0e6';
  ctx.font = `500 ${Math.round(11 * scale)}px Fraunces, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Švabín', 0, -glassH * 0.58);
  ctx.restore();
  ctx.restore();
}
