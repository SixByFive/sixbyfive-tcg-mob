// components/home/SnapshotCard.js

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

function Stat({ label, value }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default function SnapshotCard({ loading, user }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your snapshot</Text>
      <View style={styles.row}>
        <Stat label="Cards" value={loading && !user ? "…" : (user?.stats?.totalCards ?? 0)} />
        <Stat label="Binders" value={loading && !user ? "…" : (user?.stats?.binders ?? 0)} />
        <Stat label="Wishlist" value={loading && !user ? "…" : (user?.stats?.wishlist ?? 0)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  title: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  row: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1, alignItems: "center", paddingVertical: 12,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
  },
  value: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  label: { color: COLORS.textMuted, marginTop: 2 },
});
