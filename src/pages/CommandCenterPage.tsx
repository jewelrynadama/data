// src/pages/CommandCenterPage.tsx
// PearlMind™ Command Center — 5 unprecedented AI analytics running 100% client-side
import { useState, useMemo, useCallback } from 'react';
import { Zap, Brain, Copy, Check, ChevronRight, Info, BarChart2, TrendingUp } from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah } from '../utils/csvLoader';
import {
  buildCustomerDNA,
  findDNATwins,
  buildRevenueForecast,
  buildAutopilotQueue,
  calcBusinessHealth,
  type ActionType,
} from '../utils/commandCenterEngine';
import { buildCohortRetention } from '../utils/recommendEngine';

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
  onSelectCustomer?: (c: Customer) => void;
}

const URGENCY_COLOR = {
  CRITICAL: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#3b82f6',
  LOW: '#10b981',
};

const ACTION_COLORS: Record<ActionType, string> = {
  WIN_BACK: 'linear-gradient(135deg,#ef444422,#ef444408)',
  BIRTHDAY_VIP: 'linear-gradient(135deg,#f59e0b22,#f59e0b08)',
  ORDER_CYCLE_NUDGE: 'linear-gradient(135deg,#3b82f622,#3b82f608)',
  UPSELL_HIGHVALUE: 'linear-gradient(135deg,#7c3aed22,#7c3aed08)',
  FIRST_REORDER: 'linear-gradient(135deg,#06b6d422,#06b6d408)',
  CHURN_ALERT: 'linear-gradient(135deg,#dc262622,#dc262608)',
  THANK_YOU: 'linear-gradient(135deg,#10b98122,#10b98108)',
};

