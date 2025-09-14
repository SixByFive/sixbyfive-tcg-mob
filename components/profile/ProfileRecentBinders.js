// components/profile/RecentBinders.js
import { useQuery } from "@apollo/client";
import { BinderDocument } from "@sixbyfive/tcg-binder/client";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import EmptyState from "../../components/common/EmptyState";
import { COLORS } from "../../theme/colors";

/* ---------------- helpers ---------------- */
const formatDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return "—"; }
};
const computeCardsFromPages = (pages) => {
  if (!Array.isArray(pages)) return 0;
  let n = 0;
  for (const p of pages) {
    const slots = Array.isArray(p?.slots) ? p.slots : [];
    n += slots.filter((s) => s && (s.cardId || s.card?.id)).length;
  }
  return n;
};

/* ---------------- row (fetch + merge) ---------------- */
function Row({ stub, onOpenBinder }) {
  const id = String(stub?.id ?? "");
  const { data } = useQuery(BinderDocument, {
    variables: { id },
    fetchPolicy: "cache-first",         // hit cache if parent already fetched
    notifyOnNetworkStatusChange: false,
    skip: !id,
  });

  // prefer live data > stub
  const b = data?.binder ?? stub ?? {};
  const ownerId =
    (b?.userId && String(b.userId)) ||
    (stub?.userId && String(stub.userId)) ||
    undefined;

  const name = (b?.name || b?.title || "Binder").trim();
  const coverColor = b?.coverColor || b?.cover?.coverColor || "#23243c";
  const accentColor = b?.accentColor || b?.cover?.accentColor || "#424a80";
  const updatedAt = b?.updatedAt;

  const cardsCount =
    typeof b?.cardsCount === "number" ? b.cardsCount : computeCardsFromPages(b?.pages);

  return (
    <Pressable onPress={() => onOpenBinder?.(id, ownerId)} style={styles.itemRow}>
      <View style={[styles.itemBadge, { backgroundColor: coverColor }]}>
        <View style={[styles.itemAccent, { backgroundColor: accentColor }]} />
        <Text style={styles.itemBadgeText}>{name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>{name}</Text>
        <Text style={styles.itemSub} numberOfLines={1}>
          {cardsCount} {cardsCount === 1 ? "card" : "cards"} · Updated {formatDate(updatedAt)}
        </Text>
      </View>
      <Text style={styles.chev}>{">"}</Text>
    </Pressable>
  );
}

/* ---------------- list ---------------- */
export default function RecentBinders({ binders, onOpenBinder, onCreateBinder }) {
  const list = Array.isArray(binders) ? binders : [];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Recent binders</Text>

      {list.length ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          {list.map((b) => (
            <Row key={String(b.id)} stub={b} onOpenBinder={onOpenBinder} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState message="No binders yet." />
          {!!onCreateBinder && (
            <Pressable
              onPress={onCreateBinder}
              style={[styles.ctaSmall, { backgroundColor: COLORS.accent }]}
            >
              <Text style={styles.ctaSmallText}>Create a binder</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
  },
  itemBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  itemAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  itemBadgeText: { color: "#fff", fontWeight: "800" },
  itemTitle: { color: COLORS.text, fontWeight: "700" },
  itemSub: { color: COLORS.textMuted, fontSize: 12 },
  chev: { color: COLORS.textMuted, fontWeight: "800" },

  emptyWrap: { alignItems: "center", gap: 8, marginTop: 10 },
  ctaSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  ctaSmallText: { color: "#fff", fontWeight: "800" },
});
