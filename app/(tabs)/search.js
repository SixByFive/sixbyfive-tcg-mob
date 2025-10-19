// app/(tabs)/search.js
// CHANGED: fully switched to the new cardsearch query (limit/offset + items[])
//          and aligned the client-side normalization to your frontend example.

import { gql, useLazyQuery, useMutation } from "@apollo/client"; // CHANGED: import gql to define query here
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AddToCollectionDocument,
  AddToWishlistDocument,
} from "@sixbyfive/tcg-binder/client";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";

import EmptyState from "../../components/common/EmptyState";
import CardTile from "../../components/search/CardTile";
import SearchForm from "../../components/search/SearchForm";
import SearchHeader from "../../components/search/SearchHeader";
import { PER_PAGE } from "../../constants/pagination";
import useToast from "../../hooks/useToast";
import { COLORS } from "../../theme/colors";
import {
  buildMyCollectionRefetchQueries,
  upsertMyCollectionEntry,
} from "../../utils/apolloCollectionCache";

/* ------------------------------------------------------------------ */
/* GraphQL (NEW): cardsearch module query — mirrors your web example.  */
/* ------------------------------------------------------------------ */
const CARDSEARCH_QUERY = gql`
  query CardsearchCollectionSearch($input: CardSearchInput!) {
    searchCards: cardsearchSearchCards(input: $input) {
      total
      limit
      offset
      items {
        cardId
        id
        setCode
        number
        name
        rarity
        images { small large }
        set { code name }
        variants { variant displayName }
        latestPrices {
          variant
          market
          mid
          low
          high
          currency
          updatedAt
          provider
        }
      }
    }
  }
`;

// CHANGED: page sizing to match your example semantics
const CARDSEARCH_PAGE_SIZE = 48;
const CARDSEARCH_EXACT_LIMIT = 12;

// GBP symbol for formatting
const GBP_SYMBOL = "\u00A3";

/* ---------------- Helpers (ported/adapted from your web example) ---------------- */

// CHANGED: canonical variant names
function canonicalVariantKey(raw) {
  const value = String(raw ?? "normal").trim().toLowerCase();
  if (!value) return "normal";
  if (
    value === "reverse" ||
    value === "reverse holo" ||
    value === "reverse-holo" ||
    value === "reverseholo" ||
    value === "reverseholofoil"
  )
    return "reverseHolofoil";
  if (value === "holo" || value === "holofoil" || value === "holo foil")
    return "holofoil";
  if (
    value === "firstedition" ||
    value === "first edition" ||
    value === "1stedition" ||
    value === "1st edition"
  )
    return "firstEdition";
  return value;
}

