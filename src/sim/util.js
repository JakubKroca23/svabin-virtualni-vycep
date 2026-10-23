export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function callSafely(fn, ...args) {
  if (typeof fn !== 'function') return;
  try {
    fn(...args);
  } catch {
    // SFX is best-effort; rendering/physics should continue without audio.
  }
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
