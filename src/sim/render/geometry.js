export function getGlassProfile(normY, glassType, halfW) {
  if (glassType === 'teku') {
    if (normY < 0.05) return halfW * (0.66 - normY * 6);
    if (normY < 0.3) return halfW * 0.14;
    if (normY < 0.56) {
      const t = (normY - 0.3) / 0.26;
      return halfW * (0.14 + Math.sin(t * Math.PI * 0.5) * 0.92);
    }
    const t = (normY - 0.56) / 0.44;
    return halfW * (1.06 - t * 0.26);
  }
  if (glassType === 'pint') {
    const swell = Math.sin(Math.max(0, (normY - 0.6) / 0.4) * Math.PI) * 0.07;
    return halfW * (0.72 + normY * 0.27 + swell);
  }
  const barrelCurve = Math.sin(normY * Math.PI) * 0.14;
  return halfW * (0.86 + barrelCurve);
}

export function buildGlassPath(ctx, glassH, glassHalfW, glassType, inset = 0) {
  const steps = 40;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const normY = i / steps;
    const w = Math.max(4, getGlassProfile(normY, glassType, glassHalfW) - inset);
    const y = -normY * glassH;
    if (i === 0) ctx.moveTo(-w, y);
    else ctx.lineTo(-w, y);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const normY = i / steps;
    const w = Math.max(4, getGlassProfile(normY, glassType, glassHalfW) - inset);
    const y = -normY * glassH;
    ctx.lineTo(w, y);
  }
  ctx.closePath();
}
