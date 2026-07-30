import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check } from 'lucide-react';
import type { Customer } from '../types';
import { formatRupiah, cleanPrice } from '../utils/csvLoader';
import { calcChurn, CHURN_COLOR } from '../utils/churnEngine';
import { calcLoyalty } from '../utils/loyaltyEngine';
import { buildCustomerDNA, findDNATwins } from '../utils/commandCenterEngine';
import { getRecommendations, buildCoPurchaseMap, buildProductIndex } from '../utils/recommendEngine';
import ChatHistoryViewer from './ChatHistoryViewer';

interface Props {
  customer: Customer;
  allCustomers: Customer[];
  onClose: () => void;
  onNavigateToCustomer?: (c: Customer) => void;
}

const parseOrderDate = (dateStr: string) => {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split(/[\/\-.]/);
  if (parts.length >= 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(0);
};

const initials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
};

function RadarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const n = values.length;
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
      {rings.map((ring, ri) => {
        const pts = Array.from({ length: n }, (_, i) => getPoint(i, r * ring));
        return <polygon key={ri} points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--border)" strokeWidth={ri === 3 ? 1.5 : 0.8} opacity={0.6} />;
      })}
      {Array.from({ length: n }, (_, i) => {
        const outer = getPoint(i, r);
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="var(--border)" strokeWidth={0.8} opacity={0.5} />;
      })}
      <polygon points={polygon} fill="rgba(124,58,237,0.2)" stroke="#7c3aed" strokeWidth={2} />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#7c3aed" />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const outer = getPoint(i, r * 1.22);
        return <text key={i} x={outer.x} y={outer.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="var(--text-muted)">{labels[i]}</text>;
      })}
    </svg>
  );
}

