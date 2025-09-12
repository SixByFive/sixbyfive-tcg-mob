// app/(tabs)/collection.js

// CHANGED: useApolloClient for imperative queries; remove gql/useLazyQuery
import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
  AddToCollectionDocument,
  CardByIdDocument,
  MyBindersDocument,
  MyCollectionDocument,
  RemoveFromCollectionDocument,
  RemoveFromWishlistDocument,
  // NEW: hydrate via SDK-provided queries
  SearchCardsDocument,
  UpdateCollectionEntryDocument,
  WishlistDocument,
} from "@sixbyfive/tcg-binder/client"; // :contentReference[oaicite:1]{index=1}
import { useMeQuery } from "@sixbyfive/tcg-binder/react";

/* -------------------- Price normalizers (unchanged) -------------------- */
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

/* -------------------- Wishlist read helpers (minimal) -------------------- */
// NOTE: Based on your logs: { wishlist: { entries, total, page, pageSize } }
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

/* -------------------- Cache update helper (SIMPLIFIED) -------------------- */
// assumes { wishlist: { entries: [...], total } }
function removeWishlistCardInCache(cache, userId, cardId) {
  try {
    const variables = { userId, page: 1, pageSize: 200 };
    const prev = cache.readQuery({ query: WishlistDocument, variables });
    if (!prev?.wishlist) return;

    const before = prev.wishlist;
    const filtered = (before.entries || []).filter((entry) => {
      const node = entry?.node ?? entry;
      const idFromEntry = node?.card?.id || node?.cardId || node?.id;
      return String(idFromEntry) !== String(cardId);
    });

    cache.writeQuery({
      query: WishlistDocument,
      variables,
      data: {
        ...prev,
        wishlist: {
          ...before,
          entries: filtered,
          total:
            typeof before.total === "number"
              ? Math.max(0, filtered.length)
              : before.total,
        },
      },
    });
  } catch {
    /* ignore cache miss */
  }
}

/* -------------------- Search results readers (NEW) -------------------- */
// These let us support several likely shapes without giant if/elses.
function readCardsFromSearch(data) {
  if (!data) return [];
  // common direct arrays
  if (Array.isArray(data.searchCards)) return data.searchCards;
  if (Array.isArray(data.cards)) return data.cards;
  if (Array.isArray(data.results)) return data.results;

  // connection shapes
  const conn = data.searchCardsConnection;
  if (conn?.edges && Array.isArray(conn.edges)) {
    return conn.edges.map((e) => e?.node).filter(Boolean);
  }
  if (conn?.nodes && Array.isArray(conn.nodes)) {
    return conn.nodes;
  }
  return [];
}
function toCardIdMap(list) {
  const map = new Map();
  for (const c of list || []) {
    if (c?.id) map.set(String(c.id), c);
  }
  return map;
}

