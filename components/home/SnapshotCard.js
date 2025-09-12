// components/home/SnapshotCard.js

// CHANGED: read live counts from Apollo cache with graceful fallbacks.
// You can still pass explicit counts via props to override everything.

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

// NEW: pull from your generated docs + apollo client
import { useApolloClient } from "@apollo/client";
import {
  MyBindersDocument,
  MyCollectionDocument,
  WishlistDocument,
} from "@sixbyfive/tcg-binder/client";

/* ---------------- helpers: wishlist readers (minimal) ---------------- */
function readWishlistRoot(data) {
  // supports { myWishlist } or { wishlist }
  return data?.myWishlist ?? data?.wishlist ?? {};
}
function readWishlistList(root) {
  // your logs showed { entries: [...] }
  return Array.isArray(root.entries) ? root.entries : [];
}
function readWishlistTotal(root, listLen = 0) {
  const n = root.total ?? root.totalCount ?? root.count ?? listLen ?? 0;
  return Number(n) || 0;
}

/* ---------------- small presentational stat tile (unchanged) --------- */
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

  // NEW: optional overrides if the parent already knows exact counts
  cardsCount,
  bindersCount,
  wishlistCount,
}) {
  const apollo = useApolloClient(); // NEW

  // NEW: compute accurate counts with this priority:
  // 1) explicit prop override
  // 2) Apollo cache (live UI state)
  // 3) user.stats fallback
  const { cards, binders, wishlist } = useMemo(() => {
    // 1) explicit overrides take precedence when they are numbers
    const has = (v) => typeof v === "number" && !Number.isNaN(v);

    if (has(cardsCount) && has(bindersCount) && has(wishlistCount)) {
      return { cards: cardsCount, binders: bindersCount, wishlist: wishlistCount };
    }

    // 2) try Apollo cache (no network, instant). each read is wrapped in try/catch
    let cardsFromCache = undefined;
    let bindersFromCache = undefined;
    let wishlistFromCache = undefined;

    try {
      const collection = apollo.readQuery({ query: MyCollectionDocument });
      if (Array.isArray(collection?.myCollection)) {
        cardsFromCache = collection.myCollection.length;
      }
    } catch {}

    try {
      const bindersQ = apollo.readQuery({ query: MyBindersDocument });
      if (Array.isArray(bindersQ?.myBinders)) {
        bindersFromCache = bindersQ.myBinders.length;
      }
    } catch {}

    try {
      const wl = apollo.readQuery({ query: WishlistDocument });
      const root = readWishlistRoot(wl);
      const list = readWishlistList(root);
      wishlistFromCache = readWishlistTotal(root, list.length);
    } catch {}

    // 3) fall back to user.stats (your original inputs)
    const stats = user?.stats ?? {};
    const cardsFromUser = Number(stats.totalCards ?? stats.cards ?? 0) || 0;
    const bindersFromUser = Number(stats.binders ?? 0) || 0;
    const wishlistFromUser = Number(stats.wishlist ?? 0) || 0;

    const finalCards = has(cardsCount)
      ? cardsCount
      : (typeof cardsFromCache === "number" ? cardsFromCache : cardsFromUser);

    const finalBinders = has(bindersCount)
      ? bindersCount
      : (typeof bindersFromCache === "number" ? bindersFromCache : bindersFromUser);

    const finalWishlist = has(wishlistCount)
      ? wishlistCount
      : (typeof wishlistFromCache === "number" ? wishlistFromCache : wishlistFromUser);

    return { cards: finalCards, binders: finalBinders, wishlist: finalWishlist };
  }, [apollo, user, cardsCount, bindersCount, wishlistCount]);

  // keep your loading behaviour for first paint
  const show = (n) => (loading && !user ? "…" : Intl.NumberFormat().format(Number(n || 0)));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your snapshot</Text>
      <View style={styles.row}>
        <Stat label="Cards"    value={show(cards)} />
        <Stat label="Binders"  value={show(binders)} />
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
