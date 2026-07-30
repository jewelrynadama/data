// src/utils/recommendEngine.ts
// Product Recommendation Engine — co-purchase analysis, no ML library needed
import type { Customer, CustomerRow } from '../types';

export interface ProductSignature {
  jenis: string;
  type: string;
  grade: string;
  label: string;
}

export interface RecommendResult {
  label: string;
  jenis: string;
  type: string;
  grade: string;
  score: number;        // how often appears with customer's purchases
  buyerCount: number;   // how many OTHER customers bought this
}

function buildSig(order: CustomerRow): ProductSignature | null {
  if (!order.jenis) return null;
  return {
    jenis: order.jenis || '',
    type: order.type || '',
    grade: order.grade || '',
    label: [order.jenis, order.type, order.grade].filter(Boolean).join(' · '),
  };
}

function sigKey(s: ProductSignature) {
  return `${s.jenis}|${s.type}|${s.grade}`;
}

/**
 * Build a co-purchase map from all customers:
 *   productKey → Set<productKey> bought together
 */
export function buildCoPurchaseMap(allCustomers: Customer[]): Map<string, Map<string, number>> {
  const coMap = new Map<string, Map<string, number>>();

  for (const customer of allCustomers) {
    const orders = (customer.orders || []).filter((o) => o.jenis);
    const sigs = orders.map(buildSig).filter(Boolean) as ProductSignature[];
    const keys = [...new Set(sigs.map(sigKey))]; // unique product keys for this customer

    for (let i = 0; i < keys.length; i++) {
      for (let j = 0; j < keys.length; j++) {
        if (i === j) continue;
        if (!coMap.has(keys[i])) coMap.set(keys[i], new Map());
        const inner = coMap.get(keys[i])!;
        inner.set(keys[j], (inner.get(keys[j]) || 0) + 1);
      }
    }
  }

  return coMap;
}

/**
 * Build an index: productKey → product label info
 */
export function buildProductIndex(allCustomers: Customer[]): Map<string, ProductSignature & { buyerCount: number }> {
  const index = new Map<string, ProductSignature & { buyerCount: number }>();

  for (const customer of allCustomers) {
    const orders = (customer.orders || []).filter((o) => o.jenis);
    const sigs = orders.map(buildSig).filter(Boolean) as ProductSignature[];
    const seen = new Set<string>();
    for (const sig of sigs) {
      const k = sigKey(sig);
      if (!seen.has(k)) {
        seen.add(k);
        if (!index.has(k)) {
          index.set(k, { ...sig, buyerCount: 0 });
        }
        index.get(k)!.buyerCount++;
      }
    }
  }

  return index;
}

/**
 * Get recommendations for a specific customer
 * Returns up to `limit` products they haven't bought yet, sorted by co-purchase score
 */
export function getRecommendations(
  customer: Customer,
  _allCustomers: Customer[],
  coMap: Map<string, Map<string, number>>,
  productIndex: Map<string, ProductSignature & { buyerCount: number }>,
  limit = 5,
): RecommendResult[] {
  const myOrders = (customer.orders || []).filter((o) => o.jenis);
  const mySigs = myOrders.map(buildSig).filter(Boolean) as ProductSignature[];
  const myKeys = new Set(mySigs.map(sigKey));

  // Aggregate co-purchase scores for products customer hasn't bought
  const scoreMap = new Map<string, number>();

  for (const myKey of myKeys) {
    const coPartners = coMap.get(myKey);
    if (!coPartners) continue;
    for (const [partnerKey, count] of coPartners.entries()) {
      if (myKeys.has(partnerKey)) continue; // already bought
      scoreMap.set(partnerKey, (scoreMap.get(partnerKey) || 0) + count);
    }
  }

  // Sort by score + popularity
  const results: RecommendResult[] = [];
  for (const [key, score] of scoreMap.entries()) {
    const info = productIndex.get(key);
    if (!info) continue;
    results.push({
      label: info.label,
      jenis: info.jenis,
      type: info.type,
      grade: info.grade,
      score,
      buyerCount: info.buyerCount,
    });
  }

  return results
    .sort((a, b) => b.score * b.buyerCount - a.score * a.buyerCount)
    .slice(0, limit);
}

/**
 * Get popular products overall (top sellers by unique buyer count)
 */
export function getPopularProducts(
  productIndex: Map<string, ProductSignature & { buyerCount: number }>,
  limit = 5,
): (ProductSignature & { buyerCount: number })[] {
  return [...productIndex.values()]
    .sort((a, b) => b.buyerCount - a.buyerCount)
    .slice(0, limit);
}

/**
 * Convenience: compute cohort retention matrix
 * Returns months array + retention[cohortIdx][monthOffset] as percentage
 */
export interface CohortRow {
  cohortLabel: string;   // "Jan 2024"
  cohortMonth: string;   // "2024-01"
  totalCustomers: number;
  retention: number[];   // index 0 = month 0 (100%), 1 = month+1, etc.
}

export function buildCohortRetention(allCustomers: Customer[], maxMonths = 12): CohortRow[] {
  // Map customer → first purchase month
  const cohortMap = new Map<string, Set<string>>(); // cohortKey → Set<customerId>
  const customerMonths = new Map<string, Set<string>>(); // customerId → Set<"YYYY-MM">

  for (const customer of allCustomers) {
    const orders = (customer.orders || []).filter((o) => o.jenis);
    if (orders.length === 0) continue;

    const months: string[] = [];
    for (const o of orders) {
      const parts = (o.tanggalOrder || '').split(/[\/\-\.]/);
      if (parts.length >= 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          months.push(`${y}-${String(m).padStart(2, '0')}`);
        }
      }
    }
    if (months.length === 0) continue;
    months.sort();
    const firstMonth = months[0];

    if (!cohortMap.has(firstMonth)) cohortMap.set(firstMonth, new Set());
    cohortMap.get(firstMonth)!.add(customer.id);

    customerMonths.set(customer.id, new Set(months));
  }

  const sortedCohorts = [...cohortMap.keys()].sort();

  return sortedCohorts.map((cohortKey) => {
    const members = cohortMap.get(cohortKey)!;
    const [year, month] = cohortKey.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString('id-ID', { month: 'short', year: 'numeric' });

    const retention: number[] = [];
    for (let offset = 0; offset < maxMonths; offset++) {
      let m = month + offset;
      let y = year;
      while (m > 12) { m -= 12; y++; }
      const checkKey = `${y}-${String(m).padStart(2, '0')}`;
      const now = new Date();
      const checkDate = new Date(y, m - 1, 1);
      if (checkDate > now) { retention.push(-1); continue; } // future — skip
      let retained = 0;
      for (const memberId of members) {
        const memberMonths = customerMonths.get(memberId);
        if (memberMonths && memberMonths.has(checkKey)) retained++;
      }
      retention.push(members.size > 0 ? Math.round((retained / members.size) * 100) : 0);
    }

    return {
      cohortLabel: label,
      cohortMonth: cohortKey,
      totalCustomers: members.size,
      retention,
    };
  }).slice(-12); // last 12 cohorts
}
