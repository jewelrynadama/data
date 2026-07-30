import type { CustomerRow, CatalogItem } from '../types';
import { cleanPrice } from './csvLoader';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES & TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthlyCashFlow {
  month: string;         // "2024-01"
  label: string;         // "Jan 2024"
  revenue: number;
  cogs: number;
  profit: number;
  orders: number;
  aov: number;
  growthPct: number | null; // MoM growth vs previous month
}

export interface CategoryProfitability {
  category: string;
  count: number;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  avgOrderValue: number;
  revenueShare: number; // % of total revenue
}

export interface PaymentStats {
  name: string;
  count: number;
  amount: number;
  share: number; // % share
}

export interface TopCustomer {
  name: string;
  orders: number;
  revenue: number;
  profit: number;
  margin: number;
  lastOrder: string;
}

export interface TopProduct {
  kode: string;
  jenis: string;
  orders: number;
  revenue: number;
  profit: number;
  margin: number;
}

export interface WeeklyHeatmap {
  dayOfWeek: number; // 0=Sun ... 6=Sat
  dayLabel: string;
  hourBucket: number;
  orders: number;
  revenue: number;
}

export interface AIAdvice {
  level: 'critical' | 'warning' | 'opportunity' | 'excellent' | 'info';
  title: string;
  detail: string;
  metric?: string;
}

export interface YearlyComparison {
  year: number;
  revenue: number;
  profit: number;
  orders: number;
  aov: number;
}

export interface UnitEconomics {
  revPerOrder: number;
  cogsPerOrder: number;
  grossProfitPerOrder: number;
  opexPerOrder: number;
  taxPerOrder: number;
  netProfitPerOrder: number;
  marginPerOrderPct: number;
}

export interface WaterfallData {
  grossSales: number;
  ongkir: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  ebit: number;
  tax: number;
  netProfit: number;
}

export interface RunRate {
  annualRunRateRev: number;
  annualRunRateProfit: number;
  monthlyAvgRev: number;
  monthlyAvgProfit: number;
}

export interface ConcentrationRisk {
  top5CustomersSharePct: number;
  top3SkuSharePct: number;
  paretoCustomerStatus: 'Safe' | 'Moderate' | 'High Dependence';
  paretoSkuStatus: 'Balanced' | 'Concentrated' | 'Highly Vulnerable';
}

export interface FinanceOptions {
  periodFilter?: 'all' | 'ytd' | 'ltm' | 'l6m' | string; // e.g. "2026", "2025"
  customOpexPct?: number;       // default 10%
  customDefaultMarginPct?: number; // default 35% (COGS 65%)
  customTaxRatePct?: number;    // default 0.5% (UMKM tax)
}

export interface ScenarioResult {
  projectedRev: number;
  projectedCogs: number;
  projectedGrossProfit: number;
  projectedOpex: number;
  projectedNetProfit: number;
  projectedMarginPct: number;
  deltaRev: number;
  deltaNetProfit: number;
  deltaNetProfitPct: number;
}

export interface FinanceMetrics {
  // --- Core P&L ---
  totalOrders: number;
  totalRevenue: number;
  totalCogs: number;
  totalGrossProfit: number;
  totalOpex: number;
  totalTax: number;
  totalNetProfit: number;
  totalOngkir: number;
  grossMarginPct: number;
  netMarginEstPct: number;
  aov: number;

  // --- CFO Advanced Intelligence ---
  unitEconomics: UnitEconomics;
  waterfallData: WaterfallData;
  runRate: RunRate;
  concentration: ConcentrationRisk;
  activePeriodLabel: string;
  cagrPct: number | null;

  // --- Options used ---
  options: Required<FinanceOptions>;

  // --- Period Comparisons ---
  currentMonthRevenue: number;
  currentMonthProfit: number;
  currentMonthOrders: number;
  prevMonthRevenue: number;
  prevMonthProfit: number;
  prevMonthOrders: number;
  momRevenueGrowth: number | null;
  momProfitGrowth: number | null;
  currentYearRevenue: number;
  prevYearRevenue: number;
  yoyGrowth: number | null;

