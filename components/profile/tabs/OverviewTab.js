// components/profile/tabs/OverviewTab.js
// Accurate counts with minimal, schema-safe queries + safe readers + prop overrides.
//
// OWNER VIEW:
//   - uses myCollection, myBinders, myWishlist
// PUBLIC VIEW (visiting someone else):
//   - uses collection(userId), browseBinders(userId), wishlist(userId)
//
// The component decides which set to use based on `isOwner` and `userId`.

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";

import { gql, useQuery } from "@apollo/client";

/* ---------------- Minimal inline queries (owner) ---------------- */

// Only select ids / totals – avoid rich selections to prevent 400s.

const MY_COLLECTION_MIN_IDS = gql`
  query MyCollection_MinIds {
    myCollection {
      id
    }
  }
`;

const MY_BINDERS_MIN_IDS = gql`
  query MyBinders_MinIds {
    myBinders {
      id
    }
  }
`;

const MY_WISHLIST_MIN = gql`
  query MyWishlist_Min {
    myWishlist {
      total
      entries {
        id
      }
    }
  }
`;

/* ---------------- Minimal inline queries (profile / other user) ---------------- */

// These mirror the owner queries but take userId.

const PROFILE_COLLECTION_MIN_IDS = gql`
  query ProfileCollection_MinIds($userId: ID!) {
    collection(userId: $userId) {
      id
    }
  }
`;

// FIXED: browseBinders returns BinderPageResult, not [Binder]
const PROFILE_BINDERS_MIN_IDS = gql`
  query ProfileBinders_MinIds($userId: ID!) {
    browseBinders(userId: $userId, page: 1, pageSize: 1) {
      total
      binders {
        id
      }
    }
  }
`;

const PROFILE_WISHLIST_MIN = gql`
  query ProfileWishlist_Min($userId: ID!) {
    wishlist(userId: $userId, page: 1, pageSize: 1) {
      total
      entries {
        id
      }
    }
  }
`;

/* ---------------- helpers ---------------- */

function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.edges))
    return input.edges.map((e) => e?.node ?? e).filter(Boolean);
  if (Array.isArray(input.nodes)) return input.nodes.filter(Boolean);
  if (Array.isArray(input.items)) return input.items.filter(Boolean);
  if (Array.isArray(input.results)) return input.results.filter(Boolean);
  if (Array.isArray(input.entries)) return input.entries.filter(Boolean);
  for (const k of Object.keys(input || {})) {
    const v = input[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      if (Array.isArray(v.edges))
        return v.edges.map((e) => e?.node ?? e).filter(Boolean);
      if (Array.isArray(v.nodes)) return v.nodes.filter(Boolean);
    }
  }
  return [];
}

function wlRoot(data) {
  return data?.myWishlist ?? data?.wishlist ?? {};
}
function wlList(root) {
  return Array.isArray(root.entries) ? root.entries : toArray(root);
}
function wlTotal(root, listLen = 0) {
  const n = root.total ?? root.totalCount ?? root.count ?? listLen ?? 0;
  return Number(n) || 0;
}

function formatNumber(n) {
  try {
    return new Intl.NumberFormat().format(n ?? 0);
  } catch {
    return String(n ?? 0);
  }
}

/* ---------------- Component ---------------- */
/**
 * Props
 * - stats?: { binders, cards, wishlist, trades, sales } // fallback values (e.g. from profile VM)
 * - isOwner?: boolean  // when true, run "my*" live queries
 * - userId?: string    // when viewing someone else, use this for profile queries
 * - cardsCount?, bindersCount?, wishlistCount?  // explicit overrides win
 * - onEditStats, onOpenSettings, onLogout
 * - showAccountActions?: boolean
 */
