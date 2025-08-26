// components/market/TradesSection.js

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import EmptyState from "../common/EmptyState";
import TradeRow from "./TradeRow";

export default function TradesSection({ incoming, outgoing }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>Incoming</Text>
      <View style={{ height: 8 }} />
      {incoming?.length ? (
        incoming.map((t) => (
          <TradeRow
            key={t.id}
            trade={t}
            direction="in"
            onMessage={() => {}}
            onRespond={() => {}}
          />
        ))
      ) : (
        <EmptyState message="No incoming trades." />
      )}

      <View style={{ height: 18 }} />
      <Text style={styles.sectionTitle}>Outgoing</Text>
      <View style={{ height: 8 }} />
      {outgoing?.length ? (
        outgoing.map((t) => (
          <TradeRow
            key={t.id}
            trade={t}
            direction="out"
            onMessage={() => {}}
            onCancel={() => {}}
          />
        ))
      ) : (
        <EmptyState message="No outgoing trades." />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 16,
    paddingHorizontal: 12,
    marginTop: 12,
  },
});
