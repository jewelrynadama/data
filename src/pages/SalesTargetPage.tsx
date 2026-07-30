// src/pages/SalesTargetPage.tsx
import { useState, useMemo } from 'react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah } from '../utils/csvLoader';
import { Target, TrendingUp, Users, ShoppingBag, Calendar, Award, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
  theme?: 'dark' | 'light';
}

interface SalesTarget {
  revenue: number;
  orders: number;
  newCustomers: number;
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

const DEFAULT_TARGET: SalesTarget = { revenue: 50000000, orders: 30, newCustomers: 10 };

export default function SalesTargetPage({ customers, rows, theme }: Props) {
  const isLight = theme === 'light';
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const savedRaw = localStorage.getItem('pearlcrm_sales_target');
  const savedTarget: SalesTarget = savedRaw ? JSON.parse(savedRaw) : DEFAULT_TARGET;
  const [target, setTarget] = useState<SalesTarget>(savedTarget);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysPassed = now.getDate();
  const daysRemaining = daysInMonth - daysPassed;

  // Calculate actuals for current month
  const monthActuals = useMemo(() => {
    const orderRows = rows.filter((r) => {
      if (!r.jenis) return false;
      const d = parseDate(r.tanggalOrder);
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const revenue = orderRows.reduce((s, r) => {
      const val = parseInt(String(r.totalBayar).replace(/\D/g, ''), 10);
      return s + (isNaN(val) ? 0 : val);
    }, 0);
    const orders = orderRows.length;

    // New customers = customers whose first order is this month
    const newCusts = customers.filter((c) => {
      if (!c.orders || c.orders.length === 0) return false;
      const dates = c.orders.map((o) => parseDate(o.tanggalOrder)).filter(Boolean) as Date[];
      if (dates.length === 0) return false;
      const first = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
      return first.getMonth() === currentMonth && first.getFullYear() === currentYear;
    }).length;

    return { revenue, orders, newCustomers: newCusts };
  }, [rows, customers, currentMonth, currentYear]);

  function saveTarget(t: SalesTarget) {
    setTarget(t);
    localStorage.setItem('pearlcrm_sales_target', JSON.stringify(t));
    setEditing(false);

    const historyKey = 'pearlcrm_target_history';
    const historyRaw = localStorage.getItem(historyKey);
    const history = historyRaw ? JSON.parse(historyRaw) : {};
    
    const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    history[monthKey] = {
      revenue: t.revenue,
      orders: t.orders,
      newCustomers: t.newCustomers,
      actualRevenue: monthActuals.revenue,
      actualOrders: monthActuals.orders,
      actualNewCustomers: monthActuals.newCustomers
    };
    localStorage.setItem(historyKey, JSON.stringify(history));
  }



  // Monthly history (last 6 months)
  const monthHistory = useMemo(() => {
    const historyKey = 'pearlcrm_target_history';
    const historyStoreRaw = localStorage.getItem(historyKey);
    const historyStore = historyStoreRaw ? JSON.parse(historyStoreRaw) : {};

    const history: { label: string; revenue: number; orders: number; newCusts: number; targetRevenue: number | null; targetOrders: number | null }[] = [];
    for (let offset = 1; offset <= 6; offset++) {
      const d = new Date(currentYear, currentMonth - offset, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = d.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      
      const mOrders = rows.filter((r) => {
        if (!r.jenis) return false;
        const pd = parseDate(r.tanggalOrder);
        return pd && pd.getMonth() === m && pd.getFullYear() === y;
      });
      const rev = mOrders.reduce((s, r) => {
        const val = parseInt(String(r.totalBayar).replace(/\D/g, ''), 10);
        return s + (isNaN(val) ? 0 : val);
      }, 0);
      
      const stored = historyStore[monthKey];
      
      history.push({ 
        label, 
        revenue: rev, 
        orders: mOrders.length, 
        newCusts: 0,
        targetRevenue: stored ? stored.revenue : null,
        targetOrders: stored ? stored.orders : null
      });
    }
    return history.reverse();
  }, [rows, currentMonth, currentYear]);

  const metrics = [
    {
      label: 'Revenue',
      icon: TrendingUp,
      color: '#42B72A',
      bg: 'rgba(66,183,42,0.1)',
      actual: monthActuals.revenue,
      target: target.revenue,
      format: (v: number) => formatRupiah(v),
    },
    {
      label: 'Orders',
      icon: ShoppingBag,
      color: '#1877F2',
      bg: 'rgba(24,119,242,0.1)',
      actual: monthActuals.orders,
      target: target.orders,
      format: (v: number) => String(v),
    },
    {
      label: 'New Customers',
      icon: Users,
      color: '#F7B928',
      bg: 'rgba(247,185,40,0.1)',
      actual: monthActuals.newCustomers,
      target: target.newCustomers,
      format: (v: number) => String(v),
    },
  ];

  const overallPct = Math.round(
    (metrics.reduce((s, m) => s + Math.min(100, (m.actual / Math.max(1, m.target)) * 100), 0)) / metrics.length
  );

  const monthLabel = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  // Pacing alerts calculation
  const pacingAlert = useMemo(() => {
    const dailyNeeded = daysRemaining > 0 ? (target.revenue - monthActuals.revenue) / daysRemaining : 0;
    const dailyActual = daysPassed > 0 ? monthActuals.revenue / daysPassed : 0;
    const isTargetAchieved = monthActuals.revenue >= target.revenue;
    const isPacingSafe = dailyNeeded <= 0 || dailyActual >= (0.8 * dailyNeeded);
    const targetGapPct = ((target.revenue - monthActuals.revenue) / target.revenue) * 100;

    let suggestionText = "";
    let audienceCount = 0;
    
    if (targetGapPct < 20) {
      audienceCount = customers.filter(c => {
        const d = c.orders?.[0]?.tanggalOrder ? parseDate(c.orders[0].tanggalOrder) : null;
        return c.totalSpend && c.totalSpend > 5000000 && d && (now.getTime() - d.getTime()) > 60*86400*1000;
      }).length;
      suggestionText = `💡 Coba broadcast ke ${audienceCount} pelanggan VIP yang sudah > 60 hari tidak order`;
    } else if (targetGapPct <= 50) {
      audienceCount = customers.filter(c => c.orders && c.orders.length >= 2).length;
      suggestionText = `💡 Launch Flash Sale via WhatsApp ke ${audienceCount} pelanggan Loyal`;
    } else {
      audienceCount = customers.filter(c => {
        const d = c.orders?.[0]?.tanggalOrder ? parseDate(c.orders[0].tanggalOrder) : null;
        return d && (now.getTime() - d.getTime()) > 90*86400*1000;
      }).length;
      suggestionText = `💡 Aktifkan Re-engagement ke semua ${audienceCount} pelanggan inaktif 90+ hari`;
    }

    return {
      dailyNeeded,
      dailyActual,
      isTargetAchieved,
      isPacingSafe,
      suggestionText,
      targetGapPct
    };
  }, [daysRemaining, daysPassed, target.revenue, monthActuals.revenue, customers, now]);

  return (
    <div className="page-body" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: 'rgba(24,119,242,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Target size={22} color="#1877F2" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Sales Target — {monthLabel}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <Calendar size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
              {daysRemaining} hari tersisa bulan ini · Hari ke-{daysPassed} dari {daysInMonth}
            </div>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setEditing(!editing)}
          style={{ fontSize: 12, padding: '7px 14px' }}
        >
          {editing ? 'Batal' : '⚙️ Set Target'}
        </button>
      </div>

      {/* Edit Target Form */}
      {editing && (
        <div className="card" style={{ padding: 20, marginBottom: 20, border: '2px solid rgba(24,119,242,0.3)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            🎯 Set Target Bulan Ini
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                Target Revenue (Rp)
              </label>
              <input
                type="number"
                value={target.revenue}
                onChange={(e) => setTarget({ ...target, revenue: Number(e.target.value) })}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                Target Orders
              </label>
              <input
                type="number"
                value={target.orders}
                onChange={(e) => setTarget({ ...target, orders: Number(e.target.value) })}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                Target Customer Baru
              </label>
              <input
                type="number"
                value={target.newCustomers}
                onChange={(e) => setTarget({ ...target, newCustomers: Number(e.target.value) })}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => saveTarget(target)}
            style={{ marginTop: 16, fontSize: 13 }}
          >
            💾 Simpan Target
          </button>
        </div>
      )}

      {/* Overall Progress Ring */}
      <div className="card" style={{ padding: 24, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke={isLight ? '#e4e6eb' : '#3A3B3C'} strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={overallPct >= 100 ? '#42B72A' : overallPct >= 60 ? '#1877F2' : '#F7B928'}
                strokeWidth="10"
                strokeDasharray={`${(overallPct / 100) * 314} 314`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{overallPct}%</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Overall</div>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              {overallPct >= 100 ? '🎉 Target Tercapai!' : overallPct >= 75 ? '🔥 Hampir Target!' : overallPct >= 50 ? '💪 Terus Semangat!' : '📊 Masih Perlu Usaha'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {overallPct >= 100
                ? 'Semua target bulan ini sudah terpenuhi. Luar biasa!'
                : `Estimasi harian: ${formatRupiah(Math.round((target.revenue - monthActuals.revenue) / Math.max(1, daysRemaining)))} / hari untuk capai target revenue`
              }
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        {metrics.map((m) => {
          const pct = Math.min(100, Math.round((m.actual / Math.max(1, m.target)) * 100));
          const Icon = m.icon;
          const dailyRate = daysPassed > 0 ? m.actual / daysPassed : 0;
          const projected = Math.round(dailyRate * daysInMonth);
          return (
            <div className="card" key={m.label} style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: m.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} color={m.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {m.format(m.actual)}
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: pct >= 100 ? 'rgba(66,183,42,0.15)' : pct >= 60 ? 'rgba(24,119,242,0.12)' : 'rgba(247,185,40,0.12)',
                  color: pct >= 100 ? '#42B72A' : pct >= 60 ? '#1877F2' : '#F7B928',
                }}>
                  {pct}%
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                height: 8, borderRadius: 4, background: isLight ? '#e4e6eb' : '#3A3B3C',
                overflow: 'hidden', marginBottom: 10,
              }}>
                <div style={{
                  height: '100%', borderRadius: 4, width: `${pct}%`,
                  background: pct >= 100 ? '#42B72A' : m.color,
                  transition: 'width 1s ease',
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Target: {m.format(m.target)}</span>
                <span>Proyeksi: {m.format(projected)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert Pacing */}
      <div className="card" style={{ padding: 20, marginBottom: 20, border: pacingAlert.isTargetAchieved ? '2px solid #42B72A' : (!pacingAlert.isPacingSafe) ? '2px solid #ef4444' : '2px solid #42B72A', background: pacingAlert.isTargetAchieved ? 'rgba(66,183,42,0.05)' : (!pacingAlert.isPacingSafe) ? 'rgba(239,68,68,0.05)' : 'rgba(66,183,42,0.05)' }}>
        {pacingAlert.isTargetAchieved ? (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#42B72A', marginBottom: 8 }}>🎉 TARGET TERCAPAI!</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Selamat! Target revenue bulan ini telah tercapai.</div>
          </div>
        ) : pacingAlert.isPacingSafe ? (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#42B72A', marginBottom: 8 }}>✅ Pacing Aman! Terus pertahankan!</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Kecepatan penjualan harian Anda sudah cukup baik untuk mencapai target.</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>🚨 Revenue Tertinggal!</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
              Dibutuhkan Rp {formatRupiah(Math.round(pacingAlert.dailyNeeded))}/hari, saat ini rata-rata Rp {formatRupiah(Math.round(pacingAlert.dailyActual))}/hari
            </div>
            
            <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {pacingAlert.suggestionText}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Strategi ini didasarkan pada gap target ({Math.round(pacingAlert.targetGapPct)}%).
              </div>
            </div>
            
            <a href={`https://wa.me/?text=${encodeURIComponent("Halo Kak! Ada promo spesial untuk koleksi terbaru kami...")}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              🚀 Buat Kampanye Sekarang
            </a>
          </div>
        )}
      </div>

      {/* Daily Pace Indicator */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Zap size={16} color="#F7B928" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Kecepatan Harian</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {metrics.map((m) => {
            const dailyActual = daysPassed > 0 ? m.actual / daysPassed : 0;
            const dailyNeeded = daysRemaining > 0 ? (m.target - m.actual) / daysRemaining : 0;
            const onTrack = dailyActual >= (m.target / daysInMonth);
            return (
              <div key={m.label} style={{
                padding: 14, borderRadius: 12, background: isLight ? '#f0f2f5' : 'var(--bg-tertiary)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>{m.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rata-rata/hari</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {m.label === 'Revenue' ? formatRupiah(Math.round(dailyActual)) : Math.round(dailyActual * 10) / 10}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Perlu/hari</div>
                    <div style={{
                      fontSize: 15, fontWeight: 700,
                      color: dailyNeeded <= 0 ? '#42B72A' : onTrack ? '#1877F2' : '#F7B928',
                    }}>
                      {dailyNeeded <= 0 ? '✅' : m.label === 'Revenue' ? formatRupiah(Math.round(dailyNeeded)) : Math.round(dailyNeeded * 10) / 10}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly History */}
      <div className="card" style={{ padding: 20 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setShowHistory(!showHistory)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={16} color="#1877F2" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Histori 6 Bulan Terakhir</span>
          </div>
          {showHistory ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>
        {showHistory && (
          <div style={{ marginTop: 16 }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Bulan</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th>Pencapaian</th>
                  </tr>
                </thead>
                <tbody>
                  {monthHistory.map((h) => {
                    const targetRev = h.targetRevenue;
                    const pct = targetRev ? Math.round((h.revenue / targetRev) * 100) : null;
                    return (
                      <tr key={h.label}>
                        <td style={{ fontWeight: 600 }}>{h.label}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{targetRev ? formatRupiah(targetRev) : '—'}</td>
                        <td style={{ color: '#42B72A', fontWeight: 700 }}>{formatRupiah(h.revenue)}</td>
                        <td>
                          {pct !== null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{pct}% tercapai</span>
                              <div style={{ flex: 1, height: 6, background: 'var(--bg-input)', borderRadius: 3, maxWidth: 60 }}>
                                <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pct >= 100 ? '#42B72A' : '#F7B928', borderRadius: 3 }} />
                              </div>
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-card-list">
              {monthHistory.map((h) => {
                const targetRev = h.targetRevenue;
                const pct = targetRev ? Math.round((h.revenue / targetRev) * 100) : null;
                return (
                  <div key={h.label} className="inv-card">
                    <div className="inv-card-header">
                      <div className="inv-card-title">{h.label}</div>
                      {pct !== null && (
                        <div className="inv-badge inv-badge-purple">{pct}% Tercapai</div>
                      )}
                    </div>
                    <div className="inv-card-body">
                      <div className="inv-detail-row"><span>Target:</span><span>{targetRev ? formatRupiah(targetRev) : '—'}</span></div>
                      <div className="inv-detail-row"><span>Actual:</span><span style={{ color: '#42B72A', fontWeight: 700 }}>{formatRupiah(h.revenue)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
