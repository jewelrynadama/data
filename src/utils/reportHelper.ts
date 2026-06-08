// src/utils/reportHelper.ts
import type { Customer, CustomerRow } from '../types';
import { formatRupiah } from './csvLoader';

function parseAmount(val: string | undefined): number {
  if (!val) return 0;
  return parseInt(val.replace(/\D/g, ''), 10) || 0;
}

interface MonthlyStats {
  totalRevenue: number;
  totalOrders: number;
  newCustomers: number;
  repeatCustomers: number;
  topCustomers: { name: string; spend: number; orders: number }[];
  topProducts: { name: string; count: number; revenue: number }[];
  dailyRevenue: { date: string; revenue: number }[];
}

export function computeMonthlyStats(
  customers: Customer[],
  rows: CustomerRow[],
  year: number,
  month: number, // 1-based
): MonthlyStats {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  const monthRows = rows.filter((r) => (r.tanggalOrder || '').startsWith(prefix));

  const totalRevenue = monthRows.reduce((s, r) => s + parseAmount(r.totalBayar), 0);
  const totalOrders = monthRows.length;

  // New vs repeat customers
  const customerOrdersInMonth = new Map<string, number>();
  for (const r of monthRows) {
    const name = r.namaInstagram || '';
    customerOrdersInMonth.set(name, (customerOrdersInMonth.get(name) ?? 0) + 1);
  }

  let newCustomers = 0;
  let repeatCustomers = 0;
  for (const c of customers) {
    const hasOrderThisMonth = c.orders.some((o) => (o.tanggalOrder || '').startsWith(prefix));
    if (!hasOrderThisMonth) continue;
    // Check if their earliest order is this month
    const allDates = c.orders.map((o) => o.tanggalOrder || '').filter(Boolean).sort();
    const earliest = allDates[0] ?? '';
    if (earliest.startsWith(prefix)) {
      newCustomers++;
    } else {
      repeatCustomers++;
    }
  }

  // Top customers this month
  const custSpendMap = new Map<string, { spend: number; orders: number; name: string }>();
  for (const r of monthRows) {
    const name = r.namaInstagram || '—';
    const existing = custSpendMap.get(name) ?? { spend: 0, orders: 0, name };
    custSpendMap.set(name, {
      ...existing,
      spend: existing.spend + parseAmount(r.totalBayar),
      orders: existing.orders + 1,
    });
  }
  const topCustomers = [...custSpendMap.values()]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  // Top products
  const productMap = new Map<string, { count: number; revenue: number }>();
  for (const r of monthRows) {
    const product = r.jenis || r.type || 'Lainnya';
    const existing = productMap.get(product) ?? { count: 0, revenue: 0 };
    productMap.set(product, {
      count: existing.count + (parseInt(r.qty || '1', 10) || 1),
      revenue: existing.revenue + parseAmount(r.totalBayar),
    });
  }
  const topProducts = [...productMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Daily revenue
  const dailyMap = new Map<string, number>();
  for (const r of monthRows) {
    const date = (r.tanggalOrder || '').slice(0, 10);
    if (!date) continue;
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + parseAmount(r.totalBayar));
  }
  const dailyRevenue = [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, revenue]) => ({ date, revenue }));

  return { totalRevenue, totalOrders, newCustomers, repeatCustomers, topCustomers, topProducts, dailyRevenue };
}

