// app/(tabs)/collection.js
//
// UPDATED (2026-01-20):
// - NEW: CompactSearchFiltersBar added to BOTH Collection + Wishlist tabs
//   - Takes minimal space when closed (single 40px row)
//   - Opens filters in a bottom-sheet modal
// - NEW: Collection filters
//   - Search (name / set / number)
//   - Variation chips (Normal / Holo / Reverse)
//   - Rarity chips (dynamic from your collection data)
//   - Sort (Recent (default order) / Name / Set)
// - NEW: Wishlist filters
//   - Search (name / set / number)
//   - Status chips (Hunting/Dream/Someday/Upgrade)
//   - Variation chips
//   - Sort (Recent updated / Name / Set / Price)
// - CHANGE: Binder search query is now separate from Collection/Wishlist search state
//   (TopControls query continues to power binder filtering only)

import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
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
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import BinderGrid from "../../components/collection/BinderGrid";
import CollectionCardTile from "../../components/collection/CollectionCardTile";
import EditCollectionModal from "../../components/collection/EditCollectionModal";
import RemoveQuantityModal from "../../components/collection/RemoveQuantityModal";
import TopControls from "../../components/collection/TopControls";
import WishlistCardTile from "../../components/collection/WishlistCardTile";
import WishlistPlaceholder from "../../components/collection/WishlistPlaceholder";
import PageHeader from "../../components/common/PageHeader";
import useToast from "../../hooks/useToast";
import { COLORS } from "../../theme/colors";
import { filterBinders } from "../../utils/collectionFilters";

// NEW: ultra-compact bar for search + filters
import CompactSearchFiltersBar from "../../components/collection/CompactSearchFiltersBar";

import {
  CardByIdDocument,
  MyBindersDocument,
  UpdateCollectionEntryDocument,
} from "@sixbyfive/tcg-binder/client";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";

import { useCollectionWishlistActions } from "../../hooks/useCollectionWishlistActions";
import { resolveSetNameForCardlike } from "../../utils/setNames";

let MY_BINDERS_QUERY = MyBindersDocument;
try {
  const maybeSafe = require("../../graphql/binders-temp");
  if (maybeSafe?.MY_BINDERS_SAFE) MY_BINDERS_QUERY = maybeSafe.MY_BINDERS_SAFE;
} catch (err) {
  if (__DEV__)
    console.warn(
      "[CollectionTab] Safe myBinders query unavailable",
      err?.message ?? err,
    );
}

/* ---------------- [CACHE] Apollo cache policies ---------------- */
function ensureApolloPolicies(apollo) {
  try {
    apollo?.cache?.policies?.addTypePolicies?.({
      CardsearchSet: { keyFields: ["code"] },
      CardsearchCard: {
        fields: {
          set: {
            merge(existing, incoming) {
              return incoming ?? existing ?? null;
            },
          },
        },
      },
    });
  } catch (e) {}
}

/* ---------------- GraphQL (schema-safe core) ---------------- */
const MY_COLLECTION_APP = gql`
  query MyCollectionApp {
    myCollection {
      id
      cardId
      quantity
      variation
      condition
      wishlist
      card {
        id
        name
        number
        image
        rarity
        setName
        set {
          code
          name
        }
      }
    }
  }
`;

const MY_WISHLIST = gql`
  query MyWishlist {
    myWishlist {
      total
      entries {
        id
        cardId
        variation
        quantity
        notes
        status
        updatedAt
        card {
          id
          name
          number
          image
          setName
          set {
            code
            name
          }
        }
      }
    }
  }
`;

/* ------------------------------------------------------------------ */
/*  FIXED: UPDATE_WISHLIST_ENTRY                                       */
/* ------------------------------------------------------------------ */
const UPDATE_WISHLIST_ENTRY = gql`
  mutation UpdateWishlistEntry(
    $cardId: String!
    $variation: String
    $quantity: Int
    $notes: String
    $status: WishlistStatus
  ) {
    updateWishlistEntry(
      cardId: $cardId
      variation: $variation
      quantity: $quantity
      notes: $notes
      status: $status
    ) {
      id
      cardId
      variation
      quantity
      notes
      status
      updatedAt
    }
  }
`;

/* ---------------- [PRICES] Primary schema queries ---------------- */
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

/* ---------------- Legacy fallbacks (unchanged) ---------------- */
const Q_CARD_card = gql`
  query CardById_card($id: ID!) {
    card(id: $id) {
      id
      priceLatest {
        source
        market
        currency
        low
        mid
        high
        lastUpdated
        variant
      }
      prices {
        source
        market
        currency
        low
        mid
        high
        lastUpdated
        variant
      }
      pricing {
        source
        market
        currency
        low
        mid
        high
        lastUpdated
        variant
      }
    }
  }
`;

const Q_CARD_cardById = gql`
  query CardById_cardById($id: ID!) {
    cardById(id: $id) {
      id
      priceLatest {
        source
        market
        currency
        low
        mid
        high
        lastUpdated
        variant
      }
      prices {
        source
        market
        currency
        low
        mid
        high
        lastUpdated
        variant
      }
      pricing {
        source
        market
        currency
        low
        mid
        high
        lastUpdated
        variant
      }
    }
  }
`;

const Q_CARD_Cap = gql`
  query CardById_Cap($id: ID!) {
    Card(id: $id) {
      id
      priceLatest {
        source
        market
        currency
        low
        mid
        high
        lastUpdated
        variant
      }
      prices {
        source
        market
        currency
        low
        mid
        high
        lastUpdated
        variant
      }
      pricing {
        source
        market
        currency
        low
        mid
        high
        lastUpdated
        variant
      }
    }
  }
`;

const Q_ROOT_priceLatest = gql`
  query PriceLatestRoot($id: ID!, $variant: String) {
    priceLatest(cardId: $id, variant: $variant) {
      source
      market
      currency
      low
      mid
      high
      lastUpdated
      variant
    }
  }
`;

const Q_ROOT_prices = gql`
  query PricesRoot($id: ID!) {
    prices(cardId: $id) {
      source
      market
      currency
      low
      mid
      high
      lastUpdated
      variant
    }
  }
`;

/* ---------------- utils ---------------- */
const debugLog = (...args) => {
  if (__DEV__) console.log("[CollectionTab]", ...args);
};

function extractGraphQLError(err) {
  const net = err?.networkError;
  const gerrs = err?.graphQLErrors?.length
    ? err.graphQLErrors
    : net?.result?.errors?.length
      ? net.result.errors
      : [];
  const msg = [err?.message, ...gerrs.map((e) => e?.message).filter(Boolean)]
    .filter(Boolean)
    .join(" | ");
  return msg || err?.toString?.() || "Unknown GraphQL error";
}

/* id + image helpers (same as before) */
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
function parseCardId(id) {
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
  const parsed = parseCardId(
    cardish?.id || cardish?.cardId || cardish?._collection?.cardId || "",
  );
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

/* ---------------- [PRICES] helpers ---------------- */
function mapAppVariantToBackend(v) {
  const raw = String(v || "")
    .toLowerCase()
    .trim();
  if (!raw || raw === "normal" || raw === "base") return null; // omit
  if (raw === "holo" || raw === "foil") return "holofoil";
  if (raw === "reverse" || raw === "rev") return "reverse_holo";
  if (raw === "reverse_holofoil") return "reverse_holo";
  if (
    [
      "holofoil",
      "reverse_holo",
      "full_art",
      "alt_art",
      "illustration",
      "gold",
      "trainer_gallery",
    ].includes(raw)
  )
    return raw;
  return raw;
}

function normalizePrice(p) {
  if (!p || typeof p !== "object") return p;
  const source = p.source ?? p.provider ?? null;
  const variant = p.variant ?? p.variation ?? null;
  const lastUpdated = p.lastUpdated ?? p.updatedAt ?? null;
  const hasCamel = Object.prototype.hasOwnProperty.call(p, "tcgPlayer");
  const hasLower = Object.prototype.hasOwnProperty.call(p, "tcgplayer");
  return {
    ...p,
    source,
    variant,
    lastUpdated,
    tcgplayer: hasLower
      ? p.tcgplayer
      : hasCamel
        ? p.tcgPlayer
        : (p.tcgplayer ?? p.tcgPlayer ?? null),
  };
}

function normalizePricesArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizePrice);
}

