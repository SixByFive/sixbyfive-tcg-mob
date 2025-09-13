// components/home/SnapshotCard.js
// Live counts from queries with graceful fallbacks/overrides.

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

import { useQuery } from "@apollo/client";
import {
  MyBindersDocument,
  MyCollectionDocument,
  MyWishlistDocument, // ← correct doc name
} from "@sixbyfive/tcg-binder/client";

/* wishlist helpers */
function wlRoot(data) {
  return data?.myWishlist ?? data?.wishlist ?? {};
}
function wlList(root) {
  return Array.isArray(root.entries) ? root.entries : [];
}
function wlTotal(root, listLen = 0) {
  const n = root.total ?? root.totalCount ?? root.count ?? listLen ?? 0;
  return Number(n) || 0;
}

function Stat({ label, value }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default function SnapshotCard({
  loading,
  user,

  // optional explicit overrides
  cardsCount,
  bindersCount,
  wishlistCount,
}) {
  // 🔄 Always query for the signed-in user on the home snapshot
  const { data: colData } = useQuery(MyCollectionDocument, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });
  const { data: bindersData } = useQuery(MyBindersDocument, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });
  const { data: wlData } = useQuery(MyWishlistDocument, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const { cards, binders, wishlist } = useMemo(() => {
    const has = (v) => typeof v === "number" && !Number.isNaN(v);

    const cardsFromQ = Array.isArray(colData?.myCollection)
      ? colData.myCollection.length
      : undefined;

    const bindersFromQ = Array.isArray(bindersData?.myBinders)
      ? bindersData.myBinders.length
      : undefined;

    const root = wlRoot(wlData);
    const wishlistFromQ = wlTotal(root, wlList(root).length);

    const stats = user?.stats ?? {};
    const cardsFromUser = Number(stats.totalCards ?? stats.cards ?? 0) || 0;
    const bindersFromUser = Number(stats.binders ?? 0) || 0;
    const wishlistFromUser = Number(stats.wishlist ?? 0) || 0;

    return {
      cards:
        (has(cardsCount) ? cardsCount : undefined) ??
        (has(cardsFromQ) ? cardsFromQ : undefined) ??
        cardsFromUser,
      binders:
        (has(bindersCount) ? bindersCount : undefined) ??
        (has(bindersFromQ) ? bindersFromQ : undefined) ??
        bindersFromUser,
      wishlist:
        (has(wishlistCount) ? wishlistCount : undefined) ??
        (has(wishlistFromQ) ? wishlistFromQ : undefined) ??
        wishlistFromUser,
    };
  }, [cardsCount, bindersCount, wishlistCount, user, colData, bindersData, wlData]);

  const show = (n) =>
    loading && !user ? "…" : Intl.NumberFormat().format(Number(n || 0));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your snapshot</Text>
      <View style={styles.row}>
        <Stat label="Cards" value={show(cards)} />
        <Stat label="Binders" value={show(binders)} />
        <Stat label="Wishlist" value={show(wishlist)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  title: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  row: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  value: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  label: { color: COLORS.textMuted, marginTop: 2 },
});
