import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, ArcElement, PointElement, LineElement,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import type { CustomerRow, CatalogItem } from '../types';
import {
  generateFinanceMetrics,
  simulateWhatIfScenario,
  type AIAdvice,
  type FinanceOptions,
} from '../utils/financeEngine';
import {
  TrendingUp, DollarSign, ShoppingBag, Users, Repeat,
  AlertTriangle, CheckCircle, Lightbulb, Info, ArrowUp, ArrowDown,
  Activity, Zap, ChevronDown, ChevronUp, Sliders, Calendar,
  Layers, ShieldAlert, Printer, Sparkles, RefreshCw, BarChart2
} from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Tooltip, Legend, Filler
);

interface Props {
  rows: CustomerRow[];
  catalogItems: CatalogItem[];
  theme?: 'dark' | 'light';
}

const PALETTE = ['#7c3aed','#4f46e5','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6','#f97316'];

/* ── Shared sub-components ─────────────────────────────────────────────── */

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— N/A</span>;
  const up = value >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: up ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      color: up ? '#10b981' : '#ef4444',
    }}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function HealthGauge({ score, label }: { score: number; label: string }) {
  let color = '#10b981';
  if (score < 40) color = '#ef4444';
  else if (score < 60) color = '#f59e0b';
  else if (score < 80) color = '#06b6d4';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '16px 20px',
      background: 'var(--bg-card)', border: `1px solid ${color}40`,
      borderRadius: 14, minWidth: 160, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${color}, #7c3aed)`,
      }} />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        CFO Health Score
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1.1, margin: '4px 0' }}>
        {score}<span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
      </div>
      <div style={{
        fontSize: 11.5, fontWeight: 700, color, padding: '2px 10px',
        borderRadius: 20, background: `${color}18`, textTransform: 'uppercase', letterSpacing: '0.03em',
      }}>
        {label}
      </div>
    </div>
  );
}

function AdviceAccordion({ a }: { a: AIAdvice }) {
  const [open, setOpen] = useState(false);

  const cfg = {
    critical:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   icon: <AlertTriangle size={14} /> },
    warning:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  icon: <AlertTriangle size={14} /> },
    opportunity:{ color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.25)',   icon: <Lightbulb size={14} /> },
    excellent:  { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  icon: <CheckCircle size={14} /> },
    info:       { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  border: 'rgba(124,58,237,0.25)',  icon: <Info size={14} /> },
  }[a.level];

  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10,
      marginBottom: 8, overflow: 'hidden', transition: 'all 0.2s ease',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-primary)', textAlign: 'left', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.title}
          </span>
        </div>
        {a.metric && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: cfg.color, flexShrink: 0,
            marginRight: 6, whiteSpace: 'nowrap',
          }}>
            {a.metric}
          </span>
        )}
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {open && (
        <div style={{
          padding: '0 14px 14px',
          fontSize: 12, lineHeight: 1.75, color: 'var(--text-secondary)',
          borderTop: `1px solid ${cfg.border}`, paddingTop: 12,
          wordBreak: 'break-word',
        }}>
          {a.detail}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, sub, color = '#7c3aed', icon, badge,
}: {
  label: string; value: string; sub?: string; color?: string;
  icon: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '14px',
      borderTop: `3px solid ${color}`,
      display: 'flex', flexDirection: 'column', gap: 8,
      position: 'relative', overflow: 'hidden', minWidth: 0,
    }}>
      <div style={{ position: 'absolute', top: 12, right: 12, opacity: 0.07, transform: 'scale(2.2)', color }}>
        {icon}
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: `${color}20`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</div>
        <div style={{
          fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value}</div>
        {sub && (
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{sub}</div>
        )}
      </div>
      {badge && <div style={{ marginTop: 'auto' }}>{badge}</div>}
    </div>
  );
}

const PERIOD_OPTIONS = [
  { id: 'all', label: 'Seluruh Periode (All-Time)' },
  { id: 'ytd', label: 'Year-to-Date (2026)' },
  { id: 'ltm', label: '12 Bulan Terakhir (LTM)' },
  { id: 'l6m', label: '6 Bulan Terakhir' },
  { id: '2025', label: 'Tahun 2025' },
];