  // --- Velocity & Efficiency ---
  avgOrdersPerMonth: number;
  bestMonth: MonthlyCashFlow | null;
  worstMonth: MonthlyCashFlow | null;
  revenuePerDay: number;
  breakevenRevenue: number;

  // --- Customer Intelligence ---
  uniqueCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  avgLTV: number;
  topCustomers: TopCustomer[];

  // --- Product Intelligence ---
  topProducts: TopProduct[];
  uniqueSkus: number;

  // --- Time Series ---
  monthlyCashFlow: MonthlyCashFlow[];
  yearlyComparisons: YearlyComparison[];
  weeklyHeatmap: WeeklyHeatmap[];

  // --- Distribution ---
  categoryStats: CategoryProfitability[];
  paymentStats: PaymentStats[];

  // --- AI Advice ---
  aiAdvice: AIAdvice[];
  healthScore: number;
  healthLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
  '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'Mei','06':'Jun',
  '07':'Jul','08':'Ags','09':'Sep','10':'Okt','11':'Nov','12':'Des',
};

const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      const d2 = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
      if (!isNaN(d2.getTime())) return d2;
    }
    if (parts[0].length === 4) {
      const d3 = new Date(`${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`);
      if (!isNaN(d3.getTime())) return d3;
    }
  }
  return null;
}

function fmtMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function fmtMonthLabel(key: string) {
  const [yr, mo] = key.split('-');
  return `${MONTH_LABELS[mo] || mo} ${yr}`;
}

