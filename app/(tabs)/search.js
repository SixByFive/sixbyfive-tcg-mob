import { useLazyQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SEARCH_CARDS_CONN_WITH_PRICES as SearchCardsConnectionDocument,
} from "../../graphql/app-search-queries";

import EmptyState from "../../components/common/EmptyState";
import CardTile from "../../components/search/CardTile";
import SearchForm from "../../components/search/SearchForm";
import SearchHeader from "../../components/search/SearchHeader";
import { PER_PAGE } from "../../constants/pagination";
import { COLORS } from "../../theme/colors";

/* ---------------- helpers to normalize server shapes ---------------- */

function readPageInfo(payload) {
  const root =
    payload?.searchCardsConnection ??
    payload?.searchCards ??
    {};
  const pi = root.pageInfo || root.pageinfo || root.pagination || {};
  return {
    hasNextPage:
      typeof pi.hasNextPage === "boolean"
        ? pi.hasNextPage
        : typeof pi.hasMore === "boolean"
        ? pi.hasMore
        : false,
    endCursor: pi.endCursor || pi.endcursor || pi.cursor || null,
    total: Number(root.totalCount ?? root.total ?? pi.total ?? 0) || 0,
  };
}

// unify a single price record (tcgplayer vs tcgPlayer; keep other fields)
function normalizePrice(p) {
  if (!p || typeof p !== "object") return p;
  const hasCamel = Object.prototype.hasOwnProperty.call(p, "tcgPlayer");
  const hasLower = Object.prototype.hasOwnProperty.call(p, "tcgplayer");
  return {
    ...p,
    tcgplayer: hasLower ? p.tcgplayer : hasCamel ? p.tcgPlayer : p.tcgplayer ?? p.tcgPlayer ?? null,
  };
}

function normalizePricesArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizePrice);
}

// Prefer `searchCardsConnection.edges[].node`, but keep flat `cards[]` fallback
function readCards(payload) {
  const root =
    payload?.searchCardsConnection ??
    payload?.searchCards ??
    {};

  // flat array form
  if (Array.isArray(root.cards))
    return root.cards.map((n) => ({
      ...n,
      prices: Array.isArray(n?.prices)
        ? normalizePricesArray(n.prices)
        : Array.isArray(n?.pricing)
        ? normalizePricesArray(n.pricing)
        : [],
    }));

  // relay-style edges
  if (Array.isArray(root.edges))
    return root.edges
      .map((e) => e?.node)
      .filter(Boolean)
      .map((n) => ({
        ...n,
        prices: Array.isArray(n?.prices)
          ? normalizePricesArray(n.prices)
          : Array.isArray(n?.pricing)
          ? normalizePricesArray(n.pricing)
          : [],
      }));
  return [];
}

// --- Exclude TCG Pocket locally (until server-side filter is wired) ---
function isPocketCard(card) {
  const name = (card?.setName || "").toLowerCase();
  const code = (card?.set || "").toLowerCase();
  // Heuristics: set name contains "pocket" OR codes commonly used for Pocket
  return name.includes("pocket") || code.startsWith("pocket") || code.startsWith("pkp");
}

function filterOutPocket(cards, exclude = true) {
  if (!exclude) return cards;
  return cards.filter((c) => !isPocketCard(c));
}

function readHasMore(payload, pageSize, isExact) {
  const { hasNextPage, total } = readPageInfo(payload);
  if (typeof hasNextPage === "boolean") return hasNextPage;
  if (total && !isExact) {
    const len = readCards(payload).length;
    return len < total;
  }
  const len = readCards(payload).length;
  return len === (pageSize ?? PER_PAGE) && !isExact;
}

function readEndCursor(payload) {
  return readPageInfo(payload).endCursor || null;
}

// CHANGED: remove client-side set mapping; let backend handle abbreviations/canonicalization
function sanitizeSet(input) {
  const s = (input ?? "").trim();
  return s || null;
}

