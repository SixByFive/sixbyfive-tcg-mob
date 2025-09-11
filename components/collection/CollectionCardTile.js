// components/collection/CollectionCardTile.js
// PURPOSE: Collection tile with a calmer, cleaner action bar.
// - Unified rounded footer container
// - Ghost-style actions (no per-button borders)
// - Compact spacing, subtle colors
// - Same handlers: onView / onEdit / onRemove

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import { getBestPrice, normalizeImageUrl } from "../../utils/cards";
import AvgPriceBlock from "../search/AvgPriceBlock";

export default function CollectionCardTile({
  item = {},                // { id, name, setName, number, image, prices, _collection? }
  onView,                   // () => void
  onEdit,                   // () => void
  onRemove,                 // () => void
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
  const qty = Number(item?._collection?.quantity ?? 0) || 0;
  const variation = String(item?._collection?.variation ?? "normal");

  return (
    <View style={styles.card}>
      <Pressable onPress={onView} android_ripple={{ color: "#00000022" }}>
        <View style={styles.cardImageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="contain" />
          ) : null}

          {/* Owned quantity pill */}
          <View style={styles.qtyPill}>
            <Ionicons name="albums" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.qtyText}>x{qty}</Text>
          </View>

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

      {/* Unified action bar */}
      <View style={styles.actionBarWrap}>
        <ActionGhost
          icon="eye"
        //   label="View"
          color={COLORS.accent}
          onPress={onView}
        />
        <ActionGhost
          icon="create-outline"
        //   label="Edit"
          color={COLORS.text}
          onPress={onEdit}
        />
        <ActionGhost
          icon="trash-outline"
        //   label="Remove"
          color={COLORS.error || "#ff6b6b"}
          onPress={onRemove}
        />
      </View>
    </View>
  );
}

function variationLabel(v) {
  const k = String(v || "").toLowerCase().replace(/[\s_-]/g, "");
  if (k === "reverse" || k === "reverseholo" || k === "reverseholofoil" || k === "rev") return "Normal"; // keep calmer; change to "Reverse" if you prefer
  if (k === "holo" || k === "holofoil" || k === "foil") return "Holo";
  if (k === "normal" || k === "nonholo" || k === "nonfoil") return "Normal";
  return v || "Normal";
}

function ActionGhost({ icon, label, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.8 }]}
      android_ripple={{ color: "#00000022" }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={14} color={color} style={{ marginRight: 6 }} />
      <Text
        style={[
          styles.ghostLabel,
          { color, fontWeight: label === "View" ? "900" : "800" },
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

  qtyPill: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "#0e1119dd",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  qtyText: { color: "#fff", fontWeight: "800", fontSize: 11 },

  variationPill: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "#0e1119",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
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

  /* Unified action bar container */
  actionBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.background,               // single surface
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,                        // subtle outline
  },

  /* Ghost actions */
  ghostBtn: {
    flex: 1,
    minHeight: 30,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostLabel: {
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
});
