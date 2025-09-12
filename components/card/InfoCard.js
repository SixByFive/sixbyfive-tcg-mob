// components/card/InfoCard.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

function PricePill({ label, value }) {
  return (
    <View style={styles.pricePill}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>
        {typeof value === "number" ? `£${value.toFixed(2)}` : "—"}
      </Text>
    </View>
  );
}

export default function InfoCard({
  name,
  number,
  setName,
  tcgp,
  cmkt,
  average,
  hideActions = false,
  onAddToCollection,
  onToggleWishlist,
}) {

  const showActions = 
    !hideActions &&
    typeof onAddToCollection === "function" &&
    typeof onToggleWishlist === "function"; 

  return (
    <View style={styles.infoCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.name} numberOfLines={2}>
          {name || "—"}
        </Text>
        <Text style={styles.badge}>#{number || "—"}</Text>
      </View>

      <Text style={styles.meta}>{setName || "—"}</Text>

      <View style={styles.priceRow}>
        <View style={{ flex: 1 }}>
          <PricePill label="TCGP" value={tcgp} />
        </View>
        <View style={{ flex: 1 }}>
          <PricePill label="CMKT" value={cmkt} />
        </View>
      </View>

      <View style={styles.avgPill}>
        <Text style={styles.avgLabel}>Avg</Text>
        <Text style={styles.avgValue}>{average != null ? `£${average.toFixed(2)}` : "—"}</Text>
      </View>

      {showActions && (
        <View style={styles.ctaRow}>
          <Pressable onPress={onAddToCollection} style={[styles.cta, { backgroundColor: COLORS.accent }]}>
            <Text style={styles.ctaText}>Add to Collection</Text>
          </Pressable>
          <Pressable onPress={onToggleWishlist} style={[styles.ctaOutline, { borderColor: COLORS.accent }]}>
            <Text style={styles.ctaOutlineText}>Wishlist</Text>
          </Pressable>
        </View>
      )}
      
    </View>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "800", flex: 1, paddingRight: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    fontWeight: "800",
    overflow: "hidden",
  },
  meta: { marginTop: 6, color: COLORS.textMuted },

  priceRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  pricePill: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceLabel: { color: COLORS.accentLight, fontSize: 11.5, fontWeight: "800" },
  priceValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },

  avgPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avgLabel: { color: "#fff", fontWeight: "800", opacity: 0.9 },
  avgValue: {
    color: "#fff",
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },

  ctaRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  cta: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  ctaOutline: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.alt,
    borderWidth: 2,
  },
  ctaOutlineText: { color: COLORS.accent, fontWeight: "800", letterSpacing: 0.3 },
});