function firstNumber(...values) {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function hasPrice(entry) {
  if (!entry) return false;
  return [entry.market, entry.tcgplayer, entry.cardmarket, entry.gbp, entry.mid, entry.low, entry.high]
    .some((val) => typeof val === "number" && Number.isFinite(val));
}

// Choose a useful price row for tiles
function getBestPrice(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const pref = ["normal", "holofoil", "holo", "reverseHolofoil", "reverse"];
  for (const key of pref) {
    const hit = prices.find((p) => (p?.variation ?? p?.variant) === key && hasPrice(p));
    if (hit) return hit;
  }
  return prices.find((p) => hasPrice(p)) || null;
}

function computeAveragePrice(entry) {
  if (!entry || !hasPrice(entry)) return null;
  if (typeof entry.market === "number" && Number.isFinite(entry.market)) return entry.market;

  const primary = [];
  if (typeof entry.tcgplayer === "number" && Number.isFinite(entry.tcgplayer)) primary.push(entry.tcgplayer);
  if (typeof entry.cardmarket === "number" && Number.isFinite(entry.cardmarket)) primary.push(entry.cardmarket);

  if (primary.length === 2) return (primary[0] + primary[1]) / 2;
  if (primary.length === 1) return primary[0];

  const fallback = firstNumber(entry.gbp, entry.mid, entry.low, entry.high);
  if (fallback != null) return fallback;
  return primary.length ? primary[0] : null;
}

function formatGBP(value) {
  if (value == null || Number.isNaN(value)) return `${GBP_SYMBOL}--`;
  return `${GBP_SYMBOL}${Number(value).toFixed(2)}`;
}

// Normalize a single price
function normalizePriceEntry(price) {
  if (!price || typeof price !== "object") return null;
  const variation = canonicalVariantKey(price.variation ?? price.variant ?? "normal");
  const providerRaw = price.provider ?? price.source ?? null;
  const providerKey = providerRaw ? String(providerRaw).toLowerCase() : "";
  const currency = String(price.currency ?? price.curr ?? "GBP").toUpperCase();

  const market = firstNumber(price.market, price.mid, price.price, price.value);
  const mid = firstNumber(price.mid);
  const low = firstNumber(price.low);
  const high = firstNumber(price.high);
  const updatedAt = price.updatedAt || price.updated_at || null;

  const entry = {
    variation,
    provider: providerRaw || null,
    currency,
    market,
    mid,
    low,
    high,
    updatedAt,
  };

  if (currency === "GBP" && market != null) entry.gbp = market;
  if (currency === "USD" && market != null) entry.usd = market;
  if (currency === "EUR" && market != null) entry.eur = market;

  // heuristic mapping if provider implies a specific source
  const tcgValue = firstNumber(price.tcgplayer, providerKey.includes("tcg") ? market : null);
  if (tcgValue != null) entry.tcgplayer = tcgValue;

  const cmktValue = firstNumber(price.cardmarket, providerKey.includes("cardmarket") ? market : null);
  if (cmktValue != null) entry.cardmarket = cmktValue;

  if (entry.market == null) {
    entry.market = firstNumber(entry.tcgplayer, entry.cardmarket, entry.mid, entry.low, entry.high);
  }

  if (price.sampleSize != null) entry.sampleSize = price.sampleSize;

  return entry;
}

function normalizePriceList(list) {
  if (!Array.isArray(list)) return [];
  const byVariant = new Map();

  for (const price of list) {
    const entry = normalizePriceEntry(price);
    if (!entry) continue;
    const key = entry.variation || "normal";
    const existing = byVariant.get(key);

    if (!existing) {
      byVariant.set(key, { ...entry });
      continue;
    }
    // Merge heuristics
    if (entry.tcgplayer != null) existing.tcgplayer = entry.tcgplayer;
    if (entry.cardmarket != null) existing.cardmarket = entry.cardmarket;
    if (entry.market != null && existing.market == null) existing.market = entry.market;
    if (entry.mid != null && existing.mid == null) existing.mid = entry.mid;
    if (entry.low != null && existing.low == null) existing.low = entry.low;
    if (entry.high != null && existing.high == null) existing.high = entry.high;
    if (entry.gbp != null && existing.gbp == null) existing.gbp = entry.gbp;
    if (entry.usd != null && existing.usd == null) existing.usd = entry.usd;
    if (entry.eur != null && existing.eur == null) existing.eur = entry.eur;

    const existingUpdated = existing.updatedAt ? Date.parse(existing.updatedAt) : null;
    const entryUpdated = entry.updatedAt ? Date.parse(entry.updatedAt) : null;
    if (entryUpdated != null && (existingUpdated == null || entryUpdated > existingUpdated)) {
      existing.updatedAt = entry.updatedAt;
    }
  }

  return Array.from(byVariant.values());
}

function collectVariantList(item) {
  const variants = new Set();
  const push = (v) => {
    const key = canonicalVariantKey(v);
    if (key) variants.add(key);
  };

  if (Array.isArray(item?.variants)) {
    for (const v of item.variants) {
      if (typeof v === "string") push(v);
      else if (v && typeof v === "object") push(v.variant || v.displayName);
    }
  }
  if (Array.isArray(item?.variations)) {
    for (const v of item.variations) {
      if (typeof v === "string") push(v);
      else if (v && typeof v === "object") push(v.variant || v.displayName || v.variation);
    }
  }
  const source = Array.isArray(item?.latestPrices)
    ? item.latestPrices
    : Array.isArray(item?.prices)
    ? item.prices
    : [];
  for (const p of source) {
    if (typeof p === "string") push(p);
    else push(p?.variant || p?.variation);
  }
  const out = Array.from(variants).filter(Boolean);
  return out.length ? out : ["normal"];
}

function resolveCardIdentifier(card) {
  const normalize = (value) => {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str) return null;
    if (/^card-\d+$/i.test(str)) return null;
    if (/^local-\w+/i.test(str)) return null;
    return str;
  };

  const looksLikeCode = (value) => {
    if (!value) return false;
    const upper = value.toUpperCase();
    if (upper.startsWith("CARD-")) return false;
    return upper.includes("-") || upper.includes("/") || /\d/.test(upper);
  };

  const candidates = [
    normalize(card?.cardId),
    normalize(card?.id),
    normalize(card?.code),
    normalize(card?.card?.id),
    normalize(card?.cardCode),
    normalize(card?.card?.code),
    normalize(
      card?.setCode && card?.number ? `${card.setCode}-${card.number}` : null
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (looksLikeCode(candidate)) {
      return candidate;
    }
  }

  return candidates[0] ?? null;
}

function resolveVariation(card) {
  if (!card) return "normal";
  if (Array.isArray(card?.variations) && card.variations.length > 0) {
    for (const entry of card.variations) {
      if (!entry) continue;
      if (typeof entry === "string") return canonicalVariantKey(entry);
      if (typeof entry === "object") {
        return canonicalVariantKey(entry.variant || entry.variation || entry.displayName);
      }
    }
  }
  if (card?.variation) return canonicalVariantKey(card.variation);
  return "normal";
}

// Normalize one item from cardsearch into the shape your mobile UI expects
function normalizeCardsearchItem(item, index = 0) {
  if (!item) return null;

  const setRecord = item.set || {};
  const setCode = item.setCode || setRecord.code || "";
  const number = item.number || "";
  const setName = setRecord.name || item.setName || setCode || "";
  const image = item.images?.large || item.images?.small || item.image || null;
  const variations = collectVariantList(item);
  const prices = normalizePriceList(item.latestPrices ?? item.prices ?? []);

  const preferredId =
    item.cardId || item.id || (setCode && number ? `${setCode}-${number}` : null);
  const id = preferredId || `card-${index}`;

  return {
    id,
    cardId: preferredId || id,
    name: item.name || "",
    set: setCode || "",
    setCode: setCode || "",
    setName,
    number: number || "",
    image,
    tcgImageUrl: image,
    rarity: item.rarity || null,
    variations,
    prices,
  };
}

function mapCardsearchItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  return items.map((item, i) => normalizeCardsearchItem(item, i)).filter(Boolean);
}