function RadarChart({ values, labels, size = 180 }: { values: number[]; labels: string[]; size?: number }) {
  const n = values.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const angleStep = (2 * Math.PI) / n;
  const angleOffset = -Math.PI / 2;

  const getPoint = (i: number, radius: number) => {
    const angle = angleOffset + i * angleStep;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  };

  const dataPoints = values.map((v, i) => getPoint(i, r * v));
  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {/* Grid rings */}
      {rings.map((ring, ri) => {
        const pts = Array.from({ length: n }, (_, i) => getPoint(i, r * ring));
        return (
          <polygon
            key={ri}
            points={pts.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--border)"
            strokeWidth={ri === 3 ? 1.5 : 0.8}
            opacity={0.6}
          />
        );
      })}
      {/* Axis lines */}
      {Array.from({ length: n }, (_, i) => {
        const outer = getPoint(i, r);
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="var(--border)" strokeWidth={0.8} opacity={0.5} />;
      })}
      {/* Data polygon */}
      <polygon
        points={polygon}
        fill="rgba(124,58,237,0.2)"
        stroke="#7c3aed"
        strokeWidth={2}
      />
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#7c3aed" />
      ))}
      {/* Labels */}
      {Array.from({ length: n }, (_, i) => {
        const outer = getPoint(i, r * 1.22);
        return (
          <text
            key={i}
            x={outer.x}
            y={outer.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill="var(--text-muted)"
          >
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}

function CohortHeatmap({ customers }: { customers: Customer[] }) {
  const cohorts = useMemo(() => buildCohortRetention(customers, 8), [customers]);

  const getColor = (pct: number) => {
    if (pct < 0) return 'transparent'; // future
    if (pct >= 60) return `rgba(16,185,129,${0.3 + pct / 200})`;
    if (pct >= 30) return `rgba(245,158,11,${0.2 + pct / 250})`;
    if (pct >= 10) return `rgba(239,68,68,${0.15 + pct / 400})`;
    return 'rgba(239,68,68,0.08)';
  };

  if (cohorts.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>Data tidak cukup untuk analisis kohort (min 3 bulan)</div>;
  }

  const maxCols = Math.max(...cohorts.map(c => c.retention.length));

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', minWidth: 80 }}>Kohort</th>
            <th style={{ padding: '4px 6px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', minWidth: 40 }}>N</th>
            {Array.from({ length: maxCols }, (_, i) => (
              <th key={i} style={{ padding: '4px 6px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', minWidth: 40 }}>
                M+{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((row) => (
            <tr key={row.cohortMonth}>
              <td style={{ padding: '3px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {row.cohortLabel}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {row.totalCustomers}
              </td>
              {row.retention.map((pct, i) => (
                <td
                  key={i}
                  style={{
                    padding: '3px 6px',
                    textAlign: 'center',
                    background: getColor(pct),
                    color: pct >= 30 ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: pct >= 50 ? 700 : 400,
                    borderRadius: 3,
                  }}
                >
                  {pct < 0 ? '' : `${pct}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForecastChart({ rows }: { rows: CustomerRow[] }) {
  const points = useMemo(() => buildRevenueForecast(rows, 4), [rows]);

  if (points.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Tidak cukup data historis untuk forecast (min 3 bulan)</div>;
  }

  const allVals = points.flatMap(p => [
    p.historical, p.ensemble, p.confidenceLow, p.confidenceHigh,
  ]).filter(v => v !== null && v > 0) as number[];
  const maxVal = Math.max(...allVals, 1);
  const W = 100; // percentage width
  const H = 140; // px height
  const n = points.length;
  const step = W / (n - 1);

  const scaleY = (v: number) => H - (v / maxVal) * H;

  // Build SVG path
  const histPoints = points.map((p, i) => p.historical !== null ? { x: i * step, y: scaleY(p.historical) } : null).filter(Boolean) as {x:number;y:number}[];
  const ensPoints = points.map((p, i) => p.ensemble !== null ? { x: i * step, y: scaleY(p.ensemble) } : null).filter(Boolean) as {x:number;y:number}[];

  const histPath = histPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)}% ${p.y.toFixed(2)}`).join(' ');
  const ensPath = ensPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)}% ${p.y.toFixed(2)}`).join(' ');

  // Confidence band
  const forecastPts = points.filter(p => p.confidenceLow !== null && p.confidenceHigh !== null);
  const fStartIdx = points.findIndex(p => p.ensemble !== null && p.historical === null);
  const bandTop = forecastPts.map((_, fi) => {
    const i = fStartIdx + fi;
    return { x: i * step, y: scaleY(points[fStartIdx + fi].confidenceHigh!) };
  });
  const bandBot = [...forecastPts].reverse().map((_, fi) => {
    const i = fStartIdx + (forecastPts.length - 1 - fi);
    return { x: i * step, y: scaleY(points[i].confidenceLow!) };
  });
  const bandPath = [...bandTop, ...bandBot].map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)}% ${p.y.toFixed(2)}`).join(' ') + 'Z';

  return (
    <div>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, overflow: 'visible' }}>
        {/* Confidence band */}
        {forecastPts.length > 0 && <path d={bandPath} fill="rgba(124,58,237,0.1)" vectorEffect="non-scaling-stroke" />}
        {/* Historical line */}
        {histPath && <path d={histPath} fill="none" stroke="#7c3aed" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        {/* Ensemble forecast line */}
        {ensPath && <path d={ensPath} fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="6,3" vectorEffect="non-scaling-stroke" />}
        {/* Points */}
        {points.map((p, i) => (
          p.historical !== null && (
            <circle key={`h${i}`} cx={`${(i * step).toFixed(2)}%`} cy={scaleY(p.historical)} r={2.5} fill="#7c3aed" vectorEffect="non-scaling-stroke" />
          )
        ))}
        {points.map((p, i) => (
          p.ensemble !== null && (
            <circle key={`e${i}`} cx={`${(i * step).toFixed(2)}%`} cy={scaleY(p.ensemble)} r={2.5} fill="#06b6d4" vectorEffect="non-scaling-stroke" />
          )
        ))}
      </svg>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {points.filter((_, i) => i % Math.max(1, Math.floor(n / 6)) === 0 || i === n - 1).map((p) => (
          <div key={p.label} style={{ fontSize: 9.5, color: 'var(--text-muted)', textAlign: 'center', flex: '0 0 auto' }}>
            <div>{p.label}</div>
            <div style={{ fontWeight: 600, color: p.ensemble !== null ? '#06b6d4' : 'var(--text-secondary)' }}>
              {p.historical !== null
                ? formatRupiah(p.historical).replace('Rp', '')
                : p.ensemble !== null
                ? `≈${formatRupiah(p.ensemble).replace('Rp', '')}`
                : ''}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10.5 }}>
        <span style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#7c3aed', borderRadius: 1 }} /> Aktual
        </span>
        <span style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#06b6d4', borderRadius: 1, borderTop: '2px dashed #06b6d4' }} /> Ensemble Forecast
        </span>
        <span style={{ color: 'rgba(124,58,237,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 14, height: 10, background: 'rgba(124,58,237,0.15)', borderRadius: 2 }} /> Confidence Band
        </span>
      </div>
    </div>
  );
}

export default function CommandCenterPage({ customers = [], rows = [], onSelectCustomer }: Props) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'actions' | 'cohort' | 'forecast'>('actions');

  const safeCustomers = useMemo(() => customers || [], [customers]);
  const safeRows = useMemo(() => rows || [], [rows]);

  const health = useMemo(() => calcBusinessHealth(safeCustomers, safeRows), [safeCustomers, safeRows]);
  const autopilot = useMemo(() => buildAutopilotQueue(safeCustomers), [safeCustomers]);

  const allDNAs = useMemo(() =>
    safeCustomers.slice(0, 200).map(c => buildCustomerDNA(c, safeCustomers)),
  [safeCustomers]);

  const selectedDNA = useMemo(() => {
    if (!selectedCustomerId) return null;
    return allDNAs.find(d => d.customerId === selectedCustomerId) ?? null;
  }, [selectedCustomerId, allDNAs]);

  const twins = useMemo(() => {
    if (!selectedDNA) return [];
    return findDNATwins(selectedDNA, allDNAs, 3);
  }, [selectedDNA, allDNAs]);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const gradeColor = health.grade === 'A+' || health.grade === 'A' ? '#10b981'
    : health.grade === 'B' ? '#3b82f6'
    : health.grade === 'C' ? '#f59e0b'
    : '#ef4444';

  const trendLabel = {
    improving: '▲ Membaik',
    stable: '→ Stabil',
    declining: '▼ Menurun',
  }[health.trend];
  const trendColor = health.trend === 'improving' ? '#10b981' : health.trend === 'declining' ? '#ef4444' : '#f59e0b';

  return (
    <div className="page-body">
      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#7c3aed,#06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
          }}>
            <Brain size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>
              PearlMind™ Command Center
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              5 AI Engines · 100% Client-Side · No API Required
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 1: BUSINESS HEALTH SCORE ──────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          {/* Score Gauge */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: `conic-gradient(${gradeColor} ${health.total * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 24px ${gradeColor}44`,
              margin: '0 auto 8px',
              position: 'relative',
            }}>
              <div style={{
                width: 76, height: 76, borderRadius: '50%',
                background: 'var(--bg-card)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{health.grade}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{health.total}/100</div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Business Health™</div>
            <div style={{ fontSize: 11, color: trendColor, fontWeight: 600 }}>{trendLabel}</div>
          </div>

          {/* 8 Dimensions Grid */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>
              8 DIMENSI BISNIS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {health.dimensions.map(d => (
                <div key={d.name} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 8,
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${d.status === 'critical' ? '#ef444433' : d.status === 'warning' ? '#f59e0b33' : 'var(--border)'}`,
                }}>
                  <span style={{ fontSize: 14 }}>{d.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.detail}</div>
                  </div>
                  <div style={{
                    minWidth: 32, textAlign: 'right', fontWeight: 700, fontSize: 13,
                    color: d.status === 'excellent' ? '#10b981' : d.status === 'good' ? '#3b82f6' : d.status === 'warning' ? '#f59e0b' : '#ef4444',
                  }}>
                    {d.score}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              💡 {health.summary}
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 2: MAIN CONTENT ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 20 }}>
        {/* LEFT: Tabs panel */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Tab Bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 4px' }}>
            {([
              { id: 'actions', label: '🤖 Autopilot Actions', icon: Zap },
              { id: 'cohort', label: '🔥 Cohort Survival', icon: BarChart2 },
              { id: 'forecast', label: '📡 Revenue Forecast', icon: TrendingUp },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 14px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent-purple)' : '2px solid transparent',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ padding: 16 }}>
            {activeTab === 'actions' && (
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
                  <strong>{autopilot.length}</strong> aksi diprioritaskan hari ini berdasarkan churn score, siklus order, dan nilai ROI
                </div>
                {autopilot.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div>Tidak ada aksi mendesak hari ini!</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {autopilot.map((action) => (
                      <div
                        key={action.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: ACTION_COLORS[action.type],
                          border: `1px solid ${URGENCY_COLOR[action.urgency]}33`,
                          display: 'flex', gap: 12, alignItems: 'flex-start',
                        }}
                      >
                        {/* Urgency badge */}
                        <div style={{ flexShrink: 0 }}>
                          <div style={{
                            background: URGENCY_COLOR[action.urgency],
                            color: 'white', borderRadius: 5,
                            padding: '2px 7px', fontSize: 9.5, fontWeight: 700,
                          }}>
                            {action.urgency}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
                            {action.daysInfo}
                          </div>
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2, color: 'var(--text-primary)' }}>
                            {action.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                            {action.reason}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, color: '#10b981', fontWeight: 600 }}>
                              📊 Potensi: {formatRupiah(action.expectedRevenue)}
                            </span>
                          </div>
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                          {action.customer.wa && (
                            <a
                              href={`https://wa.me/${action.customer.wa.replace(/\D/g,'').replace(/^0/,'62')}?text=${encodeURIComponent(action.waTemplate)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '5px 10px', borderRadius: 6, fontSize: 10.5,
                                background: '#25D366', color: 'white', fontWeight: 600,
                                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              💬 Kirim WA
                            </a>
                          )}
                          <button
                            onClick={() => handleCopy(action.id, action.waTemplate)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, fontSize: 10.5,
                              background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                              border: '1px solid var(--border)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {copiedId === action.id ? <Check size={10} /> : <Copy size={10} />}
                            Salin
                          </button>
                          {onSelectCustomer && (
                            <button
                              onClick={() => { onSelectCustomer(action.customer); setSelectedCustomerId(action.customer.id); }}
                              style={{
                                padding: '5px 10px', borderRadius: 6, fontSize: 10.5,
                                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                                border: '1px solid var(--border)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              DNA <ChevronRight size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cohort' && (
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Berapa % pelanggan dari setiap kohort yang masih aktif membeli di bulan berikutnya (M+1, M+2, dst).
                  <strong style={{ color: '#10b981' }}> Hijau = retensi bagus</strong>,
                  <strong style={{ color: '#ef4444' }}> Merah = banyak yang kabur</strong>.
                </div>
                <CohortHeatmap customers={customers} />
              </div>
            )}

            {activeTab === 'forecast' && (
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Ensemble dari 3 algoritma: <strong>Linear Regression</strong> (tren jangka panjang) +
                  <strong> Exponential Smoothing</strong> (responsif tren baru) +
                  <strong> Seasonal Naive</strong> (pola musiman). Confidence band ±1σ.
                </div>
                <ForecastChart rows={rows} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Customer DNA Explorer */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={14} style={{ color: '#7c3aed' }} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>Customer DNA™</span>
            <div title="Fingerprint perilaku 6-dimensi. Temukan pelanggan dengan pola yang mirip." style={{ cursor: 'help', marginLeft: 'auto' }}>
              <Info size={12} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Customer Selector */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <select
              value={selectedCustomerId ?? ''}
              onChange={e => setSelectedCustomerId(e.target.value || null)}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 12,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', cursor: 'pointer',
              }}
            >
              <option value="">— Pilih customer —</option>
              {customers.slice(0, 300).map(c => (
                <option key={c.id} value={c.id}>{c.nama}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, padding: '12px 16px', overflow: 'auto' }}>
            {!selectedDNA ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🧬</div>
                <div style={{ fontSize: 12 }}>Pilih customer untuk melihat behavioral fingerprint mereka</div>
              </div>
            ) : (
              <>
                {/* Radar Chart */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <RadarChart
                    values={selectedDNA.vector}
                    labels={['Recency', 'Frekuensi', 'Monetary', 'Diversity', 'Seasonal', 'Velocity']}
                    size={200}
                  />
                </div>

                {/* Dominant Trait */}
                <div style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                  marginBottom: 12, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>DOMINANT TRAIT</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>
                    ⚡ {selectedDNA.dominantTrait}
                  </div>
                </div>

                {/* Dimension Bars */}
                <div style={{ marginBottom: 14 }}>
                  {[
                    ['Recency', selectedDNA.dimensions.recencyScore],
                    ['Frequency', selectedDNA.dimensions.frequencyScore],
                    ['Monetary', selectedDNA.dimensions.monetaryScore],
                    ['Diversity', selectedDNA.dimensions.diversityScore],
                    ['Seasonality', selectedDNA.dimensions.seasonalityScore],
                    ['Velocity', selectedDNA.dimensions.loyaltyVelocity],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>
                        <span>{label as string}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round((val as number) * 100)}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${Math.round((val as number) * 100)}%`,
                          background: (val as number) > 0.7 ? '#7c3aed' : (val as number) > 0.4 ? '#3b82f6' : '#94a3b8',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* DNA Twins */}
                {twins.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.5px' }}>
                      🔬 DNA TWINS (Pelanggan Paling Mirip)
                    </div>
                    {twins.map(twin => (
                      <div
                        key={twin.customerId}
                        style={{
                          padding: '8px 10px', borderRadius: 8,
                          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                          marginBottom: 6, cursor: 'pointer',
                        }}
                        onClick={() => setSelectedCustomerId(twin.customerId)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600 }}>{twin.customerName}</span>
                          <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700 }}>
                            {Math.round(twin.similarity * 100)}% match
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          ⚡ {twin.dominantTrait}
                        </div>
                        <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', marginTop: 5, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${Math.round(twin.similarity * 100)}%`,
                            background: 'linear-gradient(90deg,#7c3aed,#06b6d4)', borderRadius: 2,
                          }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                      💡 Kirim campaign yang sama ke DNA Twins untuk ROI lebih tinggi
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── FOOTER: Quick Stats ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Customers', val: customers.length, icon: '👥', color: '#7c3aed' },
          { label: 'Churn Critical', val: autopilot.filter(a => a.type === 'WIN_BACK').length, icon: '🚨', color: '#ef4444' },
          { label: 'Aksi Hari Ini', val: autopilot.filter(a => a.urgency === 'CRITICAL' || a.urgency === 'HIGH').length, icon: '⚡', color: '#f59e0b' },
          { label: 'Health Score', val: `${health.total}/100`, icon: '🏥', color: gradeColor },
          { label: 'VIP Customers', val: customers.filter(c => c.totalSpend > 15000000 || c.orderCount >= 5).length, icon: '👑', color: '#10b981' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
