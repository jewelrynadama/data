// src/pages/DashboardPage.tsx
import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Users, ShoppingBag, TrendingUp, Award, MapPin } from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah, formatInputNumber, cleanPrice, parseDateParts } from '../utils/csvLoader';
import type { BirthdayAlert } from '../utils/birthday';
import BirthdayBanner from '../components/BirthdayBanner';
import { getRevenueProjection } from '../utils/marketingEngine';

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement,
  Tooltip, Legend, Filler
);



interface Props {
  customers: Customer[];
  rows: CustomerRow[];
  birthdayAlerts: BirthdayAlert[];
  onSelectCustomer?: (c: Customer) => void;
  theme?: 'dark' | 'light';
  onSelectCity?: (city: string) => void;
  settings?: any;
}

type Period = 'today' | '7d' | '30d' | 'l3m' | 'l6m' | 'ytd' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hari Ini',
  '7d': '7 Hari',
  '30d': '30 Hari',
  l3m: '3 Bulan',
  l6m: '6 Bulan',
  ytd: 'Tahun Ini',
  all: 'Semua',
};

function getDateFrom(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case 'today': { const d = new Date(now); d.setHours(0,0,0,0); return d; }
    case '7d': return new Date(now.getTime() - 7*24*3600*1000);
    case '30d': return new Date(now.getTime() - 30*24*3600*1000);
    case 'l3m': return new Date(now.getTime() - 90*24*3600*1000);
    case 'l6m': return new Date(now.getTime() - 180*24*3600*1000);
    case 'ytd': return new Date(now.getFullYear(), 0, 1);
    default: return null;
  }
}