export default function CollectionTab() {
  const router = useRouter();
  const toast = useToast();
  const apollo = useApolloClient(); // NEW

  const [segment, setSegment] = useState("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // editor state
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [removing, setRemoving] = useState(null);
  const [savingRemoval, setSavingRemoval] = useState(false);

  // NEW: local store for hydrated cards (replaces useLazyQuery state)
  const [cardsByIdMap, setCardsByIdMap] = useState(() => new Map());
  const [hydrating, setHydrating] = useState(false); // tiny inline spinner only
  const hydratedIdsRef = useRef(new Set());
  const inFlightRef = useRef(false);

  // current user id
  const { data: meData, loading: meLoading, error: meError } = useMeQuery({ fetchPolicy: "cache-first" });
  const userId = meData?.me?.id ?? null;

  /* -------------------- QUERIES -------------------- */
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
    variables: { userId },
    skip: !userId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  // Wishlist (server paginates)
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

  /* -------------------- DERIVED DATA -------------------- */
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

  const allBinders = useMemo(
    () => (Array.isArray(bindersData?.myBinders) ? bindersData.myBinders : []),
    [bindersData?.myBinders]
  );

  const filteredBinders = useMemo(() => filterBinders(allBinders, query), [allBinders, query]);

  // Wishlist roots/lists
  const wishlistRoot = useMemo(() => readWishlistRoot(wishlistData), [wishlistData]);
  const wishlistRawList = useMemo(() => readWishlistList(wishlistRoot), [wishlistRoot]);
  const wishlistServerTotal = useMemo(() => readWishlistServerTotal(wishlistRoot), [wishlistRoot]);

  // Card IDs that need hydration
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

  /* -------------------- HYDRATION (ALT via SearchCards + fallback) ---- */
  const HYDRATE_BATCH = 50;

  const hydrateIdsOnce = useCallback(
    async (ids) => {
      // Dedup against what we already have in state/ref
      const missing = ids.filter((id) => !hydratedIdsRef.current.has(id) && !cardsByIdMap.has(id));
      if (missing.length === 0) return;

      // Chunk work
      const chunks = [];
      for (let i = 0; i < missing.length; i += HYDRATE_BATCH) {
        chunks.push(missing.slice(i, i + HYDRATE_BATCH));
      }

      setHydrating(true);
      try {
        for (const chunk of chunks) {
          // 1) Try SearchCards with three shapes until one returns cards
          let cards = [];
          const tryVars = [
            { ids: chunk },                 // e.g. query SearchCards(ids:[ID!]!)
            { where: { ids: chunk } },      // e.g. SearchCards(where:{ ids:[ID!]! })
            { filter: { ids: chunk } },     // e.g. SearchCards(filter:{ ids:[ID!]! })
          ];

          for (const v of tryVars) {
            try {
              const { data } = await apollo.query({
                query: SearchCardsDocument, // from SDK exports
                variables: v,
                fetchPolicy: "network-only",
              });
              const list = readCardsFromSearch(data);
              if (list.length) {
                cards = list;
                break;
              }
            } catch {
              // swallow and try next shape
            }
          }

          // 2) If search didn’t return all, fill gaps with CardByIdDocument
          const gotMap = toCardIdMap(cards);
          const gaps = chunk.filter((id) => !gotMap.has(id));
          if (gaps.length) {
            const singles = await Promise.all(
              gaps.map((id) =>
                apollo
                  .query({
                    query: CardByIdDocument, // from SDK exports
                    variables: { id },
                    fetchPolicy: "network-only",
                  })
                  .then((r) => r?.data?.cardById || null)
                  .catch(() => null)
              )
            );
            for (const c of singles) {
              if (c?.id) gotMap.set(String(c.id), c);
            }
          }

          // 3) Merge into local map + mark hydrated
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

  // Try again after render cycles if there are still gaps (e.g., after refetch)
  useEffect(() => {
    if (segment !== "wishlist") return;
    const missing = allWishlistIds.filter(
      (id) => !hydratedIdsRef.current.has(id) && !cardsByIdMap.has(id)
    );
    if (missing.length) kickHydration();
  }, [segment, allWishlistIds, cardsByIdMap, kickHydration]);

  /* -------------------- Build display list (placeholders allowed) ----- */
  const wishlistDisplayItems = useMemo(() => {
    return wishlistRawList.map((it) => {
      const node = it?.node ?? it;
      const variation = typeof node?.variation === "string" ? node.variation : "normal";
      const inlineCard = node?.card ?? null;
      const cid = node?.cardId || node?.card?.id || node?.id || null;
      const joinedCard = !inlineCard && cid ? cardsByIdMap.get(String(cid)) : null;
      const card = inlineCard || joinedCard;

      if (!card) {
        return {
          id: String(cid || Math.random()),
          name: "Loading…",
          set: "",
          setName: "",
          number: "",
          image: "",
          rarity: "",
          prices: [],
          _wishlist: { variation: String(variation) },
          _placeholder: true,
        };
      }

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
        _wishlist: { variation: String(variation) },
      };
    });
  }, [wishlistRawList, cardsByIdMap]);

  /* -------------------- Stats -------------------- */
  const stats = {
    cards: collectionCards.length,
    binders: allBinders.length,
    wishlist: wishlistServerTotal,
  };

  /* -------------------- Loading/Error/Refresh -------------------------- */
  const anyLoading =
    (meLoading && !meData) ||
    !userId ||
    (collLoading && !collData) ||
    (bindersLoading && !bindersData) ||
    wishlistLoading; // NOTE: not blocking on hydration

  const anyError = meError || collError || bindersError || wishlistError;
  const isRefetching = collNS === 4 || bindersNS === 4 || wishlistNS === 4;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refetchCollection?.(),
        refetchBinders?.(),
        refetchWishlist?.({ userId, page: 1, pageSize: 200 }),
      ]);
      // Reset hydration state after a fresh server read
      hydratedIdsRef.current = new Set();
      setCardsByIdMap(new Map());
      if (segment === "wishlist") kickHydration();
    } finally {
      setRefreshing(false);
    }
  }, [refetchCollection, refetchBinders, refetchWishlist, userId, segment, kickHydration]);

  /* -------------------- Mutations (unchanged) -------------------- */
  const [updateEntry] = useMutation(UpdateCollectionEntryDocument);
  const [removeEntry] = useMutation(RemoveFromCollectionDocument);
  const [addToCollection] = useMutation(AddToCollectionDocument);
  const [removeFromWishlist] = useMutation(RemoveFromWishlistDocument);

  const writeOptimisticMyCollection = (nextList) => {
    try {
      client.writeQuery({
        query: MyCollectionDocument,
        variables: { userId },
        data: { myCollection: nextList },
      });
    } catch {}
  };

  const writeOptimisticWishlistRemove = (cardIdToRemove) => {
    try {
      removeWishlistCardInCache(wishlistClient ?? client, userId, String(cardIdToRemove));
    } catch {}
  };

  // open edit modal
  const onEdit = (card) => setEditing(card);
  const onCloseEdit = () => setEditing(null);

  // open remove modal
  const onRemove = (card) => {
    const qty = Number(card?._collection?.quantity ?? 1) || 1;
    if (qty > 1) setRemoving(card);
    else handleRemoveQuantity(card, 1);
  };
  const onCloseRemove = () => setRemoving(null);

  // save edit (quantity + condition)
  const handleSaveEdit = async ({ quantity, condition }) => {
    if (!editing?.id) return;
    const current = myCollection.find((e) => e.card?.id === editing.id);
    if (!current) return;

    setSavingEdit(true);
    const variation = String(current.variation ?? "normal");
    const optimistic = myCollection.map((e) =>
      e.card?.id === editing.id ? { ...e, quantity, condition } : e
    );

    try {
      writeOptimisticMyCollection(optimistic);
      await updateEntry({
        variables: {
          cardId: String(editing.id),
          quantity: Number(quantity),
          variation,
          condition,
        },
      });
      toast.show("Saved", { type: "success" });
      onCloseEdit();
    } catch (e) {
      await refetchCollection?.();
      toast.show(e?.graphQLErrors?.[0]?.message || e?.message || "Failed to save", { type: "error" });
    } finally {
      setSavingEdit(false);
    }
  };

  // remove N copies
  const handleRemoveQuantity = async (card, removeQty) => {
    const current = myCollection.find((e) => e.card?.id === card.id);
    if (!current) return;

    const curQty = Number(current.quantity ?? 1) || 1;
    const nextQty = Math.max(0, curQty - Number(removeQty || 0));
    const variation = String(current.variation ?? "normal");

    setSavingRemoval(true);

    const optimistic =
      nextQty === 0
        ? myCollection.filter((e) => e.card?.id !== card.id)
        : myCollection.map((e) => (e.card?.id === card.id ? { ...e, quantity: nextQty } : e));

    try {
      writeOptimisticMyCollection(optimistic);

      const ok = await (async () => {
        try {
          await removeEntry({
            variables: { cardId: String(card.id), variation, quantity: Number(removeQty) },
          });
          return true;
        } catch {
          return false;
        }
      })();

      if (!ok) {
        await updateEntry({ variables: { cardId: String(card.id), quantity: nextQty, variation } });
      }

      toast.show(nextQty === 0 ? "Removed from collection" : "Quantity updated", { type: "success" });
      setRemoving(null);
    } catch (e) {
      await refetchCollection?.();
      toast.show(e?.graphQLErrors?.[0]?.message || e?.message || "Failed to remove", { type: "error" });
    } finally {
      setSavingRemoval(false);
    }
  };

  // Remove from wishlist
  const handleRemoveFromWishlist = async (card) => {
    const variation = String(card?._wishlist?.variation ?? "normal");
    writeOptimisticWishlistRemove(card.id);
    try {
      await removeFromWishlist({
        variables: { cardId: String(card.id), variation },
        optimisticResponse: {
          removeFromWishlist: { __typename: "RemoveFromWishlistPayload", ok: true },
        },
        update: (cache) => removeWishlistCardInCache(cache, userId, String(card.id)),
      });
      toast.show("Removed from wishlist", { type: "success" });
    } catch (e) {
      await refetchWishlist?.({ userId, page: 1, pageSize: 200 });
      toast.show(e?.graphQLErrors?.[0]?.message || e?.message || "Failed to remove", { type: "error" });
    }
  };

  // Move to collection then remove from wishlist
  const handleMoveToCollection = async (card) => {
    const variation = String(card?._wishlist?.variation ?? "normal");
    try {
      await addToCollection({ variables: { cardId: String(card.id), variation, quantity: 1 } });
      writeOptimisticWishlistRemove(card.id);
      await removeFromWishlist({
        variables: { cardId: String(card.id), variation },
        optimisticResponse: {
          removeFromWishlist: { __typename: "RemoveFromWishlistPayload", ok: true },
        },
        update: (cache) => removeWishlistCardInCache(cache, userId, String(card.id)),
      });
      refetchCollection?.();
      toast.show("Moved to collection", { type: "success" });
    } catch (e) {
      await Promise.allSettled([refetchWishlist?.({ userId, page: 1, pageSize: 200 }), refetchCollection?.()]);
      toast.show(e?.graphQLErrors?.[0]?.message || e?.message || "Failed to move", { type: "error" });
    }
  };

  /* -------------------- RENDER -------------------- */
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

      {anyLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : anyError ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.error, textAlign: "center", paddingHorizontal: 24 }}>
            {(meError || collError || bindersError || wishlistError)?.message}
          </Text>
        </View>
      ) : segment === "binders" ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl tintColor={COLORS.accent} refreshing={refreshing || isRefetching} onRefresh={onRefresh} />
          }
        >
          <BinderGrid
            binders={filteredBinders}
            onCreate={() => router.push("/binders/new")}
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
            <RefreshControl tintColor={COLORS.accent} refreshing={refreshing || isRefetching} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => {
            const normalizedPrices = Array.isArray(item?.prices) ? item.prices : Array.isArray(item?.pricing) ? item.pricing : [];
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
                onEdit={() => onEdit(item)}
                onRemove={() => onRemove(item)}
              />
            );
          }}
          ListFooterComponent={<View style={{ height: 12 }} />}
        />
      ) : /* segment === 'wishlist' */ wishlistHasData ? (
        <>
          {/* Small inline spinner while hydration runs; not blocking */}
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
              <RefreshControl tintColor={COLORS.accent} refreshing={refreshing || isRefetching} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => {
              const normalizedPrices = Array.isArray(item?.prices) ? item.prices : Array.isArray(item?.pricing) ? item.pricing : [];
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
                        prices: JSON.stringify(normalizedPrices),
                      },
                    })
                  }
                  onMoveToCollection={() => handleMoveToCollection(item)}
                  onRemoveFromWishlist={() => handleRemoveFromWishlist(item)}
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
            <RefreshControl tintColor={COLORS.accent} refreshing={refreshing || isRefetching} onRefresh={onRefresh} />
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
        onClose={onCloseEdit}
        card={editing}
        saving={savingEdit}
        onSubmit={handleSaveEdit}
      />
      <RemoveQuantityModal
        visible={!!removing}
        onClose={onCloseRemove}
        card={removing}
        removing={savingRemoval}
        onConfirm={(qty) => handleRemoveQuantity(removing, qty)}
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
});
