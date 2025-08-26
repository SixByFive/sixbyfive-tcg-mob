// components/search/CardTile.js

import { COLORS } from "../../theme/colors";

import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { getBestPrice, normalizeImageUrl } from "../../utils/cards";
import AvgPriceBlock from "./AvgPriceBlock";

export default function CardTile({ item, onPress }) {
  const price = getBestPrice(item?.prices, "normal");
  const imageUri = normalizeImageUrl(item?.image);

  return (
    <Pressable onPress={onPress} style={styles.card}>
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
          <AvgPriceBlock tcgp={price.tcgplayer} cmkt={price.cardmarket} />
        </View>
      </View>
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
});