export function printMonthlyReport(
  stats: MonthlyStats,
  year: number,
  month: number,
  storeName: string,
  storePhone: string,
  storeInstagram: string,
) {
  const INDO_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const monthLabel = `${INDO_MONTHS[month - 1]} ${year}`;
  const todayStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  const win = window.open('', '_blank', 'width=900,height=800');
  if (!win) { alert('Pop-up terblokir! Mohon izinkan pop-up untuk mencetak laporan.'); return; }

  win.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Laporan Bulanan ${monthLabel} - ${storeName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
    body { color:#0f172a; padding:40px; background:#fff; line-height:1.5; }
    .wrap { max-width:800px; margin:0 auto; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; border-bottom:2px solid #0f172a; margin-bottom:28px; }
    .store-name { font-size:22px; font-weight:900; text-transform:uppercase; }
    .store-contact { font-size:12px; color:#475569; margin-top:4px; }
    .report-label { text-align:right; }
    .report-title { font-size:18px; font-weight:800; text-transform:uppercase; }
    .report-period { font-size:13px; color:#7c3aed; font-weight:700; margin-top:4px; }
    .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:28px; }
    .stat-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; }
    .stat-box.green { border-color:#10b981; background:#f0fdf4; }
    .stat-box.purple { border-color:#7c3aed; background:#f5f3ff; }
    .stat-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:6px; }
    .stat-val { font-size:20px; font-weight:800; color:#0f172a; }
    .stat-val.green { color:#10b981; }
    .stat-val.purple { color:#7c3aed; }
    .section { margin-bottom:28px; }
    .section-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:14px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#f8fafc; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; padding:10px 12px; text-align:left; border-bottom:1.5px solid #0f172a; }
    td { padding:10px 12px; font-size:13px; border-bottom:1px solid #e2e8f0; color:#334155; }
    td.num { text-align:right; font-weight:700; color:#0f172a; }
    th.num { text-align:right; }
    .bar-track { height:8px; background:#e2e8f0; border-radius:4px; margin-top:4px; }
    .bar-fill { height:8px; background:linear-gradient(90deg,#7c3aed,#2563eb); border-radius:4px; }
    .footer { text-align:center; border-top:1px dashed #cbd5e1; padding-top:16px; font-size:11px; color:#94a3b8; margin-top:40px; }
    @media print { body{padding:0;} th{background:#f8fafc!important;-webkit-print-color-adjust:exact;} .stat-box{background:#f8fafc!important;-webkit-print-color-adjust:exact;} }
  </style></head><body><div class="wrap">
  <div class="header">
    <div><div class="store-name">${storeName}</div><div class="store-contact">WhatsApp: ${storePhone}${storeInstagram ? ` · @${storeInstagram}` : ''}</div></div>
    <div class="report-label"><div class="report-title">Laporan Bulanan</div><div class="report-period">${monthLabel}</div></div>
  </div>
  <div class="stats-row">
    <div class="stat-box green"><div class="stat-label">Total Omzet</div><div class="stat-val green">${formatRupiah(stats.totalRevenue)}</div></div>
    <div class="stat-box"><div class="stat-label">Total Order</div><div class="stat-val">${stats.totalOrders}</div></div>
    <div class="stat-box purple"><div class="stat-label">Pelanggan Baru</div><div class="stat-val purple">${stats.newCustomers}</div></div>
    <div class="stat-box"><div class="stat-label">Pelanggan Repeat</div><div class="stat-val">${stats.repeatCustomers}</div></div>
  </div>
  <div class="section"><div class="section-title">🏆 Top 5 Pelanggan</div>
    <table><thead><tr><th>No</th><th>Nama</th><th>Order</th><th class="num">Total Belanja</th></tr></thead><tbody>
    ${stats.topCustomers.map((c, i) => `<tr><td>${i+1}</td><td><strong>${c.name}</strong></td><td>${c.orders}x</td><td class="num">${formatRupiah(c.spend)}</td></tr>`).join('')}
    ${stats.topCustomers.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">Tidak ada data</td></tr>' : ''}
    </tbody></table>
  </div>
  <div class="section"><div class="section-title">📦 Top 5 Produk Terlaris</div>
    <table><thead><tr><th>No</th><th>Produk</th><th class="num">Qty Terjual</th><th class="num">Revenue</th></tr></thead><tbody>
    ${stats.topProducts.map((p, i) => `<tr><td>${i+1}</td><td><strong>${p.name}</strong></td><td class="num">${p.count}</td><td class="num">${formatRupiah(p.revenue)}</td></tr>`).join('')}
    ${stats.topProducts.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">Tidak ada data</td></tr>' : ''}
    </tbody></table>
  </div>
  <div class="footer"><div>Laporan ini dibuat otomatis oleh <strong>${storeName}</strong> CRM pada ${todayStr}</div></div>
  </div></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
