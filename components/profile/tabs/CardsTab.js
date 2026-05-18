// components/profile/CardsTab.js
// PURPOSE: Compact "Cards" grid inside a profile page.
//
// UPDATED (2026-01-21):
// - CHANGE: Uses CompactSearchFiltersBar (shared component) instead of inline filter UI.
// - CHANGE: Filters are now bottom-sheet based (search inline, filters/sort in modal).
// - CHANGE: Variation filter is now multi-select (because CompactSearchFiltersBar is multi-select).
// - CHANGE: Removed ActivityIndicator entirely (no spinner in this tab).
// - KEEP: Display-only price hydration still runs silently.
// - KEEP: 2-column FlatList, scroll disabled, image fallbacks, set label logic via util, throttled dev logs.
// - NOTE: The CompactSearchFiltersBar has its own marginHorizontal; we wrap with no extra padding.

/* eslint-disable react/no-unstable-nested-components */

import { gql, useApolloClient, useQuery } from "@apollo/client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { COLORS } from "../../../theme/colors";
import inferSetEra from "../../../utils/setEra.native";
import {
  parseCardId,
  resolveSetNameForCardlike,
} from "../../../utils/setNames";

// ✅ NEW: shared compact filter bar (bottom sheet)
import CompactSearchFiltersBar from "../../collection/CompactSearchFiltersBar";

/* ---------------- GraphQL (minimal, schema-safe) ---------------- */

const USER_COLLECTION_MIN = gql`
  query UserCollectionMin($userId: ID!) {
    collection(userId: $userId) {
      id
      cardId
      quantity
      variation
      card {
        id
        name
        number
        setCode
        images {
          small
          large
        }
        set {
          code
          name
        }
      }
    }
  }
`;

const MY_COLLECTION_MIN = gql`
  query MyCollectionMin {
    myCollection {
      id
      cardId
      quantity
      variation
      card {
        id
        name
        number
        setCode
        images {
          small
          large
        }
        set {
          code
          name
        }
      }
    }
  }
`;

/* ---------------- [PRICES] schema-first queries (same as Collection/Wishlist) ---------------- */

const Q_CARD_cardsearchCardById = gql`
  query CardById_cardsearch($id: ID!, $variant: String) {
    cardsearchCardById(cardId: $id, variant: $variant) {
      id
      cardId
      latestPrices(variant: $variant) {
        provider
        currency
        gbp
        low
        mid
        high
        market
        variation
        updatedAt
      }
    }
  }
`;

const Q_ROOT_cardsearchPriceLatest = gql`
  query PriceLatest_cardsearch($id: ID!, $variant: String) {
    cardsearchPriceLatest(cardId: $id, variant: $variant) {
      provider
      currency
      low
      mid
      high
      market
      updatedAt
      variant
    }
  }
`;

// ALWAYS 2 COLUMNS
const GRID = 2;

/* ---------------- helpers (normalizers) ---------------- */
function get(obj, path) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}
function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.edges))
    return input.edges.map((e) => e?.node ?? e).filter(Boolean);
  if (Array.isArray(input.nodes)) return input.nodes.filter(Boolean);
  if (Array.isArray(input.items)) return input.items.filter(Boolean);
  if (Array.isArray(input.results)) return input.results.filter(Boolean);
  if (Array.isArray(input.entries)) return input.entries.filter(Boolean);
  for (const k of Object.keys(input || {})) {
    const v = input[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      if (Array.isArray(v.edges))
        return v.edges.map((e) => e?.node ?? e).filter(Boolean);
      if (Array.isArray(v.nodes)) return v.nodes.filter(Boolean);
    }
  }
  return [];
}
function unwrapCardish(item) {
  const n = item?.node ?? item;
  return n?.card ?? n;
}

/* ---------------- image helpers + FallbackImage ---------------- */