function growthPct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export function generateFinanceMetrics(
  rows: CustomerRow[],
  catalog: CatalogItem[],
  options: FinanceOptions = {}
): FinanceMetrics {
  const opexPct = (options.customOpexPct ?? 10) / 100;
  const defaultMarginPct = (options.customDefaultMarginPct ?? 35) / 100;
  const taxRatePct = (options.customTaxRatePct ?? 0.5) / 100;
  const periodFilter = options.periodFilter || 'all';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  // Filter rows based on period filter
  let validRows = rows.filter(r => r.tanggalOrder);

  if (periodFilter !== 'all') {
    validRows = validRows.filter(r => {
      const d = parseDate(r.tanggalOrder);
      if (!d) return false;
      const yr = d.getFullYear();
      if (periodFilter === 'ytd') {
        return yr === currentYear;
      }
      if (periodFilter === 'ltm') {
        const ltmCutoff = new Date(currentYear - 1, currentMonth, 1);
        return d >= ltmCutoff;
      }
      if (periodFilter === 'l6m') {
        const l6mCutoff = new Date(currentYear, currentMonth - 5, 1);
        return d >= l6mCutoff;
      }
      // Specific year string e.g. "2025" or "2026"
      if (/^\d{4}$/.test(periodFilter)) {
        return yr === parseInt(periodFilter, 10);
      }
      return true;
    });
  }

  // Build catalog lookup
  const catalogMap = new Map<string, CatalogItem>();
  for (const item of catalog) {
    if (item.kode) catalogMap.set(item.kode.trim().toLowerCase(), item);
  }

  const currentMonthKey = fmtMonthKey(now);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = fmtMonthKey(prevMonthDate);
  const prevYear = currentYear - 1;

  let totalRevenue = 0;
  let totalCogs = 0;
  let totalOngkir = 0;

  const monthlyData: Record<string, { rev: number; cogs: number; orders: number }> = {};
  const categoryData: Record<string, { count: number; revenue: number; cogs: number; profit: number }> = {};
  const paymentData: Record<string, { count: number; amount: number }> = {};
  const customerData: Record<string, { orders: number; revenue: number; profit: number; lastOrder: string }> = {};
  const productData: Record<string, { kode: string; jenis: string; orders: number; revenue: number; profit: number }> = {};
  const weekdayData: Record<number, { orders: number; revenue: number }> = {};
  const yearlyData: Record<number, { revenue: number; profit: number; orders: number }> = {};

  for (let i = 0; i < 7; i++) weekdayData[i] = { orders: 0, revenue: 0 };

  let minTime = Infinity;
  let maxTime = -Infinity;
  let uniqueSkus = new Set<string>();

  validRows.forEach(row => {
    const tb = cleanPrice(row.totalBayar);
    const ongkir = cleanPrice(row.ongkir);
    let rev = tb - ongkir;
    if (rev <= 0) rev = cleanPrice(row.amount) || tb;
    if (rev <= 0) return;

    // COGS
    let cogs = 0;
    const kode = (row.kode || '').trim().toLowerCase();
    const catItem = catalogMap.get(kode);
    if (catItem) {
      const modalRangka = cleanPrice(catItem.modalRangka?.toString() || '0');
      const modalMutiara = cleanPrice(catItem.modalMutiara?.toString() || '0');
      cogs = modalRangka + modalMutiara;
    }
    if (cogs <= 0) cogs = rev * (1 - defaultMarginPct);

    const profit = rev - cogs;
    const parsedDate = parseDate(row.tanggalOrder);

    totalRevenue += rev;
    totalCogs += cogs;
    totalOngkir += ongkir;

    if (parsedDate) {
      const t = parsedDate.getTime();
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;

      const mKey = fmtMonthKey(parsedDate);
      if (!monthlyData[mKey]) monthlyData[mKey] = { rev: 0, cogs: 0, orders: 0 };
      monthlyData[mKey].rev += rev;
      monthlyData[mKey].cogs += cogs;
      monthlyData[mKey].orders += 1;

      const yr = parsedDate.getFullYear();
      if (!yearlyData[yr]) yearlyData[yr] = { revenue: 0, profit: 0, orders: 0 };
      yearlyData[yr].revenue += rev;
      yearlyData[yr].profit += profit;
      yearlyData[yr].orders += 1;

      const dayIdx = parsedDate.getDay();
      weekdayData[dayIdx].orders += 1;
      weekdayData[dayIdx].revenue += rev;
    }

    const category = row.jenis || 'Lain-lain';
    if (!categoryData[category]) categoryData[category] = { count: 0, revenue: 0, cogs: 0, profit: 0 };
    categoryData[category].count += 1;
    categoryData[category].revenue += rev;
    categoryData[category].cogs += cogs;
    categoryData[category].profit += profit;

    const payment = row.paymentVia || 'BCA/Bank';
    if (!paymentData[payment]) paymentData[payment] = { count: 0, amount: 0 };
    paymentData[payment].count += 1;
    paymentData[payment].amount += rev;

    const custName = (row.namaInstagram || row.namaPengiriman || 'Unknown').trim();
    if (!customerData[custName]) customerData[custName] = { orders: 0, revenue: 0, profit: 0, lastOrder: '' };
    customerData[custName].orders += 1;
    customerData[custName].revenue += rev;
    customerData[custName].profit += profit;
    if (row.tanggalOrder > customerData[custName].lastOrder) {
      customerData[custName].lastOrder = row.tanggalOrder;
    }

    const prodKode = (row.kodeType || row.kode || row.type || 'N/A').trim();
    if (prodKode !== 'N/A') {
      uniqueSkus.add(prodKode);
      if (!productData[prodKode]) productData[prodKode] = { kode: prodKode, jenis: category, orders: 0, revenue: 0, profit: 0 };
      productData[prodKode].orders += 1;
      productData[prodKode].revenue += rev;
      productData[prodKode].profit += profit;
    }
  });

  const totalGrossProfit = totalRevenue - totalCogs;
  const totalOpex = totalRevenue * opexPct;
  const ebit = totalGrossProfit - totalOpex;
  const totalTax = Math.max(0, totalRevenue * taxRatePct);
  const totalNetProfit = ebit - totalTax;

  const grossMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
  const netMarginEstPct = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
  const aov = validRows.length > 0 ? totalRevenue / validRows.length : 0;

  // Monthly Cashflow Time Series
  const monthlyKeys = Object.keys(monthlyData).sort();
  let prevRev = 0;
  const monthlyCashFlow: MonthlyCashFlow[] = monthlyKeys.map(key => {
    const d = monthlyData[key];
    const prof = d.rev - d.cogs;
    const growth = prevRev > 0 ? ((d.rev - prevRev) / prevRev) * 100 : null;
    prevRev = d.rev;
    return {
      month: key,
      label: fmtMonthLabel(key),
      revenue: d.rev,
      cogs: d.cogs,
      profit: prof,
      orders: d.orders,
      aov: d.orders > 0 ? d.rev / d.orders : 0,
      growthPct: growth,
    };
  });

  const sortedMonths = [...monthlyCashFlow].sort((a, b) => b.revenue - a.revenue);
  const bestMonth = sortedMonths[0] || null;
  const worstMonth = sortedMonths[sortedMonths.length - 1] || null;

  const curM = monthlyData[currentMonthKey];
  const prvM = monthlyData[prevMonthKey];
  const currentMonthRevenue = curM ? curM.rev : 0;
  const currentMonthProfit = curM ? curM.rev - curM.cogs : 0;
  const currentMonthOrders = curM ? curM.orders : 0;
  const prevMonthRevenue = prvM ? prvM.rev : 0;
  const prevMonthProfit = prvM ? prvM.rev - prvM.cogs : 0;
  const prevMonthOrders = prvM ? prvM.orders : 0;

  const momRevenueGrowth = growthPct(currentMonthRevenue, prevMonthRevenue);
  const momProfitGrowth = growthPct(currentMonthProfit, prevMonthProfit);

  const currentYearRevenue = yearlyData[currentYear]?.revenue || 0;
  const prevYearRevenue = yearlyData[prevYear]?.revenue || 0;
  const yoyGrowth = growthPct(currentYearRevenue, prevYearRevenue);

  let totalDays = 1;
  if (minTime !== Infinity && maxTime !== -Infinity) {
    const diffTime = Math.abs(maxTime - minTime);
    totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }
  const revenuePerDay = totalRevenue / totalDays;
  const totalMonths = Math.max(1, monthlyCashFlow.length);
  const avgOrdersPerMonth = validRows.length / totalMonths;

  // CFO Run Rate (Annualized based on last 3 months avg or monthly avg)
  const recent3Months = monthlyCashFlow.slice(-3);
  const avgRecentRev = recent3Months.length > 0
    ? recent3Months.reduce((s, m) => s + m.revenue, 0) / recent3Months.length
    : totalRevenue / totalMonths;
  const avgRecentProfit = recent3Months.length > 0
    ? recent3Months.reduce((s, m) => s + m.profit, 0) / recent3Months.length
    : totalGrossProfit / totalMonths;

  const annualRunRateRev = avgRecentRev * 12;
  const annualRunRateProfit = avgRecentProfit * 12 * (1 - opexPct - taxRatePct);

  // CAGR calculation if at least 2 full years exist
  const yearlyKeys = Object.keys(yearlyData).map(Number).sort();
  let cagrPct: number | null = null;
  if (yearlyKeys.length >= 2) {
    const startYr = yearlyKeys[0];
    const endYr = yearlyKeys[yearlyKeys.length - 1];
    const startRev = yearlyData[startYr].revenue;
    const endRev = yearlyData[endYr].revenue;
    const numYears = endYr - startYr;
    if (startRev > 0 && numYears >= 1) {
      cagrPct = (Math.pow(endRev / startRev, 1 / numYears) - 1) * 100;
    }
  }

  // Customer Intelligence & Concentration Risk
  const customerEntries = Object.entries(customerData).map(([name, data]) => ({
    name,
    ...data,
    profit: data.revenue * (grossMarginPct / 100),
    margin: grossMarginPct,
  }));
  customerEntries.sort((a, b) => b.revenue - a.revenue);

  const uniqueCustomers = customerEntries.length;
  const repeatCustomers = customerEntries.filter(c => c.orders > 1).length;
  const repeatRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;
  const avgLTV = uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0;
  const topCustomers = customerEntries.slice(0, 10);

  // Pareto Top 5% Customer Concentration
  const top5Count = Math.max(1, Math.ceil(uniqueCustomers * 0.05));
  const top5Rev = customerEntries.slice(0, top5Count).reduce((s, c) => s + c.revenue, 0);
  const top5CustomersSharePct = totalRevenue > 0 ? (top5Rev / totalRevenue) * 100 : 0;

  let paretoCustomerStatus: ConcentrationRisk['paretoCustomerStatus'] = 'Safe';
  if (top5CustomersSharePct > 60) paretoCustomerStatus = 'High Dependence';
  else if (top5CustomersSharePct > 40) paretoCustomerStatus = 'Moderate';

  // Product Intelligence & SKU Concentration
  const productEntries = Object.values(productData).map(p => ({
    ...p,
    margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0,
  }));
  productEntries.sort((a, b) => b.revenue - a.revenue);
  const topProducts = productEntries.slice(0, 10);

  const top3Rev = productEntries.slice(0, 3).reduce((s, p) => s + p.revenue, 0);
  const top3SkuSharePct = totalRevenue > 0 ? (top3Rev / totalRevenue) * 100 : 0;

  let paretoSkuStatus: ConcentrationRisk['paretoSkuStatus'] = 'Balanced';
  if (top3SkuSharePct > 65) paretoSkuStatus = 'Highly Vulnerable';
  else if (top3SkuSharePct > 45) paretoSkuStatus = 'Concentrated';

  // Category Profitability
  const categoryStats: CategoryProfitability[] = Object.entries(categoryData).map(([cat, d]) => {
    const margin = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
    const aovCat = d.count > 0 ? d.revenue / d.count : 0;
    const share = totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0;
    return {
      category: cat,
      count: d.count,
      revenue: d.revenue,
      cogs: d.cogs,
      profit: d.profit,
      margin,
      avgOrderValue: aovCat,
      revenueShare: share,
    };
  });
  categoryStats.sort((a, b) => b.revenue - a.revenue);

  // Payment Stats
  const paymentStats: PaymentStats[] = Object.entries(paymentData).map(([name, d]) => ({
    name,
    count: d.count,
    amount: d.amount,
    share: totalRevenue > 0 ? (d.amount / totalRevenue) * 100 : 0,
  }));
  paymentStats.sort((a, b) => b.amount - a.amount);

  // Yearly Comparisons
  const yearlyComparisons: YearlyComparison[] = Object.entries(yearlyData).map(([yr, d]) => ({
    year: Number(yr),
    revenue: d.revenue,
    profit: d.profit,
    orders: d.orders,
    aov: d.orders > 0 ? d.revenue / d.orders : 0,
  })).sort((a, b) => a.year - b.year);

  // Weekly Heatmap
  const weeklyHeatmap: WeeklyHeatmap[] = Object.entries(weekdayData).map(([dayIdx, d]) => ({
    dayOfWeek: Number(dayIdx),
    dayLabel: DAY_LABELS[Number(dayIdx)],
    hourBucket: 0,
    orders: d.orders,
    revenue: d.revenue,
  }));

  // Unit Economics
  const numOrders = Math.max(1, validRows.length);
  const unitEconomics: UnitEconomics = {
    revPerOrder: totalRevenue / numOrders,
    cogsPerOrder: totalCogs / numOrders,
    grossProfitPerOrder: totalGrossProfit / numOrders,
    opexPerOrder: totalOpex / numOrders,
    taxPerOrder: totalTax / numOrders,
    netProfitPerOrder: totalNetProfit / numOrders,
    marginPerOrderPct: netMarginEstPct,
  };

  // Waterfall P&L Bridge
  const waterfallData: WaterfallData = {
    grossSales: totalRevenue + totalOngkir,
    ongkir: totalOngkir,
    netSales: totalRevenue,
    cogs: totalCogs,
    grossProfit: totalGrossProfit,
    opex: totalOpex,
    ebit,
    tax: totalTax,
    netProfit: totalNetProfit,
  };

  // Run Rate
  const runRate: RunRate = {
    annualRunRateRev,
    annualRunRateProfit,
    monthlyAvgRev: avgRecentRev,
    monthlyAvgProfit: avgRecentProfit,
  };

  // Concentration Risk Object
  const concentration: ConcentrationRisk = {
    top5CustomersSharePct,
    top3SkuSharePct,
    paretoCustomerStatus,
    paretoSkuStatus,
  };

  // Active Period Label
  let activePeriodLabel = 'Seluruh Periode (All-Time)';
  if (periodFilter === 'ytd') activePeriodLabel = `Year-to-Date ${currentYear}`;
  else if (periodFilter === 'ltm') activePeriodLabel = '12 Bulan Terakhir (LTM)';
  else if (periodFilter === 'l6m') activePeriodLabel = '6 Bulan Terakhir';
  else if (/^\d{4}$/.test(periodFilter)) activePeriodLabel = `Tahun ${periodFilter}`;

  // Estimated Monthly Breakeven Revenue
  const breakevenRevenue = grossMarginPct > 0 ? (totalOpex / (totalMonths * (grossMarginPct / 100))) : 0;

  // ── CFO HEALTH SCORECARD (0-100) ──────────────────────────────────────────
  let healthScore = 50; // base score

  // 1. Margin (max 25 pts)
  if (grossMarginPct >= 50) healthScore += 25;
  else if (grossMarginPct >= 35) healthScore += 20;
  else if (grossMarginPct >= 20) healthScore += 10;
  else healthScore += 0;

  // 2. Growth (max 25 pts)
  if (momRevenueGrowth !== null) {
    if (momRevenueGrowth > 15) healthScore += 25;
    else if (momRevenueGrowth > 0) healthScore += 20;
    else if (momRevenueGrowth > -10) healthScore += 10;
  } else {
    healthScore += 15;
  }

  // 3. Retention (max 25 pts)
  if (repeatRate >= 35) healthScore += 25;
  else if (repeatRate >= 20) healthScore += 15;
  else if (repeatRate >= 10) healthScore += 10;

  // 4. Diversification & Concentration Risk (max 25 pts)
  if (top5CustomersSharePct < 30 && top3SkuSharePct < 40) healthScore += 25;
  else if (top5CustomersSharePct < 50 && top3SkuSharePct < 60) healthScore += 15;
  else healthScore += 5;

  healthScore = Math.min(100, Math.max(0, Math.round(healthScore)));

  let healthLabel = 'Sehat Mantap (A+)';
  if (healthScore < 40) healthLabel = 'Kritis (Cepat Restrukturasi)';
  else if (healthScore < 60) healthLabel = 'Perlu Perhatian (B)';
  else if (healthScore < 80) healthLabel = 'Sehat & Stabil (A)';

  // AI CFO Insights Generation
  const aiAdvice: AIAdvice[] = [];

  // Executive Insights
  if (grossMarginPct < 35) {
    aiAdvice.push({
      level: 'critical', title: 'Margin Rendah — Perlu Strategi Repricing',
      detail: `Gross margin ${grossMarginPct.toFixed(1)}% di bawah rata-rata industri perhiasan mutiara (35–50%). Pertimbangkan menaikkan harga jual 5-10% atau menegosiasikan ulang harga beli bahan mutiara/rangka.`,
      metric: `${grossMarginPct.toFixed(1)}% Margin`
    });
  } else if (grossMarginPct >= 50) {
    aiAdvice.push({
      level: 'excellent', title: 'Pricing Power & Margin Sangat Strong (A+)',
      detail: `Gross margin ${grossMarginPct.toFixed(1)}% menunjukkan positioning brand premium yang kuat. Alokasikan 5-10% dari laba kotor untuk pemasaran authority (fotografi produk, VIP unboxing box).`,
      metric: `${grossMarginPct.toFixed(1)}% Margin`
    });
  }

  if (top5CustomersSharePct > 50) {
    aiAdvice.push({
      level: 'warning', title: `Risiko Konsentrasi Pelanggan (${top5CustomersSharePct.toFixed(0)}% Revenue dari Top 5%)`,
      detail: `Lebih dari separuh pendapatan bergantung pada segelintir VIP. Jika salah satu VIP berhenti membeli, omzet akan terpengaruh signifikan. Giatkan akuisisi lead baru di segmen menengah-atas.`,
      metric: `${top5CustomersSharePct.toFixed(0)}% Top 5%`
    });
  }

  if (top3SkuSharePct > 60) {
    aiAdvice.push({
      level: 'warning', title: `Risiko Ketergantungan Produk (${top3SkuSharePct.toFixed(0)}% Revenue dari 3 Produk Utama)`,
      detail: `Tiga SKU teratas mendominasi ${top3SkuSharePct.toFixed(0)}% omzet. Lakukan inovasi katalog untuk memperbanyak variasi produk hero agar pasokan & tren tetap stabil.`,
      metric: `${top3SkuSharePct.toFixed(0)}% Top 3 SKU`
    });
  }

  if (annualRunRateRev > 0) {
    aiAdvice.push({
      level: 'info', title: `Annual Run Rate (ARR): Rp${(annualRunRateRev/1_000_000_000).toFixed(2)} Miliar/Tahun`,
      detail: `Berdasarkan tren 3 bulan terakhir, proyeksi omzet disetahunkan berada di angka Rp${(annualRunRateRev/1_000_000).toFixed(0)}Jt dengan proyeksi laba bersih Rp${(annualRunRateProfit/1_000_000).toFixed(0)}Jt.`,
      metric: `Rp${(annualRunRateRev/1_000_000_000).toFixed(2)}B ARR`
    });
  }

  return {
    totalOrders: validRows.length,
    totalRevenue,
    totalCogs,
    totalGrossProfit,
    totalOpex,
    totalTax,
    totalNetProfit,
    totalOngkir,
    grossMarginPct,
    netMarginEstPct,
    aov,
    unitEconomics,
    waterfallData,
    runRate,
    concentration,
    activePeriodLabel,
    cagrPct,
    options: {
      periodFilter,
      customOpexPct: opexPct * 100,
      customDefaultMarginPct: defaultMarginPct * 100,
      customTaxRatePct: taxRatePct * 100,
    },
    currentMonthRevenue,
    currentMonthProfit,
    currentMonthOrders,
    prevMonthRevenue,
    prevMonthProfit,
    prevMonthOrders,
    momRevenueGrowth,
    momProfitGrowth,
    currentYearRevenue,
    prevYearRevenue,
    yoyGrowth,
    avgOrdersPerMonth,
    bestMonth,
    worstMonth,
    revenuePerDay,
    breakevenRevenue,
    uniqueCustomers,
    repeatCustomers,
    repeatRate,
    avgLTV,
    topCustomers,
    topProducts,
    uniqueSkus: uniqueSkus.size,
    monthlyCashFlow,
    yearlyComparisons,
    weeklyHeatmap,
    categoryStats,
    paymentStats,
    aiAdvice,
    healthScore,
    healthLabel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SENSITIVITY WHAT-IF SCENARIO SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────

export function simulateWhatIfScenario(
  base: FinanceMetrics,
  params: {
    priceChangePct: number;    // e.g. +10 (%)
    volumeChangePct: number;   // e.g. +15 (%)
    cogsChangePct: number;     // e.g. -5 (%)
    opexChangePct: number;     // e.g. +10 (%)
  }
): ScenarioResult {
  const priceMult = 1 + (params.priceChangePct / 100);
  const volMult = 1 + (params.volumeChangePct / 100);
  const cogsMult = 1 + (params.cogsChangePct / 100);
  const opexMult = 1 + (params.opexChangePct / 100);

  // Projected Sales = Base Rev * PriceMult * VolMult
  const projectedRev = base.totalRevenue * priceMult * volMult;
  // Projected COGS = Base COGS * VolMult * CogsMult
  const projectedCogs = base.totalCogs * volMult * cogsMult;
  const projectedGrossProfit = projectedRev - projectedCogs;

  const projectedOpex = base.totalOpex * opexMult;
  const projectedTax = Math.max(0, projectedRev * (base.options.customTaxRatePct / 100));
  const projectedNetProfit = projectedGrossProfit - projectedOpex - projectedTax;
  const projectedMarginPct = projectedRev > 0 ? (projectedNetProfit / projectedRev) * 100 : 0;

  const deltaRev = projectedRev - base.totalRevenue;
  const deltaNetProfit = projectedNetProfit - base.totalNetProfit;
  const deltaNetProfitPct = base.totalNetProfit > 0 ? (deltaNetProfit / base.totalNetProfit) * 100 : 0;

  return {
    projectedRev,
    projectedCogs,
    projectedGrossProfit,
    projectedOpex,
    projectedNetProfit,
    projectedMarginPct,
    deltaRev,
    deltaNetProfit,
    deltaNetProfitPct,
  };
}
