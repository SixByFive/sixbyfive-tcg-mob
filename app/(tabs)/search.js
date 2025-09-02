// app/(tabs)/search.js

import { useLazyQuery } from "@apollo/client";
import { SearchCardsDocument } from "@sixbyfive/tcg-binder";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import EmptyState from "../../components/common/EmptyState";
import CardTile from "../../components/search/CardTile";
import SearchForm from "../../components/search/SearchForm";
import SearchHeader from "../../components/search/SearchHeader";
import { PER_PAGE } from "../../constants/pagination";
import { COLORS } from "../../theme/colors";

export default function SearchTab() {
  const router = useRouter();

  // form state
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  // paging state
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const [hasMore, setHasMore] = useState(false);

  const isExactCardSearch = useMemo(
    () => Boolean(setCode && number),
    [setCode, number]
  );

  const canSearch = useMemo(
    () =>
      name.trim().length > 0 ||
      setCode.trim().length > 0 ||
      number.trim().length > 0,
    [name, setCode, number]
  );

  const [runSearch, { data, loading, error, fetchMore, called }] = useLazyQuery(
    SearchCardsDocument,
    {
      notifyOnNetworkStatusChange: true,
      // ensure the first result comes from the network (with prices) then cache
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-first",
      returnPartialData: false,
    }
  );

  const results = data?.searchCards?.cards ?? [];

  // Determine if there are more pages, using pageInfo when available.
  const readHasMore = (payload, pageSize) => {
    const root = payload?.searchCards;
    if (!root) return false;
    const pi = root.pageInfo || root.pageinfo || root.pagination || {};
    if (typeof pi.hasMore === "boolean") return pi.hasMore;
    if (typeof pi.hasNextPage === "boolean") return pi.hasNextPage;

    if (pi.total && (pi.page || pi.currentPage)) {
      const page = Number(pi.page ?? pi.currentPage ?? 1);
      const size = Number(pi.pageSize ?? pageSize ?? PER_PAGE);
      return page * size < Number(pi.total);
    }
    // fallback when no metadata: if we received a full page (and not exact card)
    const len = (root.cards || []).length;
    return len === (pageSize ?? PER_PAGE) && !isExactCardSearch;
  };

  const onSearch = () => {
    if (!canSearch) return;
    pageRef.current = 1;
    loadingMoreRef.current = false;
    setHasMore(false);

    runSearch({
      variables: {
        input: {
          name: name.trim() || null,
          set: setCode.trim().toUpperCase() || null,
          number: number.trim() || null,
          page: 1,
          pageSize: PER_PAGE,
        },
        // Some backends expose a top-level flag for prices.
        // Safe to pass both; unused vars are ignored by the server.
        includePrices: true,
        withPrices: true,
      },
      onCompleted: (res) => {
        setHasMore(readHasMore(res, PER_PAGE));
      },
    });
  };

  const loadMore = async () => {
    if (!hasMore || loading || loadingMoreRef.current || !called) return;
    loadingMoreRef.current = true;

    const nextPage = pageRef.current + 1;

    try {
      await fetchMore({
        variables: {
          input: {
            name: name.trim() || null,
            set: setCode.trim().toUpperCase() || null,
            number: number.trim() || null,
            page: nextPage,
            pageSize: PER_PAGE,
          },
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          const prevCards = prev?.searchCards?.cards ?? [];
          const nextCards = fetchMoreResult?.searchCards?.cards ?? [];

          // dedupe by id
          const byId = new Map();
          for (const c of [...prevCards, ...nextCards]) {
            if (c?.id != null) byId.set(String(c.id), c);
          }
          const merged = Array.from(byId.values());

          // did we actually get new ids?
          const prevIds = new Set(prevCards.map((c) => String(c?.id)));
          const gotNew = nextCards.some((c) => !prevIds.has(String(c?.id)));

          if (gotNew) {
            pageRef.current = nextPage;
          }

          // conservative hasMore: prefer pageInfo; else full-page heuristic
          const root = fetchMoreResult?.searchCards;
          const pi = root?.pageInfo || root?.pageinfo || root?.pagination || {};
          const nextHasMore =
            typeof pi?.hasMore === "boolean"
              ? pi.hasMore
              : typeof pi?.hasNextPage === "boolean"
              ? pi.hasNextPage
              : nextCards.length === PER_PAGE && !isExactCardSearch;

          setHasMore(gotNew && nextHasMore); // only true if we made progress

          return { searchCards: { ...(root || {}), cards: merged } };
        },
      });
    } finally {
      loadingMoreRef.current = false;
    }
  };

  const showPlaceholders = !loading && results.length === 0;

  return (
    <View style={styles.container}>
      <SearchHeader
        title="Pokémon Card Search"
        subtitle="Search for any Pokémon card and add it to your collection"
      />

      <SearchForm
        name={name}
        setName={setName}
        setCode={setCode}
        setSetCode={setSetCode}
        number={number}
        setNumber={setNumber}
        canSearch={canSearch}
        loading={loading}
        onSearch={onSearch}
        errorMessage={error?.message}
      />

      {results.length > 0 ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={results}
          keyExtractor={(item, idx) => (item?.id ? String(item.id) : `${idx}`)}
          numColumns={2}
          columnWrapperStyle={styles.column}
          renderItem={({ item }) => (
            <CardTile
              item={item}
              onPress={() =>
                router.push({
                  pathname: `/card/${item.id}`,
                  params: {
                    id: String(item.id),
                    name: item.name ?? "",
                    number: String(item.number ?? ""),
                    setName: item.setName ?? "",
                    image: item.image ?? "",
                    prices: JSON.stringify(item.prices ?? []),
                  },
                })
              }
            />
          )}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={styles.footerLoadingText}>Loading more…</Text>
              </View>
            ) : null
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
        />
      ) : showPlaceholders ? (
        // visible placeholders in a strict 2-column grid
        <PlaceholderGrid shimmer={!called && !loading} rows={6} />
      ) : (
        // (rare) explicit empty + not loading + called -> keep your empty state
        <EmptyState message="No results found. Try different filters." />
      )}
    </View>
  );
}

