// components/profile/tabs/OverviewTab.js
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";

/**
 * Props
 * - stats?: { binders?: number; cards?: number; wishlist?: number; trades?: number; sales?: number }
 * - showcaseItems?: Array<{ id: string|number, name?: string, image?: string }>
 * - isOwner?: boolean                            // show edit buttons when true
 * - onEditStats?: () => void
 * - onEditShowcase?: () => void
 * - onViewCards?: () => void
 * - onOpenSettings?: () => void
 * - onLogout?: () => void
 * - showAccountActions?: boolean                 // show settings/logout section
 */
export default function OverviewTab({
  stats,
  showcaseItems = [],         // optional real data
  isOwner = false,
  onEditStats,
  onEditShowcase,
  onViewCards,
  onOpenSettings,
  onLogout,
  showAccountActions = false,
}) {
  const s = {
    binders: stats?.binders ?? 0,
    cards: stats?.cards ?? 0,
    wishlist: stats?.wishlist ?? 0,
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

      {/* --- Showcase --- */}
      <Section
        title="Showcase"
        subtitle="Featured cards from your collection"
        showEdit={isOwner && !!onEditShowcase}
        onEdit={onEditShowcase}
      >
        {hasShowcase ? (
          <View style={styles.showcaseRow}>
            {showcaseItems.slice(0, 8).map((it) => (
              <View key={String(it.id)} style={styles.showcaseCard}>
                {it.image ? (
                  <Image source={{ uri: it.image }} style={styles.showcaseThumb} />
                ) : (
                  <View style={styles.showcaseThumb} />
                )}
                <Text style={styles.showcaseCaption} numberOfLines={1}>
                  {it.name || "Card"}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyShowcaseHint isOwner={isOwner} onEditShowcase={onEditShowcase} />
        )}

        <Pressable onPress={onViewCards} hitSlop={6}>
          <Text style={styles.link}>View all cards →</Text>
        </Pressable>
      </Section>

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

/* --- Section wrapper with header + optional edit --- */
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

/* --- Pretty metric tile (uses your Stat’s numbers) --- */
function Metric({ value, label }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{formatNumber(value)}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

/* --- Empty showcase helper --- */
function EmptyShowcaseHint({ isOwner, onEditShowcase }) {
  return (
    <View style={styles.emptyShowcase}>
      <Ionicons name="images-outline" size={18} color={COLORS.textMuted} />
      <Text style={styles.emptyText}>
        {isOwner
          ? "No showcase yet. Pick a few favourites to feature."
          : "No showcase yet."}
      </Text>
      {isOwner && onEditShowcase && (
        <Pressable
          onPress={onEditShowcase}
          style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.9 }]}
          hitSlop={6}
        >
          <Ionicons name="create-outline" size={14} color="#fff" />
          <Text style={styles.emptyCtaText}>Set up showcase</Text>
        </Pressable>
      )}
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

  // showcase
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