// CHANGED: pocket filter kept (local-only opt-out)
function isPocketCard(card) {
  const name = (card?.setName || "").toLowerCase();
  const code = (card?.set || "").toLowerCase();
  return name.includes("pocket") || code.startsWith("pocket") || code.startsWith("pkp");
}
function filterOutPocket(cards, exclude = true) {
  if (!exclude) return cards;
  return cards.filter((c) => !isPocketCard(c));
}

/* ---------------- Component ---------------- */

export default function SearchTab() {
  const router = useRouter();
  const toast = useToast();

  // form state
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  // paging (CHANGED: offset/limit instead of cursor/after)
  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(PER_PAGE); // will be overwritten by API
  const [totalCount, setTotalCount] = useState(0);

  const [runSearch, { data, loading, error, fetchMore, called }] = useLazyQuery(
    CARDSEARCH_QUERY, // CHANGED: new document
    {
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
      returnPartialData: false,
    }
  );

  // CHANGED: exact search limit behavior like your web example
  const isExactCardSearch = useMemo(
    () => Boolean((setCode ?? "").trim() && (number ?? "").trim()),
    [setCode, number]
  );

  const canSearch = useMemo(
    () =>
      (name ?? "").trim().length > 0 ||
      (setCode ?? "").trim().length > 0 ||
      (number ?? "").trim().length > 0,
    [name, setCode, number]
  );

  // CHANGED: initial search using limit/offset + mapping to mobile shape
  const onSearch = useCallback(() => {
    if (!canSearch) return;

    // reset local paging
    setResults([]);
    setOffset(0);
    setHasMore(false);
    setTotalCount(0);

    const limit = isExactCardSearch
      ? Math.min(CARDSEARCH_PAGE_SIZE, CARDSEARCH_EXACT_LIMIT)
      : CARDSEARCH_PAGE_SIZE;

    runSearch({
      variables: {
        input: {
          name: name || undefined,
          set: (setCode || undefined),
          number: number || undefined,
          limit,
          offset: 0,
        },
      },
      onCompleted: (res) => {
        const payload = res?.searchCards;
        const items = mapCardsearchItems(payload?.items || []);
        const filtered = filterOutPocket(items, !/pocket/i.test(setCode || ""));

        const total = Number(payload?.total ?? filtered.length);
        const lim = Number(payload?.limit ?? limit);
        const off = Number(payload?.offset ?? 0);

        setResults(filtered);
        setTotalCount(total);
        setPageSize(lim);
        const nextOffset = Math.min(off + (payload?.items?.length || filtered.length), total);
        setOffset(nextOffset);
        setHasMore(nextOffset < total);
      },
    });
  }, [canSearch, isExactCardSearch, name, setCode, number, runSearch]);

  // CHANGED: loadMore via limit/offset
  const loadingMoreRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMoreRef.current || !called) return;
    loadingMoreRef.current = true;

    try {
      const res = await fetchMore({
        variables: {
          input: {
            name: name || undefined,
            set: (setCode || undefined),
            number: number || undefined,
            limit: pageSize,
            offset,
          },
        },
        updateQuery: (prev, { fetchMoreResult }) => fetchMoreResult || prev,
      });

      const payload = res?.data?.searchCards;
      const newItems = mapCardsearchItems(payload?.items || []);
      const filteredNew = filterOutPocket(newItems, !/pocket/i.test(setCode || ""));

      // dedupe by id
      const byId = new Map();
      for (const c of [...results, ...filteredNew]) {
        if (c?.id != null) byId.set(String(c.id), c);
      }
      const merged = Array.from(byId.values());

      const total = Number(payload?.total ?? totalCount);
      const lim = Number(payload?.limit ?? pageSize);
      const off = Number(payload?.offset ?? offset);
      const nextOffset = Math.min(off + (payload?.items?.length || filteredNew.length), total);
      setResults(merged);
      setTotalCount(total);
      setPageSize(lim);
      setOffset(nextOffset);
      setHasMore(nextOffset < total);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [hasMore, loading, called, fetchMore, name, setCode, number, pageSize, offset, results, totalCount]);

  // --- Mutations ---
  const { data: meData } = useMeQuery({ fetchPolicy: "cache-first" });
  const userId = meData?.me?.id ?? null;

  const [addToWishlist] = useMutation(AddToWishlistDocument);
  const [addToCollection] = useMutation(AddToCollectionDocument, {
    update: (cache, { data }) => {
      upsertMyCollectionEntry(cache, data?.addToCollection);
    },
    refetchQueries: () => buildMyCollectionRefetchQueries(userId),
    awaitRefetchQueries: false,
  });

  const onAddToWishlist = async (card) => {
    const cardId = resolveCardIdentifier(card);
    if (!cardId) {
      toast.show("Missing card id", { type: "error" });
      return;
    }
    const variation = resolveVariation(card);
    try {
      await addToWishlist({
        variables: {
          cardId,
          variation,
        },
      });
      toast.show("Added to wishlist", { type: "success" });
    } catch (e) {
      console.warn("addToWishlist failed:", { error: e, card, cardId, variation });
      const message = e?.graphQLErrors?.[0]?.message || e?.message || "Couldn't add to wishlist";
      toast.show(message, { type: "error" });
    }
  };

  const onAddToCollection = async (card) => {
    const cardId = resolveCardIdentifier(card);
    if (!cardId) {
      toast.show("Missing card id", { type: "error" });
      return;
    }
    const variation = resolveVariation(card);
    try {
      await addToCollection({
        variables: {
          cardId,
          variation,
          quantity: 1,
        },
      });
      toast.show("Added to collection", { type: "success" });
    } catch (e) {
      console.warn("addToCollection failed:", { error: e, card, cardId, variation });
      const message = e?.graphQLErrors?.[0]?.message || e?.message || "Couldn't add to collection";
      toast.show(message, { type: "error" });
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
          renderItem={({ item, index }) => {
            // CHANGED: compute price summary identical to your web logic
            const best = getBestPrice(item?.prices || []);
            const avg = computeAveragePrice(best);

            return (
              <CardTile
                item={{
                  ...item,
                  // Provide precomputed helpers to downstream if desired
                  averagePrice: avg,
                  bestPrice: best,
                  averagePriceFormatted: formatGBP(avg),
                }}
                onAddToWishlist={onAddToWishlist}
                onAddToCollection={onAddToCollection}
                onPress={() =>
                  router.push({
                    pathname: `/card/${item.id}`,
                    params: {
                      id: String(item.id),
                      name: item.name ?? "",
                      number: String(item.number ?? ""),
                      setName: item.setName ?? "",
                      image: item.image ?? "",
                      prices: JSON.stringify(item?.prices || []),
                      pricing: JSON.stringify(item?.prices || []),
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
                <Text style={styles.footerLoadingText}>
                  Loading more…
                </Text>
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
