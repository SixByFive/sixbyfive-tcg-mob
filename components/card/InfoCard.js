// components/card/InfoCard.js
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function InfoCard({
  name,
  number,
  setName,
  // kept for compatibility; not used visually
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

  const avgText = typeof average === "number" ? average.toFixed(2) : "—";

  return (
    <View style={styles.infoCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.name} numberOfLines={2}>
          {name || "—"}
        </Text>
        <Text style={styles.badge}>#{number || "—"}</Text>
      </View>

      <Text style={styles.meta}>{setName || "—"}</Text>

      {/* NEW: Single compact row – Avg + Buttons */}
      <View style={styles.inlineRow}>
        <View style={styles.avgWrap}>
          <View style={styles.avgIconBubble}>
            <Ionicons name="stats-chart" size={12} color="#fff" />
          </View>
          <View style={styles.avgTextCol}>
            <Text style={styles.avgCaption}>Average</Text>
            <View style={styles.avgValueRow}>
              <Text style={styles.avgCurrency}>£</Text>
              <Text style={styles.avgValue}>{avgText}</Text>
            </View>
          </View>
        </View>

        {showActions && (
          <>
            <Pressable
              onPress={onAddToCollection}
              style={[styles.cta, styles.ctaPrimary]}
            >
              <Text style={styles.ctaPrimaryText}>+ Collection</Text>
            </Pressable>

            <Pressable
              onPress={onToggleWishlist}
              style={[styles.cta, styles.ctaOutline]}
            >
              <Text style={styles.ctaOutlineText}>+ Wishlist</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const ROW_H = 40; // unified row height for pill + CTAs

const styles = StyleSheet.create({
  infoCard: {
    marginTop: 8,                      // tighter
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 10,                       // tighter
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    flex: 1,
    paddingRight: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    fontWeight: "800",
    overflow: "hidden",
    fontSize: 12,
  },
  meta: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 12.5,
    marginBottom: 6,                  // small bottom space before inline row
  },

  /* --- Inline row: Avg + Buttons --- */
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  /* Avg pill (compact, fixed height to match buttons) */
  avgWrap: {
    height: ROW_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  avgIconBubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avgTextCol: { flexDirection: "column", justifyContent: "center" },
  avgCaption: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 0,
  },
  avgValueRow: { flexDirection: "row", alignItems: "flex-end" },
  avgCurrency: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 14,
    marginRight: 2,
    opacity: 0.95,
  },
  avgValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },

  /* Buttons (same row as avg pill) */
  cta: {
    height: ROW_H,
    flex: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPrimary: {
    backgroundColor: COLORS.accent,
  },
  ctaPrimaryText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 0.25,
  },
  ctaOutline: {
    backgroundColor: COLORS.alt,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  ctaOutlineText: {
    color: COLORS.accent,
    fontWeight: "800",
    letterSpacing: 0.25,
  },
});
