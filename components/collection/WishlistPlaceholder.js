// components/collection/WishlistPlaceholder.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function WishlistPlaceholder({ count, onOpen, onBrowse }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Wishlist</Text>
      <Text style={{ color: COLORS.textMuted, marginTop: 6 }}>
        You have <Text style={{ color: COLORS.text, fontWeight: "800" }}>{count}</Text> items on your wishlist.
      </Text>
      <View style={styles.rowButtons}>
        <Pressable onPress={onOpen} style={[styles.cta, { backgroundColor: COLORS.accent, flex: 1 }]}>
          <Text style={styles.ctaText}>Open Wishlist</Text>
        </Pressable>
        <Pressable onPress={onBrowse} style={[styles.ctaOutline, { flex: 1 }]}>
          <Text style={styles.ctaOutlineText}>Browse</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  rowButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  cta: { alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  ctaOutline: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.alt,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  ctaOutlineText: { color: COLORS.accent, fontWeight: "800", letterSpacing: 0.3 },
});
