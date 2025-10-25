// app/(tabs)/search.js
// FIX: Mutations use errorPolicy:"all" and treat data+errors as success.
//      Hydration retry kept; no error toast if the mutation actually succeeded.

import { useApolloClient, useLazyQuery, useMutation } from "@apollo/client";
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
  CardByIdDocument,
  SearchCardsDocument,
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

const CARDSEARCH_PAGE_SIZE = 48;
const CARDSEARCH_EXACT_LIMIT = 12;
const GBP_SYMBOL = "\u00A3";

/* ---------------- Helpers ---------------- */

function extractErrorMessage(error) {
  if (!error) return "";
  const graphQlMessage =
    (Array.isArray(error.graphQLErrors) &&
      error.graphQLErrors.map((err) => err?.message).find(Boolean)) ||
    null;
  if (graphQlMessage) return graphQlMessage;
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "";
}
function isForeignKeyConstraintError(error) {
  const message = extractErrorMessage(error);
  return typeof message === "string" && /foreign key/i.test(message);
}

function canonicalVariantKey(raw) {
  const value = String(raw ?? "normal").trim().toLowerCase();
  if (!value) return "normal";
  if (["reverse","reverse holo","reverse-holo","reverseholo","reverseholofoil"].includes(value)) return "reverseHolofoil";
  if (["holo","holofoil","holo foil"].includes(value)) return "holofoil";
  if (["firstedition","first edition","1stedition","1st edition"].includes(value)) return "firstEdition";
  return value;
}
function firstNumber(...values) {
  for (const v of values) if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
function hasPrice(entry) {
  if (!entry) return false;
  return [entry.market, entry.tcgplayer, entry.cardmarket, entry.gbp, entry.mid, entry.low, entry.high]
    .some((val) => typeof val === "number" && Number.isFinite(val));
}
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
  const push = (v) => { const key = canonicalVariantKey(v); if (key) variants.add(key); };

  if (Array.isArray(item?.variants)) for (const v of item.variants) typeof v === "string" ? push(v) : push(v?.variant || v?.displayName);
  if (Array.isArray(item?.variations)) for (const v of item.variations) typeof v === "string" ? push(v) : push(v?.variant || v?.displayName || v?.variation);

  const source = Array.isArray(item?.latestPrices) ? item.latestPrices : Array.isArray(item?.prices) ? item.prices : [];
  for (const p of source) typeof p === "string" ? push(p) : push(p?.variant || p?.variation);

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
    normalize(card?.setCode && card?.number ? `${card.setCode}-${card.number}` : null),
  ].filter(Boolean);
  for (const candidate of candidates) if (looksLikeCode(candidate)) return candidate;
  return candidates[0] ?? null;
}
function resolveVariation(card) {
  if (!card) return "normal";
  if (Array.isArray(card?.variations) && card.variations.length > 0) {
    for (const entry of card.variations) {
      if (!entry) continue;
      if (typeof entry === "string") return canonicalVariantKey(entry);
      if (typeof entry === "object") return canonicalVariantKey(entry.variant || entry.variation || entry.displayName);
    }
  }
  if (card?.variation) return canonicalVariantKey(card.variation);
  return "normal";
}

