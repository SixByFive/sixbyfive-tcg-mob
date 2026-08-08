// components/home/SnapshotCard.js

import { Ionicons } from "@expo/vector-icons";
import { gql, useQuery } from "@apollo/client";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

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

const STATS = [
  { key: "cards",    label: "Cards",    icon: "cube-outline",    iconColor: COLORS.accent },
  { key: "binders",  label: "Binders",  icon: "albums-outline",  iconColor: "#9b59b6"     },
  { key: "wishlist", label: "Wishlist", icon: "heart-outline",   iconColor: "#e8b84b"     },
];

function StatTile({ label, value, icon, iconColor }) {
  return (
    <View style={styles.tile}>
      <View style={[styles.iconWrap, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon} size={15} color={iconColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default function SnapshotCard({
  loading,
  user,
  cardsCount,
  bindersCount,
  wishlistCount,
  onCounts,
}) {
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
    variables: { page: 1, pageSize: 1 },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const { cards, binders, wishlist } = useMemo(() => {
    const hasNum = (v) => typeof v === "number" && !Number.isNaN(v);

    const cardsFromQ = Array.isArray(colData?.myCollection)
      ? colData.myCollection.length
      : undefined;

    const bindersFromQ = Array.isArray(bindersData?.myBinders)
      ? bindersData.myBinders.length
      : undefined;

    const root = wlRoot(wlData);
    const wishlistFromQ = wlTotal(root, wlList(root).length);

    const stats = user?.stats ?? {};
    const cardsFromUser   = Number(stats.totalCards ?? stats.cards ?? 0) || 0;
    const bindersFromUser = Number(stats.binders ?? 0) || 0;
    const wishlistFromUser = Number(stats.wishlist ?? 0) || 0;

    return {
      cards:
        (hasNum(cardsCount)   ? cardsCount   : undefined) ??
        (hasNum(cardsFromQ)   ? cardsFromQ   : undefined) ??
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

  useEffect(() => {
    if (typeof onCounts !== "function") return;
    onCounts({ cards, binders, wishlist });
  }, [cards, binders, wishlist, onCounts]);

  const fmt = (n) => {
    try { return new Intl.NumberFormat().format(Number(n || 0)); }
    catch { return String(n ?? 0); }
  };
  const show = (n) => (loading && !user ? "…" : fmt(n));

  const values = { cards: show(cards), binders: show(binders), wishlist: show(wishlist) };

  return (
    <View style={styles.row}>
      {STATS.map((s) => (
        <StatTile
          key={s.key}
          label={s.label}
          value={values[s.key]}
          icon={s.icon}
          iconColor={s.iconColor}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    gap: 4,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  value: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    lineHeight: 24,
  },
  label: { color: COLORS.textMuted, fontSize: 11, fontWeight: "500", marginTop: 1 },
});
