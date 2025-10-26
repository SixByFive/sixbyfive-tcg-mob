// app/(tabs)/collection.js
// CHANGED: Use shared set-name resolver so set names show immediately.
// CHANGED: Wishlist displays placeholders (id-based image + setName) until hydration completes.
// CHANGED: Keep TCGdex-first image fallback and pass resolved setName/image to tiles/routes.
// CHANGED: Normalize binders (name/color/cards/pages) and pass normalized list to BinderGrid.

import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import {
  CardByIdDocument,
  MyBindersDocument,
  RemoveFromCollectionDocument,
  UpdateCollectionEntryDocument,
} from "@sixbyfive/tcg-binder/client";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";
let MY_BINDERS_QUERY = MyBindersDocument;
try {
  const maybeSafe = require("../../graphql/binders-temp");
  if (maybeSafe?.MY_BINDERS_SAFE) MY_BINDERS_QUERY = maybeSafe.MY_BINDERS_SAFE;
} catch (err) {
  if (__DEV__) console.warn("[CollectionTab] Safe myBinders query unavailable", err?.message ?? err);
}

// Shared set-name resolver (also used by Cards/Wishlist tabs)
import { resolveSetNameForCardlike } from "../../utils/setNames";

/* ---------------- GraphQL (INLINE, schema-safe) ---------------- */

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
        card {
          id
          name
          number
          image
          setName
        }
      }
    }
  }