export default function FinanceAnalyticsPage({ rows, catalogItems, theme = 'dark' }: Props) {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // Options & Parameters State
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [customOpexPct, setCustomOpexPct] = useState<number>(10);
  const [customDefaultMarginPct, setCustomDefaultMarginPct] = useState<number>(35);
  const [customTaxRatePct, setCustomTaxRatePct] = useState<number>(0.5);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [adviceFilter, setAdviceFilter] = useState<string>('all');

  // Sensitivity What-If Simulator State
  const [simPrice, setSimPrice] = useState<number>(0);       // -20% to +30%
  const [simVolume, setSimVolume] = useState<number>(0);     // -30% to +50%
  const [simCogs, setSimCogs] = useState<number>(0);         // -20% to +30%
  const [simOpex, setSimOpex] = useState<number>(0);         // -30% to +50%

  // Compute Metrics
  const options: FinanceOptions = useMemo(() => ({
    periodFilter,
    customOpexPct,
    customDefaultMarginPct,
    customTaxRatePct,
  }), [periodFilter, customOpexPct, customDefaultMarginPct, customTaxRatePct]);

  const m = useMemo(() => {
    return generateFinanceMetrics(rows, catalogItems, options);
  }, [rows, catalogItems, options]);

  // Compute What-If Scenario
  const sim = useMemo(() => {
    return simulateWhatIfScenario(m, {
      priceChangePct: simPrice,
      volumeChangePct: simVolume,
      cogsChangePct: simCogs,
      opexChangePct: simOpex,
    });
  }, [m, simPrice, simVolume, simCogs, simOpex]);

  const rupiah = (n: number) => {
    if (n >= 1_000_000_000) return `Rp${(n/1_000_000_000).toFixed(2)}M`;
    if (n >= 1_000_000) return `Rp${(n/1_000_000).toFixed(1)}Jt`;
    if (n >= 1_000) return `Rp${(n/1_000).toFixed(0)}Rb`;
    return `Rp${Math.round(n).toLocaleString('id-ID')}`;
  };

  const tooltipCfg = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    titleColor: isDark ? '#f8fafc' : '#0f172a',
    bodyColor: isDark ? '#cbd5e1' : '#334155',
    borderColor: isDark ? '#334155' : '#cbd5e1',
    borderWidth: 1,
    padding: 10,
    boxPadding: 4,
    usePointStyle: true,
  };

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: textColor, font: { size: 11, family: 'Inter, sans-serif' } } },
      tooltip: tooltipCfg,
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
      y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
    },
  };

  const rpTick = {
    ...baseOpts.scales.y,
    ticks: { ...baseOpts.scales.y.ticks, callback: (v: any) => rupiah(Number(v)) },
  };

  // Charts Config
  const cashFlowData = useMemo(() => ({
    labels: m.monthlyCashFlow.map(x => x.label),
    datasets: [
      { type: 'line' as const, label: 'Laba Kotor', data: m.monthlyCashFlow.map(x => x.profit),
        borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 2.5, pointRadius: 4, fill: true, tension: 0.3 },
      { type: 'bar' as const, label: 'Pendapatan', data: m.monthlyCashFlow.map(x => x.revenue),
        backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
      { type: 'bar' as const, label: 'HPP (COGS)', data: m.monthlyCashFlow.map(x => x.cogs),
        backgroundColor: 'rgba(245,158,11,0.6)', borderRadius: 4 },
    ] as any[],
  }), [m.monthlyCashFlow]);

  const waterfallChartData = useMemo(() => ({
    labels: ['Gross Sales', 'Ongkir', 'Net Sales', 'COGS (HPP)', 'Gross Profit', 'OpEx (Beban)', 'Pajak UMKM', 'Net Profit'],
    datasets: [{
      label: 'Financial Bridge',
      data: [
        m.waterfallData.grossSales,
        -m.waterfallData.ongkir,
        m.waterfallData.netSales,
        -m.waterfallData.cogs,
        m.waterfallData.grossProfit,
        -m.waterfallData.opex,
        -m.waterfallData.tax,
        m.waterfallData.netProfit,
      ],
      backgroundColor: [
        '#10b981', '#ef4444', '#06b6d4', '#f59e0b', '#7c3aed', '#ec4899', '#f97316', '#3b82f6'
      ],
      borderRadius: 5,
    }],
  }), [m.waterfallData]);

  const catBarData = useMemo(() => ({
    labels: m.categoryStats.map(c => c.category),
    datasets: [
      { label: 'Pendapatan', data: m.categoryStats.map(c => c.revenue), backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
      { label: 'Laba Kotor',  data: m.categoryStats.map(c => c.profit),  backgroundColor: 'rgba(124,58,237,0.7)', borderRadius: 4 },
    ],
  }), [m.categoryStats]);

  const paymentData = useMemo(() => ({
    labels: m.paymentStats.map(p => `${p.name} (${p.share.toFixed(0)}%)`),
    datasets: [{ data: m.paymentStats.map(p => p.amount), backgroundColor: PALETTE, borderWidth: 0, hoverOffset: 6 }],
  }), [m.paymentStats]);

  const filteredAdvice = adviceFilter === 'all'
    ? m.aiAdvice
    : m.aiAdvice.filter(a => a.level === adviceFilter);

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="page-body fin-page">

      {/* ── CFO TOOLBAR & PERIOD FILTER ────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            <Calendar size={16} style={{ color: '#7c3aed' }} /> Filter Periode:
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodFilter(p.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: periodFilter === p.id ? 700 : 500,
                  border: periodFilter === p.id ? '1px solid #7c3aed' : '1px solid var(--border)',
                  background: periodFilter === p.id ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: periodFilter === p.id ? '#7c3aed' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowConfigModal(true)}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Sliders size={14} /> Model Biaya (OpEx: {customOpexPct}%)
          </button>
          <button
            className="btn btn-primary"
            onClick={handlePrintReport}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={14} /> Cetak Laporan CFO
          </button>
        </div>
      </div>

      {/* ── DYNAMIC COST PARAMETERS MODAL/DRAWER ──────────────────────── */}
      {showConfigModal && (
        <div className="modal-overlay center" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content" style={{ width: 440, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sliders size={18} style={{ color: '#7c3aed' }} /> Parameter Model Keuangan
              </div>
              <button onClick={() => setShowConfigModal(false)} className="btn-close-dark">✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Asumsi Biaya Operasional / OpEx (% dari Omzet): <strong>{customOpexPct}%</strong>
                </label>
                <input
                  type="range" min="0" max="30" step="1"
                  value={customOpexPct}
                  onChange={e => setCustomOpexPct(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Mencakup gaji staff, sewa toko, iklan/ads, kemasan, dan biaya listrik/internet.
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Estimasi HPP Standar (Saat Modal Katalog Kosong): <strong>COGS {100 - customDefaultMarginPct}% (Margin {customDefaultMarginPct}%)</strong>
                </label>
                <input
                  type="range" min="15" max="60" step="5"
                  value={customDefaultMarginPct}
                  onChange={e => setCustomDefaultMarginPct(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Pajak Penghasilan (PPh Final UMKM %): <strong>{customTaxRatePct}%</strong>
                </label>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={customTaxRatePct}
                  onChange={e => setCustomTaxRatePct(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={() => setShowConfigModal(false)}
                style={{ marginTop: 8 }}
              >
                Terapkan Parameter Keuangan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXECUTIVE CFO HEADER ───────────────────────────────────────── */}
      <div className="fin-exec-header">
        <HealthGauge score={m.healthScore} label={m.healthLabel} />

        <div className="fin-exec-main">
          <div className="fin-exec-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Executive Financial Analytics</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(124,58,237,0.15)', color: '#7c3aed' }}>
              {m.activePeriodLabel}
            </span>
          </div>
          <div className="fin-exec-desc">
            Analisis profitabilitas & unit economics untuk {m.totalOrders.toLocaleString('id-ID')} transaksi dari {m.uniqueCustomers} pelanggan unik.
          </div>
          <div className="fin-exec-kpis">
            {[
              { label: 'Omzet', value: rupiah(m.totalRevenue), color: '#10b981' },
              { label: 'Laba Kotor', value: rupiah(m.totalGrossProfit), color: '#7c3aed' },
              { label: 'Laba Bersih (Est)', value: rupiah(m.totalNetProfit), color: '#06b6d4' },
              { label: 'Net Margin', value: `${m.netMarginEstPct.toFixed(1)}%`, color: '#3b82f6' },
              { label: 'ARR (Run Rate)', value: rupiah(m.runRate.annualRunRateRev), color: '#f59e0b' },
            ].map(kpi => (
              <div key={kpi.label} style={{
                display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 12px',
                background: 'var(--bg-card-hover)', borderRadius: 8, border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{kpi.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: kpi.color }}>{kpi.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Period Summary Card */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '14px 16px', minWidth: 200, display: 'flex',
          flexDirection: 'column', justifyContent: 'center', gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Performa Bulan Ini
          </div>
          {[
            { label: 'Omzet Bulan Ini', cur: m.currentMonthRevenue, growth: m.momRevenueGrowth },
            { label: 'Laba Bulan Ini',  cur: m.currentMonthProfit,  growth: m.momProfitGrowth },
            { label: 'Order Bulan Ini', cur: m.currentMonthOrders,  growth: m.currentMonthOrders && m.prevMonthOrders ? ((m.currentMonthOrders - m.prevMonthOrders) / m.prevMonthOrders) * 100 : null, isCount: true },
          ].map(row => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{row.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {row.isCount ? row.cur.toLocaleString('id-ID') : rupiah(row.cur)}
                </span>
                <GrowthBadge value={row.growth ?? null} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI GRID ───────────────────────────────────────────────────── */}
      <div className="fin-grid-kpi">
        <StatCard label="Total Omzet"     value={rupiah(m.totalRevenue)}            sub={`${m.totalOrders} transaksi`}        color="#10b981" icon={<DollarSign size={14} />} badge={<GrowthBadge value={m.momRevenueGrowth} />} />
        <StatCard label="Laba Kotor"      value={rupiah(m.totalGrossProfit)}        sub="Pendapatan − HPP"                    color="#7c3aed" icon={<TrendingUp size={14} />} badge={<GrowthBadge value={m.momProfitGrowth} />} />
        <StatCard label="Laba Bersih Est" value={rupiah(m.totalNetProfit)}         sub={`Net Margin ~${m.netMarginEstPct.toFixed(1)}%`} color="#06b6d4" icon={<Activity size={14} />} />
        <StatCard label="Gross Margin"    value={`${m.grossMarginPct.toFixed(1)}%`} sub={`Target: 35% – 50%`}                 color={m.grossMarginPct >= 35 ? '#10b981' : '#f59e0b'} icon={<Activity size={14} />} />
        <StatCard label="Avg Order Value" value={rupiah(m.aov)}                     sub="Nilai per transaksi"                 color="#3b82f6" icon={<ShoppingBag size={14} />} />
        <StatCard label="Run Rate (ARR)"  value={rupiah(m.runRate.annualRunRateRev)} sub="Proyeksi omzet tahunan"             color="#f59e0b" icon={<Zap size={14} />} />
        <StatCard label="Pelanggan Unik"  value={m.uniqueCustomers.toLocaleString('id-ID')} sub={`${m.repeatCustomers} repeat`} color="#ec4899" icon={<Users size={14} />} />
        <StatCard label="Repeat Rate"     value={`${m.repeatRate.toFixed(1)}%`}     sub="Loyalitas pelanggan"                 color={m.repeatRate >= 25 ? '#10b981' : '#f59e0b'} icon={<Repeat size={14} />} />
      </div>

      {/* ── UNIT ECONOMICS & WATERFALL P&L BRIDGE ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

        {/* Unit Economics Breakdown */}
        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} style={{ color: '#7c3aed' }} /> Unit Economics (Per Order Rata-Rata)
            </div>
          </div>
          <div className="fin-chart-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-card-hover)', borderRadius: 8 }}>
              <span>Nilai Rata-rata Order (AOV)</span>
              <strong style={{ color: '#10b981' }}>{rupiah(m.unitEconomics.revPerOrder)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-card-hover)', borderRadius: 8 }}>
              <span>(−) HPP (COGS) per Order</span>
              <strong style={{ color: '#f59e0b' }}>−{rupiah(m.unitEconomics.cogsPerOrder)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(124,58,237,0.1)', borderRadius: 8 }}>
              <span>(=) Laba Kotor per Order</span>
              <strong style={{ color: '#7c3aed' }}>{rupiah(m.unitEconomics.grossProfitPerOrder)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-card-hover)', borderRadius: 8 }}>
              <span>(−) Biaya Operasional / OpEx ({m.options.customOpexPct}%)</span>
              <strong style={{ color: '#ec4899' }}>−{rupiah(m.unitEconomics.opexPerOrder)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-card-hover)', borderRadius: 8 }}>
              <span>(−) Est. Pajak UMKM ({m.options.customTaxRatePct}%)</span>
              <strong style={{ color: '#f97316' }}>−{rupiah(m.unitEconomics.taxPerOrder)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8 }}>
              <span style={{ fontWeight: 700 }}>(=) LABA BERSIH PER ORDER</span>
              <strong style={{ color: '#10b981', fontSize: 15 }}>{rupiah(m.unitEconomics.netProfitPerOrder)}</strong>
            </div>
          </div>
        </div>

        {/* P&L Waterfall Bridge Chart */}
        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} style={{ color: '#06b6d4' }} /> Visualisasi P&L Waterfall Bridge
            </div>
          </div>
          <div className="fin-chart-body" style={{ height: 260 }}>
            <Bar data={waterfallChartData} options={baseOpts as any} />
          </div>
        </div>

        {/* Pareto Concentration Risk Audit */}
        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} style={{ color: '#ef4444' }} /> Audit Risiko Konsentrasi (Pareto 80/20)
            </div>
          </div>
          <div className="fin-chart-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>Konsentrasi Pelanggan (Top 5% Pembeli)</span>
                <strong style={{ color: m.concentration.top5CustomersSharePct > 50 ? '#ef4444' : '#10b981' }}>
                  {m.concentration.top5CustomersSharePct.toFixed(1)}% Omzet
                </strong>
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, m.concentration.top5CustomersSharePct)}%`, background: m.concentration.top5CustomersSharePct > 50 ? '#ef4444' : '#10b981' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Status: <strong>{m.concentration.paretoCustomerStatus}</strong>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>Konsentrasi Produk (Top 3 SKU)</span>
                <strong style={{ color: m.concentration.top3SkuSharePct > 60 ? '#ef4444' : '#06b6d4' }}>
                  {m.concentration.top3SkuSharePct.toFixed(1)}% Omzet
                </strong>
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, m.concentration.top3SkuSharePct)}%`, background: m.concentration.top3SkuSharePct > 60 ? '#ef4444' : '#06b6d4' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Status: <strong>{m.concentration.paretoSkuStatus}</strong>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── INTERACTIVE CFO "WHAT-IF" SENSITIVITY SIMULATOR ─────────────── */}
      <div className="fin-card" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.05), rgba(6,182,212,0.05))', border: '1px solid rgba(124,58,237,0.2)' }}>
        <div className="fin-card-header">
          <div className="fin-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: '#7c3aed' }} /> Simulasi Skenario CFO ("What-If" Sensitivity Analysis)
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => { setSimPrice(0); setSimVolume(0); setSimCogs(0); setSimOpex(0); }}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            <RefreshCw size={12} /> Reset Simulasi
          </button>
        </div>

        <div className="fin-chart-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>

          {/* Slider 1: Price Change */}
          <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>🏷️ Harga Jual (%)</span>
              <span style={{ color: simPrice >= 0 ? '#10b981' : '#ef4444' }}>{simPrice >= 0 ? `+${simPrice}` : simPrice}%</span>
            </label>
            <input type="range" min="-20" max="30" step="1" value={simPrice} onChange={e => setSimPrice(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

          {/* Slider 2: Volume Change */}
          <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>📦 Volume Order (%)</span>
              <span style={{ color: simVolume >= 0 ? '#10b981' : '#ef4444' }}>{simVolume >= 0 ? `+${simVolume}` : simVolume}%</span>
            </label>
            <input type="range" min="-30" max="50" step="1" value={simVolume} onChange={e => setSimVolume(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

          {/* Slider 3: COGS Change */}
          <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>🪙 Biaya HPP/COGS (%)</span>
              <span style={{ color: simCogs <= 0 ? '#10b981' : '#ef4444' }}>{simCogs >= 0 ? `+${simCogs}` : simCogs}%</span>
            </label>
            <input type="range" min="-20" max="30" step="1" value={simCogs} onChange={e => setSimCogs(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

          {/* Slider 4: OpEx Change */}
          <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>📣 Biaya OpEx/Ads (%)</span>
              <span style={{ color: simOpex <= 0 ? '#10b981' : '#ef4444' }}>{simOpex >= 0 ? `+${simOpex}` : simOpex}%</span>
            </label>
            <input type="range" min="-30" max="50" step="1" value={simOpex} onChange={e => setSimOpex(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

        </div>

        {/* Simulation Output Pro-Forma Comparison Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid #7c3aed40',
          borderRadius: 12,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PROYEKSI OMZET</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{rupiah(sim.projectedRev)}</div>
            <div style={{ fontSize: 11, color: sim.deltaRev >= 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>
              {sim.deltaRev >= 0 ? '+' : ''}{rupiah(sim.deltaRev)} vs aktual
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PROYEKSI LABA BERSIH</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>{rupiah(sim.projectedNetProfit)}</div>
            <div style={{ fontSize: 11, color: sim.deltaNetProfit >= 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>
              {sim.deltaNetProfit >= 0 ? '+' : ''}{rupiah(sim.deltaNetProfit)} ({sim.deltaNetProfitPct >= 0 ? '+' : ''}{sim.deltaNetProfitPct.toFixed(1)}%)
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PROYEKSI NET MARGIN</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#06b6d4', marginTop: 2 }}>{sim.projectedMarginPct.toFixed(1)}%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Aktual: {m.netMarginEstPct.toFixed(1)}%
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ── CASHFLOW CHART ─────────────────────────────────────────────── */}
      <div className="fin-card">
        <div className="fin-card-header">
          <div className="fin-card-title">Arus Kas Bulanan (Tren Pendapatan vs HPP vs Laba)</div>
        </div>
        <div className="fin-chart-body" style={{ height: 290 }}>
          <Line data={cashFlowData} options={rpTick as any} />
        </div>
      </div>

      {/* ── DISTRIBUTION & CATEGORIES ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

        {/* Category Profitability */}
        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title">Profitabilitas Per Kategori Produk</div>
          </div>
          <div className="fin-chart-body" style={{ height: 270 }}>
            <Bar data={catBarData} options={rpTick as any} />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title">Metode Pembayaran Pelanggan</div>
          </div>
          <div className="fin-chart-body" style={{ height: 270, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={paymentData} options={{ ...baseOpts, plugins: { ...baseOpts.plugins, legend: { position: 'right', labels: { color: textColor, font: { size: 10 } } } } } as any} />
          </div>
        </div>

      </div>

      {/* ── TOP CUSTOMERS & TOP PRODUCTS ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>

        {/* Top Customers */}
        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title">Top 10 Pelanggan Paling Menguntungkan</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="fin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama</th>
                  <th style={{ textAlign: 'right' }}>Order</th>
                  <th style={{ textAlign: 'right' }}>Omzet</th>
                  <th style={{ textAlign: 'right' }}>Profit Est</th>
                </tr>
              </thead>
              <tbody>
                {m.topCustomers.map((c, i) => (
                  <tr key={c.name}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ textAlign: 'right' }}>{c.orders}</td>
                    <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{rupiah(c.revenue)}</td>
                    <td style={{ textAlign: 'right', color: '#7c3aed', fontWeight: 700 }}>{rupiah(c.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="fin-card">
          <div className="fin-card-header">
            <div className="fin-card-title">Top 10 Produk Terlaris & Profitabilitas</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="fin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kode Produk</th>
                  <th>Kategori</th>
                  <th style={{ textAlign: 'right' }}>Terjual</th>
                  <th style={{ textAlign: 'right' }}>Omzet</th>
                </tr>
              </thead>
              <tbody>
                {m.topProducts.map((p, i) => (
                  <tr key={p.kode}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{p.kode}</td>
                    <td><span className="badge badge-purple">{p.jenis}</span></td>
                    <td style={{ textAlign: 'right' }}>{p.orders}</td>
                    <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{rupiah(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── CFO RECOMMENDATIONS & AI ADVICE ────────────────────────────── */}
      <div className="fin-card">
        <div className="fin-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="fin-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lightbulb size={16} color="#7c3aed" /> Rekomendasi CFO & Growth Strategy
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `Semua (${m.aiAdvice.length})` },
              { id: 'critical', label: '🔴 Kritis' },
              { id: 'warning', label: '🟠 Peringatan' },
              { id: 'opportunity', label: '🔵 Peluang' },
              { id: 'excellent', label: '🟢 Prestasi' },
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setAdviceFilter(btn.id)}
                style={{
                  padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: adviceFilter === btn.id ? 700 : 500,
                  border: adviceFilter === btn.id ? '1px solid #7c3aed' : '1px solid var(--border)',
                  background: adviceFilter === btn.id ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: adviceFilter === btn.id ? '#7c3aed' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          {filteredAdvice.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
              Tidak ada rekomendasi untuk kategori filter ini.
            </div>
          ) : (
            filteredAdvice.map((advice, idx) => (
              <AdviceAccordion key={idx} a={advice} />
            ))
          )}
        </div>
      </div>

    </div>
  );
}