function normalizeCardsearchItem(item, index = 0) {
  if (!item) return null;
  const setRecord = item.set || {};
  const setCode = item.setCode || setRecord.code || "";
  const number = item.number || "";
  const setName = setRecord.name || item.setName || setCode || "";
  const image = item.images?.large || item.images?.small || item.image || null;
  const variations = collectVariantList(item);
  const prices = normalizePriceList(item.latestPrices ?? item.prices ?? []);
  const preferredId = item.cardId || item.id || (setCode && number ? `${setCode}-${number}` : null);
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
  const apollo = useApolloClient();

  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(PER_PAGE);
  const [totalCount, setTotalCount] = useState(0);

  const [runSearch, { data, loading, error, fetchMore, called }] = useLazyQuery(SearchCardsDocument, {
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    returnPartialData: false,
  });

  const isExactCardSearch = useMemo(
    () => Boolean((setCode ?? "").trim() && (number ?? "").trim()),
    [setCode, number]
  );
  const canSearch = useMemo(
    () => (name ?? "").trim().length > 0 || (setCode ?? "").trim().length > 0 || (number ?? "").trim().length > 0,
    [name, setCode, number]
  );

  const onSearch = useCallback(() => {
    if (!canSearch) return;

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

      const byId = new Map();
      for (const c of [...results, ...filteredNew]) if (c?.id != null) byId.set(String(c.id), c);
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

  // --- Mutations (with errorPolicy: "all") ---
  const { data: meData } = useMeQuery({ fetchPolicy: "cache-first" });
  const userId = meData?.me?.id ?? null;

  const hydrateCardById = useCallback(
    async (cardId, variation = "normal") => {
      if (!cardId) return false;
      try {
        const { data: cardData } = await apollo.query({
          query: CardByIdDocument,
          variables: { id: cardId, variant: variation || undefined },
          fetchPolicy: "network-only",
        });
        const cardRecord = cardData?.card ?? cardData?.cardById ?? cardData?.Card ?? null;
        return Boolean(cardRecord?.id);
      } catch {
        return false;
      }
    },
    [apollo]
  );

  // Treat "data + errors" as success when the data field indicates success.
  const wishlistSuccess = (result) => {
    const d = result?.data || {};
    // Support various server shapes: boolean, object, toggle, etc.
    return Boolean(
      d.addToWishlist === true ||
      d.toggleWishlist === true ||
      d.addToWishlist?.id ||
      d.addToWishlist?.cardId ||
      d.wishlistEntry?.id
    );
  };

  const collectionSuccess = (result) => {
    const d = result?.data || {};
    const entry =
      d.addToCollection ||
      d.updateCollectionEntry ||
      d.collectionEntry ||
      null;
    return Boolean(entry && (entry.id || entry.cardId));
  };

  const [addToWishlist] = useMutation(AddToWishlistDocument, {
    errorPolicy: "all",
  });

  const [addToCollection] = useMutation(AddToCollectionDocument, {
    errorPolicy: "all",
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
    const variables = { cardId, variation };

    // First attempt (won't throw on data+errors)
    let res = await addToWishlist({ variables });
    if (wishlistSuccess(res)) {
      toast.show("Added to wishlist", { type: "success" });
      return;
    }

    // If it's an FK / hydration issue, hydrate then retry
    const err = res?.errors?.[0];
    if (isForeignKeyConstraintError(err)) {
      const hydrated = await hydrateCardById(cardId, variation);
      if (hydrated) {
        res = await addToWishlist({ variables });
        if (wishlistSuccess(res)) {
          toast.show("Added to wishlist", { type: "success" });
          return;
        }
      }
    }

    // Otherwise show the server's message
    const message = extractErrorMessage(err) || "Couldn't add to wishlist";
    toast.show(message, { type: "error" });
  };

  const onAddToCollection = async (card) => {
    const cardId = resolveCardIdentifier(card);
    if (!cardId) {
      toast.show("Missing card id", { type: "error" });
      return;
    }
    const variation = resolveVariation(card);
    const variables = { cardId, variation, quantity: 1 };

    // First attempt
    let res = await addToCollection({ variables });
    if (collectionSuccess(res)) {
      toast.show("Added to collection", { type: "success" });
      return;
    }

    // FK / hydration path
    const err = res?.errors?.[0];
    if (isForeignKeyConstraintError(err)) {
      const hydrated = await hydrateCardById(cardId, variation);
      if (hydrated) {
        res = await addToCollection({ variables });
        if (collectionSuccess(res)) {
          toast.show("Added to collection", { type: "success" });
          return;
        }
      }
    }

    const message = extractErrorMessage(err) || "Couldn't add to collection";
    toast.show(message, { type: "error" });
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
          renderItem={({ item }) => {
            const best = getBestPrice(item?.prices || []);
            const avg = computeAveragePrice(best);
            return (
              <CardTile
                item={{
                  ...item,
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
