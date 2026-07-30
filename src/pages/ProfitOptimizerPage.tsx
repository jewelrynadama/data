import { useState, useMemo } from 'react';
import type { Customer, CustomerRow, CatalogItem } from '../types';
import { formatRupiah, cleanPrice } from '../utils/csvLoader';

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
  catalog: CatalogItem[];
}

interface ProductStats {
  tipeBarang: string;
  margin: number;
  velocity: number;
  inventoryCount: number;
  compositeScore: number;
  recommendation: string;
}

export default function ProfitOptimizerPage({ customers, rows, catalog }: Props) {
  const [sortCol, setSortCol] = useState<keyof ProductStats>('compositeScore');
  const [sortDesc, setSortDesc] = useState(true);

  const stats = useMemo(() => {
    const statsMap = new Map<string, {
      tipeBarang: string;
      items: CatalogItem[];
    }>();

    (catalog || []).forEach(item => {
      if (!item.tipeBarang) return;
      if (!statsMap.has(item.tipeBarang)) {
        statsMap.set(item.tipeBarang, { tipeBarang: item.tipeBarang, items: [] });
      }
      statsMap.get(item.tipeBarang)!.items.push(item);
    });

    const calculatedStats: ProductStats[] = Array.from(statsMap.values()).map(group => {
      let sumRangka = 0;
      let sumMutiara = 0;
      let sumJual = 0;
      let inventoryCount = 0;

      group.items.forEach(item => {
        sumRangka += item.modalRangka || 0;
        sumMutiara += item.modalMutiara || 0;
        sumJual += item.hargaJual || 0;
        if (item.isReady) inventoryCount++;
      });

      const count = group.items.length;
      const avgRangka = sumRangka / count;
      const avgMutiara = sumMutiara / count;
      const avgJual = sumJual / count;

      const totalCost = avgRangka + avgMutiara;
      const margin = avgJual > 0 ? ((avgJual - totalCost) / avgJual) * 100 : 0;
      const velocity = (rows || []).filter(r => r.jenis === group.tipeBarang).length;
      const compositeScore = (margin / 100) * velocity * (inventoryCount > 0 ? 1 : 0.5);

      let recommendation = 'STABIL ✅';
      if (inventoryCount === 0 && velocity > 2) {
        recommendation = 'RESTOCK ⚠️';
      } else if (margin > 30 && velocity >= 2) {
        recommendation = 'PUSH 🚀';
      } else if (margin < 15 && velocity >= 2) {
        recommendation = 'HARGA NAIK 💰';
      } else if (margin < 15 && velocity <= 1) {
        recommendation = 'DISCONTINUE ❌';
      }

      return {
        tipeBarang: group.tipeBarang,
        margin,
        velocity,
        inventoryCount,
        compositeScore,
        recommendation,
      };
    });

    return calculatedStats;
  }, [catalog, rows]);

  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      const numA = valA as number;
      const numB = valB as number;
      return sortDesc ? numB - numA : numA - numB;
    });
  }, [stats, sortCol, sortDesc]);

  const topMarginProducts = useMemo(() => {
    return [...stats].sort((a, b) => b.margin - a.margin).slice(0, 8);
  }, [stats]);

  const handleSort = (col: keyof ProductStats) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const totalProductsAnalyzed = stats.length;
  const bestPerformer = [...stats].sort((a, b) => b.compositeScore - a.compositeScore)[0];
  const highestMargin = [...stats].sort((a, b) => b.margin - a.margin)[0];
  const needsRestockCount = stats.filter(s => s.recommendation === 'RESTOCK ⚠️').length;
  
  const totalCustomerCount = customers.length; 
  const totalRevenue = useMemo(() => {
    return rows.reduce((acc, row) => acc + (cleanPrice(row.totalBayar) || 0), 0);
  }, [rows]);

  return (
    <div className="page-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', color: 'var(--text-primary)' }}>
      <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Profit Optimizer</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Products Analyzed</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalProductsAnalyzed}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>From {totalCustomerCount} customers • Rev: {formatRupiah(totalRevenue)}</div>
        </div>
        <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Best Performer</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {bestPerformer ? bestPerformer.tipeBarang : '-'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Score: {bestPerformer ? bestPerformer.compositeScore.toFixed(2) : '-'}</div>
        </div>
        <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Highest Margin</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {highestMargin ? highestMargin.tipeBarang : '-'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Margin: {highestMargin ? highestMargin.margin.toFixed(1) : '-'}%</div>
        </div>
        <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Action Needed</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{needsRestockCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Products need restock</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>
        <div className="card" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Product Performance</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px' }}>Rank</th>
                  <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('tipeBarang')}>
                    Tipe Barang {sortCol === 'tipeBarang' ? (sortDesc ? '↓' : '↑') : ''}
                  </th>
                  <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('margin')}>
                    Margin% {sortCol === 'margin' ? (sortDesc ? '↓' : '↑') : ''}
                  </th>
                  <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('velocity')}>
                    Velocity {sortCol === 'velocity' ? (sortDesc ? '↓' : '↑') : ''}
                  </th>
                  <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('inventoryCount')}>
                    Stok {sortCol === 'inventoryCount' ? (sortDesc ? '↓' : '↑') : ''}
                  </th>
                  <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('compositeScore')}>
                    Score {sortCol === 'compositeScore' ? (sortDesc ? '↓' : '↑') : ''}
                  </th>
                  <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('recommendation')}>
                    Recommendation {sortCol === 'recommendation' ? (sortDesc ? '↓' : '↑') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((stat, i) => {
                  const maxScore = bestPerformer?.compositeScore || 1;
                  const scorePercent = Math.min(100, Math.max(0, (stat.compositeScore / maxScore) * 100));
                  
                  return (
                    <tr key={stat.tipeBarang} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px' }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{stat.tipeBarang}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: stat.margin > 30 ? '#10b981' : stat.margin < 15 ? '#ef4444' : 'inherit' }}>
                          {stat.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{stat.velocity}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: stat.inventoryCount === 0 ? '#ef4444' : 'inherit' }}>
                          {stat.inventoryCount}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '40px' }}>{stat.compositeScore.toFixed(2)}</span>
                          <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${scorePercent}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: '3px' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          fontWeight: 600,
                          backgroundColor: stat.recommendation.includes('PUSH') ? '#dcfce7' : 
                                         stat.recommendation.includes('RESTOCK') ? '#fef3c7' : 
                                         stat.recommendation.includes('DISCONTINUE') ? '#fee2e2' : 
                                         stat.recommendation.includes('HARGA') ? '#e0e7ff' : 'var(--bg-secondary)',
                          color: stat.recommendation.includes('PUSH') ? '#166534' : 
                                 stat.recommendation.includes('RESTOCK') ? '#92400e' : 
                                 stat.recommendation.includes('DISCONTINUE') ? '#991b1b' : 
                                 stat.recommendation.includes('HARGA') ? '#3730a3' : 'var(--text-primary)',
                        }}>
                          {stat.recommendation}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {sortedStats.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No product data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Top Margin Distribution</div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topMarginProducts.map(stat => (
              <div key={stat.tipeBarang} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }} title={stat.tipeBarang}>{stat.tipeBarang}</span>
                  <span style={{ fontWeight: 600 }}>{stat.margin.toFixed(1)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, stat.margin))}%`, backgroundColor: '#10b981', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
            {topMarginProducts.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No margin data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
