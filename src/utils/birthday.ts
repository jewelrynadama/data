// src/utils/birthday.ts
import type { Customer } from '../types';

export interface BirthdayAlert {
  customer: Customer;
  daysUntil: number; // 0 = today, negative = already passed this year (treat as same day?)
  label: string;
}

export function parseBirthdayMonth(raw: string): number | null {
  if (!raw) return null;
  
  const lower = raw.toLowerCase();
  if (lower.includes('jan')) return 1;
  if (lower.includes('feb')) return 2;
  if (lower.includes('mar')) return 3;
  if (lower.includes('apr')) return 4;
  if (lower.includes('mei')) return 5;
  if (lower.includes('jun')) return 6;
  if (lower.includes('jul')) return 7;
  if (lower.includes('agu') || lower.includes('aug')) return 8;
  if (lower.includes('sep')) return 9;
  if (lower.includes('okt') || lower.includes('oct')) return 10;
  if (lower.includes('nov')) return 11;
  if (lower.includes('des') || lower.includes('dec')) return 12;

  const parts = raw.split(/[\/\-\.\s]/);
  if (parts.length >= 2) {
    const month = parseInt(parts[1], 10);
    if (!isNaN(month) && month >= 1 && month <= 12) return month;
  }
  return null;
}

export function parseBirthdayDay(raw: string): number | null {
  if (!raw) return null;
  const parts = raw.split(/[/\-\\.\s]/);
  if (parts.length >= 3 && parseInt(parts[0], 10) > 1000) {
    const day = parseInt(parts[2], 10);
    if (day >= 1 && day <= 31) return day;
  }
  const match = raw.match(/\d+/);
  if (match) {
    const day = parseInt(match[0], 10);
    if (day >= 1 && day <= 31) return day;
  }
  return null;
}

function parseBirthday(raw: string): { day: number; month: number } | null {
  const day = parseBirthdayDay(raw);
  const month = parseBirthdayMonth(raw);
  if (day !== null && month !== null) {
    return { day, month };
  }
  return null;
}

export function getBirthdayAlerts(customers: Customer[]): BirthdayAlert[] {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based (1-12)
  const todayDay = now.getDate();

  const alerts: BirthdayAlert[] = [];

  for (const c of customers) {
    const bd = parseBirthday(c.tanggalUlangTahun);
    if (!bd) continue;

    if (bd.month === currentMonth) {
      const daysUntil = bd.day - todayDay;
      let label = '';
      if (daysUntil === 0) {
        label = '🎂 Hari ini!';
      } else if (daysUntil === 1) {
        label = '🎉 Besok';
      } else if (daysUntil > 1) {
        label = `${daysUntil} hari lagi`;
      } else {
        label = `Lewat ${Math.abs(daysUntil)} hari`;
      }

      alerts.push({ customer: c, daysUntil, label });
    }
  }

  return alerts.sort((a, b) => {
    // Today (0) first
    if (a.daysUntil === 0 && b.daysUntil !== 0) return -1;
    if (b.daysUntil === 0 && a.daysUntil !== 0) return 1;

    // Both upcoming (positive): sort ascending (closest first)
    if (a.daysUntil > 0 && b.daysUntil > 0) return a.daysUntil - b.daysUntil;

    // Both past (negative): sort descending (closest to today first, e.g. -1 before -5)
    if (a.daysUntil < 0 && b.daysUntil < 0) return b.daysUntil - a.daysUntil;

    // One upcoming, one past: upcoming comes first
    if (a.daysUntil > 0 && b.daysUntil < 0) return -1;
    if (a.daysUntil < 0 && b.daysUntil > 0) return 1;

    return 0;
  });
}

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function formatBirthday(raw: string | undefined): string {
  if (!raw) return '';
  const day = parseBirthdayDay(raw);
  const month = parseBirthdayMonth(raw);
  if (day !== null && month !== null) {
    return `${day} ${INDO_MONTHS[month - 1]}`;
  }
  return raw;
}
