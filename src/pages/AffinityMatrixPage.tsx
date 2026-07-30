import { useMemo, useState } from 'react';
import type { Customer, CustomerRow } from '../types';

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
}

export default function AffinityMatrixPage({ customers }: Props) {
  const [hoveredCell, setHoveredCell] = useState<{ r: string; c: string } | null>(null);

  const { topTypes, getAffinity, getCoCount, pairs, typeCounts } = useMemo(() => {
    // 1. Extract unique product types per customer
    const customerProducts = customers.map(c => {
      const types = new Set<string>();
      // Fallback in case orders is missing or not an array
      const orders = (c as any).orders || [];
      orders.forEach((o: any) => {
        if (o.jenis) types.add(o.jenis);
      });
      return Array.from(types);
    });

    // 2. Count total buyers per product type
    const counts: Record<string, number> = {};
    customerProducts.forEach(types => {
      types.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });

    // 3. Get top 12 product types
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(e => e[0]);

    // 4. Build co-purchase matrix
    const coCounts: Record<string, Record<string, number>> = {};
    customerProducts.forEach(types => {
      for (let i = 0; i < types.length; i++) {
        for (let j = i + 1; j < types.length; j++) {
          const t1 = types[i];
          const t2 = types[j];
          if (!coCounts[t1]) coCounts[t1] = {};
          if (!coCounts[t2]) coCounts[t2] = {};
          coCounts[t1][t2] = (coCounts[t1][t2] || 0) + 1;
          coCounts[t2][t1] = (coCounts[t2][t1] || 0) + 1;
        }
      }
    });

    // 5. Helpers
    const affinityFn = (t1: string, t2: string) => {
      if (t1 === t2) return null;
      const c1 = counts[t1] || 0;
      const c2 = counts[t2] || 0;
      if (c1 === 0 || c2 === 0) return 0;
      const co = coCounts[t1]?.[t2] || 0;
      return (co / Math.min(c1, c2)) * 100;
    };

    const countFn = (t1: string, t2: string) => {
      if (t1 === t2) return null;
      return coCounts[t1]?.[t2] || 0;
    };

    // 6. Pairs for top list
    const allPairs: { t1: string; t2: string; pct: number; coCount: number }[] = [];
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const t1 = top[i];
        const t2 = top[j];
        const coCount = coCounts[t1]?.[t2] || 0;
        if (coCount > 0) {
          allPairs.push({
            t1,
            t2,
            pct: affinityFn(t1, t2) || 0,
            coCount
          });
        }
      }
    }
    allPairs.sort((a, b) => b.pct - a.pct || b.coCount - a.coCount);

    return { 
      topTypes: top, 
      getAffinity: affinityFn, 
      getCoCount: countFn, 
      pairs: allPairs,
      typeCounts: counts 
    };
  }, [customers]);

  const getCellBg = (pct: number | null) => {
    if (pct === null) return 'rgba(255, 255, 255, 0.02)'; // Diagonal
    if (pct === 0) return 'transparent';
    if (pct <= 20) return 'rgba(239, 68, 68, 0.1)';
    if (pct <= 40) return 'rgba(245, 158, 11, 0.3)';
    if (pct <= 60) return 'rgba(245, 158, 11, 0.6)';
    if (pct <= 80) return 'rgba(16, 185, 129, 0.4)';
    return 'rgba(16, 185, 129, 0.8)';
  };

  const top10Pairs = pairs.slice(0, 10);
  const strongestPair = pairs.length > 0 ? pairs[0] : null;
  
  // Find a product type that is rarely paired (lowest average affinity among top types)
  let weakestProduct = "Produk";
  if (topTypes.length > 0) {
    let minScore = Infinity;
    topTypes.forEach(t1 => {
      let totalAffinity = 0;
      let count = 0;
      topTypes.forEach(t2 => {
        if (t1 !== t2) {
          totalAffinity += getAffinity(t1, t2) || 0;
          count++;
        }
      });
      const avg = count > 0 ? totalAffinity / count : 0;
      if (avg < minScore && avg > 0) { // must have at least some pairing
        minScore = avg;
        weakestProduct = t1;
      }
    });
  }

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      
      {/* Header Section */}
      <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
          <span style={{ fontSize: '1.2em' }}>🔗</span> Product Affinity Matrix™
        </h2>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)' }}>
          Temukan pasangan produk yang paling sering dibeli bersama
        </p>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Product Types</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>
              {Object.keys(typeCounts).length}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '150px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Combinations</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>
              {pairs.length}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '150px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Strongest Pair</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {strongestPair ? `${strongestPair.t1} & ${strongestPair.t2}` : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Matrix Section */}
      <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Co-Purchase Heatmap (Top {topTypes.length})</h3>
        <table style={{ borderCollapse: 'separate', borderSpacing: '2px', width: 'max-content' }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 8px' }}></th>
              {topTypes.map(t => (
                <th key={t} style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '80px', wordWrap: 'break-word', fontWeight: 'normal' }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topTypes.map(rowType => (
              <tr key={rowType}>
                <th style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', maxWidth: '100px', wordWrap: 'break-word', fontWeight: 'normal' }}>
                  {rowType}
                </th>
                {topTypes.map(colType => {
                  const pct = getAffinity(rowType, colType);
                  const isHovered = hoveredCell?.r === rowType || hoveredCell?.c === colType;
                  
                  return (
                    <td 
                      key={colType}
                      onMouseEnter={() => setHoveredCell({ r: rowType, c: colType })}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{ 
                        padding: '6px 8px', 
                        fontSize: '11px',
                        textAlign: 'center',
                        backgroundColor: getCellBg(pct),
                        color: pct === null ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: 'default',
                        transition: 'all 0.2s ease',
                        border: isHovered ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                        borderRadius: '2px',
                        minWidth: '40px'
                      }}
                      title={pct !== null ? `${rowType} & ${colType}\nAffinity: ${pct.toFixed(1)}%\nCo-purchases: ${getCoCount(rowType, colType)}` : 'Diagonal'}
                    >
                      {pct === null ? '—' : pct > 0 ? `${Math.round(pct)}%` : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Top Affinities Panel */}
        <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Top Product Pairs</h3>
          {top10Pairs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Tidak ada data pasangan produk.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {top10Pairs.map((item, idx) => (
                <div key={idx} style={{ padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    <span>{item.t1} ↔ {item.t2}</span>
                    <span style={{ fontWeight: 'bold' }}>{item.pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    dipasangkan oleh {item.coCount} customer
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--text-primary)', height: '100%', width: `${item.pct}%`, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Insights Section */}
        <div className="card" style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Actionable Insights</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {strongestPair ? (
              <div style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', borderLeft: '4px solid #10b981' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '8px' }}>
                  <span>💡</span> Pasangan terkuat
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  <strong>{strongestPair.t1} + {strongestPair.t2}</strong> ({Math.round(strongestPair.pct)}%) — pertimbangkan bundle discount untuk meningkatkan volume penjualan lebih lanjut.
                </p>
              </div>
            ) : null}

            {weakestProduct !== "Produk" ? (
              <div style={{ padding: '16px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '8px' }}>
                  <span>⚠️</span> Peluang Cross-Sell
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  <strong>{weakestProduct}</strong> jarang dipasangkan dengan produk lain — pertimbangkan cross-sell campaign untuk memperkenalkan kombinasi baru kepada pembeli produk ini.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      
    </div>
  );
}
