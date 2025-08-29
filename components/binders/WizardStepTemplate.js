// components/binders/WizardStepTemplate.js
// NEW: Step 3 – pick a page template (9-pocket, 4-pocket, full-page, etc.)

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const TEMPLATES = [
  { id: "pocket-9", name: "9-pocket", desc: "3 × 3 grid" },
  { id: "pocket-4", name: "4-pocket", desc: "2 × 2 grid (large slots)" },
  { id: "pocket-3", name: "3-row", desc: "3 × 1 (wide rows)" },
  { id: "full", name: "Full page", desc: "Single large slot" },
];

export default function WizardStepTemplate({ value, onChange }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Template</Text>
      <Text style={styles.sub}>Choose the default page layout. You can mix layouts later.</Text>

      <View style={{ gap: 10 }}>
        {TEMPLATES.map((t) => {
          const active = value === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.id)}
              style={({ pressed }) => [
                styles.row,
                active && styles.rowActive,
                pressed && { opacity: 0.92 },
              ]}
            >
              <View style={styles.preview}>
                {renderTemplateMini(t.id)}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{t.name}</Text>
                <Text style={styles.meta}>{t.desc}</Text>
              </View>
              <Text style={[styles.radio, active && styles.radioActive]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function renderTemplateMini(id) {
  // Minimal mini-preview with boxes (no images)
  const box = { flex: 1, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.alt, margin: 2, borderRadius: 4 };
  if (id === "pocket-9") {
    return (
      <View style={{ flex: 1 }}>
        {[0,1,2].map((r) => (
          <View key={r} style={{ flex: 1, flexDirection: "row" }}>
            {[0,1,2].map((c) => <View key={c} style={box} />)}
          </View>
        ))}
      </View>
    );
  }
  if (id === "pocket-4") {
    return (
      <View style={{ flex: 1 }}>
        {[0,1].map((r) => (
          <View key={r} style={{ flex: 1, flexDirection: "row" }}>
            {[0,1].map((c) => <View key={c} style={[box, { margin: 4 }]} />)}
          </View>
        ))}
      </View>
    );
  }
  if (id === "pocket-3") {
    return (
      <View style={{ flex: 1 }}>
        {[0,1,2].map((r) => <View key={r} style={[box, { margin: 4 }]} />)}
      </View>
    );
  }
  // full
  return <View style={[box, { margin: 6 }]} />;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 14, padding: 12,
  },
  title: { color: COLORS.text, fontWeight: "900" },
  sub: { color: COLORS.textMuted, marginBottom: 10 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 10,
  },
  rowActive: { borderColor: COLORS.accent },
  preview: { width: 74, height: 56, borderRadius: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  name: { color: COLORS.text, fontWeight: "900" },
  meta: { color: COLORS.textMuted, fontSize: 12 },
  radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, borderColor: COLORS.border },
  radioActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
});
