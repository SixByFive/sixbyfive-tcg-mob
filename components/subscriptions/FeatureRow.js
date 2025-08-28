// components/subscriptions/FeatureRow.js
// NEW: Simple row with a check or a lock icon state.

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function FeatureRow({ label, included }) {
  return (
    <View style={styles.row}>
      <Ionicons
        name={included ? "checkmark-circle" : "lock-closed"}
        size={18}
        color={included ? COLORS.accent : COLORS.textMuted}
        style={{ marginRight: 8 }}
      />
      <Text style={[styles.text, !included && { color: COLORS.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  text: { color: COLORS.text },
});
