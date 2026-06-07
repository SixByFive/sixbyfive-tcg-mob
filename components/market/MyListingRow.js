// components/market/MyListingRow.js

import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const STATUS_COLOR = {
  ACTIVE:        "#10b981",
  PENDING_PROOF: "#eab308",
  SOLD:          "#6b7280",
  CANCELLED:     "#ef4444",
  REMOVED:       "#ef4444",
};

export default function MyListingRow({ item, onEdit, onRemove, onSubmitProof }) {
  const info = item?.cardInfo || {};
  const imageUrl = info.imageSmall || info.imageLarge || null;
  const metaParts = [info.setName, info.number ? `#${info.number}` : null, item?.condition].filter(Boolean);
  const statusColor = STATUS_COLOR[item?.status] || COLORS.textMuted;

  return (
    <View style={styles.row}>
      <View style={styles.thumbWrap}>
        {imageUrl && (
          <Image source={{ uri: imageUrl }} resizeMode="contain" style={StyleSheet.absoluteFill} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {info.name || item?.cardId || "Card"}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{metaParts.join(" · ")}</Text>
        <Text style={[styles.rowStatus, { color: statusColor }]} numberOfLines={1}>
          {item?.status || "ACTIVE"} · {item?.price ? `£${Number(item.price).toFixed(2)}` : "Trade"}
        </Text>
      </View>
      <View style={styles.rowActions}>
        {item?.status === "PENDING_PROOF" ? (
          <Pressable onPress={onSubmitProof} style={[styles.smallBtn, { backgroundColor: "#d97706" }]}>
            <Text style={styles.smallBtnText}>+ Proof</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onEdit}
            style={[styles.smallBtn, { backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth }]}
          >
            <Text style={[styles.smallBtnText, { color: COLORS.text }]}>Edit</Text>
          </Pressable>
        )}
        <Pressable onPress={onRemove} style={[styles.smallBtn, { backgroundColor: "#DB3A34" }]}>
          <Text style={styles.smallBtnText}>Delist</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  thumbWrap: {
    width: 64,
    aspectRatio: 245 / 337,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: COLORS.alt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    position: "relative",
  },
  rowTitle: { color: COLORS.text, fontWeight: "800" },
  rowMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  rowStatus: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  rowActions: { gap: 8, alignItems: "flex-end" },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  smallBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
