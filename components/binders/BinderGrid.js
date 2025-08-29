// components/binder/BinderGrid.js
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

// Fullscreen-friendly grid; rows/cols apply globally (all pages).
export default function BinderGrid({ rows = 3, cols = 3 }) {
  return (
    <View style={styles.gridCard}>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={styles.gridRow}>
          {Array.from({ length: cols }).map((__, c) => (
            <Pressable key={c} style={({ pressed }) => [styles.cell, pressed && { opacity: 0.92 }]}>
              <View style={styles.cellInset}>
                <Text style={styles.cellText}>＋</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const BOTTOM_PAGER_H = 64;

const styles = StyleSheet.create({
  gridCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: BOTTOM_PAGER_H + 8, // keep clear of bottom pager
  },
  gridRow: { flexDirection: "row", gap: 8, flex: 1 },
  cell: { flex: 1, flexBasis: 0 },
  cellInset: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { color: COLORS.textMuted, fontSize: 22, fontWeight: "900" },
});
