// utils/sellerTier.js — port of web frontend sellerTier logic

export const SELLER_TIERS = [
  { key: "new",      label: "New Seller",   minSales: 0,   minRate: 0,  color: "#94a3b8", bg: "rgba(148,163,184,0.15)", border: "rgba(148,163,184,0.35)" },
  { key: "bronze",   label: "Bronze",       minSales: 1,   minRate: 0,  color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.35)"  },
  { key: "silver",   label: "Silver",       minSales: 10,  minRate: 75, color: "#cbd5e1", bg: "rgba(203,213,225,0.15)", border: "rgba(203,213,225,0.35)" },
  { key: "gold",     label: "Gold",         minSales: 25,  minRate: 85, color: "#facc15", bg: "rgba(250,204,21,0.15)",  border: "rgba(250,204,21,0.35)"  },
  { key: "platinum", label: "Platinum",     minSales: 50,  minRate: 90, color: "#22d3ee", bg: "rgba(34,211,238,0.15)",  border: "rgba(34,211,238,0.35)"  },
  { key: "elite",    label: "Elite Seller", minSales: 100, minRate: 95, color: "#a78bfa", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.35)" },
];

export function getSellerTier(rep) {
  if (!rep) return {
    tier: SELLER_TIERS[0], positiveRate: 100, totalRatings: 0,
    nextTier: SELLER_TIERS[1], progressPct: 0,
  };

  const sales = rep.completedMarketplace ?? 0;
  const totalRatings = (rep.positive ?? 0) + (rep.negative ?? 0) + (rep.neutral ?? 0);
  const positiveRate = totalRatings > 0
    ? Math.round(((rep.positive ?? 0) / totalRatings) * 100)
    : 100;

  let tierIndex = 0;
  for (let i = 0; i < SELLER_TIERS.length; i++) {
    const t = SELLER_TIERS[i];
    if (sales >= t.minSales && (t.minRate === 0 || positiveRate >= t.minRate)) {
      tierIndex = i;
    }
  }

  const tier = SELLER_TIERS[tierIndex];
  const nextTier = SELLER_TIERS[tierIndex + 1] ?? null;

  let progressPct = 100;
  if (nextTier) {
    const from = tier.minSales;
    const to = nextTier.minSales;
    progressPct = Math.min(100, Math.round(((sales - from) / (to - from)) * 100));
  }

  return { tier, tierIndex, positiveRate, totalRatings, nextTier, progressPct };
}
