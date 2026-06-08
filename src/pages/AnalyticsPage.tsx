// src/pages/AnalyticsPage.tsx
import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, ArcElement, PointElement, LineElement,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah } from '../utils/csvLoader';
import { getProductPerformance } from '../utils/marketingEngine';
import { TrendingUp, TrendingDown, Package } from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Tooltip, Legend, Filler
);

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
  theme?: 'dark' | 'light';
}



const PIE_COLORS = ['#7c3aed','#4f46e5','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];

export default function AnalyticsPage({ customers, rows, theme = 'dark' }: Props) {
  const isLight = theme === 'light';
  const textColor = isLight ? '#0f172a' : '#ffffff';
  const gridColor = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.04)';
  const borderColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)';
  const tooltipBg = isLight ? '#ffffff' : '#16161f';
  const tooltipBorder = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';

  const tooltipConfig = useMemo(() => ({
    backgroundColor: tooltipBg,
    borderColor: tooltipBorder,
    borderWidth: 1,
    titleColor: textColor,
    bodyColor: textColor,
    padding: 12,
    titleFont: { family: 'Inter', weight: 700 },
    bodyFont: { family: 'Inter' },
  }), [tooltipBg, tooltipBorder, textColor]);

  const scaleConfig = useMemo(() => ({
    ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
    grid: { color: gridColor },
    border: { color: borderColor },
  }), [textColor, gridColor, borderColor]);

  const orderRows = rows.filter((r) => r.jenis);

  const productPerformance = useMemo(() => getProductPerformance(rows), [rows]);

  // Grade distribution
  const gradeData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of orderRows) {
      if (r.grade) m[r.grade] = (m[r.grade] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [orderRows]);

  // Pearl type frequency
  const pearlFreq = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of orderRows) {
      if (r.type) m[r.type] = (m[r.type] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [orderRows]);

  // Shape distribution
  const shapeData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of orderRows) {
      if (r.shape) m[r.shape] = (m[r.shape] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [orderRows]);

  // Revenue per customer segment (by order count)
  const segmentData = useMemo(() => {
    const segments = { '1 order': 0, '2–3 orders': 0, '4–6 orders': 0, '7+ orders': 0 };
    const revenue = { '1 order': 0, '2–3 orders': 0, '4–6 orders': 0, '7+ orders': 0 };
    for (const c of customers) {
      let seg: keyof typeof segments;
      if (c.orderCount === 1) seg = '1 order';
      else if (c.orderCount <= 3) seg = '2–3 orders';
      else if (c.orderCount <= 6) seg = '4–6 orders';
      else seg = '7+ orders';
      segments[seg]++;
      revenue[seg] += c.totalSpend;
    }
    return { segments, revenue };
  }, [customers]);

  // Color popularity
  const colorData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of orderRows) {
      if (r.color) {
        const k = r.color.split(' ')[0];
        if (k) m[k] = (m[k] || 0) + 1;
      }
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [orderRows]);

  // Frame/Rangka distribution
  const rangkaData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of orderRows) {
      if (r.rangka) {
        const k = r.rangka.split(' ')[0];
        if (k) m[k] = (m[k] || 0) + 1;
      }
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [orderRows]);

  // Payment volume vs count
  const payData = useMemo(() => {
    const count: Record<string, number> = {};
    const vol: Record<string, number> = {};
    for (const r of orderRows) {
      if (r.paymentVia) {
        count[r.paymentVia] = (count[r.paymentVia] || 0) + 1;
        vol[r.paymentVia] = (vol[r.paymentVia] || 0) + parseInt(r.totalBayar.replace(/\D/g,'') || '0', 10);
      }
    }
    const entries = Object.entries(count).sort((a,b) => b[1]-a[1]).slice(0,5);
    return { labels: entries.map(([k])=>k), counts: entries.map(([k])=>count[k]), volumes: entries.map(([k])=>vol[k]) };
  }, [orderRows]);

  // City distribution
  const cityData = useMemo(() => {
    const m: Record<string, { count: number; revenue: number }> = {};
    for (const c of customers) {
      if (!c.city || c.city === '—') continue;
      const existing = m[c.city] ?? { count: 0, revenue: 0 };
      m[c.city] = { count: existing.count + 1, revenue: existing.revenue + c.totalSpend };
    }
    return Object.entries(m)
      .map(([city, v]) => ({ city, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [customers]);

  // Pulau grouping
  const pulauMap = useMemo(() => {
    const PULAU: Record<string, string[]> = {
      'Jawa':     ['Jakarta','Surabaya','Bandung','Semarang','Yogyakarta','Malang','Bekasi','Tangerang','Depok','Bogor','Solo','Sidoarjo','Gresik','Mojokerto','Pasuruan','Probolinggo','Jember','Kediri','Madiun','Blitar','Tulungagung'],
      'Sumatra':  ['Medan','Palembang','Pekanbaru','Batam','Padang','Banda Aceh','Jambi','Bengkulu','Lampung','Bandar Lampung'],
      'Kalimantan':['Balikpapan','Samarinda','Pontianak','Banjarmasin','Palangkaraya'],
      'Sulawesi': ['Makassar','Manado','Palu','Kendari','Gorontalo'],
      'Bali & NTT':['Bali','Denpasar','Mataram','Kupang'],
      'Papua':    ['Jayapura','Sorong','Manokwari'],
    };
    const result: Record<string, number> = {};
    for (const c of customers) {
      if (!c.city || c.city === '—') continue;
      let found = false;
      for (const [pulau, cities] of Object.entries(PULAU)) {
        if (cities.some((city) => c.city.toLowerCase().includes(city.toLowerCase()))) {
          result[pulau] = (result[pulau] ?? 0) + 1;
          found = true;
          break;
        }
      }
      if (!found) result['Lainnya'] = (result['Lainnya'] ?? 0) + 1;
    }
    return Object.entries(result).sort((a, b) => b[1] - a[1]);
  }, [customers]);

  return (
    <div className="page-body">
      <div className="analytics-grid-2" style={{ marginBottom: 20 }}>
        {/* Pearl Type Frequency */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Pearl Type Frequency</div>
              <div className="card-subtitle">Number of orders per pearl type</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 220 }}>
              <Bar
                data={{
                  labels: pearlFreq.map(([k]) => k),
                  datasets: [{
                    label: 'Orders',
                    data: pearlFreq.map(([, v]) => v),
                    backgroundColor: PIE_COLORS.map((c) => c + 'bb'),
                    borderColor: PIE_COLORS,
                    borderWidth: 1.5,
                    borderRadius: 6,
                  }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipConfig as any }, scales: { x: scaleConfig as any, y: scaleConfig as any } }}
              />
            </div>
          </div>
        </div>

        {/* Shape Distribution */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Pearl Shape Distribution</div>
              <div className="card-subtitle">Ordered by frequency</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ height: 220, width: '100%' }}>
              <Doughnut
                data={{
                  labels: shapeData.map(([k]) => k),
                  datasets: [{
                    data: shapeData.map(([, v]) => v),
                    backgroundColor: PIE_COLORS.slice(0, shapeData.length),
                    borderColor: isLight ? '#ffffff' : '#111118',
                    borderWidth: 3,
                    hoverOffset: 6,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '60%',
                  plugins: {
                    legend: { position: 'right', labels: { color: isLight ? '#334155' : '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 10 } },
                    tooltip: tooltipConfig as any,
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-grid-2" style={{ marginBottom: 20 }}>
        {/* Grade Distribution */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Grade Distribution</div>
              <div className="card-subtitle">Quality tier breakdown</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 220 }}>
              <Bar
                data={{
                  labels: gradeData.map(([k]) => k),
                  datasets: [{
                    label: 'Orders',
                    data: gradeData.map(([, v]) => v),
                    backgroundColor: '#7c3aed88',
                    borderColor: '#7c3aed',
                    borderWidth: 1.5,
                    borderRadius: 6,
                  }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipConfig as any }, scales: { x: scaleConfig as any, y: scaleConfig as any } }}
              />
            </div>
          </div>
        </div>

        {/* Color Popularity */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Popular Pearl Colors</div>
              <div className="card-subtitle">Top 8 ordered colors</div>
            </div>
          </div>
          <div className="card-body">
            <div className="top-list">
              {colorData.map(([color, count], i) => {
                const pct = Math.round((count / orderRows.length) * 100);
                return (
                  <div key={color} className="top-list-item">
                    <div className="top-list-rank">{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{color}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar-fill" style={{ width: `${(count / colorData[0][1]) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-grid-2" style={{ marginBottom: 20 }}>
        {/* Customer Segments */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Customer Segments</div>
              <div className="card-subtitle">By order frequency</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
              {Object.entries(segmentData.segments).map(([seg, count]) => (
                <div key={seg} style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '12px',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{seg}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{count}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent-green)' }}>{formatRupiah(segmentData.revenue[seg as keyof typeof segmentData.revenue])}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Frame / Rangka breakdown */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Frame Material</div>
              <div className="card-subtitle">Rangka popularity</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 220 }}>
              <Bar
                data={{
                  labels: rangkaData.map(([k]) => k),
                  datasets: [{
                    label: 'Orders',
                    data: rangkaData.map(([, v]) => v),
                    backgroundColor: '#06b6d488',
                    borderColor: '#06b6d4',
                    borderWidth: 1.5,
                    borderRadius: 6,
                  }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipConfig as any }, scales: { x: { ...scaleConfig as any, ticks: { ...scaleConfig.ticks, maxRotation: 30 } }, y: scaleConfig as any } }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Channel */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Payment Channel Performance</div>
            <div className="card-subtitle">Order count vs revenue volume</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ height: 240 }}>
            <Bar
              data={{
                labels: payData.labels,
                datasets: [
                  {
                    label: 'Order Count',
                    data: payData.counts,
                    backgroundColor: '#7c3aed88',
                    borderColor: '#7c3aed',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    yAxisID: 'y',
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 }, boxWidth: 12 } }, tooltip: tooltipConfig as any },
                scales: {
                  x: scaleConfig as any,
                  y: { ...scaleConfig as any, position: 'left', title: { display: true, text: 'Orders', color: textColor, font: { family: 'Inter' } } },
                },
              } as any}
            />
          </div>
        </div>
      </div>

      {/* 🗺️ Peta Distribusi Pelanggan */}
      <div className="analytics-grid-2" style={{ marginBottom: 20 }}>
        {/* Top Cities */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🗺️ Top 15 Kota Pelanggan</div>
              <div className="card-subtitle">Distribusi geografis pelanggan</div>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {cityData.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada data kota</div>
            ) : cityData.map((c, i) => {
              const pct = Math.round((c.count / cityData[0].count) * 100);
              const colors = ['#7c3aed','#4f46e5','#06b6d4','#10b981','#f59e0b'];
              const color = colors[Math.min(i, colors.length - 1)];
              return (
                <div key={c.city} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 24, fontSize: 11, fontWeight: 700, color: i < 3 ? color : 'var(--text-muted)', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{c.city}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.count} pelanggan</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
                      <div style={{ width: `${pct}%`, height: 4, background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 600, flexShrink: 0, minWidth: 70, textAlign: 'right' }}>{formatRupiah(c.revenue)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribusi Per Pulau */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🏝️ Distribusi Per Pulau</div>
              <div className="card-subtitle">Sebaran pelanggan berdasarkan wilayah</div>
            </div>
          </div>
          <div className="card-body">
            {pulauMap.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>Tidak ada data</div>
            ) : (
              <>
                <div style={{ height: 220 }}>
                  <Doughnut
                    data={{
                      labels: pulauMap.map(([k]) => k),
                      datasets: [{
                        data: pulauMap.map(([, v]) => v),
                        backgroundColor: PIE_COLORS.slice(0, pulauMap.length),
                        borderColor: isLight ? '#ffffff' : '#111118',
                        borderWidth: 3,
                        hoverOffset: 6,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '55%',
                      plugins: {
                        legend: { position: 'right', labels: { color: isLight ? '#334155' : '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 8 } },
                        tooltip: tooltipConfig as any,
                      },
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {pulauMap.map(([pulau, count], i) => (
                    <div key={pulau} style={{ background: `${PIE_COLORS[i % PIE_COLORS.length]}18`, border: `1px solid ${PIE_COLORS[i % PIE_COLORS.length]}33`, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: PIE_COLORS[i % PIE_COLORS.length] }}>
                      {pulau}: {count}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Product Performance Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Product Performance</div>
            <div className="card-subtitle">Top selling vs least performing items</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Top Products */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: 6, borderRadius: 8 }}><TrendingUp size={16} /></div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Top 5 Best Sellers</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {productPerformance.byType.slice(0, 5).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981', width: 24 }}>#{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.count} orders</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{formatRupiah(p.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Worst Products */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: 6, borderRadius: 8 }}><TrendingDown size={16} /></div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Needs Attention (Bottom 5)</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...productPerformance.byType].reverse().slice(0, 5).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ padding: '4px', background: 'var(--bg-card)', borderRadius: 6, color: 'var(--text-muted)' }}><Package size={14} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.count} orders</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{formatRupiah(p.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
