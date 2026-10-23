const HYSTERESIS = 3;
const WINDOW = 30;

export function recordFrameTiming(state, frameMs) {
  if (!state.fpsSamples) state.fpsSamples = [];
  const fps = frameMs > 0 ? 1000 / frameMs : 60;
  state.fpsSamples.push(fps);
  if (state.fpsSamples.length > WINDOW) state.fpsSamples.shift();
}

function averageFps(state) {
  if (!state.fpsSamples?.length) return 60;
  return state.fpsSamples.reduce((a, b) => a + b, 0) / state.fpsSamples.length;
}

export function updateRenderLod(state) {
  const fps = averageFps(state);
  const current = state.renderLod || 'high';
  let next = current;
  if (current === 'high' && fps < 55 - HYSTERESIS) next = 'medium';
  else if (current === 'medium') {
    if (fps >= 55 + HYSTERESIS) next = 'high';
    else if (fps < 40 - HYSTERESIS) next = 'low';
  } else if (current === 'low' && fps >= 40 + HYSTERESIS) next = 'medium';
  state.renderLod = next;
  return next;
}

export function lodBubbleStride(lod) {
  if (lod === 'low') return 3;
  if (lod === 'medium') return 2;
  return 1;
}

export function lodShowCondensation(lod) {
  return lod !== 'low';
}

export function lodStreamDetail(lod) {
  if (lod === 'low') return 'simple';
  if (lod === 'medium') return 'medium';
  return 'full';
}

export function lodFoamCellStride(lod) {
  if (lod === 'low') return 3;
  if (lod === 'medium') return 2;
  return 1;
}
