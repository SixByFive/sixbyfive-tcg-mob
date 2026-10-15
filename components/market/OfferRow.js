// components/market/OfferRow.js
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import CardImage from "../common/CardImage";

export const OFFER_STATUS_META = {
  pending:   { label: "Pending",   color: "#eab308" },
  accepted:  { label: "Accepted",  color: "#10b981" },
  declined:  { label: "Declined",  color: "#ef4444" },
  countered: { label: "Countered", color: "#60a5fa" },
  withdrawn: { label: "Withdrawn", color: "#6b7280" },
  expired:   { label: "Expired",   color: "#6b7280" },
};

function fmt(amount, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(amount) || 0);
  } catch {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
}

function timeAgo(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function timeLeft(d) {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "< 1h left";
  if (hrs < 24) return `${hrs}h left`;
  return `${Math.floor(hrs / 24)}d left`;
}

export default function OfferRow({ offer, direction, onPress }) {
  const status = (offer.status || "").toLowerCase();
  const meta = OFFER_STATUS_META[status] || { label: offer.status, color: COLORS.textMuted };

  const cardInfo = offer.listing?.cardInfo;
  const listingPrice = offer.listing?.price;

  const counterparty = direction === "in" ? offer.buyer : offer.listing?.seller;
  const counterpartyLabel = direction === "in" ? "Buyer" : "Seller";

  const expiry = status === "pending" ? timeLeft(offer.expiresAt) : null;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <CardImage uri={cardInfo?.imageSmall} name={cardInfo?.name} cardId={cardInfo?.id} style={styles.image} />

      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.topRow}>
          <Text style={styles.cardName} numberOfLines={1}>{cardInfo?.name || "Card"}</Text>
          <Text style={styles.amount}>{fmt(offer.amount)}</Text>
        </View>

        {cardInfo?.setName && (
          <Text style={styles.setName} numberOfLines={1}>{cardInfo.setName}</Text>
        )}

        {listingPrice && (
          <Text style={styles.listingPrice}>Listed at {fmt(listingPrice)}</Text>
        )}

        <View style={styles.pillRow}>
          <View style={[styles.pill, { borderColor: meta.color + "55", backgroundColor: meta.color + "22" }]}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {status === "countered" && offer.counterAmount && (
            <View style={[styles.pill, { borderColor: "#60a5fa55", backgroundColor: "#60a5fa22" }]}>
              <Text style={[styles.pillText, { color: "#60a5fa" }]}>Counter: {fmt(offer.counterAmount)}</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomRow}>
          {counterparty?.username && (
            <Text style={styles.counterparty}>{counterpartyLabel}: {counterparty.username}</Text>
          )}
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            {expiry && (
              <Text style={[styles.expiry, expiry === "Expired" && { color: "#ef4444" }]}>{expiry}</Text>
            )}
            <Text style={styles.date}>{timeAgo(offer.createdAt)}</Text>
          </View>
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
  amount: { color: COLORS.text, fontWeight: "800", fontSize: 14 },
  setName: { color: COLORS.textMuted, fontSize: 11 },
  listingPrice: { color: COLORS.textMuted, fontSize: 11 },
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
  expiry: { color: "#eab308", fontSize: 10, fontWeight: "700" },
  date: { color: COLORS.textMuted, fontSize: 10 },
});
