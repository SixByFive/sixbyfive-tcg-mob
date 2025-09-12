// components/collection/WishlistCardTile.js
// CHANGED: icon-only action buttons with proper touch target & a11y
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import { getBestPrice, normalizeImageUrl } from "../../utils/cards";
import AvgPriceBlock from "../search/AvgPriceBlock";

export default function WishlistCardTile({
  item = {},                // { id, name, setName, number, image, prices, _wishlist? }
  onView,
  onMoveToCollection,       // () => void
  onRemoveFromWishlist,     // () => void
}) {
  const pricesArray = Array.isArray(item?.prices)
    ? item.prices
    : Array.isArray(item?.pricing)
    ? item.pricing
    : [];

  const pricesKey = useMemo(() => JSON.stringify(pricesArray), [pricesArray]);
  const price = useMemo(
    () => getBestPrice({ ...item, prices: pricesArray }, { strategy: "recent" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pricesKey]
  );

  const imageUri = normalizeImageUrl(item?.image);
  const variation = String(item?._wishlist?.variation ?? "normal");

  return (
    <View style={styles.card}>
      <Pressable onPress={onView} android_ripple={{ color: "#00000022" }}>
        <View style={styles.cardImageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="contain" />
          ) : null}
          {/* Variation tag */}
          <View style={styles.variationPill}>
            <Text style={styles.variationText}>{variationLabel(variation)}</Text>
          </View>
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
            <AvgPriceBlock tcgp={price.tcgplayer} cmkt={price.cardmarket} />
          </View>
        </View>
      </Pressable>

      {/* Actions */}
      <View style={styles.actionBar}>
        {/* CHANGED: icon-only buttons; labels removed */}
        <IconButton
          icon="download-outline"
          variant="filled"                         // CHANGED: new prop
          onPress={onMoveToCollection}
          accessibilityLabel="Move to collection" // NEW: a11y since label removed
        />
        <IconButton
          icon="trash-outline"
          variant="tinted"                         // CHANGED
          onPress={onRemoveFromWishlist}
          accessibilityLabel="Remove from wishlist"// NEW
        />
      </View>
    </View>
  );
}

function variationLabel(v) {
  const k = String(v || "").toLowerCase().replace(/[\s_-]/g, "");
  if (k === "reverse" || k === "reverseholo" || k === "reverseholofoil" || k === "rev") return "Reverse";
  if (k === "holo" || k === "holofoil" || k === "foil") return "Holo";
  if (k === "normal" || k === "nonholo" || k === "nonfoil") return "Normal";
  return v || "Normal";
}

/* ------------------------------------------------------------------ */
/*  Icon-only button                                                  */
/* ------------------------------------------------------------------ */
// CHANGED: replaced ActionButton (with label) → IconButton (icon-only)
// - 40x40 circular touch target
// - subtle shadow, border variants
// - a11y label required if no text shown
function IconButton({ icon, variant = "default", onPress, accessibilityLabel }) {
  const base = [
    styles.iconBtn,
    variant === "filled" && styles.iconBtnFilled,
    variant === "tinted" && styles.iconBtnTint,
  ];
  // Decide icon color per variant
  const iconColor =
    variant === "filled" ? "#fff" : variant === "tinted" ? COLORS.accent : COLORS.text;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#00000022", borderless: false }}
      style={({ pressed }) => [base, pressed && styles.iconBtnPressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel} // NEW
      hitSlop={8}                             // NEW: easier to tap
    >
      <Ionicons name={icon} size={18} color={iconColor} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */
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

  variationPill: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  variationText: { color: COLORS.text, fontWeight: "800", fontSize: 11 },

  cardInfo: { padding: 8 },
  cardName: { color: COLORS.text, fontSize: 14.5, fontWeight: "700" },
  rowBetween: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMeta: { color: COLORS.textMuted, fontSize: 12, flexShrink: 1, marginRight: 8 },
  cardMetaStrong: { color: COLORS.text, fontSize: 12, fontWeight: "700" },

  actionBar: {
    // CHANGED: tighter bar for icon-only
    flexDirection: "row",
    gap: 8,                    // CHANGED: from 6
    paddingHorizontal: 8,
    paddingBottom: 8,
  },

  /* --- NEW: icon-only button styles --- */
  iconBtn: {
    flex: 1,                   // keep equal widths
    height: 40,                // NEW: hit target
    borderRadius: 12,          // CHANGED: slightly more rounded
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    // subtle shadow (iOS) / elevation (Android)
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconBtnFilled: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  iconBtnTint: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.accent,
  },
  iconBtnPressed: {
    transform: [{ scale: 0.98 }],
  },

  /* --- REMOVED: actBtn/actLabel styles from the old labeled button --- */
  // actBtn: {...}, actBtnFilled: {...}, actBtnTint: {...}, actLabel: {...}
});
