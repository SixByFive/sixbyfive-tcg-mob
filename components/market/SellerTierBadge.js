// components/market/SellerTierBadge.js
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getSellerTier } from "../../utils/sellerTier";

/**
 * size="sm"  compact chip: ● Gold · 32 sales
 * size="lg"  full card with progress bar
 */
export default function SellerTierBadge({ reputation, size = "sm", onPress }) {
  if (!reputation) return null;

  const { tier, positiveRate, totalRatings, nextTier, progressPct } = getSellerTier(reputation);
  const sales = reputation.completedMarketplace ?? 0;

  if (size === "sm") {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={[styles.chip, { backgroundColor: tier.bg, borderColor: tier.border }]}
      >
        <View style={[styles.dot, { backgroundColor: tier.color }]} />
        <Text style={[styles.chipText, { color: tier.color }]}>
          {tier.label}
          {"  "}
          <Text style={{ opacity: 0.65, fontWeight: "500" }}>
            {sales} sale{sales !== 1 ? "s" : ""}
          </Text>
        </Text>
      </Pressable>
    );
  }

  // Full card (size="lg")
  return (
    <View style={[styles.fullCard, { backgroundColor: tier.bg, borderColor: tier.border }]}>
      <View style={styles.fullRow}>
        <View style={styles.fullLeft}>
          <View style={[styles.dot, { backgroundColor: tier.color }]} />
          <Text style={[styles.fullName, { color: tier.color }]}>{tier.label}</Text>
        </View>
        <Text style={[styles.fullSales, { color: tier.color }]}>
          {sales} sale{sales !== 1 ? "s" : ""}
        </Text>
      </View>

      {totalRatings > 0 && (
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Positive feedback</Text>
          <Text style={[styles.rateValue, {
            color: positiveRate >= 90 ? "#10b981" : positiveRate >= 75 ? "#f59e0b" : "#ef4444",
          }]}>
            {positiveRate}%{"  "}
            <Text style={styles.rateSub}>({totalRatings} rating{totalRatings !== 1 ? "s" : ""})</Text>
          </Text>
        </View>
      )}

      {nextTier && (
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Progress to {nextTier.label}</Text>
            <Text style={styles.progressLabel}>{sales} / {nextTier.minSales} sales</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${progressPct}%`, backgroundColor: tier.color }]} />
          </View>
        </View>
      )}

      {!nextTier && (
        <Text style={[styles.maxTier, { color: tier.color }]}>✦ Highest tier achieved</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 11, fontWeight: "700" },

  fullCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  fullRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fullLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  fullName: { fontSize: 15, fontWeight: "800" },
  fullSales: { fontSize: 12, fontWeight: "600", opacity: 0.7 },

  rateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rateLabel: { color: "#8f98bc", fontSize: 12 },
  rateValue: { fontSize: 12, fontWeight: "700" },
  rateSub: { fontWeight: "500", color: "#8f98bc" },

  progressSection: { gap: 5 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: "#8f98bc", fontSize: 10 },
  track: { height: 4, backgroundColor: "#31365e", borderRadius: 2, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 2 },

  maxTier: { fontSize: 10, fontWeight: "700" },
});