export default function SearchTab() {
  const router = useRouter();

  // form state
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  // paging state
  const pageRef = useRef(1);
  const afterRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const [hasMore, setHasMore] = useState(false);

  // UX toggles
  const excludePocket = useMemo(() => {
    // If user explicitly types "pocket" in the set field, don't exclude
    return !/pocket/i.test(setCode || "");
  }, [setCode]);

  const isExactCardSearch = useMemo(
    () => Boolean(sanitizeSet(setCode) && number.trim()),
    [setCode, number]
  );

  const canSearch = useMemo(
    () =>
      name.trim().length > 0 ||
      setCode.trim().length > 0 ||
      number.trim().length > 0,
    [name, setCode, number]
  );

  // Use the connection query
  const [runSearch, { data, loading, error, fetchMore, called }] = useLazyQuery(
    SearchCardsConnectionDocument,
    {
      notifyOnNetworkStatusChange: true,
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-first",
      returnPartialData: false,
    }
  );

  // Normalize + filter pocket
  const results = useMemo(() => {
    const cards = readCards(data);
    return filterOutPocket(cards, excludePocket);
  }, [data, excludePocket]);

  const onSearch = () => {
    if (!canSearch) return;
    pageRef.current = 1;
    afterRef.current = null;
    loadingMoreRef.current = false;
    setHasMore(false);

    const setParam = sanitizeSet(setCode);

    // when searching by set only, send only 'set' (name/number null)
    // and set trustUpstream:true so backend respects filters strictly.
    runSearch({
      variables: {
        input: {
          name: name.trim() || null,
          set: setParam,
          number: number.trim() || null,
          first: PER_PAGE,
          after: null,
          trustUpstream: true,
        },
        includePrices: true,
      },
      onCompleted: (res) => {
        setHasMore(readHasMore(res, PER_PAGE, isExactCardSearch));
        afterRef.current = readEndCursor(res);
      },
    });
  };

  const loadMore = async () => {
    if (!hasMore || loading || loadingMoreRef.current || !called) return;
    loadingMoreRef.current = true;

    const nextAfter = afterRef.current;
    const nextPage = pageRef.current + 1;

    try {
      await fetchMore({
        variables: {
          input: {
            name: name.trim() || null,
            set: sanitizeSet(setCode),
            number: number.trim() || null,
            first: PER_PAGE,
            after: nextAfter,
            trustUpstream: true,
          },
          includePrices: true,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          const prevCards = filterOutPocket(readCards(prev), excludePocket);
          const nextCards = filterOutPocket(readCards(fetchMoreResult), excludePocket);

          // dedupe by id
          const byId = new Map();
          for (const c of [...prevCards, ...nextCards]) {
            if (c?.id != null) byId.set(String(c.id), c);
          }
          const merged = Array.from(byId.values());

          // progress?
          const prevIds = new Set(prevCards.map((c) => String(c?.id)));
          const gotNew = nextCards.some((c) => !prevIds.has(String(c?.id)));
          if (gotNew) pageRef.current = nextPage;

          const nextHasMore = readHasMore(
            fetchMoreResult,
            PER_PAGE,
            isExactCardSearch
          );
          setHasMore(gotNew && nextHasMore);
          afterRef.current = readEndCursor(fetchMoreResult);

          const root =
            fetchMoreResult?.searchCardsConnection ??
            fetchMoreResult?.searchCards ??
            {};
          return {
            searchCardsConnection: {
              ...root,
              edges: merged.map((node) => ({ cursor: null, node })),
            },
          };
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
          keyExtractor={(item, idx) =>
            item?.id ? String(item.id) : `${idx}`
          }
          numColumns={2}
          columnWrapperStyle={styles.column}
          renderItem={({ item }) => {
            const normalizedPrices = Array.isArray(item?.prices)
              ? item.prices
              : Array.isArray(item?.pricing)
              ? item.pricing
              : [];
            return (
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
                      prices: JSON.stringify(normalizedPrices),
                      pricing: JSON.stringify(normalizedPrices),
                    },
                  })
                }
              />
            );
          }}
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
        <PlaceholderGrid shimmer={!called && !loading} rows={6} />
      ) : (
        <EmptyState message="No results found. Try different filters." />
      )}
    </View>
  );
}

/* ---------- visible placeholders (always 2 per row) ---------- */
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
        <View style={[styles.placeholderLine, { width: "72%" }, shimmer && styles.pulse]} />
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
  listContent: { paddingHorizontal: 6, paddingBottom: 20 },
  column: { gap: 4 },
  footerLoading: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerLoadingText: { color: COLORS.textMuted, fontSize: 12 },
  placeholderWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 6,
    paddingBottom: 20,
  },
  placeholderCell: { width: "50%", padding: 6 },
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
