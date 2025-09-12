// components/profile/tabs/WishlistTab.js

// CHANGED: robust normalization, profile-aware fetching, and lazy hydration by cardId.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";
import WishlistGrid from "../WishlistGrid";

// NEW: Apollo + docs for any user's wishlist + my wishlist + single-card hydration
import { useLazyQuery, useQuery } from "@apollo/client";
import { CardByIdDocument, MyWishlistDocument, WishlistDocument } from "@sixbyfive/tcg-binder/client"; // any user’s wishlist

/* --------------------- helpers (normalizers) --------------------- */
// safe getter
function get(obj, path) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

// flatten containers
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

// unwrap `{node, card}` shapes
function unwrapEntry(item) {
  const n = item?.node ?? item;
  const card = n?.card ?? null;
  return { entry: n, card };
}

// normalize to what WishlistGrid expects
function normalizeWishlistItem(item, hydratedMap) {
  const { entry, card: inlineCard } = unwrapEntry(item);

  // pick a card id from card or entry
  const cid = inlineCard?.id ?? entry?.cardId ?? entry?.id ?? item?.id;
  if (!cid) return null;

  const hydrated = hydratedMap?.get?.(String(cid));
  const card = inlineCard || hydrated || {};

  const prices = Array.isArray(card?.prices)
    ? card.prices
    : Array.isArray(card?.pricing)
    ? card.pricing
    : [];

  const setName = card?.setName ?? get(card, "set.name") ?? card?.set ?? "";
  const number = card?.number ?? card?.collectorNumber ?? undefined;

  const image =
    card?.image ??
    card?.imageUrl ??
    get(card, "images.small") ??
    get(card, "images.large") ??
    "";

  const variation = typeof entry?.variation === "string" ? entry.variation : "normal";

  // Provide a minimal placeholder if we still don’t have the card object
  const name = card?.name ?? entry?.name ?? "Card";

  return {
    id: String(cid),
    name,
    image,
    setName,
    number,
    prices,
    _wishlist: { variation },
  };
}

// normalize ANY incoming `items` (array or connection-ish object)
function normalizeItemsInput(itemsProp, hydratedMap) {
  if (!itemsProp) return [];
  if (!Array.isArray(itemsProp) && typeof itemsProp === "object") {
    const candidates = ["items", "entries", "results", "edges", "nodes", "data", "wishlist", "myWishlist"];
    for (const k of candidates) {
      if (itemsProp[k]) return toArray(itemsProp[k]).map((x) => normalizeWishlistItem(x, hydratedMap)).filter(Boolean);
    }
    return toArray(itemsProp).map((x) => normalizeWishlistItem(x, hydratedMap)).filter(Boolean);
  }
  return toArray(itemsProp).map((x) => normalizeWishlistItem(x, hydratedMap)).filter(Boolean);
}

