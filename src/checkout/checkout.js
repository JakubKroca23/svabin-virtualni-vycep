export const DEMO_DISCLAIMER =
  'Toto je demo objednávka. Neodesílá se do pivovaru a neprobíhá platba.';

const STORAGE_KEY = 'svabin.orders.v1';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCheckoutForm(fields) {
  const errors = {};
  const email = String(fields.email ?? '').trim();
  const phone = String(fields.phone ?? '').trim();
  const zip = String(fields.zip ?? '').trim();

  if (!EMAIL_RE.test(email)) {
    errors.email = 'Neplatný e-mail';
  }
  if (!phone) {
    errors.phone = 'Telefon je povinný';
  }
  if (zip.length < 3 || zip.length > 10) {
    errors.zip = 'PSČ musí mít 3–10 znaků';
  }
  if (!fields.ageConfirmed) {
    errors.ageConfirmed = 'Potvrzení věku je povinné';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export function saveOrder(order, storage = globalThis.localStorage) {
  let orders = [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    orders = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(orders)) orders = [];
  } catch {
    orders = [];
  }

  const id = `SV-${Date.now()}`;
  orders.push({ ...order, id });
  storage.setItem(STORAGE_KEY, JSON.stringify(orders));
  return id;
}
