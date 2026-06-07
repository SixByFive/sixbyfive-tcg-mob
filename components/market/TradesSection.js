// components/market/TradesSection.js
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import EmptyState from "../common/EmptyState";
import TradeRow from "./TradeRow";
import TradeDetailSheet from "./TradeDetailSheet";
import { MyTradesDocument } from "../../graphql/documents";

export default function TradesSection({ myUserId }) {
  const [selectedTrade, setSelectedTrade] = useState(null);
  const { data: activeData, loading, refetch } = useQuery(MyTradesDocument, {
    variables: {},
    fetchPolicy: "cache-and-network",
  });

  const allTrades = activeData?.myTrades || [];
  const shippable = allTrades.filter(
    (t) => t.status === "LOCKED" || t.status === "IN_TRANSIT"
  );
  const incoming = allTrades.filter(
    (t) =>
      t.initiatorId !== myUserId &&
      (t.status === "PENDING" || t.status === "ACTIVE" || t.status === "COUNTERED")
  );
  const outgoing = allTrades.filter(
    (t) =>
      t.initiatorId === myUserId &&
      (t.status === "PENDING" || t.status === "ACTIVE" || t.status === "COUNTERED")
  );
  const completed = allTrades.filter(
    (t) => t.status === "COMPLETED" || t.status === "CANCELLED"
  );

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {shippable.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Ready to ship</Text>
            {shippable.map((t) => (
              <TradeRow
                key={t.id}
                trade={t}
                myUserId={myUserId}
                direction={t.initiatorId === myUserId ? "out" : "in"}
                onMessage={() => {}}
                onShip={() => setSelectedTrade(t)}
              />
            ))}
          </>
        )}

        <Text style={[styles.sectionLabel, shippable.length > 0 && styles.sectionLabelSpaced]}>
          Incoming
        </Text>
        {loading ? (
          <Text style={styles.loadingText}>Loading…</Text>
        ) : incoming.length ? (
          incoming.map((t) => (
            <TradeRow
              key={t.id}
              trade={t}
              myUserId={myUserId}
              direction="in"
              onMessage={() => {}}
              onRespond={() => {}}
            />
          ))
        ) : (
          <EmptyState message="No incoming trades." />
        )}

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Outgoing</Text>
        {loading ? null : outgoing.length ? (
          outgoing.map((t) => (
            <TradeRow
              key={t.id}
              trade={t}
              myUserId={myUserId}
              direction="out"
              onMessage={() => {}}
              onCancel={() => {}}
            />
          ))
        ) : (
          <EmptyState message="No outgoing trades." />
        )}

        {completed.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>History</Text>
            {completed.map((t) => (
              <TradeRow
                key={t.id}
                trade={t}
                myUserId={myUserId}
                direction={t.initiatorId === myUserId ? "out" : "in"}
              />
            ))}
          </>
        )}
      </ScrollView>

      <TradeDetailSheet
        trade={selectedTrade}
        myUserId={myUserId}
        visible={!!selectedTrade}
        onClose={() => setSelectedTrade(null)}
        onRefresh={refetch}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    marginTop: 22,
  },
  loadingText: {
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 16,
    fontSize: 13,
  },
});
