// components/market/TradeRow.js
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const STATUS_META = {
  PENDING:          { label: "Pending",          color: "#eab308" },
  ACTIVE:           { label: "Active",            color: "#10b981" },
  COUNTERED:        { label: "Countered",         color: "#f97316" },
  AGREED:           { label: "Agreed",            color: "#10b981" },
  PROOF_SUBMITTED:  { label: "Proof submitted",   color: "#22d3ee" },
  COMPLETED:        { label: "Completed",         color: "#6b7280" },
  CANCELLED:        { label: "Cancelled",         color: "#ef4444" },
  DISPUTED:         { label: "Disputed",          color: "#ef4444" },
};

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TradeRow({ trade, myUserId, direction, onMessage, onRespond, onCancel, onShip }) {
  const statusMeta = STATUS_META[trade.status] || { label: trade.status, color: COLORS.textMuted };

  // Cards belonging to each party
  const myParty = myUserId === trade.partyAId ? "A" : "B";
  const theirParty = myParty === "A" ? "B" : "A";

  const myCards = (trade.cards || []).filter((c) => c.party === myParty);
  const theirCards = (trade.cards || []).filter((c) => c.party === theirParty);

  const myCardCount = myCards.length;
  const theirCardCount = theirCards.length;

  return (
    <View style={styles.row}>
      {/* Status pill + date */}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { backgroundColor: statusMeta.color + "22", borderColor: statusMeta.color + "55" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
          <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
        <Text style={styles.dateText}>{fmtDate(trade.createdAt)}</Text>
      </View>

      {/* Cards summary */}
      <View style={styles.cardsRow}>
        <View style={styles.cardsSide}>
          <Text style={styles.cardsSideLabel}>You give</Text>
          <Text style={styles.cardsSideValue}>
            {myCardCount} card{myCardCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <Text style={styles.arrow}>⇄</Text>
        <View style={styles.cardsSide}>
          <Text style={styles.cardsSideLabel}>You get</Text>
          <Text style={styles.cardsSideValue}>
            {theirCardCount} card{theirCardCount !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {trade.topUpAmount > 0 && (
        <Text style={styles.topUpText}>+ £{Number(trade.topUpAmount).toFixed(2)} cash sweetener</Text>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {onMessage && (
          <Pressable onPress={onMessage} style={[styles.btn, { backgroundColor: COLORS.alt, borderColor: COLORS.border }]}>
            <Text style={styles.btnText}>Message</Text>
          </Pressable>
        )}
        {onShip && (trade.status === "LOCKED" || trade.status === "IN_TRANSIT") && (
          <Pressable onPress={onShip} style={[styles.btn, { backgroundColor: COLORS.accent }]}>
            <Text style={[styles.btnText, { color: "#fff" }]}>Ship cards</Text>
          </Pressable>
        )}
        {!onShip && direction === "in" && onRespond && (
          <Pressable onPress={onRespond} style={[styles.btn, { backgroundColor: COLORS.accent }]}>
            <Text style={[styles.btnText, { color: "#fff" }]}>Respond</Text>
          </Pressable>
        )}
        {!onShip && direction === "out" && trade.status !== "COMPLETED" && trade.status !== "CANCELLED" && onCancel && (
          <Pressable onPress={onCancel} style={[styles.btn, { backgroundColor: "#ef444422", borderColor: "#ef444455" }]}>
            <Text style={[styles.btnText, { color: "#ef4444" }]}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
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
    gap: 12,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  dateText: { color: COLORS.textMuted, fontSize: 11 },

  cardsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardsSide: { flex: 1 },
  cardsSideLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  cardsSideValue: { color: COLORS.text, fontWeight: "700", fontSize: 14, marginTop: 2 },
  arrow: { color: COLORS.textMuted, fontSize: 18 },

  topUpText: { color: "#10b981", fontSize: 12, fontWeight: "600" },

  actions: { flexDirection: "row", gap: 8, marginTop: 2 },
  btn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnText: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
});
