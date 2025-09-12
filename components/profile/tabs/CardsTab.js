// CHANGED: fetch another user's cards using CollectionDocument when `cards` is empty.
import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";

// NEW: use Apollo query + correct document for arbitrary user
import { useQuery } from "@apollo/client";
import { CollectionDocument, MyCollectionDocument } from "@sixbyfive/tcg-binder/client"; // ← NEW (for arbitrary user)

const GRID = 3;

/* --------------------- helpers (normalizers) --------------------- */
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
  // one nested layer
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

  const setName = raw?.setName ?? get(raw, "set.name") ?? raw?.set ?? "";
  return {
    id: String(id),
    name: raw?.name ?? raw?.cardName ?? "Card",
    image: raw?.image ?? raw?.imageUrl ?? get(raw, "images.small") ?? get(raw, "images.large") ?? "",
    setName,
    number: raw?.number ?? raw?.collectorNumber ?? undefined,
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

export default function CardsTab({
  title = "Cards",
  cards = [],             // may be flat or connection-like; normalized below
  userId,                 // NEW: profile user id to fetch if cards is empty
  onOpenCard,
  onViewAll,
  pageSize = 24,
  loading = false,
}) {
  // 1) normalize what was passed in
  const normalizedFromProp = useMemo(() => normalizeCardsInput(cards), [cards]);

  // 2) if prop is empty but userId exists, fetch THAT user's collection (not "my" collection)
  const shouldFetchProfile = normalizedFromProp.length === 0 && !!userId;
  const {
    data: collectionData,
    loading: fetchingProfile,
    error: collectionError,
  } = useQuery(CollectionDocument, {
    // NOTE: these vars match your other usage in the app (page/pageSize) and won't break if server ignores extras
    variables: { userId, page: 1, pageSize: pageSize },
    skip: !shouldFetchProfile,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  // 3) last resort (owner’s own profile) — only if nothing else worked and no userId provided
  const shouldFetchMine = normalizedFromProp.length === 0 && !userId;
  const {
    data: myData,
    loading: fetchingMine,
    error: myError,
  } = useQuery(MyCollectionDocument, {
    skip: !shouldFetchMine,
    fetchPolicy: "cache-and-network",
  });

  // 4) normalize fetched results (handles { collection: { entries|edges|nodes } } or array)
  const normalizedFromFetch = useMemo(() => {
    if (collectionData?.collection) {
      return toArray(collectionData.collection).map(normalizeCard).filter(Boolean);
    }
    if (myData?.myCollection) {
      return toArray(myData.myCollection).map(normalizeCard).filter(Boolean);
    }
    // some APIs return the list at root
    return toArray(collectionData || myData).map(normalizeCard).filter(Boolean);
  }, [collectionData, myData]);

  // 5) choose the list to display
  const displayCards = (normalizedFromProp.length ? normalizedFromProp : normalizedFromFetch).slice(
    0,
    pageSize
  );

  const showSkeleton =
    (loading || fetchingProfile || fetchingMine) && normalizedFromProp.length === 0;

  // DEV logs so you can see which path was used (safe to keep or remove)
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[CardsTab] source:", {
      propCount: normalizedFromProp.length,
      fetchedCount: normalizedFromFetch.length,
      used: displayCards.length,
      via: normalizedFromProp.length ? "prop" : shouldFetchProfile ? "CollectionDocument" : "MyCollectionDocument",
      errors: {
        collectionError: collectionError?.message,
        myError: myError?.message,
      },
    });
  }

  const skeleton = Array.from({ length: GRID * 3 }, (_, i) => ({ id: `sk-${i}` }));

  return (
    <View style={styles.card}>
      <View className="header" style={styles.headerRow}>
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
        <View style={styles.gridWrap}>
          {skeleton.map((s) => (
            <View key={s.id} style={styles.gridItem}>
              <View style={[styles.gridThumb, { opacity: 0.5 }]} />
              <View style={{ height: 14, marginTop: 6, borderRadius: 3, backgroundColor: COLORS.alt }} />
            </View>
          ))}
        </View>
      ) : displayCards.length ? (
        <View style={styles.gridWrap}>
          {displayCards.map((c) => (
            <Pressable
              key={String(c.id)}
              onPress={() => onOpenCard?.(c)}
              style={styles.gridItem}
              android_ripple={{ color: "#00000022" }}
            >
              {c.image ? (
                <Image source={{ uri: c.image }} style={styles.gridThumb} />
              ) : (
                <View style={styles.gridThumb} />
              )}
              <Text style={styles.gridCaption} numberOfLines={1}>
                {c.name || "Card"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.bodyText}>No cards to show.</Text>
      )}
    </View>
  );
}

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
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: `${100 / GRID - 2}%` },
  gridThumb: {
    width: "100%",
    aspectRatio: 63 / 88,
    backgroundColor: COLORS.alt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gridCaption: { color: COLORS.text, fontSize: 12, marginTop: 6 },
});
