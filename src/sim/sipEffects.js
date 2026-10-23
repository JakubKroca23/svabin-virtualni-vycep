/** Playful burp after dopití — not subtle; cooldown prevents spam. */
export const BURP_EMPTY_THRESHOLD_ML = 14;
export const BURP_COOLDOWN_MS = 4000;

export function shouldPlayBurpAfterSip(state, totalMlAfterSip) {
  if (totalMlAfterSip >= BURP_EMPTY_THRESHOLD_ML) return false;
  const now = globalThis.performance?.now?.() || Date.now();
  if (state.lastBurpAt && now - state.lastBurpAt < BURP_COOLDOWN_MS) return false;
  return true;
}

export function markBurpPlayed(state) {
  state.lastBurpAt = globalThis.performance?.now?.() || Date.now();
}
