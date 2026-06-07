// components/market/ListingRow.js

import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function ListingRow({ item, onPress }) {
  const info = item?.cardInfo || {};
  const imageUrl = info.imageSmall || info.imageLarge || null;
  const verified = item?.moderationResult === "approved";
  const sellerName = item?.seller?.username || null;
  const condition = item?.condition || null;
  const setName = info.setName || null;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} resizeMode="contain" style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>
            {item?.price ? `£${Number(item.price).toFixed(2)}` : "Trade"}
          </Text>
        </View>
        {verified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {info.name || item?.cardId || "Card"}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[setName, condition].filter(Boolean).join(" · ")}
        </Text>
        {sellerName && (
          <Text style={styles.seller} numberOfLines={1}>{sellerName}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: "hidden",
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 245 / 337,
    backgroundColor: COLORS.alt,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: COLORS.alt,
  },
  priceBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  priceText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
  verifiedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(16,185,129,0.85)",
    borderRadius: 999,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  info: {
    padding: 10,
    gap: 2,
  },
  name: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 13,
  },
  meta: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  seller: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
