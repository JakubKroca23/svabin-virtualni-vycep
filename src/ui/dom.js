const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const DATA_IMAGE_PLACEHOLDER_RE = /^data:image\/(?:gif|png|webp|jpeg);base64,[a-z0-9+/=]+$/i;
const SAFE_COLOR_RE =
  /^(?:#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i;

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

export function safeCatalogImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (DATA_IMAGE_PLACEHOLDER_RE.test(text)) return text;

  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && (host === 'svabin.com' || host.endsWith('.svabin.com'))) {
      return url.href;
    }
  } catch {}

  return '';
}

export function safeSvabinUrl(value) {
  const text = String(value || '').trim();
  if (!text) return 'https://svabin.com/';

  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && (host === 'svabin.com' || host.endsWith('.svabin.com'))) {
      return url.href;
    }
  } catch {}

  return 'https://svabin.com/';
}

export function safeCssColor(value, fallback) {
  const text = String(value || '').trim();
  return SAFE_COLOR_RE.test(text) ? text : fallback;
}
