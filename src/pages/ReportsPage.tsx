// src/pages/ReportsPage.tsx
import { useMemo, useState, useEffect } from 'react';
import { FileText, Printer, TrendingUp, Users, ShoppingBag, Repeat } from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah } from '../utils/csvLoader';
import { computeMonthlyStats, printMonthlyReport } from '../utils/reportHelper';
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

  // Revenue trend: last 6 months
  const trendData = useMemo(() => {
    const result: { label: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
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
      <style>{`
        @media (max-width: 768px) {
          .reports-table-wrapper { display: none !important; }
          .reports-card-list { display: flex !important; flex-direction: column; gap: 12px; padding: 16px; }
        }
        @media (min-width: 769px) {
          .reports-card-list { display: none !important; }
          .reports-table-wrapper { display: block !important; }
        }
        .report-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .report-card-rank {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
          flex-shrink: 0;
        }
        .report-card-info {
          flex: 1;
          min-width: 0;
        }
        .report-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .report-card-stats {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .report-card-revenue {
          font-size: 14px;
          font-weight: 700;
          color: var(--accent-green);
        }
      `}</style>
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

      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card green">
          <div className="stat-icon green"><TrendingUp size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Total Omzet</div>
            <div className="stat-value">{formatRupiah(stats.totalRevenue)}</div>
            <div className="stat-sub">{INDO_MONTHS[month - 1]} {year}</div>
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon purple"><ShoppingBag size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Total Order</div>
            <div className="stat-value">{stats.totalOrders}</div>
            <div className="stat-sub">transaksi</div>
          </div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-icon cyan"><Users size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Pelanggan Baru</div>
            <div className="stat-value">{stats.newCustomers}</div>
            <div className="stat-sub">first-time buyer</div>
          </div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber"><Repeat size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Pelanggan Repeat</div>
            <div className="stat-value">{stats.repeatCustomers}</div>
            <div className="stat-sub">returning buyer</div>
          </div>
        </div>
      </div>

      {/* Revenue Trend + Top Lists */}
      <div className="charts-grid" style={{ marginBottom: 20 }}>
        {/* Trend Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">📈 Tren Omzet 6 Bulan Terakhir</div>
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
                    backgroundColor: trendData.map((_, i) => i === 5 ? '#7c3aedcc' : '#7c3aed44'),
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
              <div className="table-wrapper reports-table-wrapper">
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
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
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

              <div className="reports-card-list">
                {stats.topProducts.map((p, i) => {
                  const pct = stats.totalRevenue > 0 ? Math.round((p.revenue / stats.totalRevenue) * 100) : 0;
                  return (
                    <div key={p.name} className="report-card">
                      <div 
                        className="report-card-rank" 
                        style={{ 
                          background: i === 0 ? '#f59e0b22' : 'var(--bg-tertiary)', 
                          color: i === 0 ? '#f59e0b' : 'var(--text-muted)' 
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="report-card-info">
                        <div className="report-card-title">{p.name}</div>
                        <div className="report-card-stats">
                          {p.count} pcs terjual &bull; {pct}% kontribusi
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
                            <div style={{ width: `${pct}%`, height: 4, background: 'var(--gradient-brand)', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                      <div className="report-card-revenue">{formatRupiah(p.revenue)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
