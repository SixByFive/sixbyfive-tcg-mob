// components/subscriptions/PlanCard.js
// NEW: Reusable plan card with badge, price, and features summary.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function PlanCard({ plan, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && { borderColor: COLORS.accent },
        { opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{plan.name}</Text>
        {plan.highlighted && <Text style={styles.badge}>Most popular</Text>}
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{plan.price}</Text>
        {!!plan.period && <Text style={styles.period}>{plan.period}</Text>}
      </View>
      <Text style={styles.pitch}>
        {plan.features.filter(f => f.included).slice(0, 2).map(f => f.label).join(" • ")}
        {plan.features.filter(f => f.included).length > 2 ? " • +" : ""}
      </Text>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{selected ? "Selected" : plan.cta}</Text>
      </View>
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
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  badge: {
    color: "#fff",
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "900", fontSize: 12,
  },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 8 },
  price: { color: COLORS.text, fontWeight: "900", fontSize: 22 },
  period: { color: COLORS.textMuted, marginLeft: 6 },
  pitch: { color: COLORS.textMuted, marginTop: 6 },
  cta: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.alt,
    alignItems: "center",
    paddingVertical: 10,
  },
  ctaText: { color: COLORS.text, fontWeight: "800" },
});