function normalizeFromPriceLatest(priceLatest) {
  if (!priceLatest) return [];
  return Array.isArray(priceLatest)
    ? normalizePricesArray(priceLatest)
    : [normalizePrice(priceLatest)];
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

/* ---------------- wishlist helpers ---------------- */
function readWishlistRoot(data) {
  return data?.myWishlist ?? data?.wishlist ?? {};
}
function readWishlistList(root) {
  return Array.isArray(root?.entries) ? root.entries : [];
}
function readWishlistServerTotal(root) {
  const n = root.total ?? root.totalCount ?? root.count ?? 0;
  return Number(n) || 0;
}

/* ---------------- NEW: filtering helpers (collection + wishlist) ---------------- */

// CHANGED/NEW: normalize a variation into one of: "normal" | "holo" | "reverse"
function bucketVariation(v) {
  const s = String(v || "").toLowerCase();
  if (!s) return "normal";
  if (s.includes("reverse")) return "reverse";
  if (s.includes("holo") || s.includes("foil")) return "holo";
  return "normal";
}

// NEW: lightweight price extract (used for wishlist price sorting)
function getAnyNumericPrice(item) {
  const rows = []
    .concat(Array.isArray(item?.prices) ? item.prices : [])
    .concat(Array.isArray(item?.pricing) ? item.pricing : [])
    .concat(
      item?.priceLatest && !Array.isArray(item.priceLatest)
        ? [item.priceLatest]
        : [],
    );

  for (const p of rows) {
    if (!p || typeof p !== "object") continue;
    const gbp = Number.isFinite(p?.gbp) ? Number(p.gbp) : null;
    if (gbp != null) return gbp;
    const mid = Number.isFinite(p?.mid)
      ? Number(p.mid)
      : Number.isFinite(p?.market)
        ? Number(p.market)
        : null;
    if (mid != null) return mid;
  }
  return null;
}

function safeLower(s) {
  return String(s || "").toLowerCase();
}

/* ---------------- UI ---------------- */
function CreateBinderBanner({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#00000018" }}
      style={({ pressed }) => [
        styles.createBanner,
        pressed && { transform: [{ scale: 0.99 }], opacity: 0.96 },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.createBannerIcon}>
        <Text style={{ color: COLORS.text, fontWeight: "900" }}>＋</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.createBannerTitle}>Create a new binder</Text>
        <Text style={styles.createBannerSub}>Start organising your cards</Text>
      </View>
      <Text style={styles.createBannerChev}>{">"}</Text>
    </Pressable>
  );
}

export default function CollectionTab() {
  const router = useRouter();
  const toast = useToast();
  const apollo = useApolloClient();

  useEffect(() => {
    ensureApolloPolicies(apollo);
  }, [apollo]);

  // CHANGED: default tab is now "all"
  const [segment, setSegment] = useState("all");

  // CHANGED: binder query is now isolated (TopControls should primarily affect binders)
  const [binderQuery, setBinderQuery] = useState("");

  // NEW: collection search/filters (compact bar)
  const [collectionQuery, setCollectionQuery] = useState("");
  const [collectionSort, setCollectionSort] = useState("recent"); // recent|name|set
  const [collectionVariations, setCollectionVariations] = useState([]); // ["normal","holo","reverse"]
  const [collectionRarities, setCollectionRarities] = useState([]); // dynamic rarities

  // NEW: wishlist search/filters (compact bar)
  const [wishlistQuery, setWishlistQuery] = useState("");
  const [wishlistSort, setWishlistSort] = useState("recent"); // recent|name|set|price
  const [wishlistStatuses, setWishlistStatuses] = useState([]); // ["ACTIVE","GRAIL","EVENTUAL","UPGRADE"]
  const [wishlistVariations, setWishlistVariations] = useState([]); // ["normal","holo","reverse"]

  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [savingRemoval, setSavingRemoval] = useState(false);

  const [updateCollectionEntry] = useMutation(UpdateCollectionEntryDocument);
  const [updateWishlistEntryMutation] = useMutation(UPDATE_WISHLIST_ENTRY);

  const {
    moveWishlistToCollection,
    removeFromWishlist,
    removeFromCollection,
    addToCollection,
  } = useCollectionWishlistActions();

  const [cardsByIdMap, setCardsByIdMap] = useState(() => new Map());
  const [hydrating, setHydrating] = useState(false);
  const hydratedIdsRef = useRef(new Set());
  const inFlightRef = useRef(false);

  // [PRICES] price hydration state (collection)
  const [collectionPricesById, setCollectionPricesById] = useState(
    () => new Map(),
  );
  const collPriceHydratingRef = useRef(false);
  const hydratedPriceIdsRef = useRef(new Set());

  // [PRICES] wishlist price hydration state (separate cache)
  const [wishlistPricesById, setWishlistPricesById] = useState(() => new Map());
  const wishPriceHydratingRef = useRef(false);
  const hydratedWishlistPriceIdsRef = useRef(new Set());

  // keep a ref to wishlist meta so we can update UI instantly
  const wishlistMetaRef = useRef(new Map());

  const { data: meData } = useMeQuery({ fetchPolicy: "cache-first" });
  const userId = meData?.me?.id ?? null;

  /* -------- queries -------- */
  const {
    data: collData,
    loading: collLoading,
    error: collError,
    refetch: refetchCollection,
    networkStatus: collNS,
  } = useQuery(MY_COLLECTION_APP, {
    skip: !userId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    onError: (err) => {
      if (__DEV__) {
        console.warn("[CollectionTab] myCollection GraphQL error", {
          message: extractGraphQLError(err),
          statusCode: err?.networkError?.statusCode || 400,
        });
      }
    },
  });

  const {
    data: bindersData,
    loading: bindersLoading,
    error: bindersError,
    refetch: refetchBinders,
    networkStatus: bindersNS,
  } = useQuery(MY_BINDERS_QUERY, {
    skip: !userId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    onError: (err) => {
      if (__DEV__) {
        console.warn("[CollectionTab] myBinders GraphQL error", {
          message: extractGraphQLError(err),
          statusCode: err?.networkError?.statusCode,
        });
      }
    },
  });

  const {
    data: wishlistData,
    loading: wishlistLoading,
    error: wishlistError,
    refetch: refetchWishlist,
    networkStatus: wishlistNS,
  } = useQuery(MY_WISHLIST, {
    skip: !userId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    onError: (err) => {
      if (__DEV__) {
        console.warn("[CollectionTab] myWishlist GraphQL error", {
          message: extractGraphQLError(err),
          statusCode: err?.networkError?.statusCode || 400,
        });
      }
    },
  });

  /* -------- derived: wishlist (MOVED UP so price hydrate effect can use wishlistRawList) -------- */
  const wishlistRoot = useMemo(
    () => readWishlistRoot(wishlistData),
    [wishlistData],
  );
  const wishlistRawList = useMemo(
    () => readWishlistList(wishlistRoot),
    [wishlistRoot],
  );
  const wishlistServerTotal = useMemo(
    () => readWishlistServerTotal(wishlistRoot),
    [wishlistRoot],
  );
  const wishlistRawCount = Array.isArray(wishlistRawList)
    ? wishlistRawList.length
    : 0;

  useEffect(() => {
    if (!wishlistData) return;
    const preview =
      Array.isArray(wishlistRawList) && wishlistRawList.length
        ? wishlistRawList.slice(0, 1)
        : wishlistData?.myWishlist || wishlistData?.wishlist;
    debugLog("wishlist raw payload", {
      keys: Object.keys(wishlistData || {}),
      hasMyWishlist: !!wishlistData?.myWishlist,
      preview,
    });
  }, [wishlistData, wishlistRawList]);

  /* -------- derived: collection cards -------- */
  const myCollection = useMemo(() => {
    if (!collData) return [];
    if (Array.isArray(collData.myCollection)) return collData.myCollection;
    if (collData.myCollection) return toArray(collData.myCollection);
    return toArray(collData);
  }, [collData]);

  useEffect(() => {
    if (!collData) return;
    const preview =
      Array.isArray(collData?.myCollection) && collData.myCollection.length
        ? collData.myCollection.slice(0, 1)
        : collData?.myCollection;
    debugLog("collection raw payload", {
      keys: Object.keys(collData || {}),
      hasMyCollection: !!collData?.myCollection,
      preview,
    });
  }, [collData]);

  const collectionCards = useMemo(() => {
    return myCollection
      .map((entry) => {
        const card = entry?.card ?? null;
        const idKey = String(card?.id ?? entry?.cardId ?? "");
        if (!idKey) return null;

        const resolvedSetName = resolveSetNameForCardlike({
          id: idKey,
          setName: card?.setName,
          set: card?.set,
        });

        const candidates = buildImageCandidates({
          id: idKey,
          image: card?.image,
        });
        const displayImage = candidates[0] || card?.image || "";

        const hydrated = collectionPricesById.get(idKey);
        const prices = Array.isArray(hydrated) ? hydrated : [];
        const priceLatest = prices[0] || null;
        const pricing = prices;

        return {
          id: idKey,
          name: card?.name ?? "Card",
          number: card?.number,
          image: displayImage,
          rarity: card?.rarity,
          setName: resolvedSetName,
          prices,
          pricing,
          priceLatest,
          _collection: {
            entryId: entry.id,
            quantity: entry.quantity,
            variation: entry.variation ?? "normal",
            condition: entry.condition ?? "near_mint",
            wishlist: !!entry.wishlist,
            cardId: idKey,
          },
        };
      })
      .filter(Boolean);
  }, [myCollection, collectionPricesById]);

  const collectionCardsCount = Array.isArray(collectionCards)
    ? collectionCards.length
    : 0;

  useEffect(() => {
    debugLog("collection query state", {
      loading: collLoading,
      networkStatus: collNS,
      entries: collectionCardsCount,
    });
  }, [collLoading, collNS, collectionCardsCount]);

  /* -------- [PRICES] background hydration with variant probing -------- */

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
        const baseVars =
          variantValue == null
            ? { id: String(id) }
            : { id: String(id), variant: String(variantValue) };

        try {
          const { data } = await apollo.query({
            query: Q_CARD_cardsearchCardById,
            variables: baseVars,
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

        try {
          const { data } = await apollo.query({
            query: Q_ROOT_cardsearchPriceLatest,
            variables: baseVars,
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

      const legacyAttempts = [
        { q: Q_CARD_card, key: "card" },
        { q: Q_CARD_cardById, key: "cardById" },
        { q: Q_CARD_Cap, key: "Card" },
        {
          q: Q_ROOT_priceLatest,
          key: "priceLatest",
          root: true,
          useVariant: true,
        },
        { q: Q_ROOT_prices, key: "prices", root: true },
      ];

      for (const a of legacyAttempts) {
        try {
          const variables = a.useVariant
            ? mapped == null
              ? { id: String(id) }
              : { id: String(id), variant: String(mapped) }
            : { id: String(id) };

          const { data } = await apollo.query({
            query: a.q,
            variables,
            fetchPolicy: "network-only",
            errorPolicy: "all",
          });

          if (!a.root) {
            const card = data?.[a.key];
            if (!card) continue;
            let all = [];
            if (Array.isArray(card?.prices))
              all = all.concat(normalizePricesArray(card.prices));
            if (Array.isArray(card?.pricing))
              all = all.concat(normalizePricesArray(card.pricing));
            if (card?.priceLatest)
              all = all.concat(normalizeFromPriceLatest(card.priceLatest));
            if (!all.length) continue;
            return preferVariant(all, variation);
          }

          if (a.key === "priceLatest" && data?.priceLatest) {
            return normalizeFromPriceLatest(data.priceLatest);
          }
          if (a.key === "prices" && Array.isArray(data?.prices)) {
            return preferVariant(normalizePricesArray(data.prices), variation);
          }
        } catch (err) {
          if (__DEV__)
            console.warn("[CollectionTab] price hydrate attempt failed", {
              shape: a.key,
              id,
              message: extractGraphQLError(err),
            });
        }
      }

      if (__DEV__)
        console.warn("[CollectionTab] price hydrate yielded no rows", {
          id,
          variation,
        });
      return [];
    },
    [apollo],
  );

  const hydrateCollectionPrices = useCallback(
    async (idsAndVariations) => {
      if (collPriceHydratingRef.current) return;
      const targets = (idsAndVariations || []).filter((t) => t && t.id);
      if (!targets.length) return;

      collPriceHydratingRef.current = true;
      try {
        for (const { id, variation } of targets) {
          if (hydratedPriceIdsRef.current.has(id)) continue;
          hydratedPriceIdsRef.current.add(id);

          const picked = await tryFetchPrices(id, variation);

          if (picked.length) {
            if (__DEV__) {
              const head = picked[0];
              console.log("[CollectionTab] price hydrated", {
                id,
                variant: head?.variant ?? head?.variation ?? null,
                provider: head?.provider ?? head?.source ?? null,
                mid: head?.mid ?? head?.market ?? null,
              });
            }
            setCollectionPricesById((prev) => {
              const next = new Map(prev);
              next.set(String(id), picked);
              return next;
            });
          }
        }
      } finally {
        collPriceHydratingRef.current = false;
      }
    },
    [tryFetchPrices],
  );

  const hydrateWishlistPrices = useCallback(
    async (idsAndVariations) => {
      if (wishPriceHydratingRef.current) return;
      const targets = (idsAndVariations || []).filter((t) => t && t.id);
      if (!targets.length) return;

      wishPriceHydratingRef.current = true;
      try {
        for (const { id, variation } of targets) {
          if (hydratedWishlistPriceIdsRef.current.has(id)) continue;
          hydratedWishlistPriceIdsRef.current.add(id);

          const picked = await tryFetchPrices(id, variation);

          if (picked.length) {
            if (__DEV__) {
              const head = picked[0];
              console.log("[CollectionTab] wishlist price hydrated", {
                id,
                variant: head?.variant ?? head?.variation ?? null,
                provider: head?.provider ?? head?.source ?? null,
                mid: head?.mid ?? head?.market ?? null,
              });
            }
            setWishlistPricesById((prev) => {
              const next = new Map(prev);
              next.set(String(id), picked);
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

  // Collection price hydration trigger
  useEffect(() => {
    if (!myCollection.length) return;
    const pending = [];
    for (const entry of myCollection) {
      const idKey = String(entry?.card?.id ?? entry?.cardId ?? "");
      if (!idKey) continue;
      if (!collectionPricesById.has(idKey)) {
        pending.push({ id: idKey, variation: entry?.variation ?? "normal" });
      }
    }
    if (pending.length) {
      debugLog("price hydrate pending", {
        count: pending.length,
        sample: pending.slice(0, 5).map((x) => x.id),
      });
      hydrateCollectionPrices(pending);
    }
  }, [myCollection, collectionPricesById, hydrateCollectionPrices]);

  // Wishlist price hydration trigger
  useEffect(() => {
    if (segment !== "wishlist") return;
    if (!wishlistRawList.length) return;

    const pending = [];
    for (const it of wishlistRawList) {
      const node = it?.node ?? it;
      const cid = node?.card?.id ?? node?.cardId ?? node?.id ?? null;
      if (!cid) continue;

      const idKey = String(cid);
      if (wishlistPricesById.has(idKey)) continue;

      const variation =
        typeof node?.variation === "string" ? node.variation : "normal";

      pending.push({ id: idKey, variation });
    }

    if (pending.length) {
      debugLog("wishlist price hydrate pending", {
        count: pending.length,
        sample: pending.slice(0, 5).map((x) => x.id),
      });
      hydrateWishlistPrices(pending);
    }
  }, [segment, wishlistRawList, wishlistPricesById, hydrateWishlistPrices]);

  /* -------- derived: binders -------- */
  const rawBindersList = useMemo(() => {
    const root =
      !bindersData || Array.isArray(bindersData)
        ? bindersData
        : (bindersData.myBinders ??
          bindersData.binders ??
          bindersData.items ??
          bindersData.results ??
          bindersData.edges ??
          bindersData.nodes ??
          bindersData.data ??
          bindersData.list ??
          bindersData);
    return toArray(root);
  }, [bindersData]);

  const DEFAULT_BINDER_COVER = "#23243c";
  const DEFAULT_BINDER_ACCENT = "#424a80";

  const asNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  function coerceColor(value, fallback = COLORS.alt) {
    if (!value && value !== 0) return fallback;
    const s = String(value).trim();
    if (!s) return fallback;
    if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`;
    if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
    return s;
  }

  function countCardsFromPages(pages) {
    if (!Array.isArray(pages)) return 0;
    let total = 0;
    for (const page of pages) {
      const slots = Array.isArray(page?.slots) ? page.slots : [];
      for (const slot of slots) {
        if (!slot) continue;
        const hasCard =
          (typeof slot.cardId === "string" && slot.cardId.trim()) ||
          slot?.card?.id ||
          slot?.card?.cardId;
        if (!hasCard) continue;
        const qty = Number(slot?.quantity);
        total += Number.isFinite(qty) && qty > 0 ? qty : 1;
      }
    }
    return total;
  }

  function normalizeBinder(b) {
    if (!b) return null;
    const id = b.id ?? b._id ?? b.uuid ?? b.key;
    const name = b.name ?? b.title ?? b.label ?? "Binder";

    const pagesArray = Array.isArray(b.pages)
      ? b.pages
      : Array.isArray(b.sheets)
        ? b.sheets
        : Array.isArray(b.children)
          ? b.children
          : null;
    const pagesCount =
      asNumber(b?.pagesCount) ??
      asNumber(b?.pageCount) ??
      asNumber(b?.numPages) ??
      (pagesArray ? pagesArray.length : 0);

    const cardsCount =
      asNumber(b?.cardsCount) ??
      asNumber(b?.cardCount) ??
      asNumber(b?.totalCards) ??
      asNumber(b?.count) ??
      countCardsFromPages(pagesArray);

    const coverColor = coerceColor(
      b?.coverColor ??
        b?.cover?.coverColor ??
        b?.color ??
        b?.colour ??
        b?.colorHex ??
        b?.colourHex ??
        b?.themeColor ??
        b?.theme,
      DEFAULT_BINDER_COVER,
    );

    const accentColor = coerceColor(
      b?.accentColor ??
        b?.cover?.accentColor ??
        b?.spineColor ??
        b?.highlightColor ??
        b?.secondaryColor,
      DEFAULT_BINDER_ACCENT,
    );

    return {
      ...b,
      id: id != null ? String(id) : undefined,
      name,
      title: name,
      color: coverColor,
      colour: coverColor,
      colorHex: coverColor,
      coverColor,
      themeColor: coverColor,
      accentColor,
      cardsCount,
      cardCount: cardsCount,
      totalCards: cardsCount,
      pagesCount,
      pageCount: pagesCount,
      numPages: pagesCount,
      _stats: { cards: cardsCount, pages: pagesCount },
    };
  }

  const normalizedBinders = useMemo(
    () => rawBindersList.map(normalizeBinder).filter(Boolean),
    [rawBindersList],
  );

  // CHANGED: binder filtering now uses binderQuery (not shared query)
  const filteredBinders = useMemo(
    () => filterBinders(normalizedBinders, binderQuery),
    [normalizedBinders, binderQuery],
  );
  const filteredBindersCount = Array.isArray(filteredBinders)
    ? filteredBinders.length
    : 0;

  useEffect(() => {
    debugLog("binders query state", {
      loading: bindersLoading,
      networkStatus: bindersNS,
      received: Array.isArray(rawBindersList) ? rawBindersList.length : 0,
      filtered: filteredBindersCount,
      query: binderQuery,
    });
  }, [
    bindersLoading,
    bindersNS,
    rawBindersList,
    filteredBindersCount,
    binderQuery,
  ]);

  /* -------- derived: wishlist meta map -------- */
  const wishlistEntryMetaMap = useMemo(() => {
    const metaMap = new Map();

    for (const it of wishlistRawList) {
      const node = it?.node ?? it;
      const card = node?.card ?? null;
      const cid = card?.id ?? node?.cardId ?? node?.id ?? null;
      if (!cid) continue;

      const key = String(cid);

      const qty =
        typeof node?.quantity === "number" &&
        Number.isFinite(node.quantity) &&
        node.quantity > 0
          ? Math.round(node.quantity)
          : 1;

      metaMap.set(key, {
        entryId: node?.id ? String(node.id) : null,
        cardId: String(node?.cardId ?? cid),
        variation:
          typeof node?.variation === "string" ? node.variation : "normal",
        status: node?.status ?? null,
        quantity: qty,
        notes: typeof node?.notes === "string" ? node.notes : "",
        updatedAt: node?.updatedAt ?? null,
      });
    }

    wishlistMetaRef.current = metaMap;
    return metaMap;
  }, [wishlistRawList]);

  const handleUpdateWishlistEntry = useCallback(
    async ({ cardId, variation, status, quantity, notes }) => {
      const cid = String(cardId || "").trim();
      if (!cid) return { ok: false, error: "Missing cardId" };

      const varNorm =
        variation == null
          ? null
          : String(variation).trim().toLowerCase() === "normal"
            ? "normal"
            : String(variation).trim();

      const safeQty =
        typeof quantity === "number" &&
        Number.isFinite(quantity) &&
        quantity > 0
          ? Math.round(quantity)
          : (wishlistMetaRef.current.get(cid)?.quantity ?? 1);

      const safeNotes =
        typeof notes === "string"
          ? notes
          : (wishlistMetaRef.current.get(cid)?.notes ?? "");

      const optimisticMeta = {
        ...(wishlistMetaRef.current.get(cid) || {}),
        cardId: cid,
        variation:
          varNorm ?? wishlistMetaRef.current.get(cid)?.variation ?? "normal",
        status: status ?? null,
        quantity: safeQty,
        notes: safeNotes,
        updatedAt: new Date().toISOString(),
      };

      wishlistMetaRef.current = new Map(wishlistMetaRef.current);
      wishlistMetaRef.current.set(cid, optimisticMeta);

      setCardsByIdMap((prev) => {
        if (!prev.has(cid)) return prev;
        const next = new Map(prev);
        const existing = next.get(cid);
        next.set(cid, {
          ...existing,
          _wishlist: { ...(existing?._wishlist || {}), ...optimisticMeta },
        });
        return next;
      });

      if (__DEV__) {
        console.log("[CollectionTab] handleUpdateWishlistEntry", {
          cardId: cid,
          variation: varNorm,
          status,
          quantity: safeQty,
          notes: safeNotes,
        });
      }

      try {
        const { data } = await updateWishlistEntryMutation({
          variables: {
            cardId: cid,
            variation: varNorm,
            status: status || null,
            quantity: safeQty,
            notes: safeNotes,
          },
        });

        const updated = data?.updateWishlistEntry || null;

        if (__DEV__) {
          console.log("[CollectionTab] updateWishlistEntry ok", updated);
        }

        if (updated?.cardId) {
          const key = String(updated.cardId);

          const mergedMeta = {
            ...(wishlistMetaRef.current.get(key) || {}),
            entryId:
              updated.id || wishlistMetaRef.current.get(key)?.entryId || null,
            cardId: key,
            variation:
              updated.variation ??
              wishlistMetaRef.current.get(key)?.variation ??
              "normal",
            status: updated.status ?? null,
            quantity:
              typeof updated.quantity === "number" &&
              Number.isFinite(updated.quantity) &&
              updated.quantity > 0
                ? Math.round(updated.quantity)
                : (wishlistMetaRef.current.get(key)?.quantity ?? 1),
            notes:
              typeof updated.notes === "string"
                ? updated.notes
                : (wishlistMetaRef.current.get(key)?.notes ?? ""),
            updatedAt:
              updated.updatedAt ??
              wishlistMetaRef.current.get(key)?.updatedAt ??
              null,
          };

          wishlistMetaRef.current = new Map(wishlistMetaRef.current);
          wishlistMetaRef.current.set(key, mergedMeta);

          setCardsByIdMap((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Map(prev);
            const existing = next.get(key);
            next.set(key, {
              ...existing,
              _wishlist: { ...(existing?._wishlist || {}), ...mergedMeta },
            });
            return next;
          });
        }

        try {
          await refetchWishlist?.();
        } catch {}

        return { ok: true, updated };
      } catch (err) {
        if (__DEV__) {
          console.warn(
            "[CollectionTab] updateWishlistEntry failed",
            extractGraphQLError(err),
          );
        }

        try {
          await refetchWishlist?.();
        } catch {}

        return { ok: false, error: err };
      }
    },
    [updateWishlistEntryMutation, refetchWishlist],
  );

  const allWishlistIds = useMemo(() => {
    const ids = new Set();
    for (const it of wishlistRawList) {
      const node = it?.node ?? it;
      const hasCardObj = !!node?.card && !!node.card.id;
      const cid = node?.cardId || node?.card?.id || node?.id || null;
      if (cid && !hasCardObj) ids.add(String(cid));
    }
    return Array.from(ids);
  }, [wishlistRawList]);

  const pendingWishlistHydration = Array.isArray(allWishlistIds)
    ? allWishlistIds.length
    : 0;

  useEffect(() => {
    debugLog("wishlist query state", {
      loading: wishlistLoading,
      networkStatus: wishlistNS,
      entries: wishlistRawCount,
      hydrated: cardsByIdMap.size,
      pendingIds: pendingWishlistHydration,
    });
  }, [
    wishlistLoading,
    wishlistNS,
    wishlistRawCount,
    cardsByIdMap.size,
    pendingWishlistHydration,
  ]);

  const wishlistDisplayItems = useMemo(() => {
    const list = [];

    for (const it of wishlistRawList) {
      const node = it?.node ?? it;
      const inline = node?.card ?? null;
      const cid = inline?.id ?? node?.cardId ?? node?.id ?? null;
      if (!cid) continue;
      const key = String(cid);

      const fallbackQty =
        typeof node?.quantity === "number" &&
        Number.isFinite(node.quantity) &&
        node.quantity > 0
          ? Math.round(node.quantity)
          : 1;

      const meta = wishlistMetaRef.current.get(key) ||
        wishlistEntryMetaMap.get(key) || {
          entryId: node?.id ? String(node.id) : null,
          cardId: String(node?.cardId ?? cid),
          variation:
            typeof node?.variation === "string" ? node.variation : "normal",
          status: node?.status ?? null,
          quantity: fallbackQty,
          notes: typeof node?.notes === "string" ? node.notes : "",
          updatedAt: node?.updatedAt ?? null,
        };

      const hydratedPrices = wishlistPricesById.get(key);
      const prices = Array.isArray(hydratedPrices) ? hydratedPrices : [];
      const pricing = prices;
      const priceLatest = prices[0] || null;

      const hydrated = cardsByIdMap.get(key);
      if (hydrated) {
        list.push({
          ...hydrated,
          prices,
          pricing,
          priceLatest,
          _wishlist: { ...(hydrated?._wishlist || {}), ...meta },
        });
        continue;
      }

      if (inline) {
        const candidates = buildImageCandidates({
          id: key,
          image: inline?.image,
        });
        const displayImage = candidates[0] || inline?.image || "";
        const setName = resolveSetNameForCardlike({
          id: key,
          setName: inline?.setName,
          set: inline?.set,
        });

        list.push({
          ...inline,
          id: key,
          image: displayImage,
          setName,
          prices,
          pricing,
          priceLatest,
          _wishlist: { ...meta },
        });
        continue;
      }

      const setName = resolveSetNameForCardlike({ id: key });
      const candidates = buildImageCandidates({ id: key, image: null });
      const displayImage = candidates[0] || "";

      list.push({
        id: key,
        name: "Card",
        image: displayImage,
        setName,
        number: undefined,
        prices,
        pricing,
        priceLatest,
        _wishlist: { ...meta },
      });
    }

    return list;
  }, [wishlistRawList, cardsByIdMap, wishlistEntryMetaMap, wishlistPricesById]);

  useEffect(() => {
    setCardsByIdMap((prev) => {
      const next = new Map();
      let changed = false;

      for (const it of wishlistRawList) {
        const node = it?.node ?? it;
        const card = node?.card ?? null;
        const cid = card?.id ?? node?.cardId ?? node?.id ?? null;
        if (!cid) continue;
        const key = String(cid);

        const metaFromRef = wishlistMetaRef.current.get(key);

        const qty =
          typeof node?.quantity === "number" &&
          Number.isFinite(node.quantity) &&
          node.quantity > 0
            ? Math.round(node.quantity)
            : 1;

        const meta = metaFromRef ||
          wishlistEntryMetaMap.get(key) || {
            entryId: node?.id ? String(node.id) : null,
            cardId: String(node?.cardId ?? cid),
            variation:
              typeof node?.variation === "string" ? node.variation : "normal",
            status: node?.status ?? null,
            quantity: qty,
            notes: typeof node?.notes === "string" ? node.notes : "",
            updatedAt: node?.updatedAt ?? null,
          };

        if (card) {
          hydratedIdsRef.current.add(key);
          const candidates = buildImageCandidates({
            id: key,
            image: card?.image,
          });
          const displayImage = candidates[0] || card?.image || "";
          const setName = resolveSetNameForCardlike({
            id: key,
            setName: card?.setName,
            set: card?.set,
          });

          const prevEntry = prev.get(key);
          const enhanced = { ...card, image: displayImage, setName };

          if (
            prevEntry?.__sourceCard === card &&
            JSON.stringify(prevEntry?._wishlist || {}) === JSON.stringify(meta)
          ) {
            next.set(key, prevEntry);
          } else {
            next.set(key, {
              ...enhanced,
              _wishlist: { ...meta },
              __sourceCard: card,
            });
            changed = true;
          }
        } else if (prev.has(key)) {
          const prevEntry = prev.get(key);
          const prevMeta = prevEntry?._wishlist || {};
          const same = JSON.stringify(prevMeta) === JSON.stringify(meta);

          if (!same) {
            next.set(key, {
              ...prevEntry,
              _wishlist: { ...prevMeta, ...meta },
            });
            changed = true;
          } else {
            next.set(key, prevEntry);
          }
        }
      }

      if (!changed) {
        if (next.size !== prev.size) {
          changed = true;
        } else {
          for (const [k, value] of next.entries()) {
            if (prev.get(k) !== value) {
              changed = true;
              break;
            }
          }
        }
      }

      if (changed) {
        debugLog("wishlist map updated", {
          total: next.size,
          hydrated: hydratedIdsRef.current.size,
        });
      }

      return changed ? next : prev;
    });
  }, [wishlistRawList, wishlistEntryMetaMap]);

  /* -------- wishlist hydration (CardById only) -------- */
  const hydrateMissingWishlistCards = useCallback(async () => {
    if (inFlightRef.current) return;

    const targets = allWishlistIds.filter(
      (id) => !hydratedIdsRef.current.has(id) && !cardsByIdMap.has(id),
    );

    if (!targets.length) return;

    inFlightRef.current = true;
    setHydrating(true);
    debugLog("wishlist hydrate start", { pending: targets.length });

    try {
      for (const id of targets) {
        const fromRef = wishlistMetaRef.current.get(id);
        const baseMeta = wishlistEntryMetaMap.get(id);

        const meta = fromRef ||
          baseMeta || {
            entryId: null,
            cardId: String(id),
            variation: "normal",
            status: null,
            quantity: 1,
            notes: "",
            updatedAt: null,
          };

        try {
          const { data } = await apollo.query({
            query: CardByIdDocument,
            variables: { id },
            fetchPolicy: "network-only",
          });

          const card =
            data?.card ??
            data?.cardById ??
            data?.Card ??
            data?.cardsearchCardById ??
            null;

          if (card?.id) {
            const candidates = buildImageCandidates({ id, image: card?.image });
            const displayImage = candidates[0] || card?.image || "";
            const setName = resolveSetNameForCardlike({
              id,
              setName: card?.setName,
              set: card?.set,
            });

            hydratedIdsRef.current.add(id);
            setCardsByIdMap((prev) => {
              const next = new Map(prev);
              next.set(id, {
                ...card,
                image: displayImage,
                setName,
                _wishlist: { ...meta },
                __sourceCard: card,
              });
              return next;
            });

            debugLog("wishlist card hydrated", { id });
          } else {
            hydratedIdsRef.current.add(id);
          }
        } catch (err) {
          if (__DEV__) {
            console.warn("Failed to hydrate wishlist card", {
              id,
              message: extractGraphQLError(err),
            });
          }
        }
      }
    } finally {
      setHydrating(false);
      inFlightRef.current = false;
      debugLog("wishlist hydrate complete", {
        hydrated: hydratedIdsRef.current.size,
        mapSize: cardsByIdMap.size,
      });
    }
  }, [allWishlistIds, apollo, cardsByIdMap, wishlistEntryMetaMap]);

  useEffect(() => {
    if (segment !== "wishlist") return;
    hydrateMissingWishlistCards();
  }, [segment, hydrateMissingWishlistCards]);

  useEffect(() => {
    debugLog("segment changed", { segment });
  }, [segment]);

  /* -------- stats -------- */
  const stats = {
    cards: Array.isArray(collectionCards) ? collectionCards.length : 0,
    binders: filteredBindersCount,
    wishlist: wishlistServerTotal || wishlistRawCount || cardsByIdMap.size,
  };

  useEffect(() => {
    debugLog("stats updated", stats);
  }, [stats.cards, stats.binders, stats.wishlist]);

  const refetchCollectionSafe = useCallback(async () => {
    try {
      await refetchCollection();
    } catch (err) {
      console.warn("Failed to refetch collection after mutation", err);
    }
  }, [refetchCollection]);

  const mutateCollectionEntry = useCallback(
    async (card, { quantity, condition }) => {
      if (!card) throw new Error("Missing card");
      const cardId = card?.id ?? card?._collection?.cardId;
      if (!cardId) throw new Error("Missing card id");
      const variation = String(card?._collection?.variation ?? "normal");

      const normalizedQty =
        typeof quantity === "number" && Number.isFinite(quantity)
          ? Math.max(0, Math.round(quantity))
          : undefined;
      const normalizedCondition = condition ? String(condition) : undefined;

      if (normalizedQty != null && normalizedQty <= 0) {
        await removeFromCollection({ cardId: String(cardId), variation });
        return { removed: true };
      }

      const variables = { cardId: String(cardId), variation };
      if (normalizedQty != null) variables.quantity = normalizedQty;
      if (normalizedCondition) variables.condition = normalizedCondition;

      await updateCollectionEntry({ variables });
      return { removed: false };
    },
    [removeFromCollection, updateCollectionEntry],
  );

  const handleEditSubmit = useCallback(
    async (card, values = {}) => {
      if (!card) return;
      const nextQuantity = Number(
        values.quantity ?? card?._collection?.quantity ?? 0,
      );
      const nextCondition =
        values.condition ?? card?._collection?.condition ?? "near_mint";

      setSavingEdit(true);
      try {
        const result = await mutateCollectionEntry(card, {
          quantity: nextQuantity,
          condition: nextCondition,
        });
        await refetchCollectionSafe();
        toast.show(
          result.removed
            ? "Removed from your collection."
            : "Updated your collection.",
          { type: "success" },
        );
        setEditing(null);
      } catch (err) {
        console.error("Failed to save collection entry", err);
        toast.show("Couldn't update your collection. Please try again.", {
          type: "error",
        });
      } finally {
        setSavingEdit(false);
      }
    },
    [mutateCollectionEntry, refetchCollectionSafe, toast],
  );

  const handleRemoveQuantity = useCallback(
    async (card, count, { closeModal = false } = {}) => {
      if (!card) return;
      const removeCount = Math.max(0, Number(count) || 0);
      if (removeCount <= 0) return;
      const currentQty = Number(card?._collection?.quantity ?? 0) || 0;
      const nextQty = Math.max(0, currentQty - removeCount);

      if (closeModal) setSavingRemoval(true);
      try {
        const result = await mutateCollectionEntry(card, {
          quantity: nextQty,
          condition: card?._collection?.condition,
        });
        await refetchCollectionSafe();
        toast.show(
          result.removed
            ? "Removed from your collection."
            : "Updated your collection.",
          { type: "success" },
        );
        setRemoving(null);
      } catch (err) {
        console.error("Failed to remove from collection", err);
        toast.show("Couldn't update your collection. Please try again.", {
          type: "error",
        });
      } finally {
        if (closeModal) setSavingRemoval(false);
      }
    },
    [mutateCollectionEntry, refetchCollectionSafe, toast],
  );

  /* -------- NEW: dynamic rarity options (collection) -------- */
  const collectionRarityOptions = useMemo(() => {
    const uniq = new Map();
    for (const c of collectionCards) {
      const raw = String(c?.rarity ?? "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!uniq.has(key)) uniq.set(key, raw);
    }
    const list = Array.from(uniq.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [collectionCards]);

  /* -------- NEW: filtered/sorted collection list -------- */
  const filteredCollectionCards = useMemo(() => {
    let list = Array.isArray(collectionCards) ? collectionCards : [];

    const q = collectionQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const name = safeLower(c?.name);
        const setName = safeLower(c?.setName);
        const num = safeLower(c?.number);
        return name.includes(q) || setName.includes(q) || num.includes(q);
      });
    }

    if (collectionVariations.length) {
      const wanted = new Set(
        collectionVariations.map((x) => String(x).toLowerCase()),
      );
      list = list.filter((c) =>
        wanted.has(bucketVariation(c?._collection?.variation)),
      );
    }

    if (collectionRarities.length) {
      const wanted = new Set(
        collectionRarities.map((x) => String(x).toLowerCase()),
      );
      list = list.filter((c) =>
        wanted.has(String(c?.rarity ?? "").toLowerCase()),
      );
    }

    if (collectionSort === "name") {
      list = [...list].sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || "")),
      );
    } else if (collectionSort === "set") {
      list = [...list].sort((a, b) =>
        String(a?.setName || "").localeCompare(String(b?.setName || "")),
      );
    }
    // "recent" = keep server order

    return list;
  }, [
    collectionCards,
    collectionQuery,
    collectionVariations,
    collectionRarities,
    collectionSort,
  ]);

  /* -------- NEW: filtered/sorted wishlist list -------- */
  const filteredWishlistItems = useMemo(() => {
    let list = Array.isArray(wishlistDisplayItems) ? wishlistDisplayItems : [];

    const q = wishlistQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const name = safeLower(c?.name);
        const setName = safeLower(c?.setName);
        const num = safeLower(c?.number);
        return name.includes(q) || setName.includes(q) || num.includes(q);
      });
    }

    if (wishlistStatuses.length) {
      const wanted = new Set(
        wishlistStatuses.map((x) => String(x).toUpperCase()),
      );
      list = list.filter((c) =>
        wanted.has(String(c?._wishlist?.status ?? "").toUpperCase()),
      );
    }

    if (wishlistVariations.length) {
      const wanted = new Set(
        wishlistVariations.map((x) => String(x).toLowerCase()),
      );
      list = list.filter((c) =>
        wanted.has(bucketVariation(c?._wishlist?.variation)),
      );
    }

    if (wishlistSort === "name") {
      list = [...list].sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || "")),
      );
    } else if (wishlistSort === "set") {
      list = [...list].sort((a, b) =>
        String(a?.setName || "").localeCompare(String(b?.setName || "")),
      );
    } else if (wishlistSort === "price") {
      list = [...list].sort((a, b) => {
        const pa = getAnyNumericPrice(a);
        const pb = getAnyNumericPrice(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pb - pa; // high -> low
      });
    } else if (wishlistSort === "recent") {
      // prefer _wishlist.updatedAt desc (most recent first)
      list = [...list].sort((a, b) => {
        const ta = +new Date(a?._wishlist?.updatedAt || 0);
        const tb = +new Date(b?._wishlist?.updatedAt || 0);
        return (tb || 0) - (ta || 0);
      });
    }

    return list;
  }, [
    wishlistDisplayItems,
    wishlistQuery,
    wishlistStatuses,
    wishlistVariations,
    wishlistSort,
  ]);

  /* -------- render helpers -------- */
  const loadingBySegment =
    segment === "binders"
      ? bindersLoading && !bindersData
      : segment === "all"
        ? collLoading && !collData
        : wishlistLoading && !wishlistData;

  const errorBySegment =
    segment === "binders"
      ? bindersError
      : segment === "all"
        ? collError
        : wishlistError;

  const isRefetching = collNS === 4 || bindersNS === 4 || wishlistNS === 4;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    debugLog("pull-to-refresh start");
    try {
      await Promise.allSettled([
        refetchCollection?.(),
        refetchBinders?.(),
        refetchWishlist?.(),
      ]);

      hydratedIdsRef.current = new Set();
      setCardsByIdMap(new Map());

      setCollectionPricesById(new Map());
      hydratedPriceIdsRef.current = new Set();

      setWishlistPricesById(new Map());
      hydratedWishlistPriceIdsRef.current = new Set();

      wishlistMetaRef.current = new Map();
    } finally {
      setRefreshing(false);
      debugLog("pull-to-refresh complete");
    }
  }, [refetchCollection, refetchBinders, refetchWishlist]);

  const evictWishlistEntryFromCache = useCallback(
    (entryOrId) => {
      try {
        const id = typeof entryOrId === "object" ? entryOrId?.id : entryOrId;
        if (!id) return;
        const cacheId = apollo.cache.identify({
          __typename: "WishlistEntry",
          id: String(id),
        });
        if (cacheId) {
          apollo.cache.evict({ id: cacheId });
          apollo.cache.gc();
        }
      } catch {}
    },
    [apollo.cache],
  );

  const handleMoveWishlistItemToCollection = useCallback(
    async (item) => {
      const cardId = item?.id ? String(item.id) : null;
      const variation = item?._wishlist?.variation ?? "normal";
      if (!cardId) {
        toast.show("Missing card id", { type: "error" });
        return;
      }
      try {
        setCardsByIdMap((prev) => {
          const next = new Map(prev);
          next.delete(cardId);
          return next;
        });

        wishlistMetaRef.current = new Map(wishlistMetaRef.current);
        wishlistMetaRef.current.delete(cardId);

        setWishlistPricesById((prev) => {
          if (!prev.has(cardId)) return prev;
          const next = new Map(prev);
          next.delete(cardId);
          return next;
        });

        await moveWishlistToCollection({ cardId, variation, quantity: 1 });
        evictWishlistEntryFromCache(item?._wishlist?.entryId);
        toast.show("Moved to collection", { type: "success" });
      } catch (err) {
        const msg = extractGraphQLError(err);
        toast.show(msg || "Couldn't move to collection", { type: "error" });
      }
    },
    [moveWishlistToCollection, evictWishlistEntryFromCache, toast],
  );

  const handleRemoveFromWishlistLocal = useCallback(
    async (item) => {
      const cardId = item?.id ? String(item.id) : null;

      if (cardId) {
        setCardsByIdMap((prev) => {
          const next = new Map(prev);
          next.delete(cardId);
          return next;
        });

        wishlistMetaRef.current = new Map(wishlistMetaRef.current);
        wishlistMetaRef.current.delete(cardId);

        setWishlistPricesById((prev) => {
          if (!prev.has(cardId)) return prev;
          const next = new Map(prev);
          next.delete(cardId);
          return next;
        });
      }

      try {
        await removeFromWishlist({
          cardId,
          variation: item?._wishlist?.variation ?? "normal",
        });
        evictWishlistEntryFromCache(item?._wishlist?.entryId);
        toast.show("Removed from wishlist", { type: "success" });
      } catch (err) {
        const msg = extractGraphQLError(err);
        toast.show(msg || "Couldn't remove from wishlist", { type: "error" });
      }
    },
    [removeFromWishlist, evictWishlistEntryFromCache, toast],
  );

  const wishlistHasData =
    wishlistServerTotal > 0 || wishlistRawCount > 0 || cardsByIdMap.size > 0;

  // NEW: count active filters for compact badges
  const collectionActiveFilterCount =
    (collectionVariations?.length || 0) + (collectionRarities?.length || 0);
  const wishlistActiveFilterCount =
    (wishlistStatuses?.length || 0) + (wishlistVariations?.length || 0);

  return (
    <View style={styles.container}>
      <PageHeader title="Collection" subtitle="Browse binders and cards" />

      <TopControls
        stats={stats}
        segment={segment}
        onChangeSegment={setSegment}
        // CHANGED: TopControls query now only drives binder filtering
        query={segment === "binders" ? binderQuery : ""}
        onChangeQuery={segment === "binders" ? setBinderQuery : () => {}}
      />

      {loadingBySegment ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : errorBySegment ? (
        <View style={styles.center}>
          <Text
            style={{
              color: COLORS.error,
              textAlign: "center",
              paddingHorizontal: 24,
            }}
          >
            {errorBySegment?.message || "Something went wrong"}
          </Text>
        </View>
      ) : segment === "binders" ? (
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
          <CreateBinderBanner onPress={() => router.push("/binder/new")} />
          <BinderGrid
            binders={filteredBinders}
            onCreate={() => router.push("/binder/new")}
            onOpen={(id) => router.push(`/binder/${id}/edit`)}
          />
          <View style={{ height: 28 }} />
        </ScrollView>
      ) : segment === "all" ? (
        <FlatList
          contentContainerStyle={styles.gridContent}
          data={filteredCollectionCards} // CHANGED: filtered/sorted list
          keyExtractor={(item, idx) => (item?.id ? String(item.id) : `${idx}`)}
          numColumns={2}
          columnWrapperStyle={styles.column}
          refreshControl={
            <RefreshControl
              tintColor={COLORS.accent}
              refreshing={refreshing || isRefetching}
              onRefresh={onRefresh}
            />
          }
          // NEW: compact search + filters header (minimal when closed)
          ListHeaderComponent={
            <View style={{ paddingTop: 2, paddingBottom: 6 }}>
              <CompactSearchFiltersBar
                query={collectionQuery}
                onChangeQuery={setCollectionQuery}
                sortKey={collectionSort}
                sortOptions={[
                  { key: "recent", label: "Recent" },
                  { key: "name", label: "Name" },
                  { key: "set", label: "Set" },
                ]}
                onChangeSort={setCollectionSort}
                activeFilterCount={collectionActiveFilterCount}
                filterGroups={[
                  {
                    key: "variation",
                    title: "Variation",
                    value: collectionVariations,
                    onChange: setCollectionVariations,
                    options: [
                      { key: "normal", label: "Normal" },
                      { key: "holo", label: "Holo" },
                      { key: "reverse", label: "Reverse" },
                    ],
                  },
                  {
                    key: "rarity",
                    title: "Rarity",
                    value: collectionRarities,
                    onChange: setCollectionRarities,
                    // dynamic options from your actual collection data
                    options: collectionRarityOptions.length
                      ? collectionRarityOptions
                      : [{ key: "unknown", label: "No rarity data" }],
                  },
                ]}
                onClearAll={() => {
                  setCollectionQuery("");
                  setCollectionSort("recent");
                  setCollectionVariations([]);
                  setCollectionRarities([]);
                }}
              />
            </View>
          }
          renderItem={({ item }) => {
            const normalizedPrices = Array.isArray(item?.prices)
              ? item.prices
              : Array.isArray(item?.pricing)
                ? item.pricing
                : [];

            return (
              <CollectionCardTile
                item={{
                  ...item,
                  pricing: normalizedPrices,
                  priceLatest: normalizedPrices[0] || null,
                }}
                isInCollection={true}
                onView={() =>
                  router.push({
                    pathname: "/card/[id]",
                    params: {
                      id: String(item.id),
                      name: item.name ?? "",
                      setName: item.setName ?? "",
                      number: String(item.number ?? ""),
                      image: item.image ?? "",
                      prices: JSON.stringify(normalizedPrices),
                      hideActions: "1",
                    },
                  })
                }
                onEdit={() => setEditing(item)}
                onRemove={() => {
                  const qty = Number(item?._collection?.quantity ?? 1) || 1;
                  if (qty > 1) setRemoving(item);
                  else handleRemoveQuantity(item, 1);
                }}
              />
            );
          }}
          ListFooterComponent={<View style={{ height: 12 }} />}
        />
      ) : /* wishlist */ wishlistHasData ? (
        <>
          {hydrating ? (
            <View style={{ paddingVertical: 6, alignItems: "center" }}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : null}

          <FlatList
            contentContainerStyle={styles.gridContent}
            data={filteredWishlistItems} // CHANGED: filtered/sorted list
            keyExtractor={(item, idx) =>
              item?.id ? String(item.id) : `${idx}`
            }
            numColumns={2}
            columnWrapperStyle={styles.column}
            refreshControl={
              <RefreshControl
                tintColor={COLORS.accent}
                refreshing={refreshing || isRefetching}
                onRefresh={onRefresh}
              />
            }
            // NEW: compact search + filters header (minimal when closed)
            ListHeaderComponent={
              <View style={{ paddingTop: 2, paddingBottom: 6 }}>
                <CompactSearchFiltersBar
                  query={wishlistQuery}
                  onChangeQuery={setWishlistQuery}
                  sortKey={wishlistSort}
                  sortOptions={[
                    { key: "recent", label: "Recent" }, // (recently updated)
                    { key: "name", label: "Name" },
                    { key: "set", label: "Set" },
                    { key: "price", label: "Price" },
                  ]}
                  onChangeSort={setWishlistSort}
                  activeFilterCount={wishlistActiveFilterCount}
                  filterGroups={[
                    {
                      key: "status",
                      title: "Status",
                      value: wishlistStatuses,
                      onChange: setWishlistStatuses,
                      options: [
                        { key: "ACTIVE", label: "Hunting" },
                        { key: "GRAIL", label: "Dream" },
                        { key: "EVENTUAL", label: "Someday" },
                        { key: "UPGRADE", label: "Upgrade" },
                      ],
                    },
                    {
                      key: "variation",
                      title: "Variation",
                      value: wishlistVariations,
                      onChange: setWishlistVariations,
                      options: [
                        { key: "normal", label: "Normal" },
                        { key: "holo", label: "Holo" },
                        { key: "reverse", label: "Reverse" },
                      ],
                    },
                  ]}
                  onClearAll={() => {
                    setWishlistQuery("");
                    setWishlistSort("recent");
                    setWishlistStatuses([]);
                    setWishlistVariations([]);
                  }}
                />
              </View>
            }
            renderItem={({ item }) => {
              const prices = Array.isArray(item?.prices)
                ? item.prices
                : Array.isArray(item?.pricing)
                  ? item.pricing
                  : [];

              return (
                <WishlistCardTile
                  item={{
                    ...item,
                    prices,
                    pricing: prices,
                    priceLatest: prices[0] || null,
                  }}
                  onView={() =>
                    router.push({
                      pathname: "/card/[id]",
                      params: {
                        id: String(item.id),
                        name: item.name ?? "",
                        setName: item.setName ?? "",
                        number: String(item.number ?? ""),
                        image: item.image ?? "",
                        prices: JSON.stringify(prices),
                      },
                    })
                  }
                  onMoveToCollection={() =>
                    handleMoveWishlistItemToCollection(item)
                  }
                  onRemoveFromWishlist={() =>
                    handleRemoveFromWishlistLocal(item)
                  }
                  onUpdateWishlistEntry={handleUpdateWishlistEntry}
                />
              );
            }}
            ListFooterComponent={<View style={{ height: 12 }} />}
          />
        </>
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
          <WishlistPlaceholder
            count={stats.wishlist}
            onOpen={() => router.push("/wishlist")}
            onBrowse={() => router.push("/(tabs)/search")}
          />
          <View style={{ height: 28 }} />
        </ScrollView>
      )}

      {/* Modals */}
      <EditCollectionModal
        visible={!!editing}
        onClose={() => setEditing(null)}
        card={editing}
        saving={savingEdit}
        onSubmit={(vals) => handleEditSubmit(editing, vals)}
      />
      <RemoveQuantityModal
        visible={!!removing}
        onClose={() => setRemoving(null)}
        card={removing}
        removing={savingRemoval}
        onConfirm={(qty) =>
          handleRemoveQuantity(removing, qty, { closeModal: true })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },
  gridContent: { paddingHorizontal: 6, paddingBottom: 20 },
  column: { gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* Create binder banner */
  createBanner: {
    marginTop: 10,
    marginHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  createBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.alt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  createBannerTitle: { color: COLORS.text, fontWeight: "800" },
  createBannerSub: { color: COLORS.textMuted, fontSize: 12 },
  createBannerChev: { color: COLORS.textMuted, fontWeight: "900" },
});
