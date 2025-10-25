// components/profile/CardsTab.js
// PURPOSE: Compact "Cards" grid inside a profile page.
// CHANGED: FlatList with numColumns=2 (no single full-width tiles).
// CHANGED: Robust image fallbacks: card.image → TCGdex (high→low) → pokemontcg.io (hires→std).
// CHANGED: Set label logic via util (never show literal "set", map sv01..sv08, else UPPER code).
// CHANGED: Renders name + set name and passes resolved setName to onOpenCard.
// CHANGED: Uses set-era helper ONLY for era slug in image URLs.
// CHANGED: FlatList scroll disabled to avoid nested VirtualizedList warnings.
// CHANGED: Dev logs are throttled via a signature guard to prevent spam.

import { gql, useQuery } from "@apollo/client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";
import inferSetEra from "../../../utils/setEra.native";
import { parseCardId, resolveSetNameForCardlike } from "../../../utils/setNames";

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
        image
        setName
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
        image
        setName
      }
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

  // 1) direct image first
  if (card?.image && isAbs(card.image)) out.push(forceHttps(card.image));

  // 2) from id/code
  const id = card?.id ?? card?.cardId ?? null;
  const { setCode, number } = parseCardId(id);
  if (setCode && number) {
    const era = inferSetEra({ code: setCode });

    // TCGdex FIRST (better coverage/quality), then PokemonTCG
    const dexHigh = tcgdexFromParts(setCode, number, era, "high");
    const dexLow = tcgdexFromParts(setCode, number, era, "low");
    if (dexHigh) out.push(dexHigh);
    if (dexLow) out.push(dexLow);

    const pokeHires = pokemontcgFromParts(setCode, number, true);
    const pokeStd = pokemontcgFromParts(setCode, number, false);
    if (pokeHires) out.push(pokeHires);
    if (pokeStd) out.push(pokeStd);
  }

  // dedupe
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

/* ---------------- normalization ---------------- */

function normalizeCard(item) {
  const raw = unwrapCardish(item);
  const id =
    raw?.id ??
    raw?.cardId ??
    item?.cardId ??
    item?.id ??
    (typeof raw?.uuid === "string" ? raw.uuid : undefined);
  if (!id) return null;

  const prices = Array.isArray(raw?.prices)
    ? raw.prices
    : Array.isArray(raw?.pricing)
    ? raw.pricing
    : [];

  const { setCode, number } = parseCardId(id);
  const era = setCode ? inferSetEra({ code: setCode }) : null;

  return {
    id: String(id),
    setCode: setCode || undefined,
    era: era || undefined,
    name: raw?.name ?? raw?.cardName ?? "Card",
    image:
      raw?.image ??
      raw?.imageUrl ??
      get(raw, "images.small") ??
      get(raw, "images.large") ??
      "",
    setName: resolveSetNameForCardlike(raw), // via util (matches Wishlist)
    number: raw?.number ?? raw?.collectorNumber ?? number ?? undefined,
    prices,
  };
}

function normalizeCardsInput(cardsProp) {
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
      if (cardsProp[k]) return toArray(cardsProp[k]).map(normalizeCard).filter(Boolean);
    }
    return toArray(cardsProp).map(normalizeCard).filter(Boolean);
  }
  return toArray(cardsProp).map(normalizeCard).filter(Boolean);
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
}) {
  const normalizedFromProp = useMemo(() => normalizeCardsInput(cards), [cards]);

  const shouldFetchProfile = normalizedFromProp.length === 0 && !!userId;
  const { data: collectionData, loading: fetchingProfile, error: collectionError } = useQuery(
    USER_COLLECTION_MIN,
    {
      variables: { userId },
      skip: !shouldFetchProfile,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    }
  );

  const shouldFetchMine = normalizedFromProp.length === 0 && !userId;
  const { data: myData, loading: fetchingMine, error: myError } = useQuery(MY_COLLECTION_MIN, {
    skip: !shouldFetchMine,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const normalizedFromFetch = useMemo(() => {
    if (collectionData?.collection) {
      return toArray(collectionData.collection).map(normalizeCard).filter(Boolean);
    }
    if (myData?.myCollection) {
      return toArray(myData.myCollection).map(normalizeCard).filter(Boolean);
    }
    return toArray(collectionData || myData).map(normalizeCard).filter(Boolean);
  }, [collectionData, myData]);

  const displayCards = (normalizedFromProp.length ? normalizedFromProp : normalizedFromFetch).slice(
    0,
    pageSize
  );

  const showSkeleton =
    (loading || fetchingProfile || fetchingMine) && normalizedFromProp.length === 0;

  /* ----- DEV LOG: throttled to avoid spam ----- */
  const lastSigRef = useRef("");
  const via = normalizedFromProp.length
    ? "prop"
    : shouldFetchProfile
    ? "UserCollectionMin"
    : "MyCollectionMin";
  const debugSig = `${via}:${normalizedFromProp.length}:${normalizedFromFetch.length}:${displayCards.length}`;
  useEffect(() => {
    if (!__DEV__) return;
    if (lastSigRef.current === debugSig) return;
    lastSigRef.current = debugSig;
    // eslint-disable-next-line no-console
    console.log("[CardsTab] source:", {
      propCount: normalizedFromProp.length,
      fetchedCount: normalizedFromFetch.length,
      used: displayCards.length,
      via,
      errors: { collectionError: collectionError?.message, myError: myError?.message },
    });
  }, [
    debugSig,
    via,
    normalizedFromProp.length,
    normalizedFromFetch.length,
    displayCards.length,
    collectionError?.message,
    myError?.message,
  ]);

  const skeleton = Array.from({ length: GRID * 3 }, (_, i) => ({ id: `sk-${i}` }));

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

      {collectionError || myError ? (
        <Text style={styles.bodyText}>Failed to load cards.</Text>
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
              <View style={{ height: 14, marginTop: 6, borderRadius: 3, backgroundColor: COLORS.alt }} />
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
            const setName = resolveSetNameForCardlike(c); // consistent label via util

            return (
              <Pressable
                onPress={() =>
                  onOpenCard?.({
                    ...c,
                    setName,                    // pass resolved setName
                    image: primaryImage,        // best image for details
                    imageCandidates: candidates,
                    pricesJSON: JSON.stringify(c.prices || []),
                  })
                }
                style={styles.gridItem}
                android_ripple={{ color: "#00000022" }}
              >
                <FallbackImage sources={candidates} style={styles.gridThumb} />

                {/* Name */}
                <Text style={styles.gridCaption} numberOfLines={1}>
                  {c.name || "Card"}
                </Text>

                {/* Set name (matches Wishlist behavior) */}
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
        <Text style={styles.bodyText}>No cards to show.</Text>
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
    padding: 12,
    marginTop: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { color: COLORS.text, fontWeight: "900" },
  viewAll: { color: COLORS.accent, fontWeight: "800" },

  bodyText: { color: COLORS.text },

  // FlatList grid styles for fixed 2 columns
  gridList: {
    paddingBottom: 8,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: GAP,
  },
  gridItem: {
    width: "48%",
  },
  gridThumb: {
    width: "100%",
    aspectRatio: 63 / 88,
    backgroundColor: COLORS.alt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gridCaption: { color: COLORS.text, fontSize: 12, marginTop: 6, fontWeight: "800" },
  gridSubCaption: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});
