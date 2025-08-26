// components/market/TradeRow.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function TradeRow({ trade, direction, onMessage, onRespond, onCancel }) {
  return (
    <View style={styles.tradeRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {direction === "in" ? `From ${trade.from}` : `To ${trade.to}`}
        </Text>
        <Text style={styles.rowMeta}>You give: {trade.give}</Text>
        <Text style={styles.rowMeta}>You get: {trade.want}</Text>
        <Text style={styles.tradeStatus}>
          {trade.status === "pending"
            ? "Pending"
            : trade.status === "countered"
            ? "Countered"
            : trade.status}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable onPress={onMessage} style={[styles.smallBtn, { backgroundColor: COLORS.accent }]}>
          <Text style={styles.smallBtnText}>Message</Text>
        </Pressable>
        {direction === "in" ? (
          <Pressable
            onPress={onRespond}
            style={[
              styles.smallBtn,
              { backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text style={styles.smallBtnText}>Respond</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onCancel}
            style={[
              styles.smallBtn,
              { backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text style={styles.smallBtnText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tradeRow: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  rowTitle: { color: COLORS.text, fontWeight: "800" },
  rowMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  tradeStatus: { marginTop: 6, color: COLORS.textMuted, fontSize: 12 },
  rowActions: { gap: 8, alignItems: "flex-end" },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smallBtnText: { color: "#fff", fontWeight: "800" },
});
