import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validateCheckoutForm,
  saveOrder,
  DEMO_DISCLAIMER,
} from '../src/checkout/checkout.js';

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    _store: store,
  };
}

function validFields(overrides = {}) {
  return {
    name: 'Jan Novák',
    email: 'jan@example.com',
    phone: '+420 123 456 789',
    street: 'Hlavní 1',
    city: 'Plzeň',
    zip: '30100',
    note: '',
    ageConfirmed: true,
    ...overrides,
  };
}

describe('validateCheckoutForm', () => {
  it('accepts valid fields', () => {
    const result = validateCheckoutForm(validFields());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects invalid email', () => {
    const result = validateCheckoutForm(validFields({ email: 'not-an-email' }));
    expect(result.ok).toBe(false);
    expect(result.errors.email).toBeTruthy();
  });

  it('requires ageConfirmed', () => {
    const result = validateCheckoutForm(validFields({ ageConfirmed: false }));
    expect(result.ok).toBe(false);
    expect(result.errors.ageConfirmed).toBeTruthy();
  });

  it('requires non-empty phone', () => {
    const result = validateCheckoutForm(validFields({ phone: '   ' }));
    expect(result.ok).toBe(false);
    expect(result.errors.phone).toBeTruthy();
  });

  it('requires zip length 3–10 characters', () => {
    expect(validateCheckoutForm(validFields({ zip: '12' })).errors.zip).toBeTruthy();
    expect(
      validateCheckoutForm(validFields({ zip: '12345678901' })).errors.zip,
    ).toBeTruthy();
    expect(validateCheckoutForm(validFields({ zip: '301' })).ok).toBe(true);
    expect(validateCheckoutForm(validFields({ zip: '1234567890' })).ok).toBe(true);
  });
});

describe('saveOrder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends order to svabin.orders.v1 and returns SV- id', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const storage = createMockStorage();
    const payload = { name: 'Jan', total: 500, items: [] };

    const id = saveOrder(payload, storage);

    expect(id).toBe('SV-1700000000000');
    const orders = JSON.parse(storage.getItem('svabin.orders.v1'));
    expect(orders).toHaveLength(1);
    expect(orders[0]).toEqual({ ...payload, id: 'SV-1700000000000' });
  });

  it('appends to existing orders', () => {
    const storage = createMockStorage();
    storage.setItem(
      'svabin.orders.v1',
      JSON.stringify([{ id: 'SV-1', name: 'Existing' }]),
    );
    vi.spyOn(Date, 'now').mockReturnValue(2);

    saveOrder({ name: 'New' }, storage);

    const orders = JSON.parse(storage.getItem('svabin.orders.v1'));
    expect(orders).toHaveLength(2);
    expect(orders[1].id).toBe('SV-2');
  });
});

describe('DEMO_DISCLAIMER', () => {
  it('exports demo checkout disclaimer text', () => {
    expect(DEMO_DISCLAIMER).toContain('demo objednávka');
    expect(DEMO_DISCLAIMER).toContain('pivovaru');
  });
});
