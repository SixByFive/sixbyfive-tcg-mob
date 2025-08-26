// components/market/MyListingRow.js

import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function MyListingRow({ item, onEdit, onRemove }) {
  return (
    <View style={styles.row}>
      <View style={styles.thumbWrap}>
        <Image source={{ uri: item.image }} resizeMode="contain" style={StyleSheet.absoluteFill} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {item.setName} · #{item.number} · {item.condition}
        </Text>
        <Text style={styles.rowMetaMuted} numberOfLines={1}>Price: £{item.price}</Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable
          onPress={onEdit}
          style={[
            styles.smallBtn,
            { backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <Text style={styles.smallBtnText}>Edit</Text>
        </Pressable>
        <Pressable onPress={onRemove} style={[styles.smallBtn, { backgroundColor: "#DB3A34" }]}>
          <Text style={styles.smallBtnText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
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
  rowMetaMuted: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  rowActions: { gap: 8, alignItems: "flex-end" },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smallBtnText: { color: "#fff", fontWeight: "800" },
});
