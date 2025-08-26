// components/collection/BinderGrid.js

import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function BinderGrid({ binders, onCreate, onOpen }) {
  if (!binders?.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No binders yet.</Text>
        <Pressable onPress={onCreate} style={[styles.cta, { backgroundColor: COLORS.accent }]}>
          <Text style={styles.ctaText}>Create a binder</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {binders.map((b) => (
        <Pressable key={b.id} onPress={() => onOpen(b.id)} style={styles.binderTile}>
          <View style={styles.coverWrap}>
            {b.coverImage ? (
              <Image source={{ uri: b.coverImage }} resizeMode="cover" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={{ color: COLORS.textMuted, fontWeight: "800" }}>
                  {(b.name || "B").slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.tileName} numberOfLines={1}>{b.name || "Untitled"}</Text>
          <Text style={styles.tileMeta} numberOfLines={1}>
            {b.count ?? 0} cards · {b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : "—"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  binderTile: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 8,
  },
  coverWrap: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    aspectRatio: 4 / 3,
    marginBottom: 8,
    position: "relative",
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: { color: COLORS.text, fontWeight: "700" },
  tileMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  emptyWrap: { alignItems: "center", gap: 8, paddingVertical: 16 },
  emptyText: { color: COLORS.textMuted },
  cta: { alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
});
