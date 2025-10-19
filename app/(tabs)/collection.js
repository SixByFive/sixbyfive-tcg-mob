import { useApolloClient, useMutation, useQuery } from "@apollo/client";
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
  MyCollectionDocument,
  RemoveFromCollectionDocument,
  SearchCardsDocument,
  UpdateCollectionEntryDocument,
  WishlistDocument,
} from "@sixbyfive/tcg-binder/client";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";

/* ---------------- small helpers ---------------- */

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

// very forgiving array reader
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

/* ---------------- search helpers ---------------- */

function readCardsFromSearch(data) {
  if (!data) return [];
  if (Array.isArray(data.searchCards)) return data.searchCards;
  if (Array.isArray(data.cards)) return data.cards;
  if (Array.isArray(data.results)) return data.results;
  const conn = data.searchCardsConnection;
  if (conn?.edges && Array.isArray(conn.edges)) return conn.edges.map((e) => e?.node).filter(Boolean);
  if (conn?.nodes && Array.isArray(conn.nodes)) return conn.nodes;
  return [];
}
function toCardIdMap(list) {
  const map = new Map();
  for (const c of list || []) if (c?.id) map.set(String(c.id), c);
  return map;
}

/* ---------------- UI: subtle, full-width Create Binder banner ---------------- */

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

  const [segment, setSegment] = useState("binders"); // show binders first
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
    client,
  } = useQuery(MyCollectionDocument, {
    variables: { userId },
    skip: !userId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: bindersData,
    loading: bindersLoading,
    error: bindersError,
    refetch: refetchBinders,
    networkStatus: bindersNS,
  } = useQuery(MyBindersDocument, {
    variables: userId ? { userId, page: 1, pageSize: 50 } : { page: 1, pageSize: 50 },
    skip: false,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: wishlistData,
    loading: wishlistLoading,
    error: wishlistError,
    refetch: refetchWishlist,
    networkStatus: wishlistNS,
    client: wishlistClient,
  } = useQuery(WishlistDocument, {
    variables: { userId, page: 1, pageSize: 200 },
    skip: !userId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  /* -------- derived: collection cards -------- */

  const myCollection = useMemo(
    () => (Array.isArray(collData?.myCollection) ? collData.myCollection : []),
    [collData?.myCollection]
  );

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
        return {
          id: card.id,
          name: card.name,
          set: card.set,
          setName: card.setName,
          number: card.number,
          image: card.image,
          rarity: card.rarity,
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

  /* -------- derived: binders (just pass the raw list; grid will hydrate) -------- */

  const rawBindersList = useMemo(() => {
    const root = (!bindersData || Array.isArray(bindersData)) ? bindersData : (
      bindersData.myBinders ?? bindersData.binders ?? bindersData.items ?? bindersData.results ??
      bindersData.edges ?? bindersData.nodes ?? bindersData.data ?? bindersData.list ?? bindersData
    );
    return toArray(root);
  }, [bindersData]);

  const filteredBinders = useMemo(
    () => filterBinders(rawBindersList, query),
    [rawBindersList, query]
  );

  /* -------- derived: wishlist -------- */

  const wishlistRoot = useMemo(() => readWishlistRoot(wishlistData), [wishlistData]);
  const wishlistRawList = useMemo(() => readWishlistList(wishlistRoot), [wishlistRoot]);
  const wishlistServerTotal = useMemo(() => readWishlistServerTotal(wishlistRoot), [wishlistRoot]);

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

  /* -------- wishlist hydration (unchanged) -------- */

  const HYDRATE_BATCH = 50;
  const hydrateIdsOnce = useCallback(
    async (ids) => {
      const missing = ids.filter((id) => !hydratedIdsRef.current.has(id) && !cardsByIdMap.has(id));
      if (missing.length === 0) return;
      const chunks = [];
      for (let i = 0; i < missing.length; i += HYDRATE_BATCH) chunks.push(missing.slice(i, i + HYDRATE_BATCH));
      setHydrating(true);
      try {
        for (const chunk of chunks) {
          let cards = [];
          const tryVars = [{ ids: chunk }, { where: { ids: chunk } }, { filter: { ids: chunk } }];
          for (const v of tryVars) {
            try {
              const { data } = await apollo.query({
                query: SearchCardsDocument,
                variables: v,
                fetchPolicy: "network-only",
              });
              const list = readCardsFromSearch(data);
              if (list.length) {
                cards = list;
                break;
              }
            } catch {}
          }
          const gotMap = toCardIdMap(cards);
          const gaps = chunk.filter((id) => !gotMap.has(id));
          if (gaps.length) {
            const singles = await Promise.all(
              gaps.map((id) =>
                apollo
                  .query({
                    query: CardByIdDocument,
                    variables: { id },
                    fetchPolicy: "network-only",
                  })
                  .then((r) => r?.data?.cardById || r?.data?.card || null)
                  .catch(() => null)
              )
            );
            for (const c of singles) if (c?.id) gotMap.set(String(c.id), c);
          }
          if (gotMap.size) {
            setCardsByIdMap((prev) => {
              const next = new Map(prev);
              for (const [id, card] of gotMap) {
                next.set(id, card);
                hydratedIdsRef.current.add(id);
              }
              return next;
            });
          }
        }
      } finally {
        setHydrating(false);
      }
    },
    [apollo, cardsByIdMap]
  );

  const kickHydration = useCallback(() => {
    if (inFlightRef.current) return;
    if (!allWishlistIds.length) return;
    inFlightRef.current = true;
    hydrateIdsOnce(allWishlistIds).finally(() => {
      inFlightRef.current = false;
    });
  }, [allWishlistIds, hydrateIdsOnce]);

  useEffect(() => {
    if (segment !== "wishlist") return;
    kickHydration();
  }, [segment, kickHydration]);

  useEffect(() => {
    if (segment !== "wishlist") return;
    const missing = allWishlistIds.filter((id) => !hydratedIdsRef.current.has(id) && !cardsByIdMap.has(id));
    if (missing.length) kickHydration();
  }, [segment, allWishlistIds, cardsByIdMap, kickHydration]);

  /* -------- stats -------- */

  const stats = {
    cards: collectionCards.length,
    binders: filteredBinders.length, // count what we show
    wishlist: wishlistServerTotal,
  };

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
      ? (bindersLoading && !bindersData)
      : segment === "all"
      ? (collLoading && !collData)
      : (wishlistLoading && !wishlistData);

  const errorBySegment =
    segment === "binders" ? bindersError : segment === "all" ? collError : wishlistError;

  const isRefetching = collNS === 4 || bindersNS === 4 || wishlistNS === 4;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refetchCollection?.(),
        refetchBinders?.(),
        refetchWishlist?.({ userId, page: 1, pageSize: 200 }),
      ]);
      hydratedIdsRef.current = new Set();
      setCardsByIdMap(new Map());
      if (segment === "wishlist") kickHydration();
    } finally {
      setRefreshing(false);
    }
  }, [refetchCollection, refetchBinders, refetchWishlist, userId, segment, kickHydration]);

  /* -------- render -------- */

  const wishlistHasData = wishlistServerTotal > 0;

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
          {/* Subtle, full-width action matching search-bar height */}
          <CreateBinderBanner onPress={() => router.push("/binder/new")} />

          {/* BinderGrid hydrates each tile with BinderDocument */}
          <BinderGrid
            binders={filteredBinders}
            onCreate={() => router.push("/binder/new")}
            onOpen={(id) => router.push(`/binder/${id}`)}
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
            data={Array.from(cardsByIdMap.values())}
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
    height: 44, // similar to a search bar height
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