export default function Customer360Modal({ customer, allCustomers, onClose, onNavigateToCustomer }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'journey' | 'dna' | 'chat'>('overview');
  const [copied, setCopied] = useState(false);

  const loyalty = useMemo(() => calcLoyalty(customer), [customer]);
  const churn = useMemo(() => calcChurn(customer), [customer]);
  const dna = useMemo(() => buildCustomerDNA(customer, allCustomers), [customer, allCustomers]);

  const allDNAs = useMemo(() => allCustomers.slice(0, 200).map(c => buildCustomerDNA(c, allCustomers)), [allCustomers]);
  const twins = useMemo(() => findDNATwins(dna, allDNAs, 3), [dna, allDNAs]);

  const recommendations = useMemo(() => {
    const coMap = buildCoPurchaseMap(allCustomers);
    const productIndex = buildProductIndex(allCustomers);
    return getRecommendations(customer, allCustomers, coMap, productIndex, 3);
  }, [customer, allCustomers]);

  const ordersSorted = useMemo(() => {
    return [...(customer.orders || [])].filter(o => o.jenis).sort((a, b) => {
      return parseOrderDate(a.tanggalOrder).getTime() - parseOrderDate(b.tanggalOrder).getTime();
    });
  }, [customer]);

  const daysSinceLastOrder = useMemo(() => {
    if (ordersSorted.length === 0) return null;
    const last = parseOrderDate(ordersSorted[ordersSorted.length - 1].tanggalOrder);
    return Math.floor((Date.now() - last.getTime()) / 86400000);
  }, [ordersSorted]);

  const predictedNextOrder = useMemo(() => {
    if (ordersSorted.length < 2) return null;
    const first = parseOrderDate(ordersSorted[0].tanggalOrder).getTime();
    const last = parseOrderDate(ordersSorted[ordersSorted.length - 1].tanggalOrder).getTime();
    const avgInterval = (last - first) / (ordersSorted.length - 1);
    const nextTime = last + avgInterval;
    return new Date(nextTime).toLocaleDateString('id-ID');
  }, [ordersSorted]);

  const aov = customer.orderCount > 0 ? customer.totalSpend / customer.orderCount : 0;

  const handleCopyPhone = () => {
    if (customer.wa) {
      navigator.clipboard.writeText(customer.wa).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const churnColor = CHURN_COLOR[churn.risk];
  const arcAngle = (churn.score / 100) * 270;

  const tabs = [
    { id: 'overview' as const, label: '📊 Overview' },
    { id: 'journey' as const, label: '🛤️ Journey' },
    { id: 'dna' as const, label: '🧬 DNA' },
    { id: 'chat' as const, label: '💬 Chat WA' },
  ];

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ maxWidth: 720, width: '95%', maxHeight: '85vh', backgroundColor: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white' }}>
              {initials(customer.nama)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{customer.nama}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Customer 360° View</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px', flexShrink: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5,
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid #7c3aed' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Loyalty */}
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{loyalty.tierEmoji} {loyalty.tier}</span>
                    <span style={{ fontSize: 11, color: loyalty.tierColor, fontWeight: 600 }}>{loyalty.points} pts</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${loyalty.progressPercent}%`, background: loyalty.tierColor, borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                  {loyalty.nextTier && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      {loyalty.pointsToNext} pts to {loyalty.nextTier}
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Total Spend', value: formatRupiah(customer.totalSpend), color: '#10b981' },
                    { label: 'Orders', value: String(customer.orderCount), color: '#3b82f6' },
                    { label: 'AOV', value: formatRupiah(aov), color: '#7c3aed' },
                    { label: 'Last Order', value: daysSinceLastOrder !== null ? `${daysSinceLastOrder}d ago` : '—', color: daysSinceLastOrder !== null && daysSinceLastOrder > 90 ? '#ef4444' : '#f59e0b' },
                  ].map(stat => (
                    <div key={stat.label} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{stat.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Churn Risk */}
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-secondary)', border: `1px solid ${churnColor}33` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <svg width={56} height={56} viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border)" strokeWidth="4" strokeDasharray="103.67" strokeDashoffset="0" transform="rotate(135 28 28)" />
                      <circle cx="28" cy="28" r="22" fill="none" stroke={churnColor} strokeWidth="4" strokeLinecap="round" strokeDasharray="103.67" strokeDashoffset={103.67 - (arcAngle / 270) * 103.67} transform="rotate(135 28 28)" />
                      <text x="28" y="30" textAnchor="middle" fontSize="12" fontWeight="800" fill={churnColor}>{churn.score}</text>
                    </svg>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: churnColor }}>Churn: {churn.risk}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{churn.reasons.slice(0, 2).join(', ') || 'Low risk'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {customer.wa && (
                    <>
                      <a href={`https://wa.me/${customer.wa.replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                        background: '#25D366', color: 'white', textDecoration: 'none', borderRadius: 7, fontWeight: 600, fontSize: 11,
                      }}>
                        💬 WhatsApp
                      </a>
                      <button onClick={handleCopyPhone} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 11,
                      }}>
                        {copied ? <Check size={12} /> : <Copy size={12} />} {customer.wa}
                      </button>
                    </>
                  )}
                  {customer.instagram && (
                    <a href={customer.instagram.startsWith('http') ? customer.instagram : `https://instagram.com/${customer.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                      background: 'linear-gradient(45deg,#f09433,#dc2743,#bc1888)', color: 'white', textDecoration: 'none', borderRadius: 7, fontWeight: 600, fontSize: 11,
                    }}>
                      📸 IG
                    </a>
                  )}
                </div>

                {/* Recommendations */}
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🎯 Rekomendasi Produk</div>
                  {recommendations.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recommendations.map((rec, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>{rec.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 40, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, rec.score * 15)}%`, height: '100%', background: '#7c3aed', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{rec.buyerCount} buyers</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Belum ada rekomendasi</div>
                  )}
                </div>

                {/* Predicted CLV */}
                <div style={{ padding: 14, borderRadius: 10, background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,182,212,0.05))', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Predicted CLV (12m)</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#7c3aed' }}>{formatRupiah(churn.clvPredicted12m)}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'journey' && (
            <div>
              <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {ordersSorted.map((order, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: -23, top: 2, width: 12, height: 12, borderRadius: '50%', background: '#7c3aed', border: '3px solid var(--bg-card)' }} />
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3 }}>{order.tanggalOrder}</div>
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{order.jenis}{order.type ? ` · ${order.type}` : ''}</div>
                      <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 2 }}>{formatRupiah(cleanPrice(order.totalBayar))}</div>
                    </div>
                  </div>
                ))}
              </div>
              {ordersSorted.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Belum ada order</div>
              )}
              {predictedNextOrder && (
                <div style={{ marginTop: 20, padding: 14, background: 'rgba(124,58,237,0.08)', borderRadius: 10, border: '1px dashed #7c3aed', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏳ Prediksi Order Berikutnya</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#7c3aed', marginTop: 4 }}>~{predictedNextOrder}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dna' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <RadarChart
                  values={dna.vector}
                  labels={['Recency', 'Frekuensi', 'Monetary', 'Diversity', 'Seasonal', 'Velocity']}
                />
                <div style={{ display: 'inline-flex', padding: '6px 14px', background: 'rgba(124,58,237,0.1)', borderRadius: 20, border: '1px solid rgba(124,58,237,0.2)', fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>
                  ⚡ {dna.dominantTrait}
                </div>
                {/* Dimension bars */}
                <div style={{ width: '100%', marginTop: 8 }}>
                  {[
                    ['Recency', dna.dimensions.recencyScore],
                    ['Frequency', dna.dimensions.frequencyScore],
                    ['Monetary', dna.dimensions.monetaryScore],
                    ['Diversity', dna.dimensions.diversityScore],
                    ['Seasonality', dna.dimensions.seasonalityScore],
                    ['Velocity', dna.dimensions.loyaltyVelocity],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ marginBottom: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 1 }}>
                        <span>{label as string}</span>
                        <span style={{ fontWeight: 600 }}>{Math.round((val as number) * 100)}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round((val as number) * 100)}%`, background: (val as number) > 0.7 ? '#7c3aed' : (val as number) > 0.4 ? '#3b82f6' : '#94a3b8', borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🔬 DNA Twins</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {twins.map(twin => {
                    const twinCustomer = allCustomers.find(c => c.id === twin.customerId);
                    return (
                      <div
                        key={twin.customerId}
                        onClick={() => twinCustomer && onNavigateToCustomer?.(twinCustomer)}
                        style={{
                          padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8,
                          border: '1px solid var(--border)', cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {initials(twin.customerName)}
                          </div>
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>{twin.customerName}</div>
                            <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>⚡ {twin.dominantTrait}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed' }}>
                          {Math.round(twin.similarity * 100)}%
                        </div>
                      </div>
                    );
                  })}
                  {twins.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>Tidak cukup data untuk matching</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div style={{ minHeight: '420px' }}>
              <ChatHistoryViewer waNumber={customer.wa} customerName={customer.nama} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
