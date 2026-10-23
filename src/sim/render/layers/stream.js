export function drawStreamLayer(ctx, layout, state, beer, streamDetail) {
  if (state.flowRate <= 0.05) return;
  const {
    spoutWorldX: sx,
    spoutWorldY: sy,
    glassCenterX: gx,
    glassBottomY: gy,
    glassH,
    glassTiltRad,
    scale,
  } = layout;

  const totalFill = Math.min(1, (state.liquidMl + state.foamMl * 0.7) / state.maxGlassMl);
  const minLevel = state.glassType === 'teku' ? 0.3 : 0.05;
  const currentNormY = minLevel + totalFill * (0.94 - minLevel);
  const localTargetY = -currentNormY * glassH;
  const localTargetX = state.isGlassTiltedMode ? 18 * scale : 0;
  const targetX = gx + (localTargetX * Math.cos(glassTiltRad) - localTargetY * Math.sin(glassTiltRad));
  const targetY = gy + (localTargetX * Math.sin(glassTiltRad) + localTargetY * Math.cos(glassTiltRad));
  const baseWidth = Math.max(2.2, Math.min(13, state.flowRate * 3.8)) * scale;
  const time = (globalThis.performance?.now?.() || Date.now()) * 0.001;
  const simple = streamDetail === 'simple';
  const medium = streamDetail === 'medium';

  const pointOnStream = (t, wobbleAmp) => {
    const wobble = Math.sin(time * 18 + t * 9) * wobbleAmp + Math.sin(time * 31 + t * 14) * wobbleAmp * 0.35;
    const x = sx + (targetX - sx) * t + wobble;
    const y = sy + (targetY - sy) * (t * t * 0.35 + t * 0.65);
    return { x, y };
  };

  ctx.save();
  if (!simple) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = baseWidth * 1.35;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + 3);
    for (let i = 1; i <= 16; i += 1) {
      const p = pointOnStream(i / 16, 1.2 * scale);
      ctx.lineTo(p.x + 2, p.y + 3);
    }
    ctx.stroke();
  }

  const filaments = simple
    ? [{ offset: 0, width: 1, alpha: 0.9 }]
    : [
        { offset: 0, width: 1, alpha: 0.95 },
        { offset: -0.55, width: 0.45, alpha: medium ? 0.45 : 0.55 },
        { offset: 0.5, width: 0.4, alpha: medium ? 0.4 : 0.5 },
      ];
  filaments.forEach((f) => {
    const grad = ctx.createLinearGradient(sx, sy, targetX, targetY);
    grad.addColorStop(0, beer.liquidBottom);
    grad.addColorStop(0.4, beer.liquidMid);
    grad.addColorStop(0.8, beer.liquidTop);
    grad.addColorStop(1, beer.foamTone);
    ctx.strokeStyle = grad;
    ctx.globalAlpha = f.alpha;
    ctx.lineWidth = baseWidth * f.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const start = pointOnStream(0, 0);
    ctx.moveTo(start.x + f.offset * baseWidth, start.y);
    const steps = simple ? 10 : 20;
    for (let i = 1; i <= steps; i += 1) {
      const p = pointOnStream(i / steps, (2.4 + state.flowRate * 0.6) * scale);
      ctx.lineTo(p.x + f.offset * baseWidth, p.y);
    }
    ctx.stroke();
  });

  if (!simple) {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = 'rgba(255, 250, 235, 0.7)';
    ctx.lineWidth = Math.max(1, baseWidth * 0.18);
    ctx.beginPath();
    ctx.moveTo(sx - baseWidth * 0.15, sy);
    for (let i = 1; i <= 18; i += 1) {
      const p = pointOnStream(i / 18, 1.6 * scale);
      ctx.lineTo(p.x - baseWidth * 0.18, p.y);
    }
    ctx.stroke();
  }

  if (!simple && !medium) {
    ctx.globalAlpha = 1;
    const dropletCount = Math.min(18, Math.floor(state.flowRate * 6));
    for (let i = 0; i < dropletCount; i += 1) {
      const t = 0.05 + Math.random() * 0.35;
      const p = pointOnStream(t, 3.5 * scale);
      const r = (0.6 + Math.random() * 1.8) * scale;
      ctx.fillStyle = Math.random() > 0.45 ? beer.liquidTop : beer.foamTone;
      ctx.globalAlpha = 0.35 + Math.random() * 0.45;
      ctx.beginPath();
      ctx.arc(p.x + (Math.random() - 0.5) * 8 * scale, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = Math.min(0.75, state.flowRate * 0.22);
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI / 2 + (i - 3) * 0.22;
      const len = (6 + state.flowRate * 3 + Math.sin(time * 40 + i) * 2) * scale;
      ctx.strokeStyle = beer.foamTone;
      ctx.lineWidth = 1.4 * scale;
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX + Math.cos(a) * len, targetY + Math.sin(a) * len * 0.55);
      ctx.stroke();
    }
  }
  ctx.restore();
}
