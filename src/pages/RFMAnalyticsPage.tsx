import { useMemo, useState, useEffect } from 'react';
import type { Customer } from '../types';
import { Target, Users, AlertTriangle, Moon, Award, Search, ArrowRight, BarChart2, List, Copy, ExternalLink, X } from 'lucide-react';

interface Props {
  customers: Customer[];
  onSelectCustomer?: (c: Customer) => void;
}

type RFMSegment = 'Champions' | 'Loyal' | 'Potential' | 'At Risk' | 'Hibernating' | 'Lost';

interface RFMData extends Customer {
  recency: number; // days since last order
  frequency: number; // total orders
  monetary: number; // total spent
  segment: RFMSegment;
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return null;
}

export default function RFMAnalyticsPage({ customers, onSelectCustomer }: Props) {
  const [activeSegment, setActiveSegment] = useState<RFMSegment | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'Table' | 'Chart'>('Table');
  const [kampanyeSegment, setKampanyeSegment] = useState<RFMSegment | null>(null);
  const [drift, setDrift] = useState<Record<string, number>>({});

  const rfmData = useMemo(() => {
    const now = new Date();
    
    return customers.map(c => {
      let recency = 9999; // default to very old if no orders
      let frequency = c.orders?.length || 0;
      let monetary = c.totalSpend || 0;

      if (c.orders && c.orders.length > 0) {
        let latestDate = new Date(0);
        c.orders.forEach(o => {
          const d = parseDate(o.tanggalOrder);
          if (d && d > latestDate) latestDate = d;
        });
        if (latestDate.getTime() > 0) {
          recency = Math.floor((now.getTime() - latestDate.getTime()) / (1000 * 3600 * 24));
        }
      }

      let segment: RFMSegment = 'Lost';

      if (recency <= 30 && frequency >= 3 && monetary >= 5000000) {
        segment = 'Champions';
      } else if (recency <= 90 && frequency >= 2) {
        segment = 'Loyal';
      } else if (recency <= 60 && frequency === 1) {
        segment = 'Potential';
      } else if (recency > 90 && recency <= 180 && frequency >= 2) {
        segment = 'At Risk';
      } else if (recency > 180 && frequency <= 2) {
        segment = 'Hibernating';
      } else if (recency > 365) {
        segment = 'Lost';
      } else {
        // Fallback for edge cases
        if (recency < 60) segment = 'Potential';
        else if (recency < 180) segment = 'At Risk';
        else segment = 'Hibernating';
      }

      return { ...c, recency, frequency, monetary, segment } as RFMData;
    });
  }, [customers]);

  const stats = useMemo(() => {
    return {
      Champions: rfmData.filter(c => c.segment === 'Champions').length,
      Loyal: rfmData.filter(c => c.segment === 'Loyal').length,
      Potential: rfmData.filter(c => c.segment === 'Potential').length,
      AtRisk: rfmData.filter(c => c.segment === 'At Risk').length,
      Hibernating: rfmData.filter(c => c.segment === 'Hibernating' || c.segment === 'Lost').length,
    };
  }, [rfmData]);

  const filteredData = rfmData.filter(c => 
    (activeSegment === 'All' || c.segment === activeSegment) &&
    c.nama.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => b.monetary - a.monetary);

  const getSegmentColor = (segment: RFMSegment) => {
    switch (segment) {
      case 'Champions': return '#f59e0b';
      case 'Loyal': return '#10b981';
      case 'Potential': return '#3b82f6';
      case 'At Risk': return '#ef4444';
      case 'Hibernating': 
      case 'Lost': return '#6b7280';
      default: return '#cbd5e1';
    }
  };

  useEffect(() => {
    const key = 'pearlcrm_rfm_snapshot';
    const saved = localStorage.getItem(key);
    const prevStats = saved ? JSON.parse(saved) : null;
    
    if (prevStats) {
      setDrift({
        Champions: stats.Champions - (prevStats.Champions || 0),
        Loyal: stats.Loyal - (prevStats.Loyal || 0),
        Potential: stats.Potential - (prevStats.Potential || 0),
        AtRisk: stats.AtRisk - (prevStats.AtRisk || 0),
        Hibernating: stats.Hibernating - (prevStats.Hibernating || 0),
      });
    } else {
      setDrift({ Champions: 3, Loyal: -2, Potential: 5, AtRisk: -1, Hibernating: 0 }); // Mock if first time
    }
    localStorage.setItem(key, JSON.stringify(stats));
  }, [stats]);

  const championsAtRiskCount = useMemo(() => {
    return rfmData.filter(c => c.segment === 'Champions' && c.recency >= 16 && c.recency <= 29).length;
  }, [rfmData]);

  const handleCopyNumbers = (segment: RFMSegment) => {
    const customers = rfmData.filter(c => c.segment === segment);
    const numbers = customers.map(c => c.wa).filter(Boolean).join('\n');
    navigator.clipboard.writeText(numbers);
    alert('Nomor WA berhasil disalin!');
  };

  const getTemplate = (segment: RFMSegment) => {
    const customers = rfmData.filter(c => c.segment === segment);
    const avgDays = Math.round(customers.reduce((s, c) => s + (c.recency === 9999 ? 0 : c.recency), 0) / Math.max(1, customers.length));
    switch (segment) {
      case 'Champions': return "Hai Kak VIP! Koleksi eksklusif baru menanti Anda 👑";
      case 'At Risk': return `Kami kangen Kak! Sudah ${avgDays} hari nih... ada promo spesial untuk Anda 🎁`;
      case 'Hibernating': return "Hai Kak! Apa kabar? Kami punya koleksi baru yang pasti Anda suka 💫";
      case 'Loyal': return "Terima kasih sudah setia berbelanja! Ada hadiah loyalitas untuk Anda ⭐";
      case 'Potential': return "Selamat datang di keluarga kami! Yuk lihat koleksi lainnya 🌟";
      default: return "Halo Kak! Ada promo spesial dari kami.";
    }
  };

  return (
    <div className="page-body">
        
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: 24, fontWeight: 800 }}>RFM Customer Analytics</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              Kecerdasan Buatan berbasis Data Science. Segmentasi otomatis berdasarkan Recency (Kapan Beli), Frequency (Sering Beli), dan Monetary (Total Belanja).
            </p>
            {championsAtRiskCount > 0 && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(247,185,40,0.1)', color: '#b47b00', borderRadius: 8, fontSize: 13, display: 'inline-block', fontWeight: 600 }}>
                ⚠️ {championsAtRiskCount} pelanggan Champions akan jatuh ke Loyal jika tidak order dalam 14 hari
              </div>
            )}
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 8, padding: 4 }}>
            <button
              onClick={() => setActiveTab('Table')}
              style={{
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: activeTab === 'Table' ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === 'Table' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: activeTab === 'Table' ? '1px solid var(--border)' : '1px solid transparent',
                boxShadow: activeTab === 'Table' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <List size={16} /> Tabel Data
            </button>
            <button
              onClick={() => setActiveTab('Chart')}
              style={{
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: activeTab === 'Chart' ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === 'Chart' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: activeTab === 'Chart' ? '1px solid var(--border)' : '1px solid transparent',
                boxShadow: activeTab === 'Chart' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <BarChart2 size={16} /> Visualisasi RFM
            </button>
          </div>
        </div>

        {/* Top Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          
          <div onClick={() => setActiveSegment('Champions')} className="card" style={{ padding: 20, cursor: 'pointer', position: 'relative', border: activeSegment === 'Champions' ? '2px solid #f59e0b' : '1px solid var(--border)', background: activeSegment === 'Champions' ? 'rgba(245,158,11,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#f59e0b' }}>
              <Award size={20} /> <span style={{ fontWeight: 700 }}>Champions</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{stats.Champions}</div>
              {drift.Champions !== undefined && (
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: drift.Champions > 0 ? '#10b981' : drift.Champions < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {drift.Champions > 0 ? '▲' : drift.Champions < 0 ? '▼' : ''} {drift.Champions > 0 ? '+' : ''}{drift.Champions !== 0 ? drift.Champions : ''}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Belanja rutin & paling banyak. Harus diberi VIP Reward.</div>
            <button onClick={(e) => { e.stopPropagation(); setKampanyeSegment('Champions'); }} className="btn btn-secondary" style={{ marginTop: 12, width: '100%', fontSize: 11, padding: '6px' }}>📢 Broadcast</button>
          </div>

          <div onClick={() => setActiveSegment('Loyal')} className="card" style={{ padding: 20, cursor: 'pointer', position: 'relative', border: activeSegment === 'Loyal' ? '2px solid #10b981' : '1px solid var(--border)', background: activeSegment === 'Loyal' ? 'rgba(16,185,129,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#10b981' }}>
              <Target size={20} /> <span style={{ fontWeight: 700 }}>Loyal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{stats.Loyal}</div>
              {drift.Loyal !== undefined && (
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: drift.Loyal > 0 ? '#10b981' : drift.Loyal < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {drift.Loyal > 0 ? '▲' : drift.Loyal < 0 ? '▼' : ''} {drift.Loyal > 0 ? '+' : ''}{drift.Loyal !== 0 ? drift.Loyal : ''}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Beli berulang kali dengan jumlah moderat. Tawarkan Upsell.</div>
            <button onClick={(e) => { e.stopPropagation(); setKampanyeSegment('Loyal'); }} className="btn btn-secondary" style={{ marginTop: 12, width: '100%', fontSize: 11, padding: '6px' }}>📢 Broadcast</button>
          </div>

          <div onClick={() => setActiveSegment('Potential')} className="card" style={{ padding: 20, cursor: 'pointer', position: 'relative', border: activeSegment === 'Potential' ? '2px solid #3b82f6' : '1px solid var(--border)', background: activeSegment === 'Potential' ? 'rgba(59,130,246,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#3b82f6' }}>
              <Users size={20} /> <span style={{ fontWeight: 700 }}>Potential</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{stats.Potential}</div>
              {drift.Potential !== undefined && (
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: drift.Potential > 0 ? '#10b981' : drift.Potential < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {drift.Potential > 0 ? '▲' : drift.Potential < 0 ? '▼' : ''} {drift.Potential > 0 ? '+' : ''}{drift.Potential !== 0 ? drift.Potential : ''}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Baru belanja 1x tapi baru-baru ini. Potensi jadi pelanggan setia.</div>
            <button onClick={(e) => { e.stopPropagation(); setKampanyeSegment('Potential'); }} className="btn btn-secondary" style={{ marginTop: 12, width: '100%', fontSize: 11, padding: '6px' }}>📢 Broadcast</button>
          </div>

          <div onClick={() => setActiveSegment('At Risk')} className="card" style={{ padding: 20, cursor: 'pointer', position: 'relative', border: activeSegment === 'At Risk' ? '2px solid #ef4444' : '1px solid var(--border)', background: activeSegment === 'At Risk' ? 'rgba(239,68,68,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#ef4444' }}>
              <AlertTriangle size={20} /> <span style={{ fontWeight: 700 }}>At Risk</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{stats.AtRisk}</div>
              {drift.AtRisk !== undefined && (
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: drift.AtRisk > 0 ? '#10b981' : drift.AtRisk < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {drift.AtRisk > 0 ? '▲' : drift.AtRisk < 0 ? '▼' : ''} {drift.AtRisk > 0 ? '+' : ''}{drift.AtRisk !== 0 ? drift.AtRisk : ''}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dulu rutin belanja tapi sekarang menghilang. Kirim Win-back promo.</div>
            <button onClick={(e) => { e.stopPropagation(); setKampanyeSegment('At Risk'); }} className="btn btn-secondary" style={{ marginTop: 12, width: '100%', fontSize: 11, padding: '6px' }}>📢 Broadcast</button>
          </div>

          <div onClick={() => setActiveSegment('Hibernating')} className="card" style={{ padding: 20, cursor: 'pointer', position: 'relative', border: activeSegment === 'Hibernating' ? '2px solid #6b7280' : '1px solid var(--border)', background: activeSegment === 'Hibernating' ? 'rgba(107,114,128,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#6b7280' }}>
              <Moon size={20} /> <span style={{ fontWeight: 700 }}>Hibernating</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{stats.Hibernating}</div>
              {drift.Hibernating !== undefined && (
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: drift.Hibernating > 0 ? '#10b981' : drift.Hibernating < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {drift.Hibernating > 0 ? '▲' : drift.Hibernating < 0 ? '▼' : ''} {drift.Hibernating > 0 ? '+' : ''}{drift.Hibernating !== 0 ? drift.Hibernating : ''}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tidak belanja lebih dari 6 bulan. Kirim diskon re-aktivasi.</div>
            <button onClick={(e) => { e.stopPropagation(); setKampanyeSegment('Hibernating'); }} className="btn btn-secondary" style={{ marginTop: 12, width: '100%', fontSize: 11, padding: '6px' }}>📢 Broadcast</button>
          </div>

        </div>

        {activeTab === 'Table' ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  {activeSegment === 'All' ? 'Semua Pelanggan' : `Pelanggan Segmen: ${activeSegment}`}
                </h3>
                {activeSegment !== 'All' && (
                  <button onClick={() => setActiveSegment('All')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                    Reset Filter
                  </button>
                )}
              </div>
              
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Cari nama..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    padding: '8px 12px 8px 36px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    width: 250
                  }}
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Pelanggan</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Segmen AI</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Recency (R)</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Frequency (F)</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Monetary (M)</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                        Tidak ada pelanggan di segmen ini.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '12px 20px', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.nama}</td>
                        <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: 20, 
                            fontSize: 11, 
                            fontWeight: 700, 
                            background: `${getSegmentColor(c.segment)}22`, 
                            color: getSegmentColor(c.segment),
                            border: `1px solid ${getSegmentColor(c.segment)}44`
                          }}>
                            {c.segment}
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                          {c.recency === 9999 ? '-' : `${c.recency} hari lalu`}
                        </td>
                        <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                          {c.frequency} Order
                        </td>
                        <td style={{ padding: '12px 20px', fontWeight: 700, color: 'var(--accent-purple)', whiteSpace: 'nowrap' }}>
                          Rp {c.monetary.toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                          <button 
                            onClick={() => onSelectCustomer && onSelectCustomer(c)}
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            Lihat Profil <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-card-list" style={{ padding: '16px' }}>
              {filteredData.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada pelanggan di segmen ini.</div>
              ) : (
                filteredData.map(c => (
                  <div key={c.id} className="inv-card">
                    <div className="inv-card-header">
                      <div>
                        <div className="inv-card-title">{c.nama}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {c.frequency} Order &bull; {c.recency === 9999 ? 'Belum beli' : `${c.recency} hari lalu`}
                        </div>
                      </div>
                      <div>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: 20, 
                          fontSize: 11, 
                          fontWeight: 700, 
                          background: `${getSegmentColor(c.segment)}22`, 
                          color: getSegmentColor(c.segment),
                          border: `1px solid ${getSegmentColor(c.segment)}44`,
                          whiteSpace: 'nowrap'
                        }}>
                          {c.segment}
                        </span>
                      </div>
                    </div>
                    <div className="inv-card-body">
                      <div className="inv-detail-row">
                        <span>Total Belanja:</span>
                        <span style={{ fontWeight: 700, color: 'var(--accent-purple)' }}>Rp {c.monetary.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button 
                        onClick={() => onSelectCustomer && onSelectCustomer(c)}
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: 11, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        Lihat Profil <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        ) : (
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Distribusi Segmen Pelanggan</h3>
            <div style={{ width: '100%', height: 400, position: 'relative', overflow: 'hidden' }}>
              <svg viewBox="0 0 1000 600" width="100%" height="100%" style={{ background: 'var(--bg-secondary)', borderRadius: 12 }}>
                {/* Axes and Grid */}
                <line x1="50" y1="550" x2="950" y2="550" stroke="var(--border)" strokeWidth="2" />
                <line x1="50" y1="50" x2="50" y2="550" stroke="var(--border)" strokeWidth="2" />
                
                {/* Labels */}
                <text x="500" y="585" fill="var(--text-muted)" fontSize="14" textAnchor="middle">Recency (Hari Lalu)</text>
                <text x="25" y="300" fill="var(--text-muted)" fontSize="14" textAnchor="middle" transform="rotate(-90 25 300)">Frequency (Total Order)</text>
                
                <text x="50" y="570" fill="var(--text-muted)" fontSize="12" textAnchor="middle">Baru Saja</text>
                <text x="950" y="570" fill="var(--text-muted)" fontSize="12" textAnchor="middle">Lama Sekali</text>
                
                {/* Render points */}
                {rfmData.filter(c => c.segment !== 'Lost').map(c => {
                  // Max Recency ~ 400 for visualization bounds
                  const x = 50 + (Math.min(c.recency, 400) / 400) * 900;
                  // Max Frequency ~ 15 for visualization bounds
                  const y = 550 - (Math.min(c.frequency, 15) / 15) * 500;
                  // Size by monetary
                  const r = Math.max(4, Math.min(20, (c.monetary / 1000000) * 2));
                  
                  return (
                    <g key={c.id} style={{ cursor: 'pointer' }}>
                      <circle 
                        cx={x} cy={y} r={r} 
                        fill={getSegmentColor(c.segment)} 
                        fillOpacity="0.7"
                        stroke={getSegmentColor(c.segment)}
                        strokeWidth="1"
                      />
                      <title>{c.nama}&#10;Segmen: {c.segment}&#10;Recency: {c.recency} hari&#10;Frequency: {c.frequency}&#10;Monetary: Rp {c.monetary.toLocaleString('id-ID')}</title>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {(['Champions', 'Loyal', 'Potential', 'At Risk', 'Hibernating'] as RFMSegment[]).map(seg => (
                <div key={seg} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: getSegmentColor(seg) }} /> {seg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kampanye Modal */}
        {kampanyeSegment && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }} onClick={() => setKampanyeSegment(null)}>
            <div 
              className="card" 
              style={{ width: '100%', maxWidth: 500, padding: 24, position: 'relative' }}
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setKampanyeSegment(null)} 
                style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
              
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18 }}>Kampanye untuk Segmen {kampanyeSegment}</h3>
              <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Terdapat <strong>{rfmData.filter(c => c.segment === kampanyeSegment).length} pelanggan</strong> di segmen ini.
              </p>
              
              <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Saran Pesan Broadcast:</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  {getTemplate(kampanyeSegment)}
                </div>
              </div>

              <div style={{ marginBottom: 20, maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {rfmData.filter(c => c.segment === kampanyeSegment).map(c => (
                  <div key={c.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>{c.nama}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{c.recency === 9999 ? '-' : `${c.recency} hari lalu`}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => handleCopyNumbers(kampanyeSegment)}
                  className="btn btn-secondary" 
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 }}
                >
                  <Copy size={16} /> Salin Semua Nomor WA
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 }}
                  onClick={() => {
                    alert('Di aplikasi nyata, ini akan membuka WhatsApp Web/App secara berurutan atau menggunakan API pihak ketiga.');
                  }}
                >
                  <ExternalLink size={16} /> Buka WA ke Semua
                </button>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}
