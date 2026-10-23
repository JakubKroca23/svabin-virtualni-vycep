import { rgbaFromHex } from '../color.js';

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
  const baseWidth = Math.max(3, Math.min(16, state.flowRate * 4.2)) * scale;
  const time = (globalThis.performance?.now?.() || Date.now()) * 0.001;
  const simple = streamDetail === 'simple';
  const medium = streamDetail === 'medium';

  const pointOnStream = (t, wobbleAmp) => {
    const wobble = Math.sin(time * 18 + t * 9) * wobbleAmp + Math.sin(time * 31 + t * 14) * wobbleAmp * 0.35;
    const x = sx + (targetX - sx) * t + wobble;
    const y = sy + (targetY - sy) * (t * t * 0.32 + t * 0.68);
    return { x, y };
  };

  ctx.save();

  if (!simple) {
    const glowGrad = ctx.createLinearGradient(sx, sy, targetX, targetY);
    glowGrad.addColorStop(0, rgbaFromHex(beer.liquidMid, 0.15));
    glowGrad.addColorStop(0.5, rgbaFromHex(beer.liquidTop, 0.22));
    glowGrad.addColorStop(1, rgbaFromHex(beer.foamTone, 0.12));
    ctx.strokeStyle = glowGrad;
    ctx.lineWidth = baseWidth * 2.1;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let i = 1; i <= 14; i += 1) {
      const p = pointOnStream(i / 14, 1.4 * scale);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.lineWidth = baseWidth * 1.45;
    ctx.beginPath();
    ctx.moveTo(sx + 2.5, sy + 4);
    for (let i = 1; i <= 16; i += 1) {
      const p = pointOnStream(i / 16, 1.2 * scale);
      ctx.lineTo(p.x + 2.5, p.y + 4);
    }
    ctx.stroke();
  }

  const filaments = simple
    ? [{ offset: 0, width: 1.15, alpha: 0.92 }]
    : [
        { offset: 0, width: 1.12, alpha: 0.98 },
        { offset: -0.58, width: 0.52, alpha: medium ? 0.5 : 0.62 },
        { offset: 0.52, width: 0.48, alpha: medium ? 0.45 : 0.55 },
        { offset: -0.22, width: 0.28, alpha: 0.35 },
      ];
  filaments.forEach((f) => {
    const grad = ctx.createLinearGradient(sx, sy, targetX, targetY);
    grad.addColorStop(0, beer.liquidBottom);
    grad.addColorStop(0.28, beer.liquidMid);
    grad.addColorStop(0.62, beer.liquidTop);
    grad.addColorStop(0.88, beer.liquidTop);
    grad.addColorStop(1, beer.foamTone);
    ctx.strokeStyle = grad;
    ctx.globalAlpha = f.alpha;
    ctx.lineWidth = baseWidth * f.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const start = pointOnStream(0, 0);
    ctx.moveTo(start.x + f.offset * baseWidth, start.y);
    const steps = simple ? 12 : 24;
    for (let i = 1; i <= steps; i += 1) {
      const p = pointOnStream(i / steps, (2.6 + state.flowRate * 0.65) * scale);
      ctx.lineTo(p.x + f.offset * baseWidth, p.y);
    }
    ctx.stroke();
  });

  if (!simple) {
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = 'rgba(255, 252, 240, 0.85)';
    ctx.lineWidth = Math.max(1.2, baseWidth * 0.22);
    ctx.beginPath();
    ctx.moveTo(sx - baseWidth * 0.18, sy);
    for (let i = 1; i <= 20; i += 1) {
      const p = pointOnStream(i / 20, 1.6 * scale);
      ctx.lineTo(p.x - baseWidth * 0.2, p.y);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = rgbaFromHex(beer.liquidBottom, 0.5);
    ctx.lineWidth = baseWidth * 0.35;
    ctx.beginPath();
    ctx.moveTo(sx + baseWidth * 0.2, sy);
    for (let i = 1; i <= 18; i += 1) {
      const p = pointOnStream(i / 18, 1.8 * scale);
      ctx.lineTo(p.x + baseWidth * 0.22, p.y);
    }
    ctx.stroke();
  }

  if (!simple) {
    ctx.globalAlpha = 1;
    const dropletCount = medium ? 10 : Math.min(28, Math.floor(state.flowRate * 8));
    for (let i = 0; i < dropletCount; i += 1) {
      const t = 0.04 + Math.random() * 0.42;
      const p = pointOnStream(t, 4 * scale);
      const r = (0.8 + Math.random() * 2.4) * scale;
      ctx.fillStyle = Math.random() > 0.4 ? beer.liquidTop : beer.foamTone;
      ctx.globalAlpha = 0.4 + Math.random() * 0.5;
      ctx.beginPath();
      ctx.arc(p.x + (Math.random() - 0.5) * 10 * scale, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const splashAlpha = Math.min(0.9, 0.25 + state.flowRate * 0.28);
    ctx.globalAlpha = splashAlpha;
    const crownCount = medium ? 5 : 11;
    for (let i = 0; i < crownCount; i += 1) {
      const a = -Math.PI / 2 + (i - crownCount / 2) * 0.2;
      const len = (8 + state.flowRate * 3.5 + Math.sin(time * 42 + i * 1.3) * 3) * scale;
      ctx.strokeStyle = i % 2 === 0 ? beer.foamTone : beer.liquidTop;
      ctx.lineWidth = (1.6 + (i % 3) * 0.4) * scale;
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX + Math.cos(a) * len, targetY + Math.sin(a) * len * 0.62);
      ctx.stroke();
    }

    if (!medium) {
      for (let m = 0; m < 14; m += 1) {
        const a = Math.random() * Math.PI * 2;
        const dist = (4 + Math.random() * 14) * scale;
        ctx.fillStyle = `rgba(255, 248, 235, ${0.15 + Math.random() * 0.35})`;
        ctx.beginPath();
        ctx.arc(targetX + Math.cos(a) * dist, targetY + Math.sin(a) * dist * 0.5, (1.2 + Math.random() * 2.5) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
