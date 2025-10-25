// components/home/SnapshotCard.js
// Live counts from inline queries with graceful fallbacks/overrides.
// Mirrors OverviewTab logic, but uses schema-safe inline docs to avoid 400s.

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

import { gql, useQuery } from "@apollo/client";

// --- Inline, minimal docs (avoid problematic package docs) ---
const MY_COLLECTION_MIN = gql`
  query MyCollection_Min {
    myCollection {
      id
    }
  }
`;

const MY_WISHLIST_MIN = gql`
  query MyWishlist_Min($page: Int, $pageSize: Int) {
    myWishlist(page: $page, pageSize: $pageSize) {
      total
      entries {
        id
      }
    }
  }
`;

const MY_BINDERS_DOC = gql`
  query MyBinders_Min {
    myBinders {
      id
    }
  }
`;

/* wishlist helpers (same as OverviewTab) */
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
  // Always query for the signed-in user on the home snapshot
  const { data: colData } = useQuery(MY_COLLECTION_MIN, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });
  const { data: bindersData } = useQuery(MY_BINDERS_DOC, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });
  const { data: wlData } = useQuery(MY_WISHLIST_MIN, {
    variables: { page: 1, pageSize: 1 }, // we only need total; tiny page for safety
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const { cards, binders, wishlist } = useMemo(() => {
    const hasNum = (v) => typeof v === "number" && !Number.isNaN(v);

    // EXACT match to OverviewTab semantics:
    // only trust counts if GraphQL returned arrays (or "total" for wishlist).
    const cardsFromQ = Array.isArray(colData?.myCollection)
      ? colData.myCollection.length
      : undefined;

    const bindersFromQ = Array.isArray(bindersData?.myBinders)
      ? bindersData.myBinders.length
      : undefined;

    const root = wlRoot(wlData);
    const wishlistFromQ = wlTotal(root, wlList(root).length);

    // Fallbacks from user.stats
    const stats = user?.stats ?? {};
    const cardsFromUser = Number(stats.totalCards ?? stats.cards ?? 0) || 0;
    const bindersFromUser = Number(stats.binders ?? 0) || 0;
    const wishlistFromUser = Number(stats.wishlist ?? 0) || 0;

    return {
      cards:
        (hasNum(cardsCount) ? cardsCount : undefined) ??
        (hasNum(cardsFromQ) ? cardsFromQ : undefined) ??
        cardsFromUser,
      binders:
        (hasNum(bindersCount) ? bindersCount : undefined) ??
        (hasNum(bindersFromQ) ? bindersFromQ : undefined) ??
        bindersFromUser,
      wishlist:
        (hasNum(wishlistCount) ? wishlistCount : undefined) ??
        (hasNum(wishlistFromQ) ? wishlistFromQ : undefined) ??
        wishlistFromUser,
    };
  }, [cardsCount, bindersCount, wishlistCount, user, colData, bindersData, wlData]);

  const fmt = (n) => {
    try {
      return new Intl.NumberFormat().format(Number(n || 0));
    } catch {
      return String(n ?? 0);
    }
  };
  const show = (n) => (loading && !user ? "…" : fmt(n));

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
