import { useMemo, useState } from 'react';
import type { Customer } from '../types';
import { Target, Users, AlertTriangle, Moon, Award, Search, ArrowRight } from 'lucide-react';

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

  return (
    <div className="page-container-scroll" style={{ flex: 1, overflowY: 'auto' }}>
      <div className="page-body">
        
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: 24, fontWeight: 800 }}>RFM Customer Analytics</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
            Kecerdasan Buatan berbasis Data Science. Segmentasi otomatis berdasarkan Recency (Kapan Beli), Frequency (Sering Beli), dan Monetary (Total Belanja).
          </p>
        </div>

        {/* Top Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          
          <div onClick={() => setActiveSegment('Champions')} className="card" style={{ padding: 20, cursor: 'pointer', border: activeSegment === 'Champions' ? '2px solid #f59e0b' : '1px solid var(--border)', background: activeSegment === 'Champions' ? 'rgba(245,158,11,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#f59e0b' }}>
              <Award size={20} /> <span style={{ fontWeight: 700 }}>Champions</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>{stats.Champions}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Belanja rutin & paling banyak. Harus diberi VIP Reward.</div>
          </div>

          <div onClick={() => setActiveSegment('Loyal')} className="card" style={{ padding: 20, cursor: 'pointer', border: activeSegment === 'Loyal' ? '2px solid #10b981' : '1px solid var(--border)', background: activeSegment === 'Loyal' ? 'rgba(16,185,129,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#10b981' }}>
              <Target size={20} /> <span style={{ fontWeight: 700 }}>Loyal</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>{stats.Loyal}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Beli berulang kali dengan jumlah moderat. Tawarkan Upsell.</div>
          </div>

          <div onClick={() => setActiveSegment('Potential')} className="card" style={{ padding: 20, cursor: 'pointer', border: activeSegment === 'Potential' ? '2px solid #3b82f6' : '1px solid var(--border)', background: activeSegment === 'Potential' ? 'rgba(59,130,246,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#3b82f6' }}>
              <Users size={20} /> <span style={{ fontWeight: 700 }}>Potential</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>{stats.Potential}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Baru belanja 1x tapi baru-baru ini. Potensi jadi pelanggan setia.</div>
          </div>

          <div onClick={() => setActiveSegment('At Risk')} className="card" style={{ padding: 20, cursor: 'pointer', border: activeSegment === 'At Risk' ? '2px solid #ef4444' : '1px solid var(--border)', background: activeSegment === 'At Risk' ? 'rgba(239,68,68,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#ef4444' }}>
              <AlertTriangle size={20} /> <span style={{ fontWeight: 700 }}>At Risk</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>{stats.AtRisk}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dulu rutin belanja tapi sekarang menghilang. Kirim Win-back promo.</div>
          </div>

          <div onClick={() => setActiveSegment('Hibernating')} className="card" style={{ padding: 20, cursor: 'pointer', border: activeSegment === 'Hibernating' ? '2px solid #6b7280' : '1px solid var(--border)', background: activeSegment === 'Hibernating' ? 'rgba(107,114,128,0.05)' : '' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#6b7280' }}>
              <Moon size={20} /> <span style={{ fontWeight: 700 }}>Hibernating</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>{stats.Hibernating}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tidak belanja lebih dari 6 bulan. Kirim diskon re-aktivasi.</div>
          </div>

        </div>

        {/* Data Table */}
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

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pelanggan</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Segmen AI</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Recency (R)</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Frequency (F)</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Monetary (M)</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Aksi</th>
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
                      <td style={{ padding: '12px 20px', fontWeight: 600 }}>{c.nama}</td>
                      <td style={{ padding: '12px 20px' }}>
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
                      <td style={{ padding: '12px 20px' }}>
                        {c.recency === 9999 ? '-' : `${c.recency} hari lalu`}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        {c.frequency} Order
                      </td>
                      <td style={{ padding: '12px 20px', fontWeight: 700, color: 'var(--accent-purple)' }}>
                        Rp {c.monetary.toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
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

        </div>

      </div>
    </div>
  );
}
