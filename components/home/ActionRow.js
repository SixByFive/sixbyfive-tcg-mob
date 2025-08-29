// components/home/ActionRow.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export function ActionCard({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.88 }]}>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function ActionRow({ children }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginBottom: 12 },
  action: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  actionLabel: { color: COLORS.text, fontWeight: "800" },
});
