import { useState, useMemo } from 'react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah, cleanPrice } from '../utils/csvLoader';

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
}

export default function BundleRecommenderPage({ customers, rows }: Props) {
  const [activeTemplate, setActiveTemplate] = useState<number | null>(null);

  const {
    topBundles,
    totalBundlesCount,
    totalPotentialUpsell,
    estRevenueBoost,
    topByPopularity,
    topByRevenue
  } = useMemo(() => {
    const jenisBuyers = new Map<string, Set<string>>();
    (customers || []).forEach(c => {
      const cJenis = new Set((c.orders || []).map(o => o.jenis).filter(Boolean));
      cJenis.forEach(j => {
        if (!jenisBuyers.has(j)) jenisBuyers.set(j, new Set());
        jenisBuyers.get(j)!.add(c.id);
      });
    });

    interface PairData {
      jenisA: string;
      jenisB: string;
      coCustomers: number;
      totalCombinedRevenue: number;
    }
    const pairsMap = new Map<string, PairData>();

    (customers || []).forEach(c => {
      const spendPerJenis = new Map<string, number>();
      (c.orders || []).forEach(o => {
        const j = o.jenis;
        if (!j) return;
        const price = cleanPrice(o.totalBayar);
        spendPerJenis.set(j, (spendPerJenis.get(j) || 0) + price);
      });
      
      const uniqueJenis = Array.from(spendPerJenis.keys()).sort();
      for (let i = 0; i < uniqueJenis.length; i++) {
        for (let j = i + 1; j < uniqueJenis.length; j++) {
          const jA = uniqueJenis[i];
          const jB = uniqueJenis[j];
          const key = `${jA}::${jB}`;
          
          const combinedSpend = (spendPerJenis.get(jA) || 0) + (spendPerJenis.get(jB) || 0);
          
          if (!pairsMap.has(key)) {
            pairsMap.set(key, {
              jenisA: jA,
              jenisB: jB,
              coCustomers: 0,
              totalCombinedRevenue: 0
            });
          }
          
          const p = pairsMap.get(key)!;
          p.coCustomers += 1;
          p.totalCombinedRevenue += combinedSpend;
        }
      }
    });

    const bundles = Array.from(pairsMap.values()).map(p => {
      const avgCombinedPrice = p.totalCombinedRevenue / p.coCustomers;
      const buyersA = jenisBuyers.get(p.jenisA)?.size || 0;
      const buyersB = jenisBuyers.get(p.jenisB)?.size || 0;
      const potentialUpsell = (buyersA + buyersB) - (2 * p.coCustomers);
      
      const suggestedBundlePrice = avgCombinedPrice * 0.85;
      const savingsAmount = avgCombinedPrice * 0.15;
      
      return {
        bundleName: `Bundle ${p.jenisA} + ${p.jenisB}`,
        coCustomers: p.coCustomers,
        avgCombinedPrice,
        suggestedBundlePrice,
        savingsAmount,
        potentialUpsell,
        score: p.coCustomers * avgCombinedPrice
      };
    });

    const sortedByScore = [...bundles].sort((a, b) => b.score - a.score);
    const top8 = sortedByScore.slice(0, 8);
    
    const totalPotential = top8.reduce((sum, b) => sum + b.potentialUpsell, 0);
    const revenueBoost = top8.reduce((sum, b) => sum + (b.potentialUpsell * b.suggestedBundlePrice * 0.1), 0); // Asumsi 10% konversi

    const popSorted = [...bundles].sort((a, b) => b.coCustomers - a.coCustomers);
    const revSorted = [...bundles].sort((a, b) => (b.potentialUpsell * b.suggestedBundlePrice) - (a.potentialUpsell * a.suggestedBundlePrice));

    return {
      topBundles: top8,
      totalBundlesCount: bundles.length,
      totalPotentialUpsell: totalPotential,
      estRevenueBoost: revenueBoost,
      topByPopularity: popSorted[0],
      topByRevenue: revSorted[0]
    };
  }, [customers, rows]);

  return (
    <div className="page-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'var(--text-primary)' }}>📦 Smart Bundle Recommender™</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
          Kombinasi produk cerdas berdasarkan pola pembelian customer
        </p>
        
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          <div style={{ flex: 1, padding: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Bundles Generated</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>{totalBundlesCount}</div>
          </div>
          <div style={{ flex: 1, padding: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Potential Upsell</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>{totalPotentialUpsell} <span style={{fontSize: '12px', fontWeight: 'normal'}}>customers</span></div>
          </div>
          <div style={{ flex: 1, padding: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Est. Revenue Boost (10% CVR)</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>{formatRupiah(estRevenueBoost)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
        {topBundles.map((bundle, idx) => (
          <div key={idx} style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--text-primary)' }}>
              📦 {bundle.bundleName}
            </div>
            
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Dibeli bersama oleh <strong style={{color: 'var(--text-primary)'}}>{bundle.coCustomers} customer</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '14px' }}>
                {formatRupiah(bundle.avgCombinedPrice)}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#10b981' }}>
                {formatRupiah(bundle.suggestedBundlePrice)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}>
                Hemat {formatRupiah(bundle.savingsAmount)} (15%)
              </span>
              <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px' }}>
                🔥 {bundle.potentialUpsell} customer potensial bisa ditawarkan bundle ini
              </span>
            </div>

            <button 
              onClick={() => setActiveTemplate(activeTemplate === idx ? null : idx)}
              style={{
                marginTop: '8px',
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: 'bold',
                alignSelf: 'flex-start'
              }}
            >
              {activeTemplate === idx ? 'Hide WA Template' : 'Generate WA Template'}
            </button>

            {activeTemplate === idx && (
              <div style={{
                marginTop: '8px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '11.5px',
                whiteSpace: 'pre-wrap',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)'
              }}>
{`Halo kak! 💎

Kami punya BUNDLE SPESIAL untuk kamu:
🎁 ${bundle.bundleName}

Harga normal: ${formatRupiah(bundle.avgCombinedPrice)}
Harga bundle: ${formatRupiah(bundle.suggestedBundlePrice)} ✨
Hemat ${formatRupiah(bundle.savingsAmount)}!

Stok terbatas, yuk order sekarang! 🛒`}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>📊 Bundle Performance Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Top Bundle by Popularity</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{topByPopularity?.bundleName || '-'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{topByPopularity?.coCustomers || 0} co-purchases</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Top Bundle by Revenue Potential</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{topByRevenue?.bundleName || '-'}</div>
            <div style={{ fontSize: '12px', color: '#10b981' }}>{formatRupiah((topByRevenue?.potentialUpsell || 0) * (topByRevenue?.suggestedBundlePrice || 0))} potential</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Addressable Upsell Audience</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{totalPotentialUpsell} customers</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From top 8 bundles</div>
          </div>
        </div>
      </div>
    </div>
  );
}
