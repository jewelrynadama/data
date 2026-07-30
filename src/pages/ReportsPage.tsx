// src/pages/ReportsPage.tsx
import { useMemo, useState, useEffect } from 'react';
import { FileText, Printer, TrendingUp, Users, ShoppingBag, Repeat } from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah } from '../utils/csvLoader';
import { computeMonthlyStats, printMonthlyReport, computeAllTimeInsights } from '../utils/reportHelper';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
  settings?: any;
}

const INDO_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function ReportsPage({ customers, rows, settings }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    const handleSetYear = (e: any) => {
      if (e.detail) {
        setYear(e.detail);
      }
    };
    window.addEventListener('AI_SET_YEAR', handleSetYear);
    return () => window.removeEventListener('AI_SET_YEAR', handleSetYear);
  }, []);

  const stats = useMemo(() => computeMonthlyStats(customers, rows, year, month), [customers, rows, year, month]);
  const allTime = useMemo(() => computeAllTimeInsights(rows), [rows]);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const prevMonthStats = useMemo(() => computeMonthlyStats(customers, rows, prevMonthYear, prevMonth), [customers, rows, prevMonthYear, prevMonth]);
  const prevYearStats = useMemo(() => computeMonthlyStats(customers, rows, year - 1, month), [customers, rows, year, month]);

  const cleanPrice = (val: string | number) => typeof val === 'string' ? parseInt(val.replace(/[^\d]/g, ''), 10) || 0 : val || 0;

  const getProductTrend = (productName: string) => {
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      let dYear = year;
      let dMonth = month - i;
      if (dMonth <= 0) {
        dMonth += 12;
        dYear -= 1;
      }
      let rev = 0;
      for (const r of rows) {
        if (r.type === productName) {
          const match = r.tanggalOrder?.match(/^(\d{4})-(\d{2})/);
          if (match && parseInt(match[1]) === dYear && parseInt(match[2]) === dMonth) {
            rev += cleanPrice(r.totalBayar);
          }
        }
      }
      trend.push(rev);
    }
    return trend;
  };

  const renderSparkline = (trend: number[]) => {
    const max = Math.max(...trend) || 1;
    return (
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 20, marginTop: 4 }}>
        {trend.map((val, i) => {
          const h = Math.max((val / max) * 100, 10);
          const isCurrent = i === trend.length - 1;
          const color = isCurrent ? 'var(--accent-purple)' : (val === 0 ? 'var(--bg-tertiary)' : (i > 0 && val >= trend[i-1] ? '#10b981' : '#ef4444'));
          return <div key={i} style={{ width: 6, height: `${h}%`, background: color, borderRadius: 2 }} title={`Bulan -${5-i}: Rp ${val}`} />
        })}
      </div>
    );
  };

  const renderDelta = (current: number, prev: number, prevY: number, isCurrency = false) => {
    const renderOne = (curr: number, pr: number, label: string) => {
      if (pr === 0) return null;
      const pct = ((curr - pr) / pr) * 100;
      const abs = curr - pr;
      const isPos = pct > 0;
      const color = isPos ? '#10b981' : '#ef4444';
      const icon = isPos ? '▲' : '▼';
      
      let absStr = '';
      if (isCurrency) {
        absStr = `(${isPos ? '+' : ''}Rp ${(Math.abs(abs)/1000000).toFixed(1)}jt)`;
      } else {
        absStr = `(${isPos ? '+' : ''}${Math.abs(abs)})`;
      }
      return (
        <div style={{ fontSize: 11, fontWeight: 600, color, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span>{icon} {Math.abs(pct).toFixed(1)}%</span>
          <span style={{ color: 'var(--text-muted)' }}>{absStr} {label}</span>
        </div>
      );
    };

    return (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {renderOne(current, prev, 'vs Bln Lalu')}
        {renderOne(current, prevY, 'vs Thn Lalu')}
      </div>
    );
  };

  const generateNarrative = () => {
    if (prevMonthStats.totalRevenue === 0 && stats.totalRevenue === 0) return "Belum ada data transaksi yang cukup untuk bulan ini.";
    
    const revPct = prevMonthStats.totalRevenue ? ((stats.totalRevenue - prevMonthStats.totalRevenue) / prevMonthStats.totalRevenue) * 100 : 100;
    const revDir = revPct >= 0 ? 'naik' : 'turun';
    
    const topProd = stats.topProducts[0];
    const prodPct = topProd && stats.totalRevenue > 0 ? ((topProd.revenue / stats.totalRevenue) * 100).toFixed(0) : 0;
    const prodStr = topProd ? `Produk ${topProd.name} mendominasi ${prodPct}% penjualan.` : '';

    const newCustPct = prevMonthStats.newCustomers ? ((stats.newCustomers - prevMonthStats.newCustomers) / prevMonthStats.newCustomers) * 100 : (stats.newCustomers > 0 ? 100 : 0);
    const newCustDir = newCustPct >= 0 ? 'naik' : 'turun';
    const advice = newCustPct < 0 ? 'pertimbangkan kampanye akuisisi.' : 'pertahankan momentum akuisisi yang baik.';

    return `Bulan ${INDO_MONTHS[month - 1]} ${year} mencatat revenue ${formatRupiah(stats.totalRevenue)}, ${revDir} ${Math.abs(revPct).toFixed(0)}% vs bulan lalu. ${prodStr} Pelanggan baru ${newCustDir} ${Math.abs(newCustPct).toFixed(0)}% — ${advice}`;
  };

  const formatPeriod = (p: string) => {
    if (!p) return '';
    const [y, m] = p.split('-');
    return `${INDO_MONTHS[parseInt(m, 10) - 1]} ${y}`;
  };

  // Revenue trend: last 12 months
  const trendData = useMemo(() => {
    const result: { label: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const s = computeMonthlyStats(customers, rows, y, m);
      result.push({ label: `${INDO_MONTHS[m - 1].slice(0, 3)} ${y}`, revenue: s.totalRevenue });
    }
    return result;
  }, [customers, rows, year, month]);

  const storeName = settings?.storeName || 'Pearl Store';
  const storePhone = settings?.storePhone || '';
  const storeInstagram = settings?.storeInstagram || '';

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="page-body">
      {/* Header & Controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <FileText size={18} color="var(--accent-purple)" />
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>Pilih Periode Laporan</span>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="filter-select">
            {INDO_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="filter-select">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-primary"
            onClick={() => printMonthlyReport(stats, year, month, storeName, storePhone, storeInstagram)}
            style={{ gap: 8 }}
          >
            <Printer size={14} /> Cetak Laporan PDF
          </button>
        </div>
      </div>

      {/* Auto Narrative Summary */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(124, 58, 237, 0.02))', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
            <TrendingUp size={16} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>📊 Ringkasan Otomatis</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {generateNarrative()}
            </div>
          </div>
        </div>
      </div>

      {/* All-Time Insights */}
      {(allTime.bestMonth || allTime.worstMonth) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
          {allTime.bestMonth && (
            <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.02))', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏆 Bulan Terbaik Sepanjang Waktu</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                  {formatPeriod(allTime.bestMonth.period)} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>({formatRupiah(allTime.bestMonth.revenue)})</span>
                </div>
              </div>
            </div>
          )}
          {allTime.worstMonth && (
            <div style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02))', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingUp size={22} style={{ transform: 'scaleY(-1)' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠️ Bulan yang Perlu Dibenahi</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                  {formatPeriod(allTime.worstMonth.period)} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>({formatRupiah(allTime.worstMonth.revenue)})</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card green">
          <div className="stat-icon green"><TrendingUp size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Total Omzet</div>
            <div className="stat-value">{formatRupiah(stats.totalRevenue)}</div>
            <div className="stat-sub">{INDO_MONTHS[month - 1]} {year}</div>
            {renderDelta(stats.totalRevenue, prevMonthStats.totalRevenue, prevYearStats.totalRevenue, true)}
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)' }}>
          <div className="stat-icon" style={{ background: '#f59e0b', color: '#fff' }}><ShoppingBag size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Average Order Value (AOV)</div>
            <div className="stat-value">{formatRupiah(stats.aov)}</div>
            <div className="stat-sub">per transaksi</div>
            {renderDelta(stats.aov, prevMonthStats.aov, prevYearStats.aov, true)}
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon purple"><ShoppingBag size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Total Order</div>
            <div className="stat-value">{stats.totalOrders}</div>
            <div className="stat-sub">transaksi</div>
            {renderDelta(stats.totalOrders, prevMonthStats.totalOrders, prevYearStats.totalOrders)}
          </div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-icon cyan"><Users size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Pelanggan Baru</div>
            <div className="stat-value">{stats.newCustomers}</div>
            <div className="stat-sub">first-time buyer</div>
            {renderDelta(stats.newCustomers, prevMonthStats.newCustomers, prevYearStats.newCustomers)}
          </div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber"><Repeat size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Pelanggan Repeat</div>
            <div className="stat-value">{stats.repeatCustomers}</div>
            <div className="stat-sub">returning buyer</div>
            {renderDelta(stats.repeatCustomers, prevMonthStats.repeatCustomers, prevYearStats.repeatCustomers)}
          </div>
        </div>
      </div>

      {/* Revenue Trend + Top Lists */}
      <div className="charts-grid" style={{ marginBottom: 20 }}>
        {/* Trend Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">📈 Tren Omzet 1 Tahun Terakhir</div>
              <div className="card-subtitle">Revenue bulanan historis</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 200 }}>
              <Bar
                data={{
                  labels: trendData.map((d) => d.label),
                  datasets: [{
                    label: 'Omzet',
                    data: trendData.map((d) => d.revenue),
                    backgroundColor: trendData.map((_, i) => i === 11 ? '#7c3aedcc' : '#7c3aed44'),
                    borderColor: '#7c3aed',
                    borderWidth: 1.5,
                    borderRadius: 6,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => ' ' + formatRupiah(ctx.raw) } } },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 }, callback: (v: any) => 'Rp ' + (v / 1000000).toFixed(0) + 'jt' } },
                  },
                } as any}
              />
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🏆 Top Pelanggan Bulan Ini</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {stats.topCustomers.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data</div>
            ) : stats.topCustomers.map((c, i) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: i === 0 ? '#f59e0b22' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: i === 0 ? '#f59e0b' : 'var(--text-muted)', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.orders} order</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', flexShrink: 0 }}>{formatRupiah(c.spend)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📦 Top Produk Terlaris Bulan Ini</div>
          <div className="card-subtitle">{INDO_MONTHS[month - 1]} {year}</div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {stats.topProducts.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data untuk bulan ini</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Produk</th>
                      <th>Qty Terjual</th>
                      <th>Revenue</th>
                      <th>Kontribusi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topProducts.map((p, i) => {
                      const pct = stats.totalRevenue > 0 ? Math.round((p.revenue / stats.totalRevenue) * 100) : 0;
                      return (
                        <tr key={p.name}>
                          <td style={{ fontWeight: 700, color: i === 0 ? '#f59e0b' : 'var(--text-muted)' }}>{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>
                            {p.name}
                            {renderSparkline(getProductTrend(p.name))}
                          </td>
                          <td>{p.count} pcs</td>
                          <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatRupiah(p.revenue)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                                <div style={{ width: `${pct}%`, height: 6, background: 'var(--gradient-brand)', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mobile-card-list">
                {stats.topProducts.map((p, i) => {
                  const pct = stats.totalRevenue > 0 ? Math.round((p.revenue / stats.totalRevenue) * 100) : 0;
                  return (
                    <div key={p.name} className="inv-card">
                      <div className="inv-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: '50%', display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
                            background: i === 0 ? '#f59e0b22' : 'var(--bg-input)',
                            color: i === 0 ? '#f59e0b' : 'var(--text-muted)',
                          }}>{i+1}</span>
                          <div>
                            <div className="inv-card-title">{p.name}</div>
                            {renderSparkline(getProductTrend(p.name))}
                          </div>
                        </div>
                        <div className="inv-badge inv-badge-blue">{p.count} Pcs</div>
                      </div>
                      <div className="inv-card-body">
                        <div className="inv-detail-row"><span>Revenue:</span><span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatRupiah(p.revenue)}</span></div>
                        <div className="inv-detail-row">
                          <span>Kontribusi ({pct}%):</span>
                          <div style={{ flex: 1, marginLeft: 10, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                            <div style={{ width: `${pct}%`, height: 6, background: 'var(--gradient-brand)', borderRadius: 3 }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top Categories and Payments */}
      <div className="charts-grid" style={{ marginBottom: 20, marginTop: 20 }}>
        {/* Top Categories */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🏷️ Distribusi Kategori</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {stats.topCategories.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data</div>
            ) : stats.topCategories.map(c => {
              const pct = stats.totalRevenue > 0 ? Math.round((c.revenue / stats.totalRevenue) * 100) : 0;
              return (
                <div key={c.name} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>{formatRupiah(c.revenue)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: 6, background: 'var(--accent-purple)', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28 }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Payments */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">💳 Metode Pembayaran Populer</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {stats.topPayments.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data</div>
            ) : stats.topPayments.map((p, i) => {
              const pct = stats.totalOrders > 0 ? Math.round((p.count / stats.totalOrders) * 100) : 0;
              return (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '6px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>
                    #{i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
                          <div style={{ width: `${pct}%`, height: 4, background: '#10b981', borderRadius: 2 }} />
                        </div>
                        {p.count} transaksi ({pct}%)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
