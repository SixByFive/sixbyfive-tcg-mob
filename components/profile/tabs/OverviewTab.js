// components/profile/tabs/OverviewTab.js
// Accurate counts with live queries + prop overrides + stats fallback

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";

// ✅ use live queries (not just cache reads)
import { useQuery } from "@apollo/client";
import {
  MyBindersDocument,
  MyCollectionDocument,
  MyWishlistDocument, // ← correct doc name
} from "@sixbyfive/tcg-binder/client";

/* ---------------- wishlist helpers ---------------- */
function wlRoot(data) {
  // supports { myWishlist } or { wishlist }
  return data?.myWishlist ?? data?.wishlist ?? {};
}
function wlList(root) {
  return Array.isArray(root.entries) ? root.entries : [];
}
function wlTotal(root, listLen = 0) {
  const n = root.total ?? root.totalCount ?? root.count ?? listLen ?? 0;
  return Number(n) || 0;
}

/**
 * Props
 * - stats?: { binders, cards, wishlist, trades, sales }
 * - showcaseItems?: Array
 * - isOwner?: boolean       // ← when true we run live "my*" queries
 * - onEditStats, onEditShowcase, onViewCards, onOpenSettings, onLogout
 * - showAccountActions?: boolean
 * - cardsCount?, bindersCount?, wishlistCount?  // explicit overrides
 */
export default function OverviewTab({
  stats,
  showcaseItems = [],
  isOwner = false,
  onEditStats,
  onEditShowcase,
  onViewCards,
  onOpenSettings,
  onLogout,
  showAccountActions = false,

  cardsCount,
  bindersCount,
  wishlistCount,
}) {
  // 🔄 Live queries (skip on public profiles)
  const { data: colData } = useQuery(MyCollectionDocument, {
    skip: !isOwner,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });
  const { data: bindersData } = useQuery(MyBindersDocument, {
    skip: !isOwner,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });
  const { data: wlData } = useQuery(MyWishlistDocument, {
    skip: !isOwner,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  // Derive counts: props → live queries → stats fallback
  const s = useMemo(() => {
    const hasNum = (v) => typeof v === "number" && !Number.isNaN(v);

    const cardsFromQ = Array.isArray(colData?.myCollection)
      ? colData.myCollection.length
      : undefined;

    const bindersFromQ = Array.isArray(bindersData?.myBinders)
      ? bindersData.myBinders.length
      : undefined;

    const wlRootObj = wlRoot(wlData);
    const wlFromQ = wlTotal(wlRootObj, wlList(wlRootObj).length);

    return {
      binders:
        (hasNum(bindersCount) ? bindersCount : undefined) ??
        (hasNum(bindersFromQ) ? bindersFromQ : undefined) ??
        (stats?.binders ?? 0),
      cards:
        (hasNum(cardsCount) ? cardsCount : undefined) ??
        (hasNum(cardsFromQ) ? cardsFromQ : undefined) ??
        (stats?.cards ?? 0),
      wishlist:
        (hasNum(wishlistCount) ? wishlistCount : undefined) ??
        (hasNum(wlFromQ) ? wlFromQ : undefined) ??
        (stats?.wishlist ?? 0),
      trades: stats?.trades ?? 0,
      sales: stats?.sales ?? 0,
    };
  }, [cardsCount, bindersCount, wishlistCount, stats, colData, bindersData, wlData]);

  const hasShowcase = Array.isArray(showcaseItems) && showcaseItems.length > 0;

  return (
    <View>
      {/* --- Stats --- */}
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

      {/* Showcase left as-is (you had it commented / optional) */}

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

/* --- utils --- */
function formatNumber(n) {
  try {
    return new Intl.NumberFormat().format(n ?? 0);
  } catch {
    return String(n ?? 0);
  }
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

  // showcase (kept from your file)
  showcaseRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  showcaseCard: { width: "23%", minWidth: 72 },
  showcaseThumb: {
    width: "100%",
    aspectRatio: 63 / 88,
    backgroundColor: COLORS.alt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  showcaseCaption: { color: COLORS.text, fontSize: 12, marginTop: 6 },

  // account
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

  link: { color: COLORS.accent, fontWeight: "800", marginTop: 10 },
});
