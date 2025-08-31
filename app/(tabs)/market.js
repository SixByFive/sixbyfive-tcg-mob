// app/(tabs)/market.js

import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import EmptyState from "../../components/common/EmptyState";
import PageHeader from "../../components/common/PageHeader";
import { COLORS } from "../../theme/colors";

import ListingRow from "../../components/market/ListingRow";
import MyListingRow from "../../components/market/MyListingRow";
import SearchBar from "../../components/market/SearchBar";
import SegmentControl from "../../components/market/SegmentControl";
import TradesSection from "../../components/market/TradesSection";

import { demoTrades, makeDemoListings } from "../../utils/marketDemoData";
import { filterListings } from "../../utils/marketFilters";

export default function MarketTab() {
  const [segment, setSegment] = useState("browse"); // 'browse' | 'listings' | 'trades'
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // --- Placeholder data (swap with GraphQL results later) ---
  const demoListings = useMemo(() => makeDemoListings(10), []);

  const filtered = useMemo(
    () => (segment === "trades" ? [] : filterListings(demoListings, query)),
    [demoListings, query, segment]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // await refetch(); // when queries are wired
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <View style={styles.container}>
      <PageHeader
        title="Market"
        subtitle="Buy, sell, and trade with the community"
      />

      <SegmentControl
        value={segment}
        onChange={setSegment}
        options={[
          { key: "browse", label: "Browse" },
          { key: "listings", label: "My Listings" },
          { key: "trades", label: "Trades" },
        ]}
      />

      {segment !== "trades" && (
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={
            segment === "browse"
              ? "Search cards, sets, sellers…"
              : "Filter my listings…"
          }
        />
      )}

      {segment === "browse" && (
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
          renderItem={({ item }) => <ListingRow item={item} />}
          ListEmptyComponent={
            <EmptyState message="No listings match your search." />
          }
        />
      )}

      {segment === "listings" && (
        <FlatList
          data={filtered.slice(0, 4)}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
          renderItem={({ item }) => <MyListingRow item={item} />}
          ListFooterComponent={
            <Pressable
              style={[
                styles.cta,
                { backgroundColor: COLORS.accent, marginTop: 8 },
              ]}
            >
              <Text style={styles.ctaText}>Create Listing</Text>
            </Pressable>
          }
          ListEmptyComponent={
            <EmptyState message="You haven’t listed any cards yet." />
          }
        />
      )}

      {segment === "trades" && (
        <TradesSection
          incoming={demoTrades.incoming}
          outgoing={demoTrades.outgoing}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },

  // footer button
  cta: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
});
