// components/subscriptions/PlanCard.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function PlanCard({ plan, selected, isCurrent, onPress }) {
  const isFree = plan.price === "Free" || plan.price === "£0";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        { opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{plan.name}</Text>
          {isCurrent && (
            <Text style={styles.currentLabel}>Current plan</Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {plan.highlighted && !isCurrent && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Most popular</Text>
            </View>
          )}
          {isCurrent && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.price}>{plan.price}</Text>

      <Text style={styles.pitch} numberOfLines={2}>
        {plan.features.filter((f) => f.included).slice(0, 3).map((f) => f.label).join(" • ")}
      </Text>

      {selected && !isFree && (
        <View style={styles.selectedIndicator}>
          <Text style={styles.selectedIndicatorText}>Selected — tap below to subscribe</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardSelected: {
    borderColor: COLORS.accent,
    borderWidth: 2,
    backgroundColor: `${COLORS.surface}`,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  name: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  currentLabel: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  popularBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  popularText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  activeBadge: {
    backgroundColor: "rgba(16,185,129,0.15)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.4)",
  },
  activeBadgeText: { color: "#10b981", fontWeight: "900", fontSize: 11 },
  price: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 22,
  },
  pitch: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  selectedIndicator: {
    marginTop: 4,
    backgroundColor: `rgba(99,102,241,0.08)`,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  selectedIndicatorText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
