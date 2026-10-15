// components/profile/tabs/SaleTradeTab.js
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";
import CardImage from "../../common/CardImage";

const FILTERS = [
  { key: "all",     label: "All" },
  { key: "singles", label: "Singles" },
  { key: "bulk",    label: "Bulk lots" },
];

function isBulk(item) {
  const k = item?.listingKind;
  return k === "BULK_TRACKED" || k === "BULK_RANDOM";
}

function MiniCard({ title = "Card", image, cardId, badge, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.miniCard}>
      <CardImage uri={image} name={title} cardId={cardId} style={styles.miniThumb} resizeMode="cover" />
      <Text style={styles.miniTitle} numberOfLines={1}>{title}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function SaleTradeTab({
  title,                 // "For Sale" | "For Trade"
  items = [],
  onOpenCard,
  emptyText,             // optional override
}) {
  const [filter, setFilter] = useState("all");

  // Pre-count so filter chips can show totals and we can hide chips entirely
  // when a lot has no bulk kinds (and vice-versa).
  const singlesCount = useMemo(() => items.filter((i) => !isBulk(i)).length, [items]);
  const bulkCount    = useMemo(() => items.filter(isBulk).length, [items]);

  const filtered = useMemo(() => {
    if (filter === "singles") return items.filter((i) => !isBulk(i));
    if (filter === "bulk")    return items.filter(isBulk);
    return items;
  }, [items, filter]);

  const showFilterChips = singlesCount > 0 && bulkCount > 0;
  const nothing = emptyText ?? (title === "For Sale" ? "No sale listings yet." : "No trade listings yet.");

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.totalText}>{items.length}</Text>
      </View>

      {showFilterChips && (
        <View style={styles.chipRow}>
          {FILTERS.map((f) => {
            const count = f.key === "singles" ? singlesCount
                        : f.key === "bulk"    ? bulkCount
                        : items.length;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, filter === f.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                  {f.label} <Text style={styles.chipCount}>({count})</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {filtered.length ? (
        <View style={styles.gridWrap}>
          {filtered.map((c) => (
            <MiniCard
              key={String(c.id)}
              title={c.name || "Card"}
              image={c.image}
              cardId={c.cardId || c.id}
              badge={isBulk(c) ? (c.listingKind === "BULK_RANDOM" ? "Random" : "Bulk") : null}
              onPress={() => onOpenCard?.(c)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.bodyText}>{nothing}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { color: COLORS.text, fontWeight: "900" },
  totalText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.alt,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  chipCount: { fontWeight: "400", opacity: 0.8 },

  bodyText: { color: COLORS.text, lineHeight: 20 },
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  miniCard: { width: "30%", position: "relative" },
  miniThumb: {
    width: "100%",
    aspectRatio: 63 / 88,
    backgroundColor: COLORS.alt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniThumbFallback: { alignItems: "center", justifyContent: "center", padding: 4 },
  miniThumbText: { color: COLORS.textMuted, fontSize: 10, textAlign: "center" },
  miniTitle: { color: COLORS.text, fontSize: 12, marginTop: 6 },

  badge: {
    position: "absolute",
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
