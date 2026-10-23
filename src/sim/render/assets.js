function safeImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && (host === 'svabin.com' || host.endsWith('.svabin.com'))) {
      return url.href;
    }
  } catch {
    // ignore invalid URLs
  }
  return '';
}

const labelImageCache = new Map();
let barBgEntry = null;

export function getLabelImage(url) {
  const safe = safeImageUrl(url);
  if (!safe || typeof Image === 'undefined') return null;
  const cached = labelImageCache.get(safe);
  if (cached) return cached.ready ? cached.img : null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const entry = { img, ready: false };
  labelImageCache.set(safe, entry);
  img.onload = () => {
    entry.ready = true;
  };
  img.onerror = () => {
    labelImageCache.delete(safe);
  };
  img.src = safe;
  return null;
}

export function drawCoverImage(ctx, img, x, y, w, h) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return false;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) * 0.5;
  const dy = y + (h - dh) * 0.42;
  ctx.drawImage(img, dx, dy, dw, dh);
  return true;
}

export function drawCoverImageFull(ctx, img, x, y, w, h) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return false;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) * 0.5, y + (h - dh) * 0.5, dw, dh);
  return true;
}

export function getBarBackground() {
  if (typeof Image === 'undefined') return null;
  if (barBgEntry?.ready) return barBgEntry.img;
  if (barBgEntry) return null;
  const img = new Image();
  barBgEntry = { img, ready: false };
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';
  img.onload = () => {
    barBgEntry.ready = true;
  };
  img.onerror = () => {
    barBgEntry = null;
  };
  img.src = `${base}images/bar-bg.jpg`;
  return null;
}

export function preloadBarBackground() {
  getBarBackground();
}
