// src/utils/commandCenterEngine.ts
// ──────────────────────────────────────────────────────────────────────────────
// PearlMind™ Command Center Engine
// 5 proprietary algorithms — 100% browser-side, zero external API
// ──────────────────────────────────────────────────────────────────────────────
import type { Customer, CustomerRow } from '../types';
import { calcChurn } from './churnEngine';

// ════════════════════════════════════════════════════════════════════════════
// 1. CUSTOMER DNA FINGERPRINT™
//    6-dimensional behavioral vector, cosine-similarity based twin-matching
// ════════════════════════════════════════════════════════════════════════════

export interface CustomerDNA {
  customerId: string;
  customerName: string;
  dimensions: {
    recencyScore: number;       // 0-1 how recent (1 = yesterday)
    frequencyScore: number;     // 0-1 order frequency per year
    monetaryScore: number;      // 0-1 avg order value normalized
    diversityScore: number;     // 0-1 product type variety
    seasonalityScore: number;   // 0-1 concentration in specific months (1=spread)
    loyaltyVelocity: number;    // 0-1 acceleration: are they buying more or less?
  };
  vector: number[];             // 6-dim normalized vector for cosine similarity
  dominantTrait: string;        // human-readable dominant behavior
}

function parseOrderDate(s: string): Date | null {
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

export function buildCustomerDNA(customer: Customer, allCustomers: Customer[] = []): CustomerDNA {
  const now = new Date();
  const safeCustomer = customer || { id: '', nama: 'Pelanggan', orders: [], totalSpend: 0 };
  const safeAll = allCustomers || [];
  const orders = (safeCustomer.orders || []).filter(o => o?.jenis);
  const dates = orders.map(o => parseOrderDate(o.tanggalOrder)).filter(Boolean) as Date[];
  dates.sort((a, b) => a.getTime() - b.getTime());

  // Recency (0-1, 1 = bought yesterday)
  const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
  const daysSinceLast = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : 9999;
  const recencyScore = Math.max(0, 1 - daysSinceLast / 365);

  // Frequency (0-1 normalized against max orders/year across all customers)
  const firstDate = dates[0] ?? now;
  const lifespanYears = Math.max(0.083, (now.getTime() - firstDate.getTime()) / (365 * 86400000));
  const ordersPerYear = orders.length / lifespanYears;
  const maxFreq = Math.max(1, ...safeAll.map(c => {
    const od = (c?.orders || []).filter(o => o?.jenis);
    if (od.length === 0) return 0;
    const fd = parseOrderDate(od[0].tanggalOrder);
    if (!fd) return 0;
    const ly = Math.max(0.083, (now.getTime() - fd.getTime()) / (365 * 86400000));
    return od.length / ly;
  }));
  const frequencyScore = Math.min(1, ordersPerYear / maxFreq);

  // Monetary (0-1 normalized avg order value)
  const avgOrder = orders.length > 0 ? (safeCustomer.totalSpend || 0) / orders.length : 0;
  const maxAvgOrder = Math.max(1, ...safeAll.map(c =>
    (c?.orders || []).length > 0 ? (c.totalSpend || 0) / c.orders.length : 0
  ));
  const monetaryScore = Math.min(1, avgOrder / maxAvgOrder);

  // Diversity (0-1 = product type variety, 1 = bought many different types)
  const uniqueTypes = new Set(orders.map(o => `${o.jenis}|${o.type}`)).size;
  const diversityScore = Math.min(1, uniqueTypes / 8);

  // Seasonality (1 = evenly spread across months, 0 = concentrated in 1-2 months)
  const monthCounts = new Array(12).fill(0);
  dates.forEach(d => { if (d) monthCounts[d.getMonth()]++; });
  const totalOrders = orders.length || 1;
  const entropy = monthCounts
    .map(c => c / totalOrders)
    .filter(p => p > 0)
    .reduce((s, p) => s - p * Math.log2(p), 0);
  const maxEntropy = Math.log2(12);
  const seasonalityScore = maxEntropy > 0 ? entropy / maxEntropy : 0;

  // Loyalty velocity (are they accelerating or decelerating?)
  let loyaltyVelocity = 0.5;
  if (dates.length >= 4) {
    const half = Math.floor(dates.length / 2);
    const recentDates = dates.slice(-half);
    const olderDates = dates.slice(0, half);
    const recentInterval = recentDates.length > 1
      ? (recentDates[recentDates.length-1].getTime() - recentDates[0].getTime()) / (recentDates.length - 1)
      : Infinity;
    const olderInterval = olderDates.length > 1
      ? (olderDates[olderDates.length-1].getTime() - olderDates[0].getTime()) / (olderDates.length - 1)
      : Infinity;
    // Shorter interval in recent = accelerating = higher score
    if (olderInterval > 0 && recentInterval > 0 && isFinite(olderInterval) && isFinite(recentInterval)) {
      const ratio = olderInterval / recentInterval;
      loyaltyVelocity = Math.min(1, Math.max(0, ratio / 2));
    }
  }

  const vector = [recencyScore, frequencyScore, monetaryScore, diversityScore, seasonalityScore, loyaltyVelocity];

  // Dominant trait
  const traits: [number, string][] = [
    [recencyScore, 'Active Buyer'],
    [frequencyScore, 'Frequent Shopper'],
    [monetaryScore, 'High-Value Spender'],
    [diversityScore, 'Explorer (beli banyak jenis)'],
    [seasonalityScore, 'Consistent Year-Round'],
    [loyaltyVelocity, 'Accelerating Loyalty'],
  ];
  const [, dominantTrait] = traits.sort((a, b) => b[0] - a[0])[0];

  return {
    customerId: safeCustomer.id || '',
    customerName: safeCustomer.nama || 'Pelanggan',
    dimensions: { recencyScore, frequencyScore, monetaryScore, diversityScore, seasonalityScore, loyaltyVelocity },
    vector,
    dominantTrait,
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export function findDNATwins(
  targetDNA: CustomerDNA,
  allDNAs: CustomerDNA[],
  limit = 3
): Array<CustomerDNA & { similarity: number }> {
  return allDNAs
    .filter(d => d.customerId !== targetDNA.customerId)
    .map(d => ({ ...d, similarity: cosineSimilarity(targetDNA.vector, d.vector) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ════════════════════════════════════════════════════════════════════════════
// 2. REVENUE ENSEMBLE FORECAST™
//    Linear Regression + Exponential Smoothing + Seasonal Naive combined
// ════════════════════════════════════════════════════════════════════════════

export interface ForecastPoint {
  label: string;           // "Jan 2025"
  historical: number | null;
  linearRegression: number | null;
  expSmoothing: number | null;
  seasonal: number | null;
  ensemble: number | null;
  confidenceLow: number | null;
  confidenceHigh: number | null;
}

export function buildRevenueForecast(rows: CustomerRow[], forecastMonths = 4): ForecastPoint[] {
  // Build monthly revenue map
  const monthMap = new Map<string, number>();
  for (const r of rows) {
    if (!r.tanggalOrder || !r.jenis) continue;
    const parts = r.tanggalOrder.split(/[\/\-\.]/);
    if (parts.length < 3) continue;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) continue;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const amt = parseInt((r.totalBayar || '0').replace(/\D/g, ''), 10) || 0;
    monthMap.set(key, (monthMap.get(key) ?? 0) + amt);
  }

  const sorted = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (sorted.length < 3) return [];

  const historical = sorted.map(([, v]) => v);
  const n = historical.length;
  const INDO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];

  // Linear Regression on historical
  const xs = historical.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = historical.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * historical[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Exponential Smoothing (α=0.3)
  const alpha = 0.3;
  const esValues: number[] = [historical[0]];
  for (let i = 1; i < n; i++) {
    esValues.push(alpha * historical[i] + (1 - alpha) * esValues[i - 1]);
  }

  // Residual std dev for confidence intervals
  const residuals = historical.map((v, i) => v - (intercept + slope * i));
  const residualMean = residuals.reduce((s, v) => s + v, 0) / n;
  const residualStd = Math.sqrt(residuals.reduce((s, v) => s + (v - residualMean) ** 2, 0) / n);

  const points: ForecastPoint[] = [];

  // Historical points (last 12 months)
  const histStart = Math.max(0, n - 12);
  for (let i = histStart; i < n; i++) {
    const [y, m] = sorted[i][0].split('-').map(Number);
    points.push({
      label: `${INDO[m - 1]} ${y}`,
      historical: historical[i],
      linearRegression: null,
      expSmoothing: null,
      seasonal: null,
      ensemble: null,
      confidenceLow: null,
      confidenceHigh: null,
    });
  }

  // Forecast points
  const lastKey = sorted[n - 1][0];
  const [lastYear, lastMonth] = lastKey.split('-').map(Number);
  const lastES = esValues[esValues.length - 1];
  const esTrend = esValues.length > 1 ? esValues[esValues.length - 1] - esValues[esValues.length - 2] : 0;

  for (let offset = 1; offset <= forecastMonths; offset++) {
    let m = lastMonth + offset;
    let y = lastYear;
    while (m > 12) { m -= 12; y++; }

    // Linear regression projection
    const lrVal = Math.max(0, Math.round(intercept + slope * (n - 1 + offset)));

    // Exponential smoothing projection
    const esVal = Math.max(0, Math.round(lastES + esTrend * offset));

    // Seasonal naive: same month last year
    const sameMonthLastYear = `${y - 1}-${String(m).padStart(2, '0')}`;
    const seasonalVal = monthMap.has(sameMonthLastYear)
      ? Math.max(0, Math.round((monthMap.get(sameMonthLastYear)! * (1 + slope / Math.max(1, intercept))) ))
      : null;

    // Ensemble: weighted average (LR=40%, ES=35%, Seasonal=25%)
    const hasAll = seasonalVal !== null;
    const ensemble = hasAll
      ? Math.round(lrVal * 0.40 + esVal * 0.35 + seasonalVal * 0.25)
      : Math.round(lrVal * 0.55 + esVal * 0.45);

    const ci = residualStd * (1 + offset * 0.15);
    points.push({
      label: `${INDO[m - 1]} ${y}`,
      historical: null,
      linearRegression: lrVal,
      expSmoothing: esVal,
      seasonal: seasonalVal,
      ensemble,
      confidenceLow: Math.max(0, Math.round(ensemble - ci)),
      confidenceHigh: Math.round(ensemble + ci),
    });
  }

  return points;
}

// ════════════════════════════════════════════════════════════════════════════
// 3. AUTOPILOT ACTION ENGINE™
//    Prioritized ROI-ranked action queue for TODAY
// ════════════════════════════════════════════════════════════════════════════

export type ActionType =
  | 'WIN_BACK'
  | 'BIRTHDAY_VIP'
  | 'ORDER_CYCLE_NUDGE'
  | 'UPSELL_HIGHVALUE'
  | 'FIRST_REORDER'
  | 'CHURN_ALERT'
  | 'THANK_YOU';

export interface AutopilotAction {
  id: string;
  type: ActionType;
  customer: Customer;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  reason: string;
  expectedRevenue: number;   // Predicted Rp impact
  priorityScore: number;     // urgency × expectedRevenue composite
  waTemplate: string;
  daysInfo: string;
}

const ACTION_LABELS: Record<ActionType, string> = {
  WIN_BACK: '🚨 Win-Back',
  BIRTHDAY_VIP: '🎂 Birthday VIP',
  ORDER_CYCLE_NUDGE: '⏰ Cycle Nudge',
  UPSELL_HIGHVALUE: '💎 Upsell',
  FIRST_REORDER: '✨ First Re-order',
  CHURN_ALERT: '⚠️ Churn Alert',
  THANK_YOU: '🙏 Thank You',
};

export function buildAutopilotQueue(
  customers: Customer[] = [],
  limit = 15
): AutopilotAction[] {
  const now = new Date();
  const actions: AutopilotAction[] = [];
  const safeCustomers = customers || [];

  for (const c of safeCustomers) {
    if (!c) continue;
    const cName = c.nama || 'Pelanggan';
    const churn = calcChurn(c);
    const orders = (c.orders || []).filter(o => o?.jenis);

    // Birthday check (within 7 days)
    if (c.tanggalUlangTahun) {
      const parts = c.tanggalUlangTahun.split(/[\/\-\.]/);
      if (parts.length >= 2) {
        const bMonth = parseInt(parts[1], 10) - 1;
        const bDay = parseInt(parts[0], 10);
        if (!isNaN(bMonth) && !isNaN(bDay)) {
          const thisYearBday = new Date(now.getFullYear(), bMonth, bDay);
          let daysUntil = Math.floor((thisYearBday.getTime() - now.getTime()) / 86400000);
          if (daysUntil < 0) {
            const nextYearBday = new Date(now.getFullYear() + 1, bMonth, bDay);
            daysUntil = Math.floor((nextYearBday.getTime() - now.getTime()) / 86400000);
          }
          if (daysUntil >= 0 && daysUntil <= 7 && churn.avgOrderValue > 0) {
            const isVip = (c.totalSpend || 0) > 15000000 || orders.length >= 5;
            if (isVip || daysUntil <= 2) {
              const firstName = cName.split(' ')[0].toUpperCase();
              actions.push({
                id: `bday-${c.id}`,
                type: 'BIRTHDAY_VIP',
                customer: c,
                urgency: daysUntil <= 1 ? 'CRITICAL' : daysUntil <= 3 ? 'HIGH' : 'MEDIUM',
                title: `${ACTION_LABELS.BIRTHDAY_VIP}: ${cName}`,
                reason: `Ulang tahun ${daysUntil === 0 ? 'HARI INI' : `dalam ${daysUntil} hari`}. AOV Rp${(churn.avgOrderValue/1e6).toFixed(1)}jt.`,
                expectedRevenue: Math.round(churn.avgOrderValue * 1.2),
                priorityScore: (daysUntil === 0 ? 10000 : 5000 / (daysUntil + 1)) * ((c.totalSpend || 0) / 1e6),
                waTemplate: `Halo Kak *${cName}* 🎂✨\n\nSelamat Ulang Tahun! Semoga hari istimewa Kakak penuh kebahagiaan.\n\nSebagai pelanggan spesial kami, ada *voucher eksklusif* khusus untuk Kakak: *BDAY${now.getFullYear().toString().slice(-2)}-${firstName}*\n\nBerlaku untuk pembelian berikutnya 💎`,
                daysInfo: daysUntil === 0 ? 'HARI INI' : `${daysUntil} hari lagi`,
              });
            }
          }
        }
      }
    }

    // Win-back: churn Critical + high value
    if (churn.risk === 'Critical' && churn.clvHistorical > 3000000) {
      actions.push({
        id: `winback-${c.id}`,
        type: 'WIN_BACK',
        customer: c,
        urgency: 'CRITICAL',
        title: `${ACTION_LABELS.WIN_BACK}: ${c.nama}`,
        reason: `${churn.recencyDays} hari tidak order. Churn score: ${churn.score}/100. Nilai historis: Rp${(churn.clvHistorical/1e6).toFixed(1)}jt.`,
        expectedRevenue: Math.round(churn.avgOrderValue * 0.4),
        priorityScore: churn.score * (churn.clvHistorical / 1e6),
        waTemplate: `Halo Kak *${c.nama}* 👋\n\nKami kangen Kakak! Sudah *${churn.recencyDays} hari* nih tidak ada kabar.\n\nAda koleksi mutiara terbaru yang pasti Kakak suka 🌊\n\nKhusus untuk Kakak, ada *penawaran spesial* yang sayang dilewatkan. Boleh Kak mampir sebentar? 💎`,
        daysInfo: `${churn.recencyDays} hari`,
      });
    }

    // Order cycle nudge: overdue by 20-50% of avg cycle
    if (churn.isOverdue && churn.avgDaysBetweenOrders > 0 && churn.risk !== 'Critical') {
      const overdueRatio = churn.recencyDays / churn.avgDaysBetweenOrders;
      if (overdueRatio >= 1.2 && overdueRatio < 2.5 && churn.avgOrderValue > 1000000) {
        actions.push({
          id: `cycle-${c.id}`,
          type: 'ORDER_CYCLE_NUDGE',
          customer: c,
          urgency: overdueRatio > 2 ? 'HIGH' : 'MEDIUM',
          title: `${ACTION_LABELS.ORDER_CYCLE_NUDGE}: ${c.nama}`,
          reason: `Biasanya order setiap ${churn.avgDaysBetweenOrders} hari — sekarang sudah ${churn.recencyDays} hari (${Math.round(overdueRatio*100-100)}% terlambat dari pola).`,
          expectedRevenue: Math.round(churn.avgOrderValue * 0.7),
          priorityScore: overdueRatio * (churn.avgOrderValue / 1e6) * 100,
          waTemplate: `Halo Kak *${c.nama}* 😊\n\nBagaimana kabar perhiasan mutiaranya? Kita sudah lama tidak bertemu nih.\n\nKami punya stok terbaru yang mungkin sesuai selera Kakak. Mau lihat-lihat dulu? 👀💎`,
          daysInfo: `+${Math.round(overdueRatio*100-100)}% dari siklus`,
        });
      }
    }

    // First re-order: single order customers older than 30 days
    if (orders.length === 1 && churn.recencyDays > 30 && churn.recencyDays < 180 && churn.avgOrderValue > 500000) {
      actions.push({
        id: `reorder-${c.id}`,
        type: 'FIRST_REORDER',
        customer: c,
        urgency: churn.recencyDays > 90 ? 'HIGH' : 'MEDIUM',
        title: `${ACTION_LABELS.FIRST_REORDER}: ${c.nama}`,
        reason: `Hanya 1x order, ${churn.recencyDays} hari lalu. Mengubah pembeli 1x menjadi repeat = nilai LTV meningkat 3-5x.`,
        expectedRevenue: Math.round(churn.avgOrderValue * 2.5),
        priorityScore: (churn.avgOrderValue / 1e6) * 150,
        waTemplate: `Halo Kak *${c.nama}* ✨\n\nTerima kasih sudah belanja di toko kami! Gimana perhiasannya, Kak?\n\nKami punya rekomendasi koleksi yang cocok untuk melengkapi perhiasan Kakak 💎 Mau Kak lihat?`,
        daysInfo: `${churn.recencyDays} hari lalu`,
      });
    }

    // High-value upsell: loyal customers with increasing spend trend
    if (orders.length >= 3 && churn.risk === 'Low' && churn.avgOrderValue > 5000000 && churn.recencyDays < 60) {
      const recentOrders = [...orders].sort((a, b) => {
        const da = parseOrderDate(a.tanggalOrder);
        const db = parseOrderDate(b.tanggalOrder);
        return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
      }).slice(0, 3);
      const recentAvg = recentOrders.reduce((s, o) => s + parseInt((o.totalBayar || '0').replace(/\D/g, ''), 10), 0) / recentOrders.length;
      if (recentAvg > churn.avgOrderValue * 1.1) {
        actions.push({
          id: `upsell-${c.id}`,
          type: 'UPSELL_HIGHVALUE',
          customer: c,
          urgency: 'LOW',
          title: `${ACTION_LABELS.UPSELL_HIGHVALUE}: ${c.nama}`,
          reason: `3 order terakhir rata-rata naik ${Math.round((recentAvg/churn.avgOrderValue - 1)*100)}%. Momentum terbaik untuk upsell premium collection.`,
          expectedRevenue: Math.round(recentAvg * 1.3),
          priorityScore: (recentAvg / 1e6) * 80,
          waTemplate: `Halo Kak *${c.nama}* 💎\n\nKami senang Kakak selalu mempercayai koleksi mutiara premium kami.\n\nBaru ada koleksi eksklusif *South Sea Pearl* terbatas yang kami pikir cocok untuk Kakak. Boleh Kak kami tunjukkan?`,
          daysInfo: `Active ${churn.recencyDays} hari lalu`,
        });
      }
    }
  }

  // Sort by priorityScore descending
  return actions
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
}

// ════════════════════════════════════════════════════════════════════════════
// 4. BUSINESS HEALTH SCORE™
//    8-dimension composite score 0-100
// ════════════════════════════════════════════════════════════════════════════

export interface HealthDimension {
  name: string;
  score: number;   // 0-100
  icon: string;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  detail: string;
}

export interface BusinessHealthScore {
  total: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: HealthDimension[];
  trend: 'improving' | 'stable' | 'declining';
  summary: string;
}

export function calcBusinessHealth(customers: Customer[], rows: CustomerRow[]): BusinessHealthScore {
  const now = new Date();
  const orders = rows.filter(r => r.jenis);

  function dim(name: string, score: number, icon: string, detail: string): HealthDimension {
    const s = Math.round(Math.min(100, Math.max(0, score)));
    return {
      name, score: s, icon, detail,
      status: s >= 80 ? 'excellent' : s >= 60 ? 'good' : s >= 35 ? 'warning' : 'critical',
    };
  }

  // 1. Revenue Growth (MoM)
  const curM = now.getMonth() + 1;
  const curY = now.getFullYear();
  const prevM = curM === 1 ? 12 : curM - 1;
  const prevY = curM === 1 ? curY - 1 : curY;
  const curKey = `${curY}-${String(curM).padStart(2,'0')}`;
  const prevKey = `${prevY}-${String(prevM).padStart(2,'0')}`;
  const monthMap = new Map<string, number>();
  for (const r of orders) {
    const parts = r.tanggalOrder?.split(/[\/\-\.]/) ?? [];
    if (parts.length < 3) continue;
    const k = `${parseInt(parts[2],10)}-${String(parseInt(parts[1],10)).padStart(2,'0')}`;
    monthMap.set(k, (monthMap.get(k) ?? 0) + parseInt((r.totalBayar ?? '0').replace(/\D/g,''), 10));
  }
  const curRev = monthMap.get(curKey) ?? 0;
  const prevRev = monthMap.get(prevKey) ?? 1;
  const growthPct = ((curRev - prevRev) / prevRev) * 100;
  const growthScore = Math.min(100, 50 + growthPct);
  const revenueGrowth = dim('Revenue Growth', growthScore, '📈', `MoM: ${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(0)}%`);

  // 2. Customer Retention
  const activeThisMonth = new Set(orders.filter(r => {
    const parts = r.tanggalOrder?.split(/[\/\-\.]/) ?? [];
    if (parts.length < 3) return false;
    return `${parseInt(parts[2],10)}-${String(parseInt(parts[1],10)).padStart(2,'0')}` === curKey;
  }).map(r => r.namaInstagram));
  const activeLastMonth = new Set(orders.filter(r => {
    const parts = r.tanggalOrder?.split(/[\/\-\.]/) ?? [];
    if (parts.length < 3) return false;
    return `${parseInt(parts[2],10)}-${String(parseInt(parts[1],10)).padStart(2,'0')}` === prevKey;
  }).map(r => r.namaInstagram));
  const retained = [...activeLastMonth].filter(id => activeThisMonth.has(id)).length;
  const retentionPct = activeLastMonth.size > 0 ? (retained / activeLastMonth.size) * 100 : 70;
  const retentionHealth = dim('Customer Retention', retentionPct, '🔄', `${retained}/${activeLastMonth.size} pelanggan aktif kembali`);

  // 3. Churn Risk Index (inverted: lower churn = higher score)
  const churnScores = customers.map(c => calcChurn(c).score);
  const avgChurn = churnScores.length > 0 ? churnScores.reduce((s, v) => s + v, 0) / churnScores.length : 50;
  const churnHealth = dim('Churn Control', 100 - avgChurn, '🛡️', `Avg churn risk: ${avgChurn.toFixed(0)}/100`);

  // 4. Average Order Value Trend
  const aovThis = activeThisMonth.size > 0 ? curRev / Math.max(1, [...activeThisMonth].length) : 0;
  const aovPrev = activeLastMonth.size > 0 ? prevRev / Math.max(1, [...activeLastMonth].length) : 1;
  const aovTrendPct = ((aovThis - aovPrev) / Math.max(1, aovPrev)) * 100;
  const aovHealth = dim('AOV Trend', Math.min(100, 50 + aovTrendPct), '💰', `AOV: Rp${(aovThis/1e6).toFixed(1)}jt (${aovTrendPct >= 0 ? '+' : ''}${aovTrendPct.toFixed(0)}% MoM)`);

  // 5. Customer Acquisition (new customers this month vs last 3m avg)
  const newCustomers3m = customers.filter(c => {
    const orders3m = c.orders.filter(o => {
      const p = o.tanggalOrder?.split(/[\/\-\.]/) ?? [];
      if (p.length < 3) return false;
      const d = new Date(parseInt(p[2],10), parseInt(p[1],10)-1, parseInt(p[0],10));
      return (now.getTime() - d.getTime()) < 90 * 86400000;
    });
    return orders3m.length > 0;
  }).length;
  const acquisitionScore = Math.min(100, (newCustomers3m / Math.max(1, customers.length * 0.1)) * 50);
  const acquisitionHealth = dim('Customer Acquisition', acquisitionScore, '🌟', `${newCustomers3m} customer baru (3 bln)`);

  // 6. Product Diversity Health
  const productTypes = new Set(orders.map(r => r.jenis)).size;
  const divScore = Math.min(100, productTypes * 12);
  const diversityHealth = dim('Product Diversity', divScore, '🎨', `${productTypes} jenis produk aktif`);

  // 7. VIP/Loyal Customer Ratio
  const vipCount = customers.filter(c => c.totalSpend > 15000000 || c.orderCount >= 5).length;
  const vipRatio = customers.length > 0 ? (vipCount / customers.length) * 100 : 0;
  const vipScore = Math.min(100, vipRatio * 5);
  const vipHealth = dim('VIP Customer Base', vipScore, '👑', `${vipCount} VIP/Loyal (${vipRatio.toFixed(0)}% dari total)`);

  // 8. Order Frequency Index
  const avgOrdersPerCust = customers.length > 0
    ? customers.reduce((s, c) => s + c.orderCount, 0) / customers.length
    : 0;
  const freqScore = Math.min(100, avgOrdersPerCust * 20);
  const freqHealth = dim('Order Frequency', freqScore, '⚡', `Rata-rata ${avgOrdersPerCust.toFixed(1)} order/customer`);

  const dimensions = [revenueGrowth, retentionHealth, churnHealth, aovHealth, acquisitionHealth, diversityHealth, vipHealth, freqHealth];
  const total = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);

  let grade: BusinessHealthScore['grade'] = 'F';
  if (total >= 90) grade = 'A+';
  else if (total >= 80) grade = 'A';
  else if (total >= 70) grade = 'B';
  else if (total >= 55) grade = 'C';
  else if (total >= 40) grade = 'D';

  // Trend: compare worst 3 dims vs best to decide
  const criticals = dimensions.filter(d => d.status === 'critical' || d.status === 'warning').length;
  const trend = growthPct > 5 && retentionPct > 50 ? 'improving' : growthPct < -10 || criticals > 4 ? 'declining' : 'stable';

  const summary = grade === 'A+' || grade === 'A'
    ? `Bisnis berjalan sangat baik! ${dimensions.filter(d => d.status === 'excellent').length} dimensi dalam kondisi excellent.`
    : grade === 'B'
    ? `Performa solid. Fokus pada: ${dimensions.filter(d => d.status === 'warning' || d.status === 'critical').map(d => d.name).join(', ')}.`
    : `Perlu perhatian segera pada: ${dimensions.filter(d => d.status === 'critical').map(d => d.name).join(', ') || 'beberapa area'}.`;

  return { total, grade, dimensions, trend, summary };
}
