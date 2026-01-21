// components/search/CardTile.js
//
// UPDATED (2026-01-21):
// - FIX: Remove JSON.stringify memo key (expensive + causes churn).
// - CHANGE: Accept derived price props (averagePrice / bestPrice / averagePriceFormatted)
//           so Search renderItem doesn't create a new item object.
// - PERF: Wrap CardTile in React.memo with a custom comparator to prevent re-render jitter.
// - PERF: best-price selection memo now depends on stable inputs, not stringified arrays.

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import { getBestPrice, normalizeImageUrl } from "../../utils/cards";
import AvgPriceBlock from "./AvgPriceBlock";

/* ---------- local helpers for robust fallback ---------- */

function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function pickValue(p) {
  // prefer market → gbp → mid → low → high
  if (!p) return undefined;
  return (
    (isNum(p.market) ? p.market : undefined) ??
    (isNum(p.gbp) ? p.gbp : undefined) ??
    (isNum(p.mid) ? p.mid : undefined) ??
    (isNum(p.low) ? p.low : undefined) ??
    (isNum(p.high) ? p.high : undefined)
  );
}

function canonicalVariant(v) {
  const s = String(v ?? "normal")
    .toLowerCase()
    .trim();
  if (!s) return "normal";
  if (
    [
      "reverse",
      "reverse holo",
      "reverse-holo",
      "reverseholo",
      "reverseholofoil",
    ].includes(s)
  )
    return "reverseHolofoil";
  if (["holo", "holofoil", "holo foil"].includes(s)) return "holofoil";
  if (
    ["first edition", "firstedition", "1st edition", "1stedition"].includes(s)
  )
    return "firstEdition";
  return s;
}

function hasAnyValue(p) {
  return (
    isNum(p?.market) ||
    isNum(p?.gbp) ||
    isNum(p?.mid) ||
    isNum(p?.low) ||
    isNum(p?.high) ||
    isNum(p?.tcgplayer) ||
    isNum(p?.cardmarket)
  );
}

function localBestPrice(prices = []) {
  if (!Array.isArray(prices) || prices.length === 0) return null;

  // normalize variants for ordering
  const rows = prices
    .map((r) =>
      r ? { ...r, _v: canonicalVariant(r.variation ?? r.variant) } : null,
    )
    .filter(Boolean)
    .filter(hasAnyValue);

  if (rows.length === 0) return null;

  const pref = ["normal", "holofoil", "holo", "reverseHolofoil", "reverse"];
  for (const v of pref) {
    const hit = rows.find((r) => r._v === v && pickValue(r) != null);
    if (hit) return hit;
  }

  return rows.find((r) => pickValue(r) != null) || null;
}

/* -------------------------------------------------------------------------- */
/*  Memoized tile                                                             */
/* -------------------------------------------------------------------------- */

function CardTileInner({
  item = {},
  onPress,
  onAddToCollection,
  onAddToWishlist,
  isInCollection = false,
  isInWishlist = false,

  // UPDATED: derived price props (so parent doesn't create a new item object)
  averagePrice,
  bestPrice,
  averagePriceFormatted,
}) {
  const pricesArray = Array.isArray(item?.prices)
    ? item.prices
    : Array.isArray(item?.pricing)
      ? item.pricing
      : [];

  // UPDATED: compute best price only when inputs actually change
  const best = useMemo(() => {
    // Prefer explicitly passed bestPrice from parent if present
    if (bestPrice && hasAnyValue(bestPrice)) return bestPrice;

    const utilResult = getBestPrice(
      { ...item, prices: pricesArray },
      { strategy: "recent" },
    );
    const useUtil = utilResult && hasAnyValue(utilResult);
    return useUtil ? utilResult : localBestPrice(pricesArray);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestPrice, item?.id, pricesArray]);

  // Derive values for AvgPriceBlock
  const tcgp = useMemo(() => {
    if (!best) return undefined;
    return (
      (isNum(best.tcgplayer) ? best.tcgplayer : undefined) ?? pickValue(best)
    );
  }, [best]);

  const cmkt = useMemo(() => {
    if (!best) return undefined;
    return isNum(best.cardmarket) ? best.cardmarket : undefined;
  }, [best]);

  // (Optional) accept derived averagePriceFormatted if parent provided it
  // Not currently displayed in this tile because AvgPriceBlock handles UI,
  // but keeping for future / parity.
  const _avg = averagePrice; // eslint-disable-line no-unused-vars
  const _avgFmt = averagePriceFormatted; // eslint-disable-line no-unused-vars

  const imageUri = normalizeImageUrl(item?.image);

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      android_ripple={{ color: "#00000022" }}
    >
      <View style={styles.cardImageWrap}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.cardImage}
            resizeMode="contain"
          />
        ) : null}
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item?.name || "—"}
        </Text>

        <View style={styles.rowBetween}>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {item?.setName || "—"}
          </Text>
          <Text style={styles.cardMetaStrong}>#{item?.number ?? "—"}</Text>
        </View>

        <View style={{ marginTop: 8 }}>
          {tcgp != null || cmkt != null ? (
            <AvgPriceBlock tcgp={tcgp} cmkt={cmkt} />
          ) : (
            <Text style={[styles.cardMeta, { textAlign: "right" }]}>—</Text>
          )}
        </View>
      </View>

      <View style={styles.actionBar}>
        <ActionButton
          icon={isInCollection ? "checkmark" : "add-circle-outline"}
          label={isInCollection ? "Added" : "Add"}
          filled={!isInCollection}
          disabled={isInCollection}
          onPress={() => onAddToCollection?.(item)}
        />
        <ActionButton
          icon={isInWishlist ? "heart" : "heart-outline"}
          label={isInWishlist ? "Wishlisted" : "Wishlist"}
          filled={false}
          tinted
          disabled={isInWishlist}
          onPress={() => onAddToWishlist?.(item)}
        />
      </View>
    </Pressable>
  );
}

