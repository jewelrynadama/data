// src/utils/__tests__/csvLoader.test.ts
import { describe, it, expect } from 'vitest';
import {
  cleanPrice,
  formatWhatsApp,
  extractCity,
  getCustomerLabel,
  parseDateToSortValue,
} from '../csvLoader';

// ─── cleanPrice ───────────────────────────────────────────────────────────────
describe('cleanPrice', () => {
  it('parses Rupiah string with dots', () => {
    expect(cleanPrice('1.500.000')).toBe(1500000);
    expect(cleanPrice('Rp 1.500.000')).toBe(1500000);
    expect(cleanPrice('Rp1.500.000')).toBe(1500000);
  });

  it('parses plain numbers', () => {
    expect(cleanPrice('500000')).toBe(500000);
    expect(cleanPrice('0')).toBe(0);
  });

  it('handles empty / null / undefined', () => {
    expect(cleanPrice('')).toBe(0);
    expect(cleanPrice(null)).toBe(0);
    expect(cleanPrice(undefined)).toBe(0);
  });

  it('handles comma decimal separator', () => {
    // "1.500,00" → treat ,00 as cents, strip → 1500
    expect(cleanPrice('1.500,00')).toBe(1500);
  });
});

// ─── formatWhatsApp ───────────────────────────────────────────────────────────
describe('formatWhatsApp', () => {
  it('converts leading 0 to 62', () => {
    expect(formatWhatsApp('08123456789')).toBe('628123456789');
  });

  it('keeps already 62-prefixed numbers', () => {
    expect(formatWhatsApp('628123456789')).toBe('628123456789');
  });

  it('strips non-digit characters', () => {
    expect(formatWhatsApp('+62 812-345-6789')).toBe('628123456789');
  });

  it('returns empty string for empty input', () => {
    expect(formatWhatsApp('')).toBe('');
  });
});

// ─── extractCity ─────────────────────────────────────────────────────────────
describe('extractCity', () => {
  it('extracts known city from address string', () => {
    expect(extractCity('Jl. Merdeka No.1, Jakarta Selatan')).toBe('Jakarta');
    expect(extractCity('Kp. Ciawi, Bogor, Jawa Barat')).toBe('Bogor');
  });

  it('returns em-dash for empty address', () => {
    expect(extractCity('')).toBe('—');
  });
});

// ─── getCustomerLabel ─────────────────────────────────────────────────────────
describe('getCustomerLabel', () => {
  it('returns vip when spend >= threshold', () => {
    expect(getCustomerLabel(15000000, 5, 15000000, 3)).toBe('vip');
    expect(getCustomerLabel(20000000, 1, 15000000, 3)).toBe('vip');
  });

  it('returns loyal when orderCount >= threshold and not vip', () => {
    expect(getCustomerLabel(1000000, 3, 15000000, 3)).toBe('loyal');
    expect(getCustomerLabel(0, 10, 15000000, 3)).toBe('loyal');
  });

  it('returns new for first-time customers', () => {
    expect(getCustomerLabel(500000, 1, 15000000, 3)).toBe('new');
  });

  it('returns null for 2 orders below VIP threshold', () => {
    expect(getCustomerLabel(1000000, 2, 15000000, 3)).toBeNull();
  });
});

// ─── parseDateToSortValue ─────────────────────────────────────────────────────
describe('parseDateToSortValue', () => {
  it('parses YYYY-MM-DD format', () => {
    expect(parseDateToSortValue('2024-06-15')).toBe(20240615);
  });

  it('parses DD/MM/YYYY format', () => {
    expect(parseDateToSortValue('15/06/2024')).toBe(20240615);
  });

  it('returns 0 for empty or invalid input', () => {
    expect(parseDateToSortValue('')).toBe(0);
    expect(parseDateToSortValue('—')).toBe(0);
    expect(parseDateToSortValue('-')).toBe(0);
  });
});
