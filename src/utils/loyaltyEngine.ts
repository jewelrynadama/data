// src/utils/loyaltyEngine.ts
import type { Customer } from '../types';

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface LoyaltyInfo {
  points: number;
  tier: LoyaltyTier;
  tierColor: string;
  tierEmoji: string;
  nextTier: LoyaltyTier | null;
  pointsToNext: number;
  progressPercent: number;
}

// 1 point per Rp 10.000 spent
const POINTS_PER_RUPIAH = 1 / 10000;

const TIERS: { tier: LoyaltyTier; minPoints: number; color: string; emoji: string }[] = [
  { tier: 'Bronze',   minPoints: 0,     color: '#cd7f32', emoji: '🥉' },
  { tier: 'Silver',   minPoints: 500,   color: '#94a3b8', emoji: '🥈' },
  { tier: 'Gold',     minPoints: 2000,  color: '#f59e0b', emoji: '🥇' },
  { tier: 'Platinum', minPoints: 5000,  color: '#7c3aed', emoji: '💎' },
];

export function calcLoyalty(customer: Customer): LoyaltyInfo {
  const points = Math.floor(customer.totalSpend * POINTS_PER_RUPIAH);

  let currentTierIdx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].minPoints) {
      currentTierIdx = i;
      break;
    }
  }

  const current = TIERS[currentTierIdx];
  const next = TIERS[currentTierIdx + 1] ?? null;

  let progressPercent = 100;
  let pointsToNext = 0;

  if (next) {
    const range = next.minPoints - current.minPoints;
    const earned = points - current.minPoints;
    progressPercent = Math.min(100, Math.round((earned / range) * 100));
    pointsToNext = next.minPoints - points;
  }

  return {
    points,
    tier: current.tier,
    tierColor: current.color,
    tierEmoji: current.emoji,
    nextTier: next?.tier ?? null,
    pointsToNext,
    progressPercent,
  };
}

export function getLoyaltyStats(customers: Customer[]) {
  const tierCount: Record<LoyaltyTier, number> = {
    Bronze: 0, Silver: 0, Gold: 0, Platinum: 0,
  };
  let totalPoints = 0;

  for (const c of customers) {
    const info = calcLoyalty(c);
    tierCount[info.tier]++;
    totalPoints += info.points;
  }

  return { tierCount, totalPoints };
}

export const TIER_THRESHOLDS = TIERS;
