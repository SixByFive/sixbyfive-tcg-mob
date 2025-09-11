// app/(tabs)/collection.js
import { useMutation, useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import WishlistPlaceholder from "../../components/collection/WishlistPlaceholder";
import PageHeader from "../../components/common/PageHeader";
import useToast from "../../hooks/useToast";
import { COLORS } from "../../theme/colors";
import { filterBinders } from "../../utils/collectionFilters";

import {
  MyBindersDocument,
  MyCollectionDocument,
  RemoveFromCollectionDocument,
  UpdateCollectionEntryDocument,
} from "@sixbyfive/tcg-binder/client";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";

/* --- prices normalizer --- */
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

export default function CollectionTab() {
  const router = useRouter();
  const toast = useToast();

  const [segment, setSegment] = useState("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // editor state
  const [editing, setEditing] = useState(null); // card row being edited
  const [savingEdit, setSavingEdit] = useState(false);

  const [removing, setRemoving] = useState(null); // card row for removal quantity picker
  const [savingRemoval, setSavingRemoval] = useState(false);

  const { data: meData, loading: meLoading, error: meError } = useMeQuery({ fetchPolicy: "cache-first" });

  const {
    data: collData,
    loading: collLoading,
    error: collError,
    refetch: refetchCollection,
    networkStatus: collNS,
    client,
  } = useQuery(MyCollectionDocument, {
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
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

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

  const filteredBinders = useMemo(
    () => filterBinders(allBinders, query),
    [allBinders, query]
  );

  const stats = { cards: collectionCards.length, binders: allBinders.length, wishlist: 0 };

  const anyLoading =
    (meLoading && !meData) || (collLoading && !collData) || (bindersLoading && !bindersData);
  const anyError = meError || collError || bindersError;
  const isRefetching = collNS === 4 || bindersNS === 4;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([refetchCollection?.(), refetchBinders?.()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchCollection, refetchBinders]);

  // mutations
  const [updateEntry] = useMutation(UpdateCollectionEntryDocument);
  const [removeEntry] = useMutation(RemoveFromCollectionDocument);

  const writeOptimisticMyCollection = (nextList) => {
    try {
      client.writeQuery({ query: MyCollectionDocument, data: { myCollection: nextList } });
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
          condition, // schema usually accepts this; harmless if server ignores
        },
      });
      toast.show("Saved", { type: "success" });
      onCloseEdit();
    } catch (e) {
      await refetchCollection?.();
      toast.show(e?.graphQLErrors?.[0]?.message || e?.message || "Failed to save", {
        type: "error",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // remove N copies (if API supports quantity in RemoveFromCollection; else fallback to update)
  const handleRemoveQuantity = async (card, removeQty) => {
    const current = myCollection.find((e) => e.card?.id === card.id);
    if (!current) return;

    const curQty = Number(current.quantity ?? 1) || 1;
    const nextQty = Math.max(0, curQty - Number(removeQty || 0));
    const variation = String(current.variation ?? "normal");

    setSavingRemoval(true);

    // optimistic list: if nextQty === 0 remove entry; else update qty
    const optimistic =
      nextQty === 0
        ? myCollection.filter((e) => e.card?.id !== card.id)
        : myCollection.map((e) => (e.card?.id === card.id ? { ...e, quantity: nextQty } : e));

    try {
      writeOptimisticMyCollection(optimistic);

      // Try RemoveFromCollection with a quantity param first
      const tryRemoveWithQuantity = async () => {
        try {
          await removeEntry({
            variables: {
              cardId: String(card.id),
              variation,
              quantity: Number(removeQty), // if server ignores, it won't break
            },
          });
          return true;
        } catch (err) {
          // If the server rejects because quantity isn't allowed, fall back
          return false;
        }
      };

      const ok = await tryRemoveWithQuantity();
      if (!ok) {
        // Fallback: just update to the reduced quantity
        await updateEntry({
          variables: {
            cardId: String(card.id),
            quantity: nextQty,
            variation,
          },
        });
      }

      toast.show(nextQty === 0 ? "Removed from collection" : "Quantity updated", {
        type: "success",
      });
      setRemoving(null);
    } catch (e) {
      await refetchCollection?.();
      toast.show(e?.graphQLErrors?.[0]?.message || e?.message || "Failed to remove", {
        type: "error",
      });
    } finally {
      setSavingRemoval(false);
    }
  };

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
            {(meError || collError || bindersError)?.message}
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
                onEdit={() => onEdit(item)}
                onRemove={() => onRemove(item)}
              />
            );
          }}
          ListFooterComponent={<View style={{ height: 12 }} />}
        />
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