// UPDATED: memo comparator to stop scroll jitter re-renders
function areEqual(prev, next) {
  const a = prev.item || {};
  const b = next.item || {};

  // If identity changes, re-render
  if (String(a.id ?? "") !== String(b.id ?? "")) return false;

  // Re-render if core visible fields changed
  if ((a.name ?? "") !== (b.name ?? "")) return false;
  if ((a.setName ?? "") !== (b.setName ?? "")) return false;
  if (String(a.number ?? "") !== String(b.number ?? "")) return false;
  if ((a.image ?? "") !== (b.image ?? "")) return false;

  // Buttons state changes
  if (!!prev.isInCollection !== !!next.isInCollection) return false;
  if (!!prev.isInWishlist !== !!next.isInWishlist) return false;

  // Derived pricing props (if you pass them)
  if ((prev.averagePriceFormatted ?? "") !== (next.averagePriceFormatted ?? ""))
    return false;

  // If parent passed bestPrice, use a small fingerprint
  const pa = prev.bestPrice;
  const pb = next.bestPrice;
  const paKey =
    pa && typeof pa === "object"
      ? `${pa.variation ?? pa.variant ?? ""}:${pa.market ?? pa.gbp ?? pa.mid ?? pa.low ?? pa.high ?? ""}`
      : "";
  const pbKey =
    pb && typeof pb === "object"
      ? `${pb.variation ?? pb.variant ?? ""}:${pb.market ?? pb.gbp ?? pb.mid ?? pb.low ?? pb.high ?? ""}`
      : "";
  if (paKey !== pbKey) return false;

  return true;
}

const CardTile = React.memo(CardTileInner, areEqual);
export default CardTile;

function ActionButton({ icon, label, filled, tinted, disabled, onPress }) {
  const base = [
    styles.actBtn,
    filled && styles.actBtnFilled,
    tinted && styles.actBtnTint,
    disabled && styles.actBtnDisabled,
  ];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "#00000022", borderless: false }}
      style={({ pressed }) => [
        base,
        pressed && !disabled && { transform: [{ scale: 0.98 }] },
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Ionicons
        name={icon}
        size={14}
        color={
          disabled
            ? COLORS.textMuted
            : filled
              ? "#fff"
              : tinted
                ? COLORS.accent
                : COLORS.text
        }
        style={{ marginRight: 6 }}
      />
      <Text
        style={[
          styles.actLabel,
          filled && { color: "#fff" },
          tinted && !filled && { color: COLORS.accent, fontWeight: "900" },
          disabled && { color: COLORS.textMuted },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    margin: 6,
    overflow: "hidden",
  },
  cardImageWrap: {
    backgroundColor: COLORS.alt,
    aspectRatio: 245 / 337,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardImage: { ...StyleSheet.absoluteFillObject },
  cardInfo: { padding: 8 },
  cardName: { color: COLORS.text, fontSize: 14.5, fontWeight: "700" },
  rowBetween: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    flexShrink: 1,
    marginRight: 8,
  },
  cardMetaStrong: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  actionBar: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  actBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  actBtnFilled: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  actBtnTint: { backgroundColor: COLORS.alt, borderColor: COLORS.accent },
  actBtnDisabled: { opacity: 0.6 },
  actLabel: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
});