/* ---------- visible placeholder items (always 2 per row) ---------- */
function PlaceholderGrid({ shimmer = false, rows = 3 }) {
  const items = Array.from({ length: rows * 2 }, (_, i) => i);
  return (
    <View style={styles.placeholderWrap}>
      {items.map((i) => (
        <View key={i} style={styles.placeholderCell}>
          <PlaceholderTile shimmer={shimmer} />
        </View>
      ))}
    </View>
  );
}

function PlaceholderTile({ shimmer = false }) {
  return (
    <View style={styles.placeholderCard}>
      <View style={[styles.placeholderImageWrap, shimmer && styles.pulse]} />
      <View style={styles.placeholderInfo}>
        <View
          style={[styles.placeholderLine, { width: "72%" }, shimmer && styles.pulse]}
        />
        <View
          style={[
            styles.placeholderLine,
            { width: "46%", marginTop: 6 },
            shimmer && styles.pulse,
          ]}
        />
      </View>
      <View style={[styles.placeholderBar, shimmer && styles.pulse]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // real results grid
  listContent: { paddingHorizontal: 6, paddingBottom: 20 },
  column: { gap: 4 },

  footerLoading: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerLoadingText: { color: COLORS.textMuted, fontSize: 12 },

  // placeholder grid: exactly two columns
  placeholderWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 6,
    paddingBottom: 20,
  },
  placeholderCell: {
    width: "50%", // <-- forces 2 per row
    padding: 6,   // matches CardTile margins
  },

  // visible placeholder tile
  placeholderCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  placeholderImageWrap: {
    backgroundColor: COLORS.alt,
    aspectRatio: 245 / 337,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeholderInfo: { padding: 8 },
  placeholderLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.alt,
  },
  placeholderBar: {
    height: 36,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pulse: { opacity: 0.8 },
});