function forceHttps(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/^http:\/\//i, "https://");
}
function isAbs(url) {
  return /^https?:\/\//i.test(url || "");
}
function tcgdexFromParts(setCode, number, era = null, quality = "high") {
  if (!setCode || !number) return null;
  const inferredEra = era || inferSetEra({ code: setCode }) || "";
  const eraSlug = String(inferredEra || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const numPadded = String(number).replace(/^0+/, "").padStart(3, "0");
  if (!eraSlug) return null;
  return `https://assets.tcgdex.net/en/${eraSlug}/${setCode}/${numPadded}/${quality}.webp`;
}
function pokemontcgFromParts(setCode, number, hires = true) {
  if (!setCode || !number) return null;
  const n = String(number).replace(/^0+/, "");
  const suffix = hires ? "_hires" : "";
  return `https://images.pokemontcg.io/${setCode}/${n}${suffix}.png`;
}

function buildImageCandidates(card) {
  const out = [];
  const directImage = card?.images?.small ?? card?.images?.large ?? card?.image ?? null;
  if (directImage && isAbs(directImage)) out.push(forceHttps(directImage));

  const id = card?.id ?? card?.cardId ?? null;
  const { setCode, number } = parseCardId(id);
  if (setCode && number) {
    const era = inferSetEra({ code: setCode });
    const dexHigh = tcgdexFromParts(setCode, number, era, "high");
    const dexLow = tcgdexFromParts(setCode, number, era, "low");
    if (dexHigh) out.push(dexHigh);
    if (dexLow) out.push(dexLow);

    const pokeHires = pokemontcgFromParts(setCode, number, true);
    const pokeStd = pokemontcgFromParts(setCode, number, false);
    if (pokeHires) out.push(pokeHires);
    if (pokeStd) out.push(pokeStd);
  }

  const seen = new Set();
  return out.filter((u) => {
    const k = String(u || "");
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function FallbackImage({ sources, style }) {
  const [idx, setIdx] = useState(0);
  const list = Array.isArray(sources) ? sources : [];
  const uri = list[idx] || null;

  if (!uri) return <View style={[style, { backgroundColor: COLORS.alt }]} />;

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      onError={() => setIdx((i) => (i + 1 < list.length ? i + 1 : i))}
    />
  );
}

/* ---------------- [PRICES] helpers ---------------- */

function mapAppVariantToBackend(v) {
  const raw = String(v || "")
    .toLowerCase()
    .trim();
  if (!raw || raw === "normal" || raw === "base") return null;
  if (raw === "holo" || raw === "foil") return "holofoil";
  if (raw === "reverse" || raw === "rev") return "reverse_holo";
  if (raw === "reverse_holofoil") return "reverse_holo";
  return raw;
}

function normalizePrice(p) {
  if (!p || typeof p !== "object") return p;
  const source = p.source ?? p.provider ?? null;
  const variant = p.variant ?? p.variation ?? null;
  const lastUpdated = p.lastUpdated ?? p.updatedAt ?? null;
  return { ...p, source, variant, lastUpdated };
}
function normalizePricesArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizePrice);
}
function preferVariant(pricesArray, variation) {
  if (!Array.isArray(pricesArray) || !pricesArray.length) return [];
  const want = mapAppVariantToBackend(variation) ?? "normal";
  const alias = new Set([want]);
  if (want === "holofoil") alias.add("holo");
  if (want === "reverse_holo") {
    alias.add("reverse");
    alias.add("reverse_holofoil");
  }
  const exact = pricesArray.filter((p) =>
    alias.has(String(p?.variant ?? p?.variation ?? "").toLowerCase()),
  );
  if (exact.length) return exact;
  return [pricesArray[0]];
}

/* ---------------- normalization ---------------- */

function normalizeCard(item, pricesMap) {
  const raw = unwrapCardish(item);
  const id =
    raw?.id ??
    raw?.cardId ??
    item?.cardId ??
    item?.id ??
    (typeof raw?.uuid === "string" ? raw.uuid : undefined);
  if (!id) return null;

  const entryVariation =
    typeof item?.variation === "string"
      ? item.variation
      : typeof raw?.variation === "string"
        ? raw.variation
        : "normal";

  const entryQty =
    typeof item?.quantity === "number" && Number.isFinite(item.quantity)
      ? Math.max(1, Math.round(item.quantity))
      : 1;

  const { setCode, number } = parseCardId(id);
  const era = setCode ? inferSetEra({ code: setCode }) : null;

  // price attach (display only)
  const hydratedPrices = pricesMap?.get?.(String(id));
  const prices = Array.isArray(hydratedPrices) ? hydratedPrices : [];
  const pricing = prices;
  const priceLatest = prices[0] || null;

  return {
    id: String(id),
    setCode: setCode || undefined,
    era: era || undefined,
    name: raw?.name ?? raw?.cardName ?? "Card",
    image:
      get(raw, "images.small") ??
      get(raw, "images.large") ??
      raw?.image ??
      raw?.imageUrl ??
      "",
    setName: resolveSetNameForCardlike(raw),
    number: raw?.number ?? raw?.collectorNumber ?? number ?? undefined,
    prices,
    pricing,
    priceLatest,
    _collection: {
      quantity: entryQty,
      variation: entryVariation,
      cardId: String(id),
    },
  };
}

function normalizeCardsInput(cardsProp, pricesMap) {
  if (!cardsProp) return [];
  if (!Array.isArray(cardsProp) && typeof cardsProp === "object") {
    const candidates = [
      "cards",
      "cardsPreview",
      "preview",
      "collection",
      "myCollection",
      "results",
      "items",
      "entries",
      "edges",
      "nodes",
      "data",
    ];
    for (const k of candidates) {
      if (cardsProp[k])
        return toArray(cardsProp[k])
          .map((x) => normalizeCard(x, pricesMap))
          .filter(Boolean);
    }
    return toArray(cardsProp)
      .map((x) => normalizeCard(x, pricesMap))
      .filter(Boolean);
  }
  return toArray(cardsProp)
    .map((x) => normalizeCard(x, pricesMap))
    .filter(Boolean);
}

/* ---------------- display-only filters ---------------- */

function matchesQuery(card, q) {
  const query = String(q || "")
    .trim()
    .toLowerCase();
  if (!query) return true;

  const hay = [
    card?.name,
    card?.setName,
    card?.number,
    card?.id,
    card?._collection?.variation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(query);
}

function applyCardFilters(cards, { query, variations }) {
  const selected = Array.isArray(variations) ? variations : [];
  const hasVarFilter = selected.length > 0;

  return (cards || []).filter((c) => {
    if (!matchesQuery(c, query)) return false;
    if (!hasVarFilter) return true;

    // normalize card variation to backend-ish keys to match chip keys
    const rawVar = String(c?._collection?.variation ?? "normal")
      .toLowerCase()
      .trim();
    const v = mapAppVariantToBackend(rawVar) ?? rawVar;

    return selected.includes(v);
  });
}

function sortCards(cards, sortKey) {
  const key = String(sortKey || "name").toLowerCase();
  const list = [...(cards || [])];

  if (key === "set") {
    list.sort((a, b) =>
      String(a?.setName || "").localeCompare(String(b?.setName || "")),
    );
    return list;
  }
  if (key === "qty") {
    list.sort(
      (a, b) =>
        (Number(b?._collection?.quantity || 0) || 0) -
        (Number(a?._collection?.quantity || 0) || 0),
    );
    return list;
  }
  if (key === "price") {
    list.sort((a, b) => {
      const ap =
        Number(
          a?.priceLatest?.gbp ??
            a?.priceLatest?.mid ??
            a?.priceLatest?.market ??
            0,
        ) || 0;
      const bp =
        Number(
          b?.priceLatest?.gbp ??
            b?.priceLatest?.mid ??
            b?.priceLatest?.market ??
            0,
        ) || 0;
      return bp - ap;
    });
    return list;
  }

  list.sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || "")),
  );
  return list;
}

