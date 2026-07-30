// src/utils/churnEngine.ts
// Churn Risk + CLV engine — 100% local, no API needed
import type { Customer } from '../types';

export type ChurnRisk = 'Low' | 'Medium' | 'High' | 'Critical';

export interface ChurnResult {
  risk: ChurnRisk;
  score: number;          // 0–100 (higher = more likely to churn)
  recencyDays: number;
  avgDaysBetweenOrders: number;
  isOverdue: boolean;     // last order > avg gap * 1.5
  reasons: string[];
  clvHistorical: number;  // total spend so far
  clvPredicted12m: number; // predicted spend next 12 months
  avgOrderValue: number;
  ordersPerYear: number;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const parts = s.split(/[\/\-\.]/);
  if (parts.length >= 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
  }
  return null;
}

export function calcChurn(customer: Customer): ChurnResult {
  const now = new Date();
  const orders = (customer.orders || []).filter((o) => o.jenis);

  // --- Recency ---
  let recencyDays = 9999;
  let latestDate = new Date(0);
  const orderDates: Date[] = [];

  for (const o of orders) {
    const d = parseDate(o.tanggalOrder);
    if (d) {
      orderDates.push(d);
      if (d > latestDate) latestDate = d;
    }
  }

  if (latestDate.getTime() > 0) {
    recencyDays = Math.floor((now.getTime() - latestDate.getTime()) / 86400000);
  }

  // --- Average days between orders ---
  let avgDaysBetween = 0;
  if (orderDates.length >= 2) {
    const sorted = [...orderDates].sort((a, b) => a.getTime() - b.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000);
    }
    avgDaysBetween = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  }

  const isOverdue = avgDaysBetween > 0 && recencyDays > avgDaysBetween * 1.5;

  // --- CLV ---
  const clvHistorical = customer.totalSpend || 0;
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? clvHistorical / totalOrders : 0;

  // Estimate customer lifespan from first order to now
  let firstDate = now;
  if (orderDates.length > 0) {
    firstDate = orderDates.reduce((min, d) => (d < min ? d : min), orderDates[0]);
  }
  const lifespanDays = Math.max(30, (now.getTime() - firstDate.getTime()) / 86400000);
  const ordersPerYear = (totalOrders / lifespanDays) * 365;

  // Predicted CLV: if churn risk high, discount future value
  const baseClv = avgOrderValue * ordersPerYear;
  let retentionMultiplier = 1.0;
  if (recencyDays > 365) retentionMultiplier = 0.1;
  else if (recencyDays > 180) retentionMultiplier = 0.3;
  else if (recencyDays > 90) retentionMultiplier = 0.6;
  else if (recencyDays > 60) retentionMultiplier = 0.8;
  const clvPredicted12m = baseClv * retentionMultiplier;

  // --- Scoring (0–100, higher = more risk) ---
  const reasons: string[] = [];
  let score = 0;

  // Recency scoring (0–40 pts)
  if (recencyDays > 365) { score += 40; reasons.push('Tidak order >1 tahun'); }
  else if (recencyDays > 180) { score += 32; reasons.push('Tidak order >6 bulan'); }
  else if (recencyDays > 90) { score += 22; reasons.push('Tidak order >3 bulan'); }
  else if (recencyDays > 60) { score += 12; reasons.push('Tidak order >2 bulan'); }
  else if (recencyDays > 30) { score += 5; }

  // Frequency scoring (0–20 pts)
  if (totalOrders === 0) { score += 20; reasons.push('Belum pernah order'); }
  else if (totalOrders === 1) { score += 12; reasons.push('Baru 1x order'); }
  else if (totalOrders === 2) { score += 6; }

  // Overdue scoring (0–20 pts)
  if (isOverdue && avgDaysBetween > 0) {
    const overdueRatio = recencyDays / avgDaysBetween;
    if (overdueRatio > 3) { score += 20; reasons.push('Telat 3x dari jadwal order'); }
    else if (overdueRatio > 2) { score += 14; reasons.push('Telat 2x dari jadwal order'); }
    else { score += 7; reasons.push('Agak terlambat order'); }
  }

  // Low spend scoring (0–10 pts)
  if (clvHistorical < 500000 && totalOrders > 0) { score += 5; reasons.push('Nilai belanja rendah'); }

  // Single channel (0–10 pts)
  const uniqueJenis = new Set(orders.map((o) => o.jenis)).size;
  if (uniqueJenis <= 1 && totalOrders >= 3) { score += 5; reasons.push('Hanya beli 1 jenis produk'); }

  score = Math.min(100, score);

  let risk: ChurnRisk = 'Low';
  if (score >= 70) risk = 'Critical';
  else if (score >= 45) risk = 'High';
  else if (score >= 20) risk = 'Medium';

  return {
    risk,
    score,
    recencyDays,
    avgDaysBetweenOrders: Math.round(avgDaysBetween),
    isOverdue,
    reasons,
    clvHistorical,
    clvPredicted12m: Math.round(clvPredicted12m),
    avgOrderValue: Math.round(avgOrderValue),
    ordersPerYear: Math.round(ordersPerYear * 10) / 10,
  };
}

export function getChurnSummary(customers: Customer[]) {
  const results = customers.map((c) => ({ customer: c, churn: calcChurn(c) }));
  const counts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  let totalClvPredicted = 0;
  for (const r of results) {
    counts[r.churn.risk]++;
    totalClvPredicted += r.churn.clvPredicted12m;
  }
  const atRisk = results
    .filter((r) => r.churn.risk === 'High' || r.churn.risk === 'Critical')
    .sort((a, b) => b.churn.score - a.churn.score);
  return { counts, atRisk, totalClvPredicted };
}

export const CHURN_COLOR: Record<ChurnRisk, string> = {
  Low:      '#42B72A',
  Medium:   '#F7B928',
  High:     '#F87171',
  Critical: '#E41E3F',
};

export const CHURN_BG: Record<ChurnRisk, string> = {
  Low:      'rgba(66,183,42,0.12)',
  Medium:   'rgba(247,185,40,0.12)',
  High:     'rgba(248,113,113,0.12)',
  Critical: 'rgba(228,30,63,0.15)',
};
