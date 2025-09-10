// app/(tabs)/collection.js

import { useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AllCardsPlaceholder from "../../components/collection/AllCardsPlaceholder";
import BinderGrid from "../../components/collection/BinderGrid";
import Fab from "../../components/collection/Fab";
import TopControls from "../../components/collection/TopControls";
import WishlistPlaceholder from "../../components/collection/WishlistPlaceholder";
import PageHeader from "../../components/common/PageHeader";
import { COLORS } from "../../theme/colors";
import { filterBinders } from "../../utils/collectionFilters";

// ✅ package docs
import {
  MyBindersDocument,
  MyCollectionDocument, // expects { userId }
  WishlistDocument, // expects { userId, page, pageSize }
} from "@sixbyfive/tcg-binder/client";
import {
  useMeQuery, // to get the current user's id
} from "@sixbyfive/tcg-binder/react";

export default function CollectionTab() {
  const router = useRouter();

  const [segment, setSegment] = useState("all"); // 'binders' | 'all' | 'wishlist'
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // 1) Get current user id from package hook
  const { data: meData, loading: meLoading, error: meError } = useMeQuery({
    fetchPolicy: "cache-first",
  });
  const userId = meData?.me?.id ?? null;

  // Guard object to avoid repeating `{ userId }` literals
  const uidVars = useMemo(() => ({ userId }), [userId]);

  // 2) Run package queries ONLY when userId exists
  const {
    data: collData,
    loading: collLoading,
    error: collError,
    refetch: refetchCollection,
    networkStatus: collNS,
  } = useQuery(MyCollectionDocument, {
    variables: uidVars,              // <-- REQUIRED
    skip: !userId,                   // <-- avoid "Variable $userId ... not provided"
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: bindersData,
    loading: bindersLoading,
    error: bindersError,
    refetch: refetchBinders,
    networkStatus: bindersNS,
  } = useQuery(MyBindersDocument, {
    variables: uidVars,              // <-- REQUIRED
    skip: !userId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: wishlistData,
    loading: wishlistLoading,
    error: wishlistError,
    refetch: refetchWishlist,
    networkStatus: wishlistNS,
  } = useQuery(WishlistDocument, {
    variables: { ...uidVars, page: 1, pageSize: 1 }, // cheap way to get total
    skip: !userId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  // Derive UI data
  const myCollection = useMemo(
    () => (Array.isArray(collData?.myCollection) ? collData.myCollection : []),
    [collData?.myCollection]
  );
  const allBinders = useMemo(
    () => (Array.isArray(bindersData?.myBinders) ? bindersData.myBinders : []),
    [bindersData?.myBinders]
  );
  const filteredBinders = useMemo(
    () => filterBinders(allBinders, query),
    [allBinders, query]
  );
  const stats = {
    cards: myCollection.length,
    binders: allBinders.length,
    wishlist: Number(wishlistData?.myWishlist?.total ?? 0),
  };

  const anyLoading =
    (meLoading && !userId) ||
    (collLoading && !collData) ||
    (bindersLoading && !bindersData) ||
    (wishlistLoading && !wishlistData);

  const anyError = meError || collError || bindersError || wishlistError;
  const isRefetching =
    collNS === 4 || bindersNS === 4 || wishlistNS === 4; // NetworkStatus.refetch

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refetchCollection?.(),
        refetchBinders?.(),
        refetchWishlist?.(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchCollection, refetchBinders, refetchWishlist]);

  return (
    <View style={styles.container}>
      <PageHeader title="Collection" subtitle="Browse binders and cards" />

      <TopControls
        stats={stats}
        segment={segment}
        onChangeSegment={setSegment}
        query={query}
        onChangeQuery={setQuery}
      />

      {anyLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : anyError ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.error, textAlign: "center", paddingHorizontal: 24 }}>
            {(meError || collError || bindersError || wishlistError)?.message}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              tintColor={COLORS.accent}
              refreshing={refreshing || isRefetching}
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
              count={stats.cards}
              onView={() => router.push("/cards")}
              onAdd={() => router.push("/(tabs)/search")}
            />
          ) : (
            <WishlistPlaceholder
              count={stats.wishlist}
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