export default function DashboardPage({ customers, rows, birthdayAlerts, onSelectCustomer, theme = 'dark', onSelectCity, settings }: Props) {
  const [salesGoal, setSalesGoal] = useState(() => {
    const saved = localStorage.getItem('salesGoal');
    return saved ? parseInt(saved, 10) : 150000000;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [period, setPeriod] = useState<Period>('all');

  const handleSaveGoal = () => {
    const val = parseInt(goalInput.replace(/\D/g, '') || '0', 10);
    if (val > 0) {
      setSalesGoal(val);
      localStorage.setItem('salesGoal', val.toString());
    }
    setIsEditingGoal(false);
  };

  // ── Filtered rows based on selected period ──────────────────
  const filteredRows = useMemo(() => {
    const from = getDateFrom(period);
    if (!from) return rows;
    return rows.filter(r => {
      if (!r.tanggalOrder) return false;
      const parsed = parseDateParts(r.tanggalOrder);
      if (!parsed) return false;
      const d = new Date(parsed.year, parsed.month - 1, parsed.day || 1);
      return d >= from;
    });
  }, [rows, period]);

  // ── Filtered customers based on period (customers active in period) ──
  const filteredCustomers = useMemo(() => {
    if (period === 'all') return customers;
    const activeIds = new Set(filteredRows.map(r => r.namaInstagram));
    return customers.filter(c => activeIds.has(c.nama)); // wait, matching row.namaInstagram to customer.nama or instagram? Customer's 'nama' usually matches 'namaInstagram' in row. Let's check csvLoader.ts. Actually in PearlCRM, row.namaInstagram maps to customer.nama. Let's use c.nama
  }, [customers, filteredRows, period]);

  // ── Stats ──────────────────────────────────────────────────
  const chartOptions = useMemo(() => {
    const isLight = theme === 'light';
    const textColor = isLight ? '#0f172a' : '#ffffff';
    const gridColor = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.04)';
    const borderColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)';
    const tooltipBg = isLight ? '#ffffff' : '#16161f';
    const tooltipBorder = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: 'Inter', size: 12 }, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          titleColor: textColor,
          bodyColor: textColor,
          padding: 12,
          titleFont: { family: 'Inter', weight: 700 },
          bodyFont: { family: 'Inter' },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
          grid: { color: gridColor },
          border: { color: borderColor },
        },
        y: {
          ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
          grid: { color: gridColor },
          border: { color: borderColor },
        },
      },
    };
  }, [theme]);

  // ── Stats (all use filteredRows/filteredCustomers) ─────────
  const totalRevenue = useMemo(
    () => filteredRows.reduce((s, r) => s + (r.jenis ? (parseInt(r.totalBayar?.replace(/\D/g,'') || '0',10)) : 0), 0),
    [filteredRows]
  );

  const totalOrders = filteredRows.filter((r) => r.jenis).length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const currentMonthRevenue = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    return rows.reduce((sum, r) => {
      if (!r.tanggalOrder || !r.jenis) return sum;
      const parsed = parseDateParts(r.tanggalOrder);
      if (!parsed) return sum;
      
      if (parsed.month === currentMonth && parsed.year === currentYear) {
        const amt = cleanPrice(r.totalBayar);
        return sum + amt;
      }
      return sum;
    }, 0);
  }, [rows]);

  // ── Previous Month Revenue & Orders (for trend) ────────────
  const { prevMonthRevenue, prevMonthOrders, currentMonthOrders } = useMemo(() => {
    const today = new Date();
    const cm = today.getMonth() + 1;
    const cy = today.getFullYear();
    const pm = cm === 1 ? 12 : cm - 1;
    const py = cm === 1 ? cy - 1 : cy;

    let prevRev = 0, prevOrd = 0, curOrd = 0;
    for (const r of rows) {
      if (!r.tanggalOrder || !r.jenis) continue;
      const parsed = parseDateParts(r.tanggalOrder);
      if (!parsed) continue;
      const amt = cleanPrice(r.totalBayar);
      if (parsed.month === pm && parsed.year === py) { prevRev += amt; prevOrd++; }
      if (parsed.month === cm && parsed.year === cy) curOrd++;
    }
    return { prevMonthRevenue: prevRev, prevMonthOrders: prevOrd, currentMonthOrders: curOrd };
  }, [rows]);

  function trendBadge(current: number, previous: number) {
    if (previous === 0) return null;
    const pct = Math.round(((current - previous) / previous) * 100);
    const up = pct >= 0;
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 4,
        color: up ? '#10b981' : '#ef4444',
        background: up ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      }} title={`Bulan lalu: ${previous.toLocaleString('id-ID')}`}>
        {up ? '▲' : '▼'} {Math.abs(pct)}%
      </span>
    );
  }

  // ── Orders by Type ─────────────────────────────────────────
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRows) {
      if (r.jenis) map[r.jenis] = (map[r.jenis] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [filteredRows]);

  // ── Revenue by Pearl Type ──────────────────────────────────
  const byPearl = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRows) {
      const k = r.type || 'Unknown';
      const amt = cleanPrice(r.totalBayar);
      map[k] = (map[k] || 0) + amt;
    }
    return Object.entries(map)
      .filter(([k]) => k !== 'Unknown' && k !== '')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [filteredRows]);

  // ── Orders over time (by month) ────────────────────────────
  const byMonth = useMemo(() => {
    const map: Record<string, number> = {};
    const mapPrevYear: Record<string, number> = {};
    const curYear = new Date().getFullYear();
    for (const r of rows) { // always use ALL rows for time chart
      if (!r.tanggalOrder || !r.jenis) continue;
      const parsed = parseDateParts(r.tanggalOrder);
      if (!parsed) continue;
      const month = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      map[month] = (map[month] || 0) + 1;
      // For YoY: store previous year's data mapped to current year month
      if (parsed.year === curYear - 1) {
        const curYearKey = `${curYear}-${String(parsed.month).padStart(2, '0')}`;
        mapPrevYear[curYearKey] = (mapPrevYear[curYearKey] || 0) + 1;
      }
    }
    const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
    return { sorted, prevYear: mapPrevYear };
  }, [rows]);

  // ── Top Cities ─────────────────────────────────────────────
  const byCityData = useMemo(() => {
    const src = period === 'all' ? customers : filteredCustomers;
    const map: Record<string, number> = {};
    for (const c of src) {
      if (c.city && c.city !== '—') map[c.city] = (map[c.city] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [customers, filteredCustomers, period]);

  // ── Payment split ──────────────────────────────────────────
  const byPayment = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRows) {
      if (r.paymentVia) map[r.paymentVia] = (map[r.paymentVia] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredRows]);

  const pieColors = ['#7c3aed', '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  // ── Revenue Prediction (Linear Regression) ─────────────────
  const revenueForecast = useMemo(() => {
    // Get last 6 months revenue
    const monthMap = new Map<string, number>();
    for (const r of rows) {
      if (!r.tanggalOrder || !r.jenis) continue;
      const parsed = parseDateParts(r.tanggalOrder);
      if (!parsed) continue;
      const key = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + cleanPrice(r.totalBayar));
    }
    const sorted = [...monthMap.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(-6);
    if (sorted.length < 2) return null;

    // Simple linear regression
    const n = sorted.length;
    const xs = sorted.map((_,i) => i);
    const ys = sorted.map(([,v]) => v);
    const sumX = xs.reduce((a,b)=>a+b,0);
    const sumY = ys.reduce((a,b)=>a+b,0);
    const sumXY = xs.reduce((s,x,i)=>s+x*ys[i],0);
    const sumX2 = xs.reduce((s,x)=>s+x*x,0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
    const intercept = (sumY - slope*sumX) / n;

    // Project next 3 months
    const lastKey = sorted[sorted.length-1][0];
    const [lastYear, lastMonth] = lastKey.split('-').map(Number);
    const INDO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    const projections = [1,2,3].map((offset) => {
      let m = lastMonth + offset;
      let y = lastYear;
      if (m > 12) { m -= 12; y++; }
      const projected = Math.max(0, Math.round(intercept + slope * (n - 1 + offset)));
      return { label: `${INDO[m-1]} ${y}`, value: projected };
    });

    return {
      historicalLabels: sorted.map(([k]) => { const [y,m] = k.split('-'); return `${INDO[parseInt(m,10)-1]} ${y}`; }),
      historicalValues: sorted.map(([,v]) => v),
      projectionLabels: projections.map(p => p.label),
      projectionValues: projections.map(p => p.value),
      trend: slope > 0 ? 'naik' : slope < 0 ? 'turun' : 'stabil',
      slopeRupiah: slope,
    };
  }, [rows]);

  return (
    <div className="page-body">
      {/* Birthday Alerts */}
      <BirthdayBanner alerts={birthdayAlerts} settings={settings} onSelectCustomer={onSelectCustomer} />

      {/* ── Global Period Filter Bar ────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginRight: 4 }}>📅 Periode:</span>
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: period === p ? 700 : 500,
              background: period === p ? 'var(--accent-purple)' : 'var(--bg-card)',
              color: period === p ? '#fff' : 'var(--text-secondary)',
              boxShadow: period === p ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {period !== 'all' && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
            → {filteredRows.filter(r => r.jenis).length} order · {filteredCustomers.length} customer aktif
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon purple"><Users size={20} /></div>
          <div className="stat-info">
            <div className="stat-label">{period === 'all' ? 'Total Customers' : 'Customer Aktif'}</div>
            <div className="stat-value">{period === 'all' ? customers.length : filteredCustomers.length}</div>
            <div className="stat-sub">{period === 'all' ? 'Unique accounts' : `dari ${customers.length} total`}</div>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><ShoppingBag size={20} /></div>
          <div className="stat-info">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center' }}>
              {totalOrders}
              {trendBadge(currentMonthOrders, prevMonthOrders)}
            </div>
            <div className="stat-sub">Product items · bulan ini: {currentMonthOrders}</div>
          </div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber"><TrendingUp size={20} /></div>
          <div className="stat-info">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center' }}>
              {formatRupiah(totalRevenue)}
              {trendBadge(currentMonthRevenue, prevMonthRevenue)}
            </div>
            <div className="stat-sub">Bulan ini: {formatRupiah(currentMonthRevenue)}</div>
          </div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-icon cyan"><Award size={20} /></div>
          <div className="stat-info">
            <div className="stat-label">Avg Order Value</div>
            <div className="stat-value">{formatRupiah(avgOrder)}</div>
            <div className="stat-sub">Per transaction</div>
          </div>
        </div>
        <div className="stat-card pink">
          <div className="stat-icon pink"><TrendingUp size={20} /></div>
          <div className="stat-info">
            <div className="stat-label">Sales Goal (Bulan Ini)</div>
            <div className="stat-value">{formatRupiah(currentMonthRevenue)}</div>
            <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              <span>Target:</span>
              {isEditingGoal ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11 }}>Rp</span>
                  <input
                    type="text"
                    value={formatInputNumber(goalInput)}
                    onChange={(e) => setGoalInput(formatInputNumber(e.target.value))}
                    onBlur={handleSaveGoal}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveGoal();
                      if (e.key === 'Escape') setIsEditingGoal(false);
                    }}
                    style={{
                      width: 90, background: 'var(--bg-card-hover)',
                      border: '1px solid #1877F2', borderRadius: 4,
                      color: 'var(--text-primary)', fontSize: 11, padding: '2px 6px', outline: 'none',
                      boxShadow: '0 0 0 2px rgba(24,119,242,0.2)'
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <span
                  onClick={() => { setGoalInput(formatInputNumber(salesGoal.toString())); setIsEditingGoal(true); }}
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                  title="Klik untuk mengubah target omzet"
                >
                  Rp {salesGoal.toLocaleString('id-ID')}
                  <span style={{ fontSize: 10 }}>✏️</span>
                </span>
              )}
            </div>

            {/* Enhanced Progress bar with color milestones */}
            {(() => {
              const pct = Math.min(100, (currentMonthRevenue / salesGoal) * 100);
              const proj = getRevenueProjection(currentMonthRevenue, salesGoal);
              const barColor =
                pct >= 100 ? 'linear-gradient(90deg,#7c3aed,#4f46e5)' :
                pct >= 75  ? 'linear-gradient(90deg,#059669,#10b981)' :
                pct >= 50  ? 'linear-gradient(90deg,#d97706,#f59e0b)' :
                pct >= 25  ? 'linear-gradient(90deg,#2563eb,#06b6d4)' :
                             'linear-gradient(90deg,#475569,#64748b)';
              const glowColor =
                pct >= 100 ? 'rgba(124,58,237,0.4)' :
                pct >= 75  ? 'rgba(16,185,129,0.35)' :
                pct >= 50  ? 'rgba(245,158,11,0.35)' :
                             'rgba(37,99,235,0.25)';
              return (
                <div style={{ width: '100%', marginTop: 10 }}>
                  {/* Percentage + milestone markers */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>
                    <span>Pencapaian</span>
                    <span style={{ fontWeight: 700, color: pct >= 100 ? '#a78bfa' : pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : 'var(--accent-pink)' }}>
                      {Math.round(pct)}%
                    </span>
                  </div>
                  {/* Progress track */}
                  <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
                    {/* Milestone ticks */}
                    {[25, 50, 75].map((m) => (
                      <div key={m} style={{ position: 'absolute', top: 0, bottom: 0, left: `${m}%`, width: 1, background: 'rgba(255,255,255,0.12)', zIndex: 1 }} />
                    ))}
                    <div style={{ height: '100%', background: barColor, width: `${pct}%`, borderRadius: 99, boxShadow: `0 0 8px ${glowColor}`, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)', position: 'relative', zIndex: 2 }} />
                  </div>
                  {/* Projection info */}
                  <div style={{ marginTop: 7, fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span>Avg harian: <strong style={{ color: 'var(--text-secondary)' }}>{formatRupiah(Math.round(proj.dailyAvg))}</strong></span>
                    {proj.projectedDate && (
                      <span>
                        {currentMonthRevenue >= salesGoal
                          ? <span style={{ color: '#10b981', fontWeight: 700 }}>🎉 Target sudah tercapai!</span>
                          : <span>Proyeksi tercapai: <strong style={{ color: proj.isAtRisk ? '#ef4444' : '#a78bfa' }}>{proj.projectedDate}</strong></span>
                        }
                      </span>
                    )}
                    {proj.isAtRisk && currentMonthRevenue < salesGoal && (
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠️ Hanya {proj.daysRemaining} hari lagi — perlu akselerasi!</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="charts-grid">
        {/* Orders over time */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Orders Over Time</div>
              <div className="card-subtitle">Monthly order volume · garis abu = tahun lalu (YoY)</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 220 }}>
              <Line
                data={{
                  labels: byMonth.sorted.map(([m]) => m),
                  datasets: [
                    {
                      label: 'Tahun Ini',
                      data: byMonth.sorted.map(([, v]) => v),
                      borderColor: '#7c3aed',
                      backgroundColor: 'rgba(124,58,237,0.12)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 4,
                      pointBackgroundColor: '#7c3aed',
                    },
                    {
                      label: 'Tahun Lalu',
                      data: byMonth.sorted.map(([k]) => byMonth.prevYear[k] || 0),
                      borderColor: 'rgba(150,150,150,0.5)',
                      backgroundColor: 'transparent',
                      fill: false,
                      tension: 0.4,
                      pointRadius: 3,
                      borderDash: [4, 3],
                      pointBackgroundColor: 'rgba(150,150,150,0.5)',
                    },
                  ],
                }}
                options={chartOptions as any}
              />
            </div>
          </div>
        </div>

        {/* Payment Split */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Payment Channels</div>
              <div className="card-subtitle">Distribution</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Doughnut
                data={{
                  labels: byPayment.map(([k]) => k),
                  datasets: [
                    {
                      data: byPayment.map(([, v]) => v),
                      backgroundColor: pieColors.slice(0, byPayment.length),
                      borderColor: theme === 'light' ? '#ffffff' : '#111118',
                      borderWidth: 3,
                      hoverOffset: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '65%',
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: { color: theme === 'light' ? '#334155' : '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 12 },
                    },
                    tooltip: (chartOptions.plugins.tooltip as any),
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="charts-grid" style={{ marginBottom: 20 }}>
        {/* Orders by jewellery type */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Orders by Jewellery Type</div>
              <div className="card-subtitle">Volume per category</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 220 }}>
              <Bar
                data={{
                  labels: byType.map(([k]) => k),
                  datasets: [
                    {
                      label: 'Orders',
                      data: byType.map(([, v]) => v),
                      backgroundColor: byType.map((_, i) => pieColors[i % pieColors.length] + 'cc'),
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } } as any}
              />
            </div>
          </div>
        </div>

        {/* Top Cities */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top Cities</div>
              <div className="card-subtitle">Customers by location</div>
            </div>
          </div>
          <div className="card-body">
            <div className="top-list">
              {byCityData.map(([city, count], i) => {
                const pct = Math.round((count / customers.length) * 100);
                return (
                  <div
                    key={city}
                    className="top-list-item"
                    style={{ cursor: onSelectCity ? 'pointer' : 'default' }}
                    onClick={() => onSelectCity && onSelectCity(city)}
                    title={onSelectCity ? `Klik untuk melihat customer di ${city}` : undefined}
                  >
                    <div className="top-list-rank">{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--text-accent)', fontWeight: 600 }}>
                          <MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />{city}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Top Customers by Revenue</div>
            <div className="card-subtitle">Highest lifetime value</div>
          </div>
        </div>
        <div className="card-body">
          {/* Desktop: table */}
          <div className="dash-top-table" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th><div className="th-inner">Rank</div></th>
                  <th><div className="th-inner">Customer</div></th>
                  <th><div className="th-inner">City</div></th>
                  <th><div className="th-inner">Orders</div></th>
                  <th><div className="th-inner">Total Spend</div></th>
                  <th><div className="th-inner">Avg Order</div></th>
                </tr>
              </thead>
              <tbody>
                {[...customers]
                  .sort((a, b) => b.totalSpend - a.totalSpend)
                  .slice(0, 10)
                  .map((c, i) => (
                    <tr key={c.id}>
                      <td>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: i < 3 ? 'var(--gradient-brand)' : 'var(--bg-card)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: i < 3 ? 'white' : 'var(--text-muted)'
                        }}>{i + 1}</span>
                      </td>
                      <td className="td-name">
                        <span
                          style={{ cursor: 'pointer', color: 'var(--text-accent)' }}
                          onClick={() => onSelectCustomer && onSelectCustomer(c)}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {c.nama}
                        </span>
                      </td>
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                          if (c.city && c.city !== '—' && onSelectCity) {
                            onSelectCity(c.city);
                          }
                        }}
                        style={{
                          color: (c.city && c.city !== '—' && onSelectCity) ? 'var(--text-accent)' : 'inherit',
                          cursor: (c.city && c.city !== '—' && onSelectCity) ? 'pointer' : 'default',
                          fontWeight: (c.city && c.city !== '—' && onSelectCity) ? 600 : 'normal'
                        }}
                        onMouseEnter={(e) => {
                          if (c.city && c.city !== '—' && onSelectCity) {
                            e.currentTarget.style.textDecoration = 'underline';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                        title={(c.city && c.city !== '—' && onSelectCity) ? `Klik untuk melihat customer di ${c.city}` : undefined}
                      >
                        {c.city}
                      </td>
                      <td>{c.orderCount}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatRupiah(c.totalSpend)}</td>
                      <td>{formatRupiah(c.orderCount > 0 ? c.totalSpend / c.orderCount : 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: compact ranked cards */}
          <div className="dash-top-cards">
            {[...customers]
              .sort((a, b) => b.totalSpend - a.totalSpend)
              .slice(0, 10)
              .map((c, i) => (
                <div
                  key={c.id}
                  className="dash-top-row"
                  onClick={() => onSelectCustomer && onSelectCustomer(c)}
                >
                  <div className="dash-top-rank" style={{
                    background: i < 3 ? 'var(--gradient-brand)' : 'var(--bg-card)',
                    color: i < 3 ? 'white' : 'var(--text-muted)',
                    border: i >= 3 ? '1px solid var(--border)' : 'none',
                  }}>
                    {i + 1}
                  </div>
                  <div className="dash-top-info">
                    <div className="dash-top-name">{c.nama}</div>
                    <div className="dash-top-meta">
                      {c.city && c.city !== '—' ? `📍 ${c.city}  ·  ` : ''}{c.orderCount} orders
                    </div>
                  </div>
                  <div className="dash-top-spend">{formatRupiah(c.totalSpend)}</div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Pearl Type Revenue */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Revenue by Pearl Type</div>
            <div className="card-subtitle">Total IDR per pearl category</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ height: 220 }}>
            <Bar
              data={{
                labels: byPearl.map(([k]) => k),
                datasets: [
                  {
                    label: 'Revenue (IDR)',
                    data: byPearl.map(([, v]) => v),
                    backgroundColor: ['#7c3aed88', '#06b6d488', '#10b98188', '#f59e0b88', '#ec489988', '#4f46e588'],
                    borderColor: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#4f46e5'],
                    borderWidth: 1.5,
                    borderRadius: 6,
                  },
                ],
              }}
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  legend: { display: false },
                  tooltip: {
                    ...chartOptions.plugins.tooltip,
                    callbacks: {
                      label: (ctx: any) => ' ' + formatRupiah(ctx.raw as number),
                    },
                  },
                },
              } as any}
            />
          </div>
        </div>
      </div>

      {/* Revenue Forecast */}
      {revenueForecast && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">📈 Prediksi Omzet</div>
              <div className="card-subtitle">
                Proyeksi 3 bulan ke depan · Tren:{' '}
                <strong style={{ color: revenueForecast.trend === 'naik' ? '#10b981' : revenueForecast.trend === 'turun' ? '#ef4444' : '#f59e0b' }}>
                  {revenueForecast.trend === 'naik' ? '▲ Naik' : revenueForecast.trend === 'turun' ? '▼ Turun' : '→ Stabil'}
                </strong>
                {Math.abs(revenueForecast.slopeRupiah) > 1000 && (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                    {' '}(±{formatRupiah(Math.abs(Math.round(revenueForecast.slopeRupiah)))} /bulan)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 220 }}>
              <Bar
                data={{
                  labels: [...revenueForecast.historicalLabels, ...revenueForecast.projectionLabels],
                  datasets: [
                    {
                      label: 'Aktual',
                      data: [...revenueForecast.historicalValues, ...revenueForecast.projectionValues.map(() => null)],
                      backgroundColor: '#7c3aed99',
                      borderColor: '#7c3aed',
                      borderWidth: 1.5,
                      borderRadius: 6,
                    },
                    {
                      label: 'Proyeksi',
                      data: [...revenueForecast.historicalValues.map(() => null), ...revenueForecast.projectionValues],
                      backgroundColor: '#10b98155',
                      borderColor: '#10b981',
                      borderWidth: 1.5,
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                      ...chartOptions.plugins.tooltip,
                      callbacks: { label: (ctx: any) => ctx.raw != null ? ' ' + formatRupiah(ctx.raw) : '' },
                    },
                  },
                  scales: {
                    ...chartOptions.scales,
                    y: {
                      ...chartOptions.scales.y,
                      ticks: {
                        ...chartOptions.scales.y.ticks,
                        callback: (v: any) => 'Rp ' + (v / 1000000).toFixed(0) + 'jt',
                      },
                    },
                  },
                } as any}
              />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
              {revenueForecast.projectionLabels.map((label, i) => (
                <div key={label} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Proyeksi {label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{formatRupiah(revenueForecast.projectionValues[i])}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
