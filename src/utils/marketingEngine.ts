// src/utils/marketingEngine.ts
import type { Customer, CustomerRow } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Customer Segments (for Broadcast Manager)
// ─────────────────────────────────────────────────────────────────────────────
export interface CustomerSegment {
  id: string;
  label: string;
  description: string;
  customers: Customer[];
  icon: string;
  color: string;
}

export function getCustomerSegments(customers: Customer[], settings: any): CustomerSegment[] {
  const vipMinSpend = settings?.vipMinSpend ?? 15000000;
  const loyalMinOrders = settings?.loyalMinOrders ?? 3;
  const now = new Date();
  const currentMonth = now.getMonth();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const vip = customers.filter((c) => c.totalSpend >= vipMinSpend);
  const loyal = customers.filter((c) => c.orderCount >= loyalMinOrders && c.totalSpend < vipMinSpend);
  const newC = customers.filter((c) => c.orderCount < loyalMinOrders);
  const inactive = customers.filter((c) => {
    if (!c.lastOrder || c.orderCount === 0) return false;
    const d = parseDate(c.lastOrder);
    return d && d < ninetyDaysAgo;
  });
  const birthdayMonth = customers.filter((c) => {
    if (!c.tanggalUlangTahun) return false;
    const parts = c.tanggalUlangTahun.split('/');
    if (parts.length < 2) return false;
    return parseInt(parts[1], 10) - 1 === currentMonth;
  });

  const cityMap: Record<string, Customer[]> = {};
  for (const c of customers) {
    if (c.city && c.city !== '—') {
      if (!cityMap[c.city]) cityMap[c.city] = [];
      cityMap[c.city].push(c);
    }
  }
  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6);

  const base: CustomerSegment[] = [
    { id: 'vip', label: 'VIP', description: `Belanja ≥ ${formatRupiah(vipMinSpend)}`, customers: vip, icon: '👑', color: '#f59e0b' },
    { id: 'loyal', label: 'Loyal', description: `≥ ${loyalMinOrders} pesanan`, customers: loyal, icon: '💎', color: '#7c3aed' },
    { id: 'new', label: 'Pelanggan Baru', description: `< ${loyalMinOrders} pesanan`, customers: newC, icon: '✨', color: '#10b981' },
    { id: 'inactive', label: 'Tidak Aktif 90H', description: 'Belum beli > 90 hari', customers: inactive, icon: '🔁', color: '#6366f1' },
    { id: 'birthday', label: `Ultah ${now.toLocaleString('id-ID', { month: 'long' })}`, description: 'Ulang tahun bulan ini', customers: birthdayMonth, icon: '🎂', color: '#ef4444' },
  ];
  for (const [city, cityCustomers] of topCities) {
    base.push({ id: `city-${city}`, label: city, description: `${cityCustomers.length} pelanggan`, customers: cityCustomers, icon: '📍', color: '#06b6d4' });
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Bundle & Upsell Analysis
// ─────────────────────────────────────────────────────────────────────────────
export interface BundleRecommendation {
  product1: string;
  product2: string;
  count: number;
  confidence: number;
  customerNames: string[];
  estimatedUplift: number;
}

export function getBundleRecommendations(rows: CustomerRow[]): BundleRecommendation[] {
  const byCustomer: Record<string, string[]> = {};
  const avgRevenue =
    rows.length > 0
      ? rows.reduce((s, r) => s + parseInt(r.totalBayar?.replace(/\D/g, '') || '0', 10), 0) / rows.length
      : 500000;

  for (const row of rows) {
    if (!row.jenis) continue;
    const key = row.namaInstagram || row.namaPengiriman || row.id;
    if (!byCustomer[key]) byCustomer[key] = [];
    if (!byCustomer[key].includes(row.jenis)) byCustomer[key].push(row.jenis);
  }

  const pairMap: Record<string, { count: number; customers: string[] }> = {};
  const productCount: Record<string, number> = {};

  for (const [customer, products] of Object.entries(byCustomer)) {
    for (const p of products) productCount[p] = (productCount[p] || 0) + 1;
    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const key = [products[i], products[j]].sort().join('|||');
        if (!pairMap[key]) pairMap[key] = { count: 0, customers: [] };
        pairMap[key].count++;
        pairMap[key].customers.push(customer);
      }
    }
  }

  return Object.entries(pairMap)
    .map(([key, data]) => {
      const [p1, p2] = key.split('|||');
      const conf = Math.min(100, Math.round((data.count / (productCount[p1] || 1)) * 100));
      return {
        product1: p1,
        product2: p2,
        count: data.count,
        confidence: conf,
        customerNames: data.customers.slice(0, 5),
        estimatedUplift: Math.round(data.count * avgRevenue * 0.25),
      };
    })
    .filter((b) => b.count >= 1)
    .sort((a, b) => b.count - a.count || b.confidence - a.confidence)
    .slice(0, 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Product Performance
// ─────────────────────────────────────────────────────────────────────────────
export interface ProductStat {
  name: string;
  count: number;
  revenue: number;
  avgRevenue: number;
  lastSoldDaysAgo: number | null;
  isDeadStock: boolean;
}

export function getProductPerformance(rows: CustomerRow[]): {
  byType: ProductStat[];
  byPearl: ProductStat[];
  deadStock: ProductStat[];
  weekdayHeatmap: { day: string; count: number }[];
} {
  const orderRows = rows.filter((r) => r.jenis);
  const now = new Date();

  function computeStats(groupKey: (r: CustomerRow) => string): ProductStat[] {
    const map: Record<string, { count: number; revenue: number; lastDate: Date | null }> = {};
    for (const r of orderRows) {
      const key = groupKey(r);
      if (!key || key === '—') continue;
      if (!map[key]) map[key] = { count: 0, revenue: 0, lastDate: null };
      map[key].count++;
      map[key].revenue += parseInt(r.totalBayar?.replace(/\D/g, '') || '0', 10);
      const d = parseDate(r.tanggalOrder);
      if (d && (!map[key].lastDate || d > map[key].lastDate!)) map[key].lastDate = d;
    }
    return Object.entries(map)
      .map(([name, data]) => {
        const daysAgo = data.lastDate ? Math.floor((now.getTime() - data.lastDate.getTime()) / 86400000) : null;
        return { name, count: data.count, revenue: data.revenue, avgRevenue: data.count > 0 ? Math.round(data.revenue / data.count) : 0, lastSoldDaysAgo: daysAgo, isDeadStock: daysAgo !== null && daysAgo > 60 };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  const byType = computeStats((r) => r.jenis);
  const byPearl = computeStats((r) => r.type || '');
  const deadStock = [...byType, ...byPearl].filter((p) => p.isDeadStock).sort((a, b) => (b.lastSoldDaysAgo ?? 0) - (a.lastSoldDaysAgo ?? 0)).slice(0, 8);

  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
  const dayCounts = new Array(7).fill(0);
  for (const r of orderRows) {
    const d = parseDate(r.tanggalOrder);
    if (d) dayCounts[d.getDay()]++;
  }

  return { byType: byType.slice(0, 8), byPearl: byPearl.slice(0, 8), deadStock, weekdayHeatmap: DAYS.map((day, i) => ({ day, count: dayCounts[i] })) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Revenue Projection (for Dashboard)
// ─────────────────────────────────────────────────────────────────────────────
export interface RevenueProjection {
  projectedDate: string | null;
  dailyAvg: number;
  projectedTotal: number;
  pacePercent: number;
  daysRemaining: number;
  isAtRisk: boolean;
}

export function getRevenueProjection(currentMonthRevenue: number, goal: number): RevenueProjection {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const dailyAvg = dayOfMonth > 0 ? currentMonthRevenue / dayOfMonth : 0;
  const projectedTotal = currentMonthRevenue + dailyAvg * daysRemaining;
  const pacePercent = goal > 0 ? Math.round((projectedTotal / goal) * 100) : 0;
  const progressPercent = goal > 0 ? (currentMonthRevenue / goal) * 100 : 0;
  const isAtRisk = daysRemaining <= 5 && progressPercent < 70;

  let projectedDate: string | null = null;
  if (dailyAvg > 0 && currentMonthRevenue < goal) {
    const daysNeeded = Math.ceil((goal - currentMonthRevenue) / dailyAvg);
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysNeeded);
    if (targetDate.getMonth() === now.getMonth()) {
      projectedDate = targetDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
    }
  } else if (currentMonthRevenue >= goal) {
    projectedDate = 'Sudah tercapai! 🎉';
  }

  return { projectedDate, dailyAvg, projectedTotal, pacePercent, daysRemaining, isAtRisk };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Re-engagement Engine
// ─────────────────────────────────────────────────────────────────────────────
export type InactiveLevel = 'warning' | 'high' | 'critical';

export interface InactiveCustomer {
  customer: Customer;
  daysInactive: number;
  level: InactiveLevel;
  lastProduct: string;
  lastOrderDate: string;
  suggestedMessage: string;
}

export function getInactiveCustomers(customers: Customer[], rows: CustomerRow[], settings: any): InactiveCustomer[] {
  const now = new Date();
  const storeName = settings?.storeName || 'Pearl Store';

  const result: InactiveCustomer[] = [];
  for (const customer of customers) {
    if (!customer.lastOrder || customer.orderCount === 0) continue;
    const lastDate = parseDate(customer.lastOrder);
    if (!lastDate) continue;
    const daysInactive = Math.floor((now.getTime() - lastDate.getTime()) / 86400000);
    if (daysInactive < 90) continue;

    const level: InactiveLevel = daysInactive >= 180 ? 'critical' : daysInactive >= 120 ? 'high' : 'warning';

    const customerRows = rows
      .filter((r) => (r.namaInstagram === customer.instagram || r.namaPengiriman === customer.nama) && r.jenis)
      .sort((a, b) => (parseDate(b.tanggalOrder)?.getTime() ?? 0) - (parseDate(a.tanggalOrder)?.getTime() ?? 0));
    const lastProduct = customerRows[0]?.jenis || 'perhiasan';

    const suggestedMessage = `Halo Kak ${customer.nama}! 💎\n\nSudah lama nih, kami kangen Kakak di ${storeName}! 🥰\n\nTerakhir Kakak mempercayakan kami untuk koleksi *${lastProduct}*-nya. Saat ini kami punya koleksi-koleksi terbaru yang cantik dan sayang untuk dilewatkan! ✨\n\nYuk mampir dan intip koleksi terbaru kami, mungkin ada yang cocok untuk Kakak! 💕\n\nSalam hangat,\n💎 ${storeName}`;

    result.push({ customer, daysInactive, level, lastProduct, lastOrderDate: customer.lastOrder, suggestedMessage });
  }
  return result.sort((a, b) => b.daysInactive - a.daysInactive);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Flash Sale Content Generator
// ─────────────────────────────────────────────────────────────────────────────
export interface FlashSaleContent {
  waBroadcast: string;
  igCaption: string;
  igStory: string;
}

export type FlashSaleStyle = 'luxury' | 'casual' | 'formal' | 'trendy';

export function generateFlashSaleContent(params: {
  productName: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  timeLimit: string;
  style: FlashSaleStyle;
  storeName: string;
  storeInstagram: string;
}): FlashSaleContent {
  const { productName, discountType, discountValue, timeLimit, style, storeName, storeInstagram } = params;
  const discountLabel = discountType === 'percent' ? `${discountValue}%` : formatRupiah(discountValue);

  const styleVoice = {
    luxury: {
      open: '✨ Penawaran Eksklusif',
      adj: 'istimewa dan langka',
      cta: 'Jadikan milik Kakak sebelum kehabisan.',
      closing: '💎',
    },
    casual: {
      open: '🔥 Flash Sale Alert!',
      adj: 'kece abis',
      cta: 'Jangan sampe nyesel kelewatan ya!',
      closing: '🛍️',
    },
    formal: {
      open: '📢 Pengumuman Penawaran Spesial',
      adj: 'terpilih',
      cta: 'Segera manfaatkan penawaran terbatas ini.',
      closing: '🤝',
    },
    trendy: {
      open: '⚡ SALE VIBES!',
      adj: 'hits & limited',
      cta: "Gaskeun sebelum sold out bestie!",
      closing: '💅',
    },
  };
  const v = styleVoice[style];

  const waBroadcast =
`${v.open} dari ${storeName}! ${v.closing}

Halo Kak {customerName}! 👋

Kabar baik untuk Kakak — kami menghadirkan penawaran ${v.adj} yang sayang untuk dilewatkan:

💎 *${productName}*
🏷️ Diskon spesial *${discountLabel}*!
⏰ Berlaku selama: *${timeLimit}*

${v.cta}

Hubungi kami sekarang untuk info lebih lanjut & pemesanan!
Terima kasih sudah menjadi pelanggan setia kami 🥰

Salam hangat,
💎 *${storeName}*`;

  const igCaption =
`${v.open} ✨

*${productName}* hadir dengan diskon ${v.adj} sebesar *${discountLabel}*! 💎

Ini kesempatan ${v.adj} yang nggak boleh kamu lewatkan!

🏷️ Diskon: *${discountLabel}*
⏰ Berlaku: *${timeLimit}*
📦 Stok terbatas!

${v.cta}

💌 DM kami atau klik link di bio untuk info & pemesanan.

—
@${storeInstagram}
#FlashSale #Sale #Promo #${storeName.replace(/\s/g, '')} #PerhiasMutiara #JewelryIndonesia #MutiaraAsli #Diskon`;

  const igStory =
`${v.open.split(' ').slice(0, 2).join(' ').toUpperCase()}! 🔥
━━━━━━━━━━━━━
💎 ${productName.toUpperCase()}
🏷️ DISKON ${discountLabel.toUpperCase()}!
━━━━━━━━━━━━━
⏰ Berlaku ${timeLimit} saja!

Swipe up / DM untuk order!
@${storeInstagram}`;

  return { waBroadcast, igCaption, igStory };
}
