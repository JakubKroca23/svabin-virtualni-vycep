export function computeSceneLayout(width, height, state) {
  const W = width;
  const H = height;
  const tableY = H * 0.84;
  const scale = Math.min(1.05, Math.max(0.68, Math.min(W / 560, H / 560)));
  const glassCenterX = W * 0.32;
  const glassBottomY = tableY - 8 * scale;
  const glassH = 220 * scale;
  const glassHalfW = 58 * scale;
  const glassTiltRad = (state.glassTiltAngle * Math.PI) / 180;
  const canW = (state.vesselType === 'can' ? 72 : 64) * scale;
  const canH = (state.vesselType === 'can' ? 138 : 185) * scale;
  const vesselPivotX = glassCenterX + 195 * scale;
  const vesselPivotY = glassBottomY - glassH - 95 * scale;
  const vesselTiltRad = (-state.vesselAngle * Math.PI) / 180;
  const localSpoutX = -canW * 0.28;
  const localSpoutY = -canH * 0.5;
  const spoutWorldX =
    vesselPivotX + (localSpoutX * Math.cos(vesselTiltRad) - localSpoutY * Math.sin(vesselTiltRad));
  const spoutWorldY =
    vesselPivotY + (localSpoutX * Math.sin(vesselTiltRad) + localSpoutY * Math.cos(vesselTiltRad));

  return {
    W,
    H,
    tableY,
    scale,
    glassCenterX,
    glassBottomY,
    glassH,
    glassHalfW,
    glassTiltRad,
    canW,
    canH,
    vesselPivotX,
    vesselPivotY,
    vesselTiltRad,
    spoutWorldX,
    spoutWorldY,
  };
}
