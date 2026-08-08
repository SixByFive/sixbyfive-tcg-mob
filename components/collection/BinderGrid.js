import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

/* ---------------- helpers ---------------- */

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return "—"; }
};

const computeCardsFromPages = (pages) => {
  if (!Array.isArray(pages)) return 0;
  let n = 0;
  for (const p of pages) {
    const slots = Array.isArray(p?.slots) ? p.slots : [];
    for (const slot of slots) {
      if (!slot || typeof slot?.cardId !== "string" || !slot.cardId) continue;
      const qty = Number(slot?.quantity);
      n += Number.isFinite(qty) && qty > 0 ? qty : 1;
    }
  }
  return n;
};

function mergeBinder(stub) {
  const b = { ...(stub || {}) };

  const id = String(b?.id ?? stub?.id ?? "");
  const name = (b?.name || b?.title || "Binder").trim();
  const coverColor = b?.coverColor || b?.cover?.coverColor || COLORS.alt;
  const accentColor = b?.accentColor || b?.cover?.accentColor || "#424a80";
  const updatedAt = b?.updatedAt;

  const pages = Array.isArray(b?.pages) ? b.pages : [];
  const pagesCount =
    toNumber(b?.pagesCount) ??
    toNumber(b?.pageCount) ??
    (pages ? pages.length : 0);

  const cardsCount =
    toNumber(b?.cardsCount) ??
    toNumber(b?.cardCount) ??
    computeCardsFromPages(pages);

  const coverImage = b?.coverImage || b?.cover?.image || null;

  return { id, name, coverColor, accentColor, updatedAt, pagesCount, cardsCount, coverImage };
}

/* ---------------- small UI bits ---------------- */

function StatPill({ icon, children }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={12} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
      <Text style={styles.statText} numberOfLines={1}>{children}</Text>
    </View>
  );
}

function ColorLegend({ cover, accent }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: cover }]} />
      <View style={[styles.legendDot, { backgroundColor: accent }]} />
    </View>
  );
}

/* ---------------- tile (hydrates itself) ---------------- */

function HydratedTile({ stub, onOpen }) {
  const merged = mergeBinder(stub);
  if (!merged?.id) return null;

  return (
    <Pressable
      onPress={() => onOpen?.(merged.id)}
      android_ripple={{ color: "#00000018" }}
      style={({ pressed }) => [
        styles.binderTile,
        { borderColor: merged.accentColor + "55" },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      {/* Cover */}
      <View style={[styles.coverWrap, { borderColor: merged.accentColor + "88" }]}>
        {/* Accent stripe makes secondary color obvious */}
        <View style={[styles.accentStripe, { backgroundColor: merged.accentColor }]} />

        {merged.coverImage ? (
          <>
            <Image source={{ uri: merged.coverImage }} resizeMode="cover" style={StyleSheet.absoluteFill} />
            <View style={styles.coverGradient} />
          </>
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: merged.coverColor }]} />
        )}

        {/* subtle inner ring */}
        <View style={[styles.coverInnerRing, { borderColor: merged.accentColor + "33" }]} />

        {/* SixByFive brand tag (VaultX-style) */}
        <View style={styles.brandBadge}>
          <Text style={styles.brandText}>SixByFive</Text>
        </View>
      </View>

      {/* Title + color legend */}
      <View style={styles.titleRow}>
        <Text style={styles.tileName} numberOfLines={1}>{merged.name}</Text>
        <ColorLegend cover={merged.coverColor} accent={merged.accentColor} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatPill icon="albums-outline">
          {merged.cardsCount} {merged.cardsCount === 1 ? "card" : "cards"}
        </StatPill>
        <StatPill icon="grid-outline">
          {merged.pagesCount} {merged.pagesCount === 1 ? "page" : "pages"}
        </StatPill>
        {/* <StatPill icon="time-outline">{formatDate(merged.updatedAt)}</StatPill> */}
      </View>
    </Pressable>
  );
}

/* ---------------- grid ---------------- */

export default function BinderGrid({ binders, onCreate, onOpen }) {
  const list = Array.isArray(binders) ? binders : [];

  if (list.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No binders yet.</Text>
        <Pressable onPress={onCreate} style={[styles.cta, { backgroundColor: COLORS.accent }]}>
          <Text style={styles.ctaText}>Create a binder</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {list.map((stub, idx) => (
        <HydratedTile key={String(stub?.id ?? idx)} stub={stub} onOpen={onOpen} />
      ))}
    </View>
  );
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },

  binderTile: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  coverWrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: COLORS.alt,
    borderWidth: StyleSheet.hairlineWidth,
    aspectRatio: 4 / 3,
    position: "relative",
    marginBottom: 10,
  },

  // secondary color strip
  accentStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    zIndex: 2,
  },

  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  coverInnerRing: {
    position: "absolute",
    left: 6,
    top: 6,
    right: 6,
    bottom: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
  },

  // brand tag (lower-right)
  brandBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  brandText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.3,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tileName: { color: COLORS.text, fontWeight: "800", fontSize: 14.5, flexShrink: 1 },

  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },

  statsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statText: {
    color: COLORS.textSecondary,
    fontSize: 11.5,
    fontWeight: "700",
  },

  emptyWrap: { alignItems: "center", gap: 8, paddingVertical: 16 },
  emptyText: { color: COLORS.textMuted },
  cta: { alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
});