/* ---------------- Component ---------------- */

export default function CardsTab({
  title = "Cards",
  cards = [],
  userId,
  onOpenCard,
  onViewAll,
  pageSize = 24,
  loading = false,
  // defaults (display-only)
  defaultVariationFilter = "all", // kept for backwards-compat but we convert it to initial array below
  defaultSort = "name",
}) {
  const apollo = useApolloClient();

  // [PRICES] display-only cache for this tab
  const [pricesById, setPricesById] = useState(() => new Map());
  const priceHydratingRef = useRef(false);
  const hydratedPriceIdsRef = useRef(new Set());

  // ✅ CompactSearchFiltersBar state
  const [query, setQuery] = useState("");

  // ✅ UPDATED: multi-select variations array
  const initialVariations = useMemo(() => {
    const v = String(defaultVariationFilter || "all")
      .toLowerCase()
      .trim();
    if (!v || v === "all") return [];
    // allow old single values to carry forward
    return [mapAppVariantToBackend(v) ?? v];
  }, [defaultVariationFilter]);

  const [variationFilters, setVariationFilters] = useState(initialVariations);
  const [sortKey, setSortKey] = useState(defaultSort);

  const normalizedFromProp = useMemo(
    () => normalizeCardsInput(cards, pricesById),
    [cards, pricesById],
  );

  const shouldFetchProfile = normalizedFromProp.length === 0 && !!userId;
  const {
    data: collectionData,
    loading: fetchingProfile,
    error: collectionError,
  } = useQuery(USER_COLLECTION_MIN, {
    variables: { userId },
    skip: !shouldFetchProfile,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const shouldFetchMine = normalizedFromProp.length === 0 && !userId;
  const {
    data: myData,
    loading: fetchingMine,
    error: myError,
  } = useQuery(MY_COLLECTION_MIN, {
    skip: !shouldFetchMine,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const normalizedFromFetch = useMemo(() => {
    if (collectionData?.collection) {
      return toArray(collectionData.collection)
        .map((x) => normalizeCard(x, pricesById))
        .filter(Boolean);
    }
    if (myData?.myCollection) {
      return toArray(myData.myCollection)
        .map((x) => normalizeCard(x, pricesById))
        .filter(Boolean);
    }
    return toArray(collectionData || myData)
      .map((x) => normalizeCard(x, pricesById))
      .filter(Boolean);
  }, [collectionData, myData, pricesById]);

  const baseCards = normalizedFromProp.length
    ? normalizedFromProp
    : normalizedFromFetch;

  /* ---------------- [PRICES] hydrate ---------------- */

  const tryFetchPrices = useCallback(
    async (id, variation) => {
      const mapped = mapAppVariantToBackend(variation);

      const variantCandidates = [
        null,
        mapped,
        "holo",
        "holofoil",
        "reverse",
        "reverse_holo",
        "reverse_holofoil",
      ].filter((v, idx, arr) => arr.indexOf(v) === idx);

      const runSchemaFirst = async (variantValue) => {
        const vars =
          variantValue == null
            ? { id: String(id) }
            : { id: String(id), variant: String(variantValue) };

        // A) cardsearchCardById
        try {
          const { data } = await apollo.query({
            query: Q_CARD_cardsearchCardById,
            variables: vars,
            fetchPolicy: "network-only",
            errorPolicy: "all",
          });

          const card = data?.cardsearchCardById;
          const lp = Array.isArray(card?.latestPrices) ? card.latestPrices : [];
          if (lp.length) {
            const normalized = normalizePricesArray(lp);
            const picked =
              variantValue == null
                ? normalized
                : preferVariant(normalized, variantValue);
            if (picked.length) return picked;
          }
        } catch (err) {}

        // B) cardsearchPriceLatest
        try {
          const { data } = await apollo.query({
            query: Q_ROOT_cardsearchPriceLatest,
            variables: vars,
            fetchPolicy: "network-only",
            errorPolicy: "all",
          });

          const rows = Array.isArray(data?.cardsearchPriceLatest)
            ? data.cardsearchPriceLatest
            : [];
          if (rows.length) {
            const normalized = normalizePricesArray(rows);
            const picked =
              variantValue == null
                ? normalized
                : preferVariant(normalized, variantValue);
            if (picked.length) return picked;
          }
        } catch (err) {}

        return [];
      };

      let result = await runSchemaFirst(null);
      if (result.length) return result;

      for (const v of variantCandidates.slice(1)) {
        result = await runSchemaFirst(v);
        if (result.length) return result;
      }

      return [];
    },
    [apollo],
  );

  const hydratePrices = useCallback(
    async (targets) => {
      if (priceHydratingRef.current) return;
      const list = (targets || []).filter((t) => t && t.id);
      if (!list.length) return;

      priceHydratingRef.current = true;
      try {
        for (const { id, variation } of list) {
          const key = String(id);
          if (hydratedPriceIdsRef.current.has(key)) continue;
          hydratedPriceIdsRef.current.add(key);

          const picked = await tryFetchPrices(key, variation);
          if (picked.length) {
            setPricesById((prev) => {
              const next = new Map(prev);
              next.set(key, picked);
              return next;
            });
          }
        }
      } finally {
        priceHydratingRef.current = false;
      }
    },
    [tryFetchPrices],
  );

  /* ---------------- filters (apply BEFORE pageSize slice) ---------------- */

  const filteredSortedCards = useMemo(() => {
    const filtered = applyCardFilters(baseCards, {
      query,
      variations: variationFilters,
    });
    return sortCards(filtered, sortKey);
  }, [baseCards, query, variationFilters, sortKey]);

  const displayCards = useMemo(
    () => filteredSortedCards.slice(0, pageSize),
    [filteredSortedCards, pageSize],
  );

  useEffect(() => {
    if (!displayCards.length) return;

    const pending = [];
    for (const c of displayCards) {
      const id = String(c?.id || "");
      if (!id) continue;
      if (pricesById.has(id)) continue;

      const variation =
        typeof c?._collection?.variation === "string"
          ? c._collection.variation
          : "normal";

      pending.push({ id, variation });
    }

    if (pending.length) hydratePrices(pending);
  }, [displayCards, pricesById, hydratePrices]);

  const showSkeleton =
    (loading || fetchingProfile || fetchingMine) &&
    normalizedFromProp.length === 0;

  /* ----- DEV LOG: throttled to avoid spam ----- */
  const lastSigRef = useRef("");
  const via = normalizedFromProp.length
    ? "prop"
    : shouldFetchProfile
      ? "UserCollectionMin"
      : "MyCollectionMin";
  const debugSig = `${via}:${normalizedFromProp.length}:${normalizedFromFetch.length}:${displayCards.length}:${query}:${variationFilters.join(
    ",",
  )}:${sortKey}`;
  useEffect(() => {
    if (!__DEV__) return;
    if (lastSigRef.current === debugSig) return;
    lastSigRef.current = debugSig;
    // eslint-disable-next-line no-console
    console.log("[CardsTab] source:", {
      propCount: normalizedFromProp.length,
      fetchedCount: normalizedFromFetch.length,
      filteredCount: filteredSortedCards.length,
      used: displayCards.length,
      via,
      filters: { query, variationFilters, sortKey },
      errors: {
        collectionError: collectionError?.message,
        myError: myError?.message,
      },
    });
  }, [
    debugSig,
    via,
    normalizedFromProp.length,
    normalizedFromFetch.length,
    filteredSortedCards.length,
    displayCards.length,
    query,
    variationFilters,
    sortKey,
    collectionError?.message,
    myError?.message,
  ]);

  const skeleton = Array.from({ length: GRID * 3 }, (_, i) => ({
    id: `sk-${i}`,
  }));

  /* ---------------- CompactSearchFiltersBar config ---------------- */

  // ✅ Count active filters for the badge (variation selections only here)
  const activeFilterCount =
    (variationFilters?.length || 0) > 0 ? variationFilters.length : 0;

  const sortOptions = useMemo(
    () => [
      { key: "name", label: "Name" },
      { key: "set", label: "Set" },
      { key: "qty", label: "Qty" },
      { key: "price", label: "Price" },
    ],
    [],
  );

  const filterGroups = useMemo(
    () => [
      {
        key: "variation",
        title: "Variation",
        options: [
          { key: "normal", label: "Normal" },
          { key: "holofoil", label: "Holo" },
          { key: "reverse_holo", label: "Reverse" },
        ],
        value: variationFilters,
        onChange: (nextArr) =>
          setVariationFilters(Array.isArray(nextArr) ? nextArr : []),
      },
    ],
    [variationFilters],
  );

  const clearAll = useCallback(() => {
    setQuery("");
    setVariationFilters([]);
    setSortKey(defaultSort || "name");
  }, [defaultSort]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        {typeof onViewAll === "function" && (
          <Pressable onPress={onViewAll} hitSlop={6}>
            <Text style={styles.viewAll}>View all →</Text>
          </Pressable>
        )}
      </View>

      {/* ✅ Shared compact filters bar (no ActivityIndicator) */}
      <CompactSearchFiltersBar
        query={query}
        onChangeQuery={setQuery}
        activeFilterCount={activeFilterCount}
        sortKey={sortKey}
        sortOptions={sortOptions}
        onChangeSort={setSortKey}
        filterGroups={filterGroups}
        onClearAll={clearAll}
      />

      {collectionError || myError ? (
        <Text style={[styles.bodyText, { marginTop: 10 }]}>
          Failed to load cards.
        </Text>
      ) : showSkeleton ? (
        <FlatList
          data={skeleton}
          keyExtractor={(it) => it.id}
          numColumns={GRID}
          contentContainerStyle={styles.gridList}
          columnWrapperStyle={styles.gridRow}
          renderItem={() => (
            <View style={styles.gridItem}>
              <View style={[styles.gridThumb, { opacity: 0.5 }]} />
              <View
                style={{
                  height: 14,
                  marginTop: 6,
                  borderRadius: 3,
                  backgroundColor: COLORS.alt,
                }}
              />
            </View>
          )}
          scrollEnabled={false}
          removeClippedSubviews
          initialNumToRender={6}
        />
      ) : displayCards.length ? (
        <FlatList
          data={displayCards}
          keyExtractor={(item) => String(item.id)}
          numColumns={GRID}
          contentContainerStyle={styles.gridList}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item: c }) => {
            const candidates = buildImageCandidates(c);
            const primaryImage = candidates[0] || c.image || null;
            const setName = resolveSetNameForCardlike(c);

            const prices = Array.isArray(c?.prices) ? c.prices : [];
            const pricing = Array.isArray(c?.pricing) ? c.pricing : prices;
            const priceLatest = c?.priceLatest ?? pricing?.[0] ?? null;

            return (
              <Pressable
                onPress={() =>
                  onOpenCard?.({
                    ...c,
                    setName,
                    image: primaryImage,
                    imageCandidates: candidates,
                    prices,
                    pricing,
                    priceLatest,
                    pricesJSON: JSON.stringify(prices || []),
                  })
                }
                style={styles.gridItem}
                android_ripple={{ color: "#00000022" }}
              >
                <FallbackImage sources={candidates} style={styles.gridThumb} />

                <Text style={styles.gridCaption} numberOfLines={1}>
                  {c.name || "Card"}
                </Text>

                <Text style={styles.gridSubCaption} numberOfLines={1}>
                  {setName || ""}
                </Text>
              </Pressable>
            );
          }}
          ListFooterComponent={<View style={{ height: 8 }} />}
          scrollEnabled={false}
          removeClippedSubviews
          initialNumToRender={8}
        />
      ) : (
        <Text style={[styles.bodyText, { marginTop: 10 }]}>
          {query || (variationFilters?.length || 0) > 0
            ? "No matches for your filters."
            : "No cards to show."}
        </Text>
      )}
    </View>
  );
}

const GAP = 10;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginTop: 12,
  },
  headerRow: {
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardTitle: { color: COLORS.text, fontWeight: "900" },
  viewAll: { color: COLORS.accent, fontWeight: "800" },
  bodyText: {
    color: COLORS.text,
    paddingHorizontal: 12,
  },

  gridList: { paddingBottom: 8, paddingHorizontal: 12 },
  gridRow: { justifyContent: "space-between", marginBottom: GAP },
  gridItem: { width: "48%" },
  gridThumb: {
    width: "100%",
    aspectRatio: 63 / 88,
    backgroundColor: COLORS.alt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gridCaption: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 6,
    fontWeight: "800",
  },
  gridSubCaption: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});