`;

/* ---------------- debug logger (dev-only) ---------------- */
const debugLog = (...args) => {
  if (__DEV__) console.log("[CollectionTab]", ...args);
};

/* ---------------- id + image helpers ---------------- */

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
  return m ? m[0] : null; // "sv" from "sv05"
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

  const parsed = parseCardId(cardish?.id || cardish?.cardId || cardish?._collection?.cardId || "");
  if (parsed.setCode && parsed.number) {
    const era = inferEraFromSetCode(parsed.setCode);
    // TCGdex first
    const dHigh = tcgdexFromParts(parsed.setCode, parsed.number, era, "high");
    const dLow = tcgdexFromParts(parsed.setCode, parsed.number, era, "low");
    if (dHigh) out.push(dHigh);
    if (dLow) out.push(dLow);
    // then PokemonTCG
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

/* ---------------- misc helpers ---------------- */

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
function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.edges)) return input.edges.map((e) => e?.node ?? e).filter(Boolean);
  if (Array.isArray(input.nodes)) return input.nodes.filter(Boolean);
  if (Array.isArray(input.items)) return input.items.filter(Boolean);
  if (Array.isArray(input.results)) return input.results.filter(Boolean);
  if (Array.isArray(input.entries)) return input.entries.filter(Boolean);
  for (const k of Object.keys(input || {})) {
    const v = input[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      if (Array.isArray(v.edges)) return v.edges.map((e) => e?.node ?? e).filter(Boolean);
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

  const [segment, setSegment] = useState("binders");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [savingRemoval, setSavingRemoval] = useState(false);

  const [updateCollectionEntry] = useMutation(UpdateCollectionEntryDocument);
  const [removeFromCollection] = useMutation(RemoveFromCollectionDocument);

  // wishlist hydration
  const [cardsByIdMap, setCardsByIdMap] = useState(() => new Map());
  const [hydrating, setHydrating] = useState(false);
  const hydratedIdsRef = useRef(new Set());
  const inFlightRef = useRef(false);

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
          message: err.message,
          graphQLErrors: err.graphQLErrors?.map((e) => e.message),
          networkError: err.networkError?.message || err.networkError,
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
          message: err.message,
          graphQLErrors: err.graphQLErrors?.map((e) => e.message),
          networkError: err.networkError?.message || err.networkError,
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
          message: err.message,
          graphQLErrors: err.graphQLErrors?.map((e) => e.message),
          networkError: err.networkError?.message || err.networkError,
          statusCode: err?.networkError?.statusCode || 400,
        });
      }
    },
  });

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
        if (!card) return null;

        const prices = Array.isArray(card?.prices)
          ? normalizePricesArray(card.prices)
          : Array.isArray(card?.pricing)
          ? normalizePricesArray(card.pricing)
          : [];

        // Resolve set name immediately (from card payload OR id fallback)
        const resolvedSetName = resolveSetNameForCardlike({
          id: card?.id ?? entry?.cardId,
          setName: card?.setName,
          set: card?.set,
        });

        // Robust image (prefer TCGdex)
        const candidates = buildImageCandidates({ id: card?.id ?? entry?.cardId, image: card?.image });
        const displayImage = candidates[0] || card?.image || "";

        return {
          id: card.id,
          name: card.name,
          number: card.number,
          image: displayImage,
          rarity: card.rarity,
          setName: resolvedSetName,
          prices,
          _collection: {
            entryId: entry.id,
            quantity: entry.quantity,
            variation: entry.variation,
            condition: entry.condition ?? "near_mint",
            wishlist: !!entry.wishlist,
          },
        };
      })
      .filter(Boolean);
  }, [myCollection]);

  const collectionCardsCount = Array.isArray(collectionCards) ? collectionCards.length : 0;

  useEffect(() => {
    debugLog("collection query state", {
      loading: collLoading,
      networkStatus: collNS,
      entries: collectionCardsCount,
    });
  }, [collLoading, collNS, collectionCardsCount]);

  /* -------- derived: binders -------- */

  const rawBindersList = useMemo(() => {
    const root =
      !bindersData || Array.isArray(bindersData)
        ? bindersData
        : bindersData.myBinders ??
          bindersData.binders ??
          bindersData.items ??
          bindersData.results ??
          bindersData.edges ??
          bindersData.nodes ??
          bindersData.data ??
          bindersData.list ??
          bindersData;
    return toArray(root);
  }, [bindersData]);

  // Normalization so BinderGrid gets consistent fields (name/color/cards/pages)
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

    const pagesArray =
      Array.isArray(b.pages) ? b.pages :
      Array.isArray(b.sheets) ? b.sheets :
      Array.isArray(b.children) ? b.children :
      null;
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
      DEFAULT_BINDER_COVER
    );

    const accentColor = coerceColor(
      b?.accentColor ??
        b?.cover?.accentColor ??
        b?.spineColor ??
        b?.highlightColor ??
        b?.secondaryColor,
      DEFAULT_BINDER_ACCENT
    );

    // Provide multiple aliases so any grid implementation can pick what it expects
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
    [rawBindersList]
  );

  const filteredBinders = useMemo(
    () => filterBinders(normalizedBinders, query),
    [normalizedBinders, query]
  );
  const filteredBindersCount = Array.isArray(filteredBinders) ? filteredBinders.length : 0;

  useEffect(() => {
    debugLog("binders query state", {
      loading: bindersLoading,
      networkStatus: bindersNS,
      received: Array.isArray(rawBindersList) ? rawBindersList.length : 0,
      filtered: filteredBindersCount,
      query,
    });
  }, [bindersLoading, bindersNS, rawBindersList, filteredBindersCount, query]);

  /* -------- derived: wishlist -------- */

  const wishlistRoot = useMemo(() => readWishlistRoot(wishlistData), [wishlistData]);
  const wishlistRawList = useMemo(() => readWishlistList(wishlistRoot), [wishlistRoot]);
  const wishlistServerTotal = useMemo(() => readWishlistServerTotal(wishlistRoot), [wishlistRoot]);
  const wishlistRawCount = Array.isArray(wishlistRawList) ? wishlistRawList.length : 0;

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

  const wishlistVariationMap = useMemo(() => {
    const variationMap = new Map();
    for (const it of wishlistRawList) {
      const node = it?.node ?? it;
      const card = node?.card ?? null;
      const cid = card?.id ?? node?.cardId ?? node?.id ?? null;
      if (!cid) continue;
      const variation = typeof node?.variation === "string" ? node.variation : "normal";
      variationMap.set(String(cid), variation);
    }
    return variationMap;
  }, [wishlistRawList]);

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

  const pendingWishlistHydration = Array.isArray(allWishlistIds) ? allWishlistIds.length : 0;

  useEffect(() => {
    debugLog("wishlist query state", {
      loading: wishlistLoading,
      networkStatus: wishlistNS,
      entries: wishlistRawCount,
      hydrated: cardsByIdMap.size,
      pendingIds: pendingWishlistHydration,
    });
  }, [wishlistLoading, wishlistNS, wishlistRawCount, cardsByIdMap.size, pendingWishlistHydration]);

  // Build a display list that shows immediately (hydrated, inline, or placeholder)
  const wishlistDisplayItems = useMemo(() => {
    const list = [];
    for (const it of wishlistRawList) {
      const node = it?.node ?? it;
      const inline = node?.card ?? null;
      const cid = inline?.id ?? node?.cardId ?? node?.id ?? null;
      if (!cid) continue;
      const key = String(cid);

      const hydrated = cardsByIdMap.get(key);
      if (hydrated) {
        list.push(hydrated);
        continue;
      }

      if (inline) {
        const candidates = buildImageCandidates({ id: key, image: inline?.image });
        const displayImage = candidates[0] || inline?.image || "";
        const setName = resolveSetNameForCardlike({
          id: key,
          setName: inline?.setName,
          set: inline?.set,
        });
        list.push({ ...inline, id: key, image: displayImage, setName });
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
        prices: [],
        _wishlist: { variation: wishlistVariationMap.get(key) ?? "normal" },
      });
    }
    return list;
  }, [wishlistRawList, cardsByIdMap, wishlistVariationMap]);

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
        const variation = wishlistVariationMap.get(key) ?? "normal";

        if (card) {
          // enhance: image + setName
          hydratedIdsRef.current.add(key);
          const candidates = buildImageCandidates({ id: key, image: card?.image });
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
            prevEntry?._wishlist?.variation === variation
          ) {
            next.set(key, prevEntry);
          } else {
            next.set(key, {
              ...enhanced,
              _wishlist: { variation },
              __sourceCard: card,
            });
            changed = true;
          }
        } else if (prev.has(key)) {
          const prevEntry = prev.get(key);
          if ((prevEntry?._wishlist?.variation ?? "normal") !== variation) {
            next.set(key, { ...prevEntry, _wishlist: { variation } });
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
          for (const [key, value] of next.entries()) {
            if (prev.get(key) !== value) {
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
  }, [wishlistRawList, wishlistVariationMap]);

  /* -------- wishlist hydration (CardById only) -------- */

  const hydrateMissingWishlistCards = useCallback(async () => {
    if (inFlightRef.current) return;
    const targets = allWishlistIds.filter(
      (id) => !hydratedIdsRef.current.has(id) && !cardsByIdMap.has(id)
    );
    if (!targets.length) return;

    inFlightRef.current = true;
    setHydrating(true);
    debugLog("wishlist hydrate start", { pending: targets.length });
    try {
      for (const id of targets) {
        const variation = wishlistVariationMap.get(id) ?? "normal";
        try {
          const { data } = await apollo.query({
            query: CardByIdDocument,
            variables: { id },
            fetchPolicy: "network-only",
          });
          const card = data?.card ?? data?.cardById ?? data?.Card ?? null;
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
                _wishlist: { variation },
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
            console.warn("Failed to hydrate wishlist card", { err, id });
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
  }, [allWishlistIds, apollo, cardsByIdMap, wishlistVariationMap]);

  useEffect(() => {
    if (segment !== "wishlist") return;
    hydrateMissingWishlistCards();
  }, [segment, hydrateMissingWishlistCards]);

  useEffect(() => {
    debugLog("segment changed", { segment });
  }, [segment]);

  /* -------- stats -------- */

  const stats = {
    cards: collectionCardsCount,
    binders: filteredBindersCount, // use normalized & filtered count
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
        await removeFromCollection({ variables: { cardId: String(cardId), variation } });
        return { removed: true };
      }

      const variables = { cardId: String(cardId), variation };
      if (normalizedQty != null) variables.quantity = normalizedQty;
      if (normalizedCondition) variables.condition = normalizedCondition;

      await updateCollectionEntry({ variables });
      return { removed: false };
    },
    [removeFromCollection, updateCollectionEntry]
  );

  const handleEditSubmit = useCallback(
    async (card, values = {}) => {
      if (!card) return;
      const nextQuantity = Number(values.quantity ?? card?._collection?.quantity ?? 0);
      const nextCondition = values.condition ?? card?._collection?.condition ?? "near_mint";

      setSavingEdit(true);
      try {
        const result = await mutateCollectionEntry(card, {
          quantity: nextQuantity,
          condition: nextCondition,
        });
        await refetchCollectionSafe();
        toast.show(
          result.removed ? "Removed from your collection." : "Updated your collection.",
          { type: "success" }
        );
        setEditing(null);
      } catch (err) {
        console.error("Failed to save collection entry", err);
        toast.show("Couldn't update your collection. Please try again.", { type: "error" });
      } finally {
        setSavingEdit(false);
      }
    },
    [mutateCollectionEntry, refetchCollectionSafe, toast]
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
          result.removed ? "Removed from your collection." : "Updated your collection.",
          { type: "success" }
        );
        setRemoving(null);
      } catch (err) {
        console.error("Failed to remove from collection", err);
        toast.show("Couldn't update your collection. Please try again.", { type: "error" });
      } finally {
        if (closeModal) setSavingRemoval(false);
      }
    },
    [mutateCollectionEntry, refetchCollectionSafe, toast]
  );

  /* -------- per-segment loading/error -------- */
  const loadingBySegment =
    segment === "binders"
      ? bindersLoading && !bindersData
      : segment === "all"
      ? collLoading && !collData
      : wishlistLoading && !wishlistData;

  const errorBySegment =
    segment === "binders" ? bindersError : segment === "all" ? collError : wishlistError;

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
    } finally {
      setRefreshing(false);
      debugLog("pull-to-refresh complete");
    }
  }, [refetchCollection, refetchBinders, refetchWishlist]);

  /* -------- render -------- */

  // Consider any of: total > 0, raw entries > 0, or hydrated map > 0
  const wishlistHasData =
    wishlistServerTotal > 0 || wishlistRawCount > 0 || cardsByIdMap.size > 0;

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

      {loadingBySegment ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : errorBySegment ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.error, textAlign: "center", paddingHorizontal: 24 }}>
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
            // pass normalized binders so name/color/cards/pages are present
            binders={filteredBinders}
            onCreate={() => router.push("/binder/new")}
            onOpen={(id) => router.push(`/binder/${id}/edit`)}
          />
          <View style={{ height: 28 }} />
        </ScrollView>
      ) : segment === "all" ? (
        <FlatList
          contentContainerStyle={styles.gridContent}
          data={collectionCards}
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
          renderItem={({ item }) => {
            const normalizedPrices = Array.isArray(item?.prices)
              ? item.prices
              : Array.isArray(item?.pricing)
              ? item.pricing
              : [];

            return (
              <CollectionCardTile
                item={item}
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
            data={wishlistDisplayItems}
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
            renderItem={({ item }) => {
              const prices = Array.isArray(item?.prices)
                ? item.prices
                : Array.isArray(item?.pricing)
                ? item.pricing
                : [];
              return (
                <WishlistCardTile
                  item={item}
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
                  onMoveToCollection={() => {}}
                  onRemoveFromWishlist={() => {}}
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
        onConfirm={(qty) => handleRemoveQuantity(removing, qty, { closeModal: true })}
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
