// components/card/PricingHistory.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const RANGES = ["7D", "30D", "90D", "1Y"];

export default function PricingHistory({ range, onChangeRange, barHeights, avg, min, max }) {
  return (
    <View style={styles.historyCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.historyTitle}>Pricing history</Text>

        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => onChangeRange(r)}
              style={[
                styles.rangePill,
                r === range && { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
              ]}
            >
              <Text
                style={[
                  styles.rangePillText,
                  r === range && { color: "#fff", fontWeight: "800" },
                ]}
              >
                {r}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.chartWrap}>
        <View style={styles.chartGrid}>
          <View style={[styles.hLine, { top: 0 }]} />
          <View style={[styles.hLine, { top: "50%" }]} />
          <View style={[styles.hLine, { bottom: 0 }]} />
        </View>

        <View style={styles.barsRow}>
          {barHeights.map((h, i) => (
            <View key={i} style={[styles.bar, { height: h }]} />
          ))}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Avg</Text>
          <Text style={styles.statValue}>{avg != null ? `£${avg.toFixed(2)}` : "—"}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>High</Text>
          <Text style={styles.statValue}>{max != null ? `£${max.toFixed(2)}` : "—"}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Low</Text>
          <Text style={styles.statValue}>{min != null ? `£${min.toFixed(2)}` : "—"}</Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>Placeholder data shown. Live history coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },

  rangeRow: { flexDirection: "row", gap: 6 },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rangePillText: { color: COLORS.text, fontWeight: "700", fontSize: 12 },

  chartWrap: {
    marginTop: 12,
    height: 100,
    borderRadius: 12,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  chartGrid: { ...StyleSheet.absoluteFillObject },
  hLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  barsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 2,
  },
  bar: {
    width: 4,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: COLORS.accent,
  },

  statsRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statItem: {
    flex: 1,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4, fontWeight: "600" },
  statValue: { color: COLORS.text, fontWeight: "800" },
  disclaimer: { color: COLORS.textMuted, fontSize: 12, marginTop: 8, textAlign: "right" },
});
