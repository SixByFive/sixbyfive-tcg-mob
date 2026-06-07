// components/market/OffersSection.js
import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import EmptyState from "../common/EmptyState";
import OfferRow from "./OfferRow";
import OfferDetailSheet from "./OfferDetailSheet";
import { MyIncomingOffersDocument, MyOffersDocument } from "../../graphql/documents";

const TABS = [
  { key: "incoming", label: "Incoming" },
  { key: "sent",     label: "Sent" },
];

export default function OffersSection() {
  const [tab, setTab] = useState("incoming");
  const [selectedOffer, setSelectedOffer] = useState(null);

  const {
    data: incomingData,
    loading: incomingLoading,
    refetch: refetchIncoming,
  } = useQuery(MyIncomingOffersDocument, { fetchPolicy: "cache-and-network" });

  const {
    data: sentData,
    loading: sentLoading,
    refetch: refetchSent,
  } = useQuery(MyOffersDocument, { fetchPolicy: "cache-and-network" });

  const incomingOffers = incomingData?.myIncomingOffers ?? [];
  const sentOffers = sentData?.myOffers ?? [];

  const offers = tab === "incoming" ? incomingOffers : sentOffers;
  const loading = tab === "incoming" ? incomingLoading : sentLoading;
  const refetch = tab === "incoming" ? refetchIncoming : refetchSent;
  const direction = tab === "incoming" ? "in" : "out";

  const pendingIncoming = incomingOffers.filter((o) => o.status === "pending").length;
  const pendingSent = sentOffers.filter((o) => o.status === "pending" || o.status === "countered").length;

  function handleRefresh() {
    refetchIncoming();
    refetchSent();
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabRow}>
        {TABS.map(({ key, label }) => {
          const badge = key === "incoming" ? pendingIncoming : pendingSent;
          return (
            <Pressable
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
                {badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={offers}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading && offers.length === 0}
            onRefresh={handleRefresh}
            tintColor={COLORS.accent}
          />
        }
        renderItem={({ item }) => (
          <OfferRow
            offer={item}
            direction={direction}
            onPress={() => setSelectedOffer({ offer: item, direction })}
          />
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              message={
                tab === "incoming"
                  ? "No incoming offers."
                  : "You haven't made any offers yet."
              }
            />
          )
        }
      />

      <OfferDetailSheet
        offer={selectedOffer?.offer ?? null}
        direction={selectedOffer?.direction ?? "in"}
        visible={!!selectedOffer}
        onClose={() => setSelectedOffer(null)}
        onRefresh={handleRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  tabActive: { backgroundColor: COLORS.alt },
  tabText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: COLORS.text },
  badge: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  list: { paddingBottom: 40 },
});
