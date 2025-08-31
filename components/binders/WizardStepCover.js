// components/binders/WizardStepCover.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const MOCK_COVERS = [
  { id: "cover1", color: "#23243c", label: "Midnight" },
  { id: "cover2", color: "#1a1f2e", label: "Deep Blue" },
  { id: "cover3", color: "#2a1f2a", label: "Violet" },
  { id: "cover4", color: "#2b2620", label: "Sepia" },
  { id: "cover5", color: "#1f2623", label: "Forest" },
  { id: "cover6", color: "#2a2323", label: "Crimson" },
];

export default function WizardStepCover({ value, onChange }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Choose a cover</Text>
      <Text style={styles.sub}>Pick a color or artwork for the binder.</Text>

      <View style={styles.grid}>
        {MOCK_COVERS.map((c) => {
          const active = value === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => onChange(c.id)}
              style={({ pressed }) => [
                styles.cover,
                { backgroundColor: c.color },
                active && styles.coverActive,
                pressed && { opacity: 0.92 },
              ]}
            >
              {/* Placeholder “art” area; swap to <Image/> when you have assets */}
              <View style={styles.coverInset} />
              <Text style={styles.label} numberOfLines={1}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 14, padding: 12,
  },
  title: { color: COLORS.text, fontWeight: "900" },
  sub: { color: COLORS.textMuted, marginBottom: 10 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cover: {
    width: "48.2%", borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 10,
  },
  coverActive: { borderColor: COLORS.accent, borderWidth: 2 },
  coverInset: {
    height: 90, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#00000020",
  },
  label: { color: "#fff", fontWeight: "800", marginTop: 8 },
});
