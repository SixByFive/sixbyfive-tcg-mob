// components/profile/tabs/WishlistTab.js
// PURPOSE: Wishlist grid inside a profile with robust fetching, hydration, image fallbacks,
//          AND display-only filters + price hydration like Collection tab.
//
// UPDATED (2026-01-21):
// - CHANGE: CompactSearchFiltersBar is rendered directly UNDER the title (inside same header card).
// - CHANGE: Wishlist display is now a 2-column grid (FlatList numColumns=2), like CardsTab.
// - CHANGE: Removed WishlistGrid usage (it was rendering large single tiles).
// - KEEP: Card hydration + schema-first price hydration.
// - KEEP: resolveSetNameForCardlike + image fallbacks + https normalization.
//
// UPDATED (2026-01-21 - STATUS UI MATCH):
// - FIX: Status pill now matches components/collection/WishlistCardTile.js exactly (bookmark icon + tone + label + style).

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { COLORS } from "../../../theme/colors";

import { gql, useApolloClient, useLazyQuery, useQuery } from "@apollo/client";
import { CardByIdDocument } from "../../../graphql/documents";
import { resolveSetNameForCardlike } from "../../../utils/setNames";

// CHANGED: use shared compact filters bar
import CompactSearchFiltersBar from "../../collection/CompactSearchFiltersBar";

// ADDED: match WishlistCardTile status pill (bookmark icon)
import { Ionicons } from "@expo/vector-icons";

/* -------------------- INLINE GraphQL (schema-safe) -------------------- */

const MY_WISHLIST_MIN = gql`
  query MyWishlist_Min($page: Int, $pageSize: Int) {
    myWishlist(page: $page, pageSize: $pageSize) {
      total
      entries {
        id
        cardId
        variation
        status
        quantity
        updatedAt
        card {
          id
          name
          number
          setCode
          images { small large }
          set { code name }
          __typename
        }
        __typename
      }
    }
  }
`;

const WISHLIST_MIN = gql`
  query Wishlist_Min($userId: ID!, $page: Int, $pageSize: Int) {
    wishlist(userId: $userId, page: $page, pageSize: $pageSize) {
      total
      entries {
        id
        cardId
        variation
        status
        quantity
        updatedAt
        card {
          id
          name
          number
          setCode
          images { small large }
          set { code name }
          __typename
        }
        __typename
      }
    }
  }
`;

/* -------------------- [PRICES] schema-first queries -------------------- */

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

// CHANGED: match CardsTab layout
const GRID = 2;
const GAP = 10;

/* -------------------- helpers -------------------- */

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

function unwrapEntry(item) {
  const n = item?.node ?? item;
  return { entry: n, card: n?.card ?? null };
}

/* -------------------- image fallbacks -------------------- */

