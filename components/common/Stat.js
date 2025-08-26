// components/common/Stat.js

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function Stat({ label, value, minWidth = 72 }) {
  return (
    <View style={[styles.wrap, { minWidth }]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  value: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  label: { color: COLORS.textMuted, fontSize: 12 },
});
