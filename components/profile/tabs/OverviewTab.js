// components/profile/tabs/OverviewTab.js
// CHANGED: accurate counts via Apollo cache with prop overrides

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";

// NEW: use Apollo client + generated docs to read cache
import { useApolloClient } from "@apollo/client";
import {
  MyBindersDocument,
  MyCollectionDocument,
  WishlistDocument,
} from "@sixbyfive/tcg-binder/client";

/* ---------------- helpers: wishlist readers (minimal) ---------------- */
function readWishlistRoot(data) {
  return data?.myWishlist ?? data?.wishlist ?? {};
}
function readWishlistList(root) {
  return Array.isArray(root.entries) ? root.entries : [];
}
function readWishlistTotal(root, listLen = 0) {
  const n = root.total ?? root.totalCount ?? root.count ?? listLen ?? 0;
  return Number(n) || 0;
}

/**
 * Props
 * - stats?: { binders?: number; cards?: number; wishlist?: number; trades?: number; sales?: number }
 * - showcaseItems?: Array<{ id: string|number, name?: string, image?: string }>
 * - isOwner?: boolean
 * - onEditStats?: () => void
 * - onEditShowcase?: () => void
 * - onViewCards?: () => void
 * - onOpenSettings?: () => void
 * - onLogout?: () => void
 * - showAccountActions?: boolean
 *
 * - NEW (optional overrides for perfect accuracy):
 *   - cardsCount?: number
 *   - bindersCount?: number
 *   - wishlistCount?: number
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

  // NEW: allow parent to override counts explicitly
  cardsCount,
  bindersCount,
  wishlistCount,
}) {
  const apollo = useApolloClient(); // NEW

  // NEW: derive accurate counts: overrides → Apollo cache → stats fallback
  const derived = useMemo(() => {
    const has = (v) => typeof v === "number" && !Number.isNaN(v);

    // 1) explicit overrides
    if (has(cardsCount) || has(bindersCount) || has(wishlistCount)) {
      return {
        cards: has(cardsCount) ? cardsCount : undefined,
        binders: has(bindersCount) ? bindersCount : undefined,
        wishlist: has(wishlistCount) ? wishlistCount : undefined,
      };
    }

    // 2) Apollo cache (instant, no network)
    let cardsFromCache;
    let bindersFromCache;
    let wishlistFromCache;
    try {
      const c = apollo.readQuery({ query: MyCollectionDocument });
      if (Array.isArray(c?.myCollection)) cardsFromCache = c.myCollection.length;
    } catch {}
    try {
      const b = apollo.readQuery({ query: MyBindersDocument });
      if (Array.isArray(b?.myBinders)) bindersFromCache = b.myBinders.length;
    } catch {}
    try {
      const w = apollo.readQuery({ query: WishlistDocument });
      const root = readWishlistRoot(w);
      const list = readWishlistList(root);
      wishlistFromCache = readWishlistTotal(root, list.length);
    } catch {}

    return {
      cards: cardsFromCache,
      binders: bindersFromCache,
      wishlist: wishlistFromCache,
    };
  }, [apollo, cardsCount, bindersCount, wishlistCount]);

  // FINAL numbers: use derived first, then stats fallback
  const s = {
    binders:
      (typeof derived.binders === "number" ? derived.binders : undefined) ??
      (stats?.binders ?? 0),
    cards:
      (typeof derived.cards === "number" ? derived.cards : undefined) ??
      (stats?.cards ?? 0),
    wishlist:
      (typeof derived.wishlist === "number" ? derived.wishlist : undefined) ??
      (stats?.wishlist ?? 0),
    trades: stats?.trades ?? 0,
    sales: stats?.sales ?? 0,
  };

  const hasShowcase = Array.isArray(showcaseItems) && showcaseItems.length > 0;

  return (
    <View>
      {/* --- Stats --- */}
      <Section
        title="Overview"
        subtitle="Your collection at a glance"
        showEdit={isOwner && !!onEditStats}                 // CHANGED: allow editing stats if owner
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

      {/* --- Showcase (unchanged / commented in your original) --- */}
      {/* keep as-is ... */}

      {/* --- Account actions (owner only) --- */}
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

/* --- Section wrapper with header + optional edit (unchanged except showEdit) --- */
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

/* --- Pretty metric tile --- */
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

/* --- Styles (unchanged) --- */
const TILE_BG = "#1c1d24";

const styles = StyleSheet.create({
  // section
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

  // metrics
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
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

  // showcase (kept)
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

  // empty showcase (kept)
  emptyShowcase: {
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    backgroundColor: TILE_BG,
    gap: 8,
  },
  emptyText: { color: COLORS.textMuted, fontWeight: "800", textAlign: "center" },
  emptyCta: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emptyCtaText: { color: "#fff", fontWeight: "900", fontSize: 12.5 },

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
