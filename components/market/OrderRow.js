// components/market/OrderRow.js
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const FULFILMENT_META = {
  pending:           { label: "Pending",           color: "#eab308" },
  awaiting_shipment: { label: "Awaiting shipment", color: "#f97316" },
  shipped:           { label: "Shipped",           color: "#22d3ee" },
  completed:         { label: "Completed",         color: "#10b981" },
  cancelled:         { label: "Cancelled",         color: "#ef4444" },
  disputed:          { label: "Disputed",          color: "#ef4444" },
};

function fmt(amount, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(amount) || 0);
  } catch {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrderRow({ order, myUserId, onPress }) {
  const isBuyer = order.buyerId === myUserId;
  const role = isBuyer ? "Buying" : "Selling";
  const roleColor = isBuyer ? "#60a5fa" : "#10b981";

  const status = (order.fulfilmentStatus || "").toLowerCase();
  const meta = FULFILMENT_META[status] || { label: order.fulfilmentStatus, color: COLORS.textMuted };

  const cardInfo = order.listing?.cardInfo;
  const counterparty = isBuyer ? order.seller : order.buyer;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      {cardInfo?.imageSmall ? (
        <Image source={{ uri: cardInfo.imageSmall }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={[styles.image, { backgroundColor: COLORS.alt }]} />
      )}

      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.topRow}>
          <Text style={styles.cardName} numberOfLines={1}>{cardInfo?.name || "Card"}</Text>
          <Text style={styles.price}>{fmt(order.totalAmount, order.currency)}</Text>
        </View>

        {cardInfo?.setName && (
          <Text style={styles.setName} numberOfLines={1}>{cardInfo.setName}</Text>
        )}

        <View style={styles.pillRow}>
          <View style={[styles.pill, { borderColor: roleColor + "55", backgroundColor: roleColor + "22" }]}>
            <Text style={[styles.pillText, { color: roleColor }]}>{role}</Text>
          </View>
          <View style={[styles.pill, { borderColor: meta.color + "55", backgroundColor: meta.color + "22" }]}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          {counterparty?.username && (
            <Text style={styles.counterparty}>
              {isBuyer ? "Seller" : "Buyer"}: {counterparty.username}
            </Text>
          )}
          <Text style={styles.date}>{fmtDate(order.createdAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  image: { width: 52, height: 72, borderRadius: 6 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { color: COLORS.text, fontWeight: "700", fontSize: 14, flex: 1, marginRight: 8 },
  price: { color: COLORS.text, fontWeight: "800", fontSize: 14 },
  setName: { color: COLORS.textMuted, fontSize: 11 },
  pillRow: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillText: { fontSize: 10, fontWeight: "700" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  counterparty: { color: COLORS.textMuted, fontSize: 11 },
  date: { color: COLORS.textMuted, fontSize: 10 },
});
