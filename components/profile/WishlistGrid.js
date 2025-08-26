// components/profile/WishlistGrid.js

import EmptyState from "../../components/common/EmptyState";
import { COLORS } from "../../theme/colors";

import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { normalizeImageUrl } from "../../utils/cards";

export default function WishlistGrid({ items, onOpenCard, onBrowse }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Wishlist</Text>

      {items?.length ? (
        <View style={styles.wishlistGrid}>
          {items.map((c) => {
            const img = normalizeImageUrl(c.image);
            return (
              <Pressable key={c.id} onPress={() => onOpenCard(c)} style={styles.wishlistTile}>
                <View style={styles.wishlistImgWrap}>
                  {img ? (
                    <Image
                      source={{ uri: img }}
                      resizeMode="contain"
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                </View>
                <Text style={styles.tileName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.tileMeta} numberOfLines={1}>
                  {c.setName} · #{c.number}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState message="Your wishlist is empty." />
          <Pressable
            onPress={onBrowse}
            style={[styles.ctaSmall, { backgroundColor: COLORS.accent }]}
          >
            <Text style={styles.ctaSmallText}>Browse cards</Text>
          </Pressable>
        </View>
      )}
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
    marginTop: 10,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },

  wishlistGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  wishlistTile: {
    width: "48%",
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 8,
  },
  wishlistImgWrap: {
    backgroundColor: COLORS.surface,
    aspectRatio: 245 / 337,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
    position: "relative",
  },
  tileName: { color: COLORS.text, fontWeight: "700" },
  tileMeta: { color: COLORS.textMuted, fontSize: 12 },

  emptyWrap: { alignItems: "center", gap: 8, marginTop: 10 },
  ctaSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  ctaSmallText: { color: "#fff", fontWeight: "800" },
});
