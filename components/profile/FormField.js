// components/profile/FormField.js
// NEW: Tiny wrapper to keep field label/hint consistent.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function FormField({ label, hint, children, style }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: COLORS.text, fontWeight: "800", marginBottom: 6 },
  hint: { color: COLORS.textMuted, marginTop: -2, marginBottom: 6, fontSize: 12 },
});