/* --------------------- component --------------------- */
export default function WishlistTab({
  // NEW: props to mirror CardsTab behaviour
  title = "Wishlist",
  items = [],             // loose shapes accepted
  userId,                 // profile user id; if provided and items empty → fetch
  onOpenCard,
  onViewAll,              // optional “View all” CTA
  pageSize = 24,
  loading = false,        // external loading flag (optional)
}) {
  // hydrated cards map (id → card)
  const [hydratedMap, setHydratedMap] = useState(() => new Map());
  const hydratedIdsRef = useRef(new Set());
  const inflightRef = useRef(false);

  // 1) normalize prop items first
  const normalizedFromProp = useMemo(() => normalizeItemsInput(items, hydratedMap), [items, hydratedMap]);

  // 2) fetch this profile user's wishlist if props are empty
  const shouldFetchProfile = normalizedFromProp.length === 0 && !!userId;
  const {
    data: wlData,
    loading: fetchingProfile,
    error: wlError,
  } = useQuery(WishlistDocument, {
    variables: { userId, page: 1, pageSize },
    skip: !shouldFetchProfile,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  // 3) fallback to my wishlist if no userId (owner)
  const shouldFetchMine = normalizedFromProp.length === 0 && !userId;
  const {
    data: myWlData,
    loading: fetchingMine,
    error: myWlError,
  } = useQuery(MyWishlistDocument, {
    skip: !shouldFetchMine,
    fetchPolicy: "cache-and-network",
  });

  // 4) normalize fetched wishlist (supports { wishlist: { entries } } or arrays)
  const normalizedFromFetch = useMemo(() => {
    const root = wlData?.wishlist ?? myWlData?.myWishlist ?? wlData ?? myWlData ?? {};
    const flat = toArray(root);
    return flat.map((x) => normalizeWishlistItem(x, hydratedMap)).filter(Boolean);
  }, [wlData, myWlData, hydratedMap]);

  // 5) choose items to display (prop wins)
  const displayItems = (normalizedFromProp.length ? normalizedFromProp : normalizedFromFetch).slice(0, pageSize);

  // 6) build a list of ids that still need hydration (no inline card + not hydrated yet)
  const idsNeedingHydration = useMemo(() => {
    const ids = [];
    const seen = new Set();
    const source = normalizedFromProp.length ? toArray(items) : toArray(wlData?.wishlist ?? myWlData?.myWishlist ?? {});
    for (const it of source) {
      const n = it?.node ?? it;
      const card = n?.card;
      const cid = card?.id ?? n?.cardId ?? n?.id;
      if (!cid) continue;
      const key = String(cid);
      if (!card && !hydratedIdsRef.current.has(key) && !seen.has(key)) {
        ids.push(key);
        seen.add(key);
      }
    }
    return ids;
  }, [items, normalizedFromProp.length, wlData, myWlData]);

  // 7) lazy single-card hydration by id (sequential, small batches)
  const [fetchCardById] = useLazyQuery(CardByIdDocument, { fetchPolicy: "cache-first" });
  useEffect(() => {
    if (!idsNeedingHydration.length) return;
    if (inflightRef.current) return;

    inflightRef.current = true;
    (async () => {
      try {
        for (const id of idsNeedingHydration) {
          // guard re-entrancy / dedupe
          if (hydratedIdsRef.current.has(id)) continue;
          const { data } = await fetchCardById({ variables: { id } });
          const card = data?.card ?? data?.cardById ?? data?.Card ?? null;
          if (card?.id) {
            hydratedIdsRef.current.add(id);
            setHydratedMap((prev) => {
              const next = new Map(prev);
              next.set(String(card.id), card);
              return next;
            });
          } else {
            // even if not found, mark as attempted to avoid loops
            hydratedIdsRef.current.add(id);
          }
        }
      } finally {
        inflightRef.current = false;
      }
    })();
  }, [idsNeedingHydration, fetchCardById]);

  // loading state: we never block the grid for hydration
  const showSkeleton = (loading || fetchingProfile || fetchingMine) && normalizedFromProp.length === 0;
  const hasError = wlError || myWlError;

  // DEV: quick insight
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[WishlistTab] source:", {
      propCount: normalizedFromProp.length,
      fetchedCount: normalizedFromFetch.length,
      displayCount: displayItems.length,
      needsHydration: idsNeedingHydration.length,
      via: normalizedFromProp.length ? "prop" : shouldFetchProfile ? "WishlistDocument" : "MyWishlistDocument",
      errors: { wlError: wlError?.message, myWlError: myWlError?.message },
    });
  }

  // --- render ---
  if (displayItems.length) {
    return (
      <>
        {/* optional compact header */}
        {typeof onViewAll === "function" && (
          <View style={[styles.card, { paddingVertical: 8, marginBottom: 8 }]}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text onPress={onViewAll} style={styles.viewAll}>View all →</Text>
            </View>
          </View>
        )}

        {/* small top spinner only while hydration runs (doesn't block the grid) */}
        {idsNeedingHydration.length > 0 && (
          <View style={{ paddingVertical: 4, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        )}

        <WishlistGrid items={displayItems} onOpenCard={onOpenCard} />
      </>
    );
  }

  if (showSkeleton) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={{ height: 120, borderRadius: 10, backgroundColor: COLORS.alt, opacity: 0.5 }} />
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.bodyText}>Failed to load wishlist.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.bodyText}>No wishlist items yet.</Text>
    </View>
  );
}

/* --------------------- styles --------------------- */
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  viewAll: { color: COLORS.accent, fontWeight: "800" },
  bodyText: { color: COLORS.text },
});