function forceHttps(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/^http:\/\//i, "https://");
}
function isAbs(url) {
  return /^https?:\/\//i.test(url || "");
}
function normalizeSetCode(code) {
  if (!code) return "";
  return String(code).trim().toLowerCase().replace(/\s+/g, "");
}
function inferEraFromSetCode(code) {
  const c = normalizeSetCode(code);
  if (!c) return null;
  const m = c.match(/^[a-z]+/);
  return m ? m[0] : null;
}
function parseCardIdLocal(id) {
  if (typeof id !== "string") return { setCode: null, number: null };
  const parts = id.split("-");
  if (parts.length < 2) return { setCode: null, number: null };
  const setCode = parts[0]?.trim() || null;
  const numberRaw = parts.slice(1).join("-").trim();
  const number = numberRaw || null;
  return { setCode, number };
}
function tcgdexFromParts(setCode, number, era = null, quality = "high") {
  if (!setCode || !number) return null;
  const eraSlug = (era || inferEraFromSetCode(setCode) || "")
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
function buildImageCandidates(cardish) {
  const out = [];
  const raw = cardish?.image;
  if (raw && isAbs(raw)) out.push(forceHttps(raw));

  const parsed = parseCardIdLocal(cardish?.id || cardish?.cardId || "");
  if (parsed.setCode && parsed.number) {
    const era = inferEraFromSetCode(parsed.setCode);
    const dHigh = tcgdexFromParts(parsed.setCode, parsed.number, era, "high");
    const dLow = tcgdexFromParts(parsed.setCode, parsed.number, era, "low");
    if (dHigh) out.push(dHigh);
    if (dLow) out.push(dLow);

    const pHires = pokemontcgFromParts(parsed.setCode, parsed.number, true);
    const pStd = pokemontcgFromParts(parsed.setCode, parsed.number, false);
    if (pHires) out.push(pHires);
    if (pStd) out.push(pStd);
  }

  const seen = new Set();
  const list = out.filter((u) => {
    const k = String(u || "");
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const tcgdexFirst =
    list.find((u) => u.includes("assets.tcgdex.net")) || list[0] || "";
  return [tcgdexFirst, ...list.filter((u) => u !== tcgdexFirst)];
}

// CHANGED: add FallbackImage for grid tiles (same pattern as CardsTab)
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

/* -------------------- [PRICES] helpers -------------------- */

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

/* -------------------- normalizers -------------------- */

function normalizeWishlistItem(item, hydratedCardMap, pricesMap) {
  const { entry, card: inlineCard } = unwrapEntry(item);

  const cid = inlineCard?.id ?? entry?.cardId ?? entry?.id ?? item?.id;
  if (!cid) return null;

  const key = String(cid);
  const hydrated = hydratedCardMap?.get?.(key);
  const card = inlineCard || hydrated || {};

  const setName = resolveSetNameForCardlike({
    id: key,
    setName: card?.setName,
    set: card?.set,
  });

  const direct =
    card?.image ??
    card?.imageUrl ??
    get(card, "images.small") ??
    get(card, "images.large") ??
    "";

  const candidates = buildImageCandidates({ id: key, image: direct });
  const image = candidates[0] || direct || "";

  const hydratedPrices = pricesMap?.get?.(key);
  const prices = Array.isArray(hydratedPrices) ? hydratedPrices : [];
  const pricing = prices;
  const priceLatest = prices[0] || null;

  const variation =
    typeof entry?.variation === "string" ? entry.variation : "normal";
  const name = card?.name ?? entry?.name ?? "Card";
  const number = card?.number ?? card?.collectorNumber ?? undefined;

  return {
    id: key,
    name,
    image,
    setName,
    number,
    prices,
    pricing,
    priceLatest,
    _wishlist: {
      entryId: entry?.id ? String(entry.id) : null,
      cardId: String(entry?.cardId ?? key),
      variation,
      status: entry?.status ?? null,
      quantity:
        typeof entry?.quantity === "number" && Number.isFinite(entry.quantity)
          ? Math.max(1, Math.round(entry.quantity))
          : 1,
      updatedAt: entry?.updatedAt ?? null,
    },
  };
}

function normalizeItemsInput(itemsProp, hydratedMap, pricesMap) {
  if (!itemsProp) return [];
  if (!Array.isArray(itemsProp) && typeof itemsProp === "object") {
    const candidates = [
      "items",
      "entries",
      "results",
      "edges",
      "nodes",
      "data",
    ];
    for (const k of candidates) {
      if (itemsProp[k])
        return toArray(itemsProp[k])
          .map((x) => normalizeWishlistItem(x, hydratedMap, pricesMap))
          .filter(Boolean);
    }
    return toArray(itemsProp)
      .map((x) => normalizeWishlistItem(x, hydratedMap, pricesMap))
      .filter(Boolean);
  }
  return toArray(itemsProp)
    .map((x) => normalizeWishlistItem(x, hydratedMap, pricesMap))
    .filter(Boolean);
}

/* -------------------- display-only filters -------------------- */

function matchesQuery(item, q) {
  const query = String(q || "")
    .trim()
    .toLowerCase();
  if (!query) return true;

  const hay = [
    item?.name,
    item?.setName,
    item?.number,
    item?.id,
    item?._wishlist?.variation,
    item?._wishlist?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(query);
}

// variationArr is multi-select. empty => All
function applyWishlistFilters(items, { query, variationArr }) {
  const selected = Array.isArray(variationArr) ? variationArr : [];
  const selectedNorm = selected
    .map((v) =>
      String(v || "")
        .toLowerCase()
        .trim(),
    )
    .filter(Boolean);

  return (items || []).filter((it) => {
    if (!matchesQuery(it, query)) return false;
    if (!selectedNorm.length) return true;

    const v = String(it?._wishlist?.variation ?? "normal").toLowerCase();
    return selectedNorm.includes(v);
  });
}

function sortWishlistItems(items, sortKey) {
  const key = String(sortKey || "recent").toLowerCase();
  const safe = [...(items || [])];

  if (key === "name") {
    safe.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || "")),
    );
    return safe;
  }
  if (key === "set") {
    safe.sort((a, b) =>
      String(a?.setName || "").localeCompare(String(b?.setName || "")),
    );
    return safe;
  }
  if (key === "price") {
    safe.sort((a, b) => {
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
    return safe;
  }

  safe.sort((a, b) => {
    const at = Date.parse(a?._wishlist?.updatedAt || "") || 0;
    const bt = Date.parse(b?._wishlist?.updatedAt || "") || 0;
    return bt - at;
  });
  return safe;
}

/* -------------------- STATUS HELPERS (MATCH WishlistCardTile) -------------------- */
// ADDED: exact same label mapping
function prettyStatus(s) {
  switch (String(s || "").toUpperCase()) {
    case "ACTIVE":
      return "Hunting";
    case "GRAIL":
      return "Dream";
    case "EVENTUAL":
      return "Someday";
    case "UPGRADE":
      return "Upgrade";
    default:
      return "";
  }
}

// ADDED: exact same tones
function statusTone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "GRAIL")
    return { bg: COLORS.alt, border: COLORS.accent, text: COLORS.text };
  if (s === "ACTIVE")
    return { bg: COLORS.background, border: COLORS.border, text: COLORS.text };
  if (s === "EVENTUAL")
    return {
      bg: COLORS.background,
      border: COLORS.border,
      text: COLORS.textMuted,
    };
  if (s === "UPGRADE")
    return { bg: COLORS.background, border: COLORS.border, text: COLORS.text };
  return {
    bg: COLORS.background,
    border: COLORS.border,
    text: COLORS.textMuted,
  };
}

/* -------------------- Component -------------------- */

export default function WishlistTab({
  title = "Wishlist",
  items = [],
  userId,
  username,
  onOpenCard,
  onViewAll,
  pageSize = 24,
  loading = false,
  defaultSort = "recent",
}) {
  const apollo = useApolloClient();

  const [hydratedMap, setHydratedMap] = useState(() => new Map());
  const hydratedIdsRef = useRef(new Set());
  const inflightRef = useRef(false);

  const [wishlistPricesById, setWishlistPricesById] = useState(() => new Map());
  const wishPriceHydratingRef = useRef(false);
  const hydratedWishlistPriceIdsRef = useRef(new Set());

  // CompactSearchFiltersBar state
  const [query, setQuery] = useState("");
  const [variationArr, setVariationArr] = useState([]); // empty => All
  const [sortKey, setSortKey] = useState(defaultSort);

  const normalizedFromProp = useMemo(
    () => normalizeItemsInput(items, hydratedMap, wishlistPricesById),
    [items, hydratedMap, wishlistPricesById],
  );

  const shouldFetchProfile = normalizedFromProp.length === 0 && !!userId;
  const {
    data: wlData,
    loading: fetchingProfile,
    error: wlError,
  } = useQuery(WISHLIST_MIN, {
    variables: { userId, page: 1, pageSize },
    skip: !shouldFetchProfile,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  useEffect(() => {
    if (wlError && __DEV__)
      console.warn("[WishlistTab] wishlist error", wlError?.message || wlError);
  }, [wlError]);

  const shouldFetchMine = normalizedFromProp.length === 0 && !userId;
  const {
    data: myWlData,
    loading: fetchingMine,
    error: myWlError,
  } = useQuery(MY_WISHLIST_MIN, {
    variables: { page: 1, pageSize },
    skip: !shouldFetchMine,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  useEffect(() => {
    if (myWlError && __DEV__)
      console.warn("[WishlistTab] myWishlist error", myWlError?.message || myWlError);
  }, [myWlError]);

  const normalizedFromFetch = useMemo(() => {
    const root =
      wlData?.wishlist ?? myWlData?.myWishlist ?? wlData ?? myWlData ?? {};
    const entries = root?.entries ? root.entries : root;
    return toArray(entries)
      .map((x) => normalizeWishlistItem(x, hydratedMap, wishlistPricesById))
      .filter(Boolean);
  }, [wlData, myWlData, hydratedMap, wishlistPricesById]);

  const baseItems = useMemo(() => {
    return normalizedFromProp.length ? normalizedFromProp : normalizedFromFetch;
  }, [normalizedFromProp, normalizedFromFetch]);

  /* -------------------- card hydration (missing inline card) -------------------- */

  const idsNeedingHydration = useMemo(() => {
    const ids = [];
    const seen = new Set();

    const src = normalizedFromProp.length
      ? toArray(items)
      : toArray(
          (wlData?.wishlist ?? myWlData?.myWishlist ?? {})?.entries ??
            wlData?.wishlist ??
            myWlData?.myWishlist ??
            {},
        );

    for (const it of src) {
      const n = it?.node ?? it;
      const hasCard = !!n?.card;
      const cid = n?.card?.id ?? n?.cardId ?? n?.id;
      if (!cid) continue;

      const key = String(cid);
      if (!hasCard && !hydratedIdsRef.current.has(key) && !seen.has(key)) {
        ids.push(key);
        seen.add(key);
      }
    }

    return ids;
  }, [items, normalizedFromProp.length, wlData, myWlData]);

  const [fetchCardById] = useLazyQuery(CardByIdDocument, {
    fetchPolicy: "cache-first",
  });

  useEffect(() => {
    if (!idsNeedingHydration.length || inflightRef.current) return;

    inflightRef.current = true;
    (async () => {
      try {
        for (const id of idsNeedingHydration) {
          if (hydratedIdsRef.current.has(id)) continue;

          try {
            const { data } = await fetchCardById({ variables: { id } });
            const card = data?.card ?? data?.cardById ?? data?.Card ?? null;

            hydratedIdsRef.current.add(id);

            if (card?.id) {
              const candidates = buildImageCandidates({
                id: String(card.id),
                image: card?.image,
              });
              const image = candidates[0] || card?.image || "";

              const setName = resolveSetNameForCardlike({
                id: String(card.id),
                setName: card?.setName,
                set: card?.set,
              });

              setHydratedMap((prev) => {
                const next = new Map(prev);
                next.set(String(card.id), { ...card, image, setName });
                return next;
              });
            }
          } catch {}
        }
      } finally {
        inflightRef.current = false;
      }
    })();
  }, [idsNeedingHydration, fetchCardById]);

  /* -------------------- [PRICES] fetch + hydrate -------------------- */

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
        } catch {}

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
        } catch {}

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

  const hydrateWishlistPrices = useCallback(
    async (targets) => {
      if (wishPriceHydratingRef.current) return;
      const list = (targets || []).filter((t) => t && t.id);
      if (!list.length) return;

      wishPriceHydratingRef.current = true;
      try {
        for (const { id, variation } of list) {
          const key = String(id);
          if (hydratedWishlistPriceIdsRef.current.has(key)) continue;
          hydratedWishlistPriceIdsRef.current.add(key);

          const picked = await tryFetchPrices(key, variation);
          if (picked.length) {
            setWishlistPricesById((prev) => {
              const next = new Map(prev);
              next.set(key, picked);
              return next;
            });
          }
        }
      } finally {
        wishPriceHydratingRef.current = false;
      }
    },
    [tryFetchPrices],
  );

  /* -------------------- apply filters + sort -------------------- */

  const filteredSortedItems = useMemo(() => {
    const filtered = applyWishlistFilters(baseItems, { query, variationArr });
    return sortWishlistItems(filtered, sortKey);
  }, [baseItems, query, variationArr, sortKey]);

  // IMPORTANT: slice AFTER filters
  const displayItems = useMemo(
    () => filteredSortedItems.slice(0, pageSize),
    [filteredSortedItems, pageSize],
  );

  // Price hydration for visible items only
  useEffect(() => {
    if (!displayItems.length) return;

    const pending = [];
    for (const it of displayItems) {
      const id = String(it?.id || "");
      if (!id) continue;
      if (wishlistPricesById.has(id)) continue;

      const variation =
        typeof it?._wishlist?.variation === "string"
          ? it._wishlist.variation
          : "normal";

      pending.push({ id, variation });
    }

    if (pending.length) hydrateWishlistPrices(pending);
  }, [displayItems, wishlistPricesById, hydrateWishlistPrices]);

  const showSkeleton =
    (loading || fetchingProfile || fetchingMine) &&
    normalizedFromProp.length === 0;
  const hasError = wlError || myWlError;

  const activeFilterCount =
    (Array.isArray(variationArr) ? variationArr.length : 0) || 0;

  const showHydrateSpinner =
    idsNeedingHydration.length > 0 || wishPriceHydratingRef.current;

  /* -------------------- render -------------------- */

  if (showSkeleton) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <View
          style={{
            height: 120,
            borderRadius: 10,
            backgroundColor: COLORS.alt,
            opacity: 0.5,
          }}
        />
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <Text style={styles.bodyText}>Failed to load wishlist.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Title row */}
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {username ? (
            <Pressable
              hitSlop={8}
              onPress={() =>
                Share.share({
                  title: `${username}'s wishlist · SixByFive TCG`,
                  message: `Check out what ${username} is hunting for!\nhttps://sixbyfive.co.uk/profile/${encodeURIComponent(username)}`,
                })
              }
            >
              <Text style={styles.shareBtn}>Share ↗</Text>
            </Pressable>
          ) : null}
          {typeof onViewAll === "function" ? (
            <Pressable onPress={onViewAll} hitSlop={8}>
              <Text style={styles.viewAll}>View all →</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Bar directly under title */}
      <View style={{ marginHorizontal: -12, marginTop: 6 }}>
        <CompactSearchFiltersBar
          query={query}
          onChangeQuery={setQuery}
          activeFilterCount={activeFilterCount}
          sortKey={sortKey}
          sortOptions={[
            { key: "recent", label: "Recent" },
            { key: "name", label: "Name" },
            { key: "set", label: "Set" },
            { key: "price", label: "Price" },
          ]}
          onChangeSort={setSortKey}
          filterGroups={[
            {
              key: "variation",
              title: "Variation",
              options: [
                { key: "normal", label: "Normal" },
                { key: "holofoil", label: "Holo" },
                { key: "reverse_holo", label: "Reverse" },
              ],
              value: variationArr,
              onChange: setVariationArr,
            },
          ]}
          onClearAll={() => {
            setQuery("");
            setVariationArr([]);
            setSortKey(defaultSort);
          }}
        />
      </View>

      {/* Optional hydration spinner (kept for wishlist) */}
      {showHydrateSpinner ? (
        <View style={{ paddingTop: 8, alignItems: "center" }}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : null}

      {/* 2-column grid */}
      {displayItems.length ? (
        <FlatList
          data={displayItems}
          keyExtractor={(it) => String(it.id)}
          numColumns={GRID}
          contentContainerStyle={styles.gridList}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const candidates = buildImageCandidates({
              id: item.id,
              image: item.image,
            });
            const primaryImage = candidates[0] || item.image || "";

            const prices = Array.isArray(item?.prices) ? item.prices : [];
            const pricing = Array.isArray(item?.pricing)
              ? item.pricing
              : prices;
            const priceLatest = item?.priceLatest ?? pricing?.[0] ?? null;

            // CHANGED: status pill matches WishlistCardTile.js
            const rawStatus = String(
              item?._wishlist?.status ?? "",
            ).toUpperCase();
            const label = prettyStatus(rawStatus);
            const tone = statusTone(rawStatus);

            return (
              <Pressable
                onPress={() =>
                  onOpenCard?.({
                    ...item,
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
                <View style={styles.thumbWrap}>
                  <FallbackImage
                    sources={candidates}
                    style={styles.gridThumb}
                  />

                  {/* Status pill (top-left) - EXACT look/feel */}
                  {label ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.statusPill,
                        { backgroundColor: tone.bg, borderColor: tone.border },
                      ]}
                    >
                      <Ionicons
                        name="bookmark"
                        size={12}
                        color={tone.text}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.statusText, { color: tone.text }]}>
                        {label}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.gridCaption} numberOfLines={1}>
                  {item.name || "Card"}
                </Text>

                <Text style={styles.gridSubCaption} numberOfLines={1}>
                  {item.setName || ""}
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
          {query || activeFilterCount > 0
            ? "No matches for your filters."
            : "No wishlist items yet."}
        </Text>
      )}
    </View>
  );
}

/* -------------------- styles -------------------- */

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { color: COLORS.text, fontWeight: "900" },
  viewAll: { color: COLORS.accent, fontWeight: "800" },
  shareBtn: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },
  bodyText: { color: COLORS.text },

  // 2-column grid (matches CardsTab proportions)
  gridList: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: GAP,
  },
  gridItem: {
    width: "48%",
  },

  // wrapper for overlay positioning
  thumbWrap: {
    position: "relative",
  },

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

  // ADDED: Status pill styles copied from WishlistCardTile.js
  statusPill: {
    position: "absolute",
    left: 8,
    top: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  statusText: { fontWeight: "900", fontSize: 11 },
});
