import { useMemo } from 'react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah, cleanPrice } from '../utils/csvLoader';

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
}

export default function DemandForecastPage({ rows }: Props) {
  // Aggregate historical sales per product type per month
  // Date format: DD/MM/YYYY or DD-MM-YYYY
  const analysis = useMemo(() => {
    const dataByJenisByMonth: Record<string, Record<string, { count: number; revenue: number }>> = {};
    const allMonthsSet = new Set<string>();
    const monthRevenues: Record<string, number> = {};

    (rows || []).forEach(row => {
      if (!row.jenis || !row.tanggalOrder) return;
      const parts = row.tanggalOrder.split(/[-/]/);
      if (parts.length >= 3) {
        // month: YYYY-MM
        const year = parts[2];
        const month = parts[1].padStart(2, '0');
        const monthKey = `${year}-${month}`;
        
        allMonthsSet.add(monthKey);
        
        if (!dataByJenisByMonth[row.jenis]) {
          dataByJenisByMonth[row.jenis] = {};
        }
        if (!dataByJenisByMonth[row.jenis][monthKey]) {
          dataByJenisByMonth[row.jenis][monthKey] = { count: 0, revenue: 0 };
        }
        
        dataByJenisByMonth[row.jenis][monthKey].count += parseInt(row.qty || '1', 10) || 1;
        const rev = cleanPrice(row.totalBayar);
        dataByJenisByMonth[row.jenis][monthKey].revenue += rev;
        
        monthRevenues[monthKey] = (monthRevenues[monthKey] || 0) + rev;
      }
    });

    const sortedMonths = Array.from(allMonthsSet).sort();
    
    // Determine peak month
    let peakMonth = '';
    let maxRev = 0;
    Object.entries(monthRevenues).forEach(([m, r]) => {
      if (r > maxRev) {
        maxRev = r;
        peakMonth = m;
      }
    });

    // Linear regression for each product
    const productStats = Object.keys(dataByJenisByMonth).map(jenis => {
      const monthData = dataByJenisByMonth[jenis];
      
      // Get historical counts based on the sorted global timeline
      const historicalCounts = sortedMonths.map(m => monthData[m] ? monthData[m].count : 0);
      
      // We take up to last 6 months for regression
      const yValues = historicalCounts.slice(-6);
      const n = yValues.length;
      let slope = 0;
      let intercept = 0;
      
      if (n > 1) {
        const sumX = (n - 1) * n / 2;
        const sumY = yValues.reduce((a, b) => a + b, 0);
        let sumXY = 0;
        let sumX2 = 0;
        yValues.forEach((y, i) => {
          sumXY += i * y;
          sumX2 += i * i;
        });
        
        const meanX = sumX / n;
        const meanY = sumY / n;
        
        let num = 0;
        let den = 0;
        yValues.forEach((y, i) => {
          num += (i - meanX) * (y - meanY);
          den += (i - meanX) * (i - meanX);
        });
        
        if (den !== 0) {
          slope = num / den;
        }
        intercept = meanY - slope * meanX;
      } else if (n === 1) {
        intercept = yValues[0];
      }
      
      // Predict next 3 months
      const predictions = [];
      for (let i = 0; i < 3; i++) {
        const px = n + i;
        const py = Math.max(0, slope * px + intercept);
        predictions.push(Math.round(py));
      }
      
      // Total past 3 months
      const past3 = yValues.slice(-3).reduce((a, b) => a + b, 0);
      const next3 = predictions.reduce((a, b) => a + b, 0);
      
      let growthPct = 0;
      if (past3 > 0) {
        growthPct = ((next3 - past3) / past3) * 100;
      } else if (next3 > 0) {
        growthPct = 100;
      }
      
      return {
        jenis,
        historicalCounts: yValues,
        predictions,
        past3,
        next3,
        growthPct,
        slope
      };
    });

    productStats.sort((a, b) => b.next3 - a.next3);
    
    const topGrowing = [...productStats].sort((a, b) => b.growthPct - a.growthPct)[0];
    const topDeclining = [...productStats].sort((a, b) => a.growthPct - b.growthPct)[0];

    return {
      productStats,
      sortedMonths,
      peakMonth,
      maxRev,
      topGrowing,
      topDeclining
    };
  }, [rows]);

  // Styling
  const styles = {
    page: {
      padding: '24px',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '24px'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap' as const,
      gap: '16px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 600,
      margin: '0 0 8px 0'
    },
    subtitle: {
      color: 'var(--text-muted)',
      margin: 0,
      fontSize: '14px'
    },
    statsContainer: {
      display: 'flex',
      gap: '16px'
    },
    statBox: {
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '12px 16px',
      minWidth: '120px'
    },
    statLabel: {
      fontSize: '12px',
      color: 'var(--text-muted)',
      marginBottom: '4px'
    },
    statValue: {
      fontSize: '18px',
      fontWeight: 600
    },
    card: {
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
      overflowX: 'auto' as const
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '12px',
      textAlign: 'left' as const
    },
    th: {
      padding: '12px',
      borderBottom: '1px solid var(--border)',
      color: 'var(--text-muted)',
      fontWeight: 500,
      whiteSpace: 'nowrap' as const
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid var(--border)',
      verticalAlign: 'middle' as const
    },
    badge: {
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      display: 'inline-block',
      whiteSpace: 'nowrap' as const
    },
    insightsPanel: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px',
      marginTop: '16px'
    },
    insightItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderLeft: '3px solid var(--border)',
      borderRadius: '4px',
      fontSize: '14px'
    }
  };

  const getStatusBadge = (growth: number, next3: number) => {
    if (next3 < 5) return { text: '❄️ LOW', bg: '#2a3a4a', color: '#88ccff' };
    if (growth > 20) return { text: '🔥 HIGH DEMAND', bg: '#4a2a2a', color: '#ff8888' };
    if (growth < -10) return { text: '⚠️ MENURUN', bg: '#4a4a2a', color: '#ffff88' };
    return { text: '✅ STABIL', bg: '#2a4a2a', color: '#88ff88' };
  };

  const getTrendIndicator = (growth: number) => {
    if (growth > 5) return <span style={{ color: '#88ff88' }}>▲ {growth.toFixed(1)}%</span>;
    if (growth < -5) return <span style={{ color: '#ff8888' }}>▼ {Math.abs(growth).toFixed(1)}%</span>;
    return <span style={{ color: 'var(--text-muted)' }}>→ {growth.toFixed(1)}%</span>;
  };

  const renderSparkline = (hist: number[], pred: number[]) => {
    const w = 120;
    const h = 32;
    const all = [...hist, ...pred];
    const max = Math.max(...all, 1);
    const step = w / (all.length - 1 || 1);
    
    const histPoints = hist.map((val, i) => `${i * step},${h - (val / max) * h}`).join(' ');
    const predPoints = pred.map((val, i) => `${(hist.length - 1 + i) * step},${h - (val / max) * h}`).join(' ');
    const connect = hist.length > 0 && pred.length > 0 
      ? `${(hist.length - 1) * step},${h - (hist[hist.length - 1] / max) * h} ${(hist.length) * step},${h - (pred[0] / max) * h}` 
      : '';

    return (
      <svg width={w} height={h} style={{ overflow: 'visible' }}>
        <polyline points={histPoints} fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {connect && <polyline points={connect} fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="4" />}
        <polyline points={predPoints} fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div className="page-body" style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📈 Demand Forecasting</h1>
          <p style={styles.subtitle}>Prediksi permintaan produk 3 bulan ke depan berdasarkan tren historis</p>
        </div>
        <div style={styles.statsContainer}>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Total Products</div>
            <div style={styles.statValue}>{analysis.productStats.length}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Months Analyzed</div>
            <div style={styles.statValue}>{analysis.sortedMonths.length}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Top Growth</div>
            <div style={styles.statValue}>{analysis.topGrowing?.jenis || '-'}</div>
          </div>
        </div>
      </div>

      <div className="card" style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Product Type</th>
              <th style={styles.th}>Trend (Next 3 Mo)</th>
              <th style={styles.th}>Past 3 Mo Actual</th>
              <th style={styles.th}>Next 3 Mo Predicted</th>
              <th style={styles.th}>Current Inventory</th>
              <th style={styles.th}>6 Mo Trend + 3 Mo Forecast</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {analysis.productStats.map(stat => {
              const badge = getStatusBadge(stat.growthPct, stat.next3);
              return (
                <tr key={stat.jenis}>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{stat.jenis}</td>
                  <td style={styles.td}>{getTrendIndicator(stat.growthPct)}</td>
                  <td style={styles.td}>{stat.past3}</td>
                  <td style={styles.td}>{stat.next3}</td>
                  <td style={{ ...styles.td, color: 'var(--text-muted)' }}>Data N/A</td>
                  <td style={{ ...styles.td, padding: '12px' }}>
                    {renderSparkline(stat.historicalCounts, stat.predictions)}
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: badge.bg, color: badge.color }}>
                      {badge.text}
                    </span>
                  </td>
                </tr>
              );
            })}
            {analysis.productStats.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...styles.td, textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  Tidak ada data untuk diprediksi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>💡 Automated Insights</h3>
        <div style={styles.insightsPanel}>
          {analysis.topGrowing && analysis.topGrowing.growthPct > 10 && (
            <div style={{ ...styles.insightItem, borderLeftColor: '#ff8888' }}>
              <span>🔥 <strong>{analysis.topGrowing.jenis}</strong> menunjukkan pertumbuhan {analysis.topGrowing.growthPct.toFixed(0)}% — pertimbangkan restock untuk 3 bulan ke depan.</span>
            </div>
          )}
          {analysis.topDeclining && analysis.topDeclining.growthPct < -10 && (
            <div style={{ ...styles.insightItem, borderLeftColor: '#ffff88' }}>
              <span>⚠️ <strong>{analysis.topDeclining.jenis}</strong> mengalami penurunan {Math.abs(analysis.topDeclining.growthPct).toFixed(0)}% — pertimbangkan promo atau diskon.</span>
            </div>
          )}
          {analysis.peakMonth && (
            <div style={{ ...styles.insightItem, borderLeftColor: '#88ccff' }}>
              <span>📊 Musim puncak: <strong>{analysis.peakMonth}</strong> (revenue tertinggi sepanjang data: {formatRupiah(analysis.maxRev)})</span>
            </div>
          )}
          {!analysis.topGrowing && !analysis.topDeclining && !analysis.peakMonth && (
            <div style={{ ...styles.insightItem, borderLeftColor: 'var(--border)' }}>
              <span>Data belum cukup untuk memberikan insight otomatis.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
