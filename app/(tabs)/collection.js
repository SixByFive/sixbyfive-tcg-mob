// app/(tabs)/collection.js

import { useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import AllCardsPlaceholder from "../../components/collection/AllCardsPlaceholder";
import BinderGrid from "../../components/collection/BinderGrid";
import Fab from "../../components/collection/Fab";
import TopControls from "../../components/collection/TopControls";
import WishlistPlaceholder from "../../components/collection/WishlistPlaceholder";
import PageHeader from "../../components/common/PageHeader";
import { COLLECTION_Q } from "../../graphql/collectionQueries";
import { COLORS } from "../../theme/colors";
import { filterBinders } from "../../utils/collectionFilters";

export default function CollectionTab() {
  const router = useRouter();

  const [segment, setSegment] = useState("all"); // 'binders' | 'all' | 'wishlist'
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading, error, refetch, networkStatus } = useQuery(COLLECTION_Q, {
    notifyOnNetworkStatusChange: true,
  });

  const me = data?.me ?? null;
  const allBinders = me?.binders?.length ? me.binders : (me?.recentBinders ?? []);

  const filteredBinders = useMemo(
    () => filterBinders(allBinders, query),
    [allBinders, query]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <View style={styles.container}>
      <PageHeader title="Collection" subtitle="Browse binders and cards" />

      <TopControls
        stats={{
          cards: me?.stats?.cards ?? 0,
          binders: me?.stats?.binders ?? 0,
          wishlist: me?.stats?.wishlist ?? 0,
        }}
        segment={segment}
        onChangeSegment={setSegment}
        query={query}
        onChangeQuery={setQuery}
      />

      {loading && !me ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.error, textAlign: "center", paddingHorizontal: 24 }}>
            {error.message}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              tintColor={COLORS.accent}
              refreshing={refreshing || networkStatus === 4}
              onRefresh={onRefresh}
            />
          }
        >
          {segment === "binders" ? (
            <BinderGrid
              binders={filteredBinders}
              onCreate={() => router.push("/binders/new")}
              onOpen={(id) => router.push(`/binder/${id}`)}
            />
          ) : segment === "all" ? (
            <AllCardsPlaceholder
              count={me?.stats?.cards ?? 0}
              onView={() => router.push("/cards")}
              onAdd={() => router.push("/(tabs)/search")}
            />
          ) : (
            <WishlistPlaceholder
              count={me?.stats?.wishlist ?? 0}
              onOpen={() => router.push("/wishlist")}
              onBrowse={() => router.push("/(tabs)/search")}
            />
          )}

          <View style={{ height: 28 }} />
        </ScrollView>
      )}

      <Fab label="＋" onPress={() => router.push("/binders/new")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