export default function OverviewTab({
  stats,
  isOwner = false,
  userId,
  onEditStats,
  onOpenSettings,
  onLogout,
  showAccountActions = false,

  cardsCount,
  bindersCount,
  wishlistCount,
}) {
  const isProfileView = !isOwner && !!userId;

  if (__DEV__) {
    // High-level mode info
    // eslint-disable-next-line no-console
    console.log("[OverviewTab] props", {
      isOwner,
      isProfileView,
      userId,
      stats,
      cardsCount,
      bindersCount,
      wishlistCount,
    });
  }

  // --- OWNER QUERIES (my*) ---
  const { data: myColData } = useQuery(MY_COLLECTION_MIN_IDS, {
    skip: !isOwner,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const { data: myBindersData, error: myBindersError } = useQuery(
    MY_BINDERS_MIN_IDS,
    {
      skip: !isOwner,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
    },
  );

  const { data: myWlData } = useQuery(MY_WISHLIST_MIN, {
    skip: !isOwner,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  // --- PROFILE QUERIES (other user, by userId) ---
  const { data: profileColData } = useQuery(PROFILE_COLLECTION_MIN_IDS, {
    skip: !isProfileView,
    variables: isProfileView ? { userId } : undefined,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const { data: profileBindersData, error: profileBindersError } = useQuery(
    PROFILE_BINDERS_MIN_IDS,
    {
      skip: !isProfileView,
      variables: isProfileView ? { userId } : undefined,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
    },
  );

  const { data: profileWlData } = useQuery(PROFILE_WISHLIST_MIN, {
    skip: !isProfileView,
    variables: isProfileView ? { userId } : undefined,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  if (__DEV__) {
    // Raw query payloads so we can see if anything actually comes back
    // eslint-disable-next-line no-console
    console.log("[OverviewTab] raw query data", {
      isOwner,
      isProfileView,
      userId,
      myColData,
      myBindersData,
      myWlData,
      profileColData,
      profileBindersData,
      profileWlData,
      myBindersError: myBindersError?.message,
      profileBindersError: profileBindersError?.message,
    });
  }

  // Derive counts (override props → live query → fallback stats)
  const s = useMemo(() => {
    const isNum = (v) => typeof v === "number" && Number.isFinite(v);

    // Decide which datasets to use
    const colData = isOwner ? myColData : profileColData;
    const bindersData = isOwner ? myBindersData : profileBindersData;
    const wlData = isOwner ? myWlData : profileWlData;

    // collection
    const collectionListRaw =
      Array.isArray(colData?.myCollection) || Array.isArray(colData?.collection)
        ? colData?.myCollection || colData?.collection
        : toArray(colData?.myCollection || colData?.collection);

    const cardsFromQ = Array.isArray(collectionListRaw)
      ? collectionListRaw.length
      : undefined;

    // binders
    const bindersListRaw =
      Array.isArray(bindersData?.myBinders) ||
      Array.isArray(bindersData?.browseBinders)
        ? bindersData?.myBinders || bindersData?.browseBinders
        : toArray(bindersData?.myBinders || bindersData?.browseBinders);

    const bindersFromQ = Array.isArray(bindersListRaw)
      ? bindersListRaw.length
      : undefined;

    // wishlist (use total if available, else entries length)
    const root = wlRoot(wlData);
    const list = wlList(root);
    const wlFromQ = wlTotal(root, list.length);

    const derived = {
      binders:
        (isNum(bindersCount) ? bindersCount : undefined) ??
        (isNum(bindersFromQ) ? bindersFromQ : undefined) ??
        stats?.binders ??
        0,

      cards:
        (isNum(cardsCount) ? cardsCount : undefined) ??
        (isNum(cardsFromQ) ? cardsFromQ : undefined) ??
        stats?.cards ??
        0,

      wishlist:
        (isNum(wishlistCount) ? wishlistCount : undefined) ??
        (isNum(wlFromQ) ? wlFromQ : undefined) ??
        stats?.wishlist ??
        0,

      trades: stats?.trades ?? 0,
      sales: stats?.sales ?? 0,
    };

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[OverviewTab] derived counts", {
        isOwner,
        isProfileView,
        userId,
        cardsFromQ,
        bindersFromQ,
        wlFromQ,
        root,
        listLen: list.length,
        final: derived,
      });
    }

    return derived;
  }, [
    isOwner,
    userId,
    cardsCount,
    bindersCount,
    wishlistCount,
    stats,
    myColData,
    myBindersData,
    myWlData,
    profileColData,
    profileBindersData,
    profileWlData,
  ]);

  return (
    <View>
      <Section
        title="Overview"
        subtitle="Your collection at a glance"
        showEdit={isOwner && !!onEditStats}
        onEdit={onEditStats}
      >
        <View style={styles.statsRow}>
          <Metric value={s.binders} label="Binders" />
          <Metric value={s.cards} label="Cards" />
          <Metric value={s.wishlist} label="Wishlist" />
          <Metric value={s.trades} label="Trades" />
          <Metric value={s.sales} label="Sales" />
        </View>
      </Section>

      {showAccountActions && (
        <Section title="Account" compact>
          <Pressable style={styles.actionRow} onPress={onOpenSettings}>
            <Text style={styles.actionText}>App/Account Settings</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.textMuted}
            />
          </Pressable>
          <Pressable style={styles.actionRow} onPress={onLogout}>
            <Text style={styles.actionText}>Log out</Text>
            <Ionicons
              name="log-out-outline"
              size={16}
              color={COLORS.textMuted}
            />
          </Pressable>
        </Section>
      )}
    </View>
  );
}

/* --- Section wrapper --- */
function Section({
  title,
  subtitle,
  children,
  showEdit,
  onEdit,
  compact = false,
}) {
  return (
    <View
      style={[styles.card, compact && { paddingTop: 10, paddingBottom: 10 }]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.cardSub}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

/* --- Metric tile --- */
function Metric({ value, label }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{formatNumber(value)}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

/* --- Styles --- */
const TILE_BG = "#1c1d24";

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: { color: COLORS.text, fontWeight: "900" },
  cardSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.alt,
  },
  editText: { color: COLORS.accent, fontWeight: "800", fontSize: 12.5 },

  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    minWidth: 104,
    flexGrow: 1,
    backgroundColor: TILE_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  metricLabel: { color: COLORS.textMuted, fontWeight: "800", marginTop: 2 },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TILE_BG,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  actionText: { color: COLORS.text, fontWeight: "800" },
});
