// components/binders/WizardStepName.js
// NEW: Step 1 – binder name

import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function WizardStepName({ value, onChange }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Name your binder</Text>
      <Text style={styles.sub}>You can change this later.</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="e.g., Main Binder, Trades, Set Master…"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
        autoFocus
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 14, padding: 14,
  },
  title: { color: COLORS.text, fontWeight: "900", marginBottom: 4 },
  sub: { color: COLORS.textMuted, marginBottom: 10 },
  input: {
    backgroundColor: COLORS.alt, color: COLORS.text,
    borderColor: COLORS.border, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
  },
});
