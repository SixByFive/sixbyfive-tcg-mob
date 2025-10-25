// components/profile/tabs/OverviewTab.js
// Accurate counts with minimal, schema-safe queries + safe readers + prop overrides.

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";

import { gql, useQuery } from "@apollo/client";

/* ---------------- Minimal inline queries (avoid 400s) ---------------- */

// Only select what's needed to count; some servers 400 on rich selections.
const MY_COLLECTION_MIN_IDS = gql`
  query MyCollection_MinIds {
    myCollection { id }
  }
`;

const MY_BINDERS_MIN_IDS = gql`
  query MyBinders_MinIds {
    myBinders { id }
  }
`;

const MY_WISHLIST_MIN = gql`
  query MyWishlist_Min {
    myWishlist {
      total
      entries { id }
    }
  }
`;

/* ---------------- helpers ---------------- */

function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.edges)) return input.edges.map(e => e?.node ?? e).filter(Boolean);
  if (Array.isArray(input.nodes)) return input.nodes.filter(Boolean);
  if (Array.isArray(input.items)) return input.items.filter(Boolean);
  if (Array.isArray(input.results)) return input.results.filter(Boolean);
  if (Array.isArray(input.entries)) return input.entries.filter(Boolean);
  for (const k of Object.keys(input || {})) {
    const v = input[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      if (Array.isArray(v.edges)) return v.edges.map(e => e?.node ?? e).filter(Boolean);
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
  try { return new Intl.NumberFormat().format(n ?? 0); }
  catch { return String(n ?? 0); }
}

/* ---------------- Component ---------------- */
/**
 * Props
 * - stats?: { binders, cards, wishlist, trades, sales }
 * - isOwner?: boolean  // when true, run "my*" live queries
 * - cardsCount?, bindersCount?, wishlistCount?  // explicit overrides win
 * - onEditStats, onOpenSettings, onLogout
 * - showAccountActions?: boolean
 */
export default function OverviewTab({
  stats,
  isOwner = false,
  onEditStats,
  onOpenSettings,
  onLogout,
  showAccountActions = false,

  cardsCount,
  bindersCount,
  wishlistCount,
}) {
  // Live queries only for the profile owner
  const { data: colData } = useQuery(MY_COLLECTION_MIN_IDS, {
    skip: !isOwner,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const { data: bindersData } = useQuery(MY_BINDERS_MIN_IDS, {
    skip: !isOwner,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const { data: wlData } = useQuery(MY_WISHLIST_MIN, {
    skip: !isOwner,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  // Derive counts (override props → live query → fallback stats)
  const s = useMemo(() => {
    const isNum = (v) => typeof v === "number" && Number.isFinite(v);

    const collectionList =
      Array.isArray(colData?.myCollection) ? colData.myCollection : toArray(colData?.myCollection);
    const cardsFromQ = Array.isArray(collectionList) ? collectionList.length : undefined;

    const bindersList =
      Array.isArray(bindersData?.myBinders) ? bindersData.myBinders : toArray(bindersData?.myBinders);
    const bindersFromQ = Array.isArray(bindersList) ? bindersList.length : undefined;

    const root = wlRoot(wlData);
    const wlFromQ = wlTotal(root, wlList(root).length);

    return {
      binders:
        (isNum(bindersCount) ? bindersCount : undefined) ??
        (isNum(bindersFromQ) ? bindersFromQ : undefined) ??
        (stats?.binders ?? 0),

      cards:
        (isNum(cardsCount) ? cardsCount : undefined) ??
        (isNum(cardsFromQ) ? cardsFromQ : undefined) ??
        (stats?.cards ?? 0),

      wishlist:
        (isNum(wishlistCount) ? wishlistCount : undefined) ??
        (isNum(wlFromQ) ? wlFromQ : undefined) ??
        (stats?.wishlist ?? 0),

      trades: stats?.trades ?? 0,
      sales: stats?.sales ?? 0,
    };
  }, [cardsCount, bindersCount, wishlistCount, stats, colData, bindersData, wlData]);

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
            <Text style={styles.actionText}>App Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </Pressable>
          <Pressable style={styles.actionRow} onPress={onLogout}>
            <Text style={styles.actionText}>Log out</Text>
            <Ionicons name="log-out-outline" size={16} color={COLORS.textMuted} />
          </Pressable>
        </Section>
      )}
    </View>
  );
}

/* --- Section wrapper --- */
function Section({ title, subtitle, children, showEdit, onEdit, compact = false }) {
  return (
    <View style={[styles.card, compact && { paddingTop: 10, paddingBottom: 10 }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.cardSub}>{subtitle}</Text>}
        </View>
        {showEdit && (
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${title}`}
            hitSlop={6}
          >
            <Ionicons name="create-outline" size={14} color={COLORS.accent} />
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        )}
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
