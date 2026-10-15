// components/common/CardImageFallback.js
//
// Shown when a card has no image (or it fails to load):
//   [ Pokémon sprite ]
//   Name
//   SET
// `compact` (thumbnails) drops the text and shows the sprite only.

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import { parseCardId } from "../../utils/cardImageHelpers";
import { getPokemonSpriteUrl } from "../../utils/pokemonSprite";

export default function CardImageFallback({ name, cardId, setCode, compact }) {
  const [spriteFailed, setSpriteFailed] = useState(false);
  const sprite = useMemo(() => getPokemonSpriteUrl(name), [name]);
  const abbr = String(setCode || parseCardId(cardId).setCode || "").toUpperCase();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {sprite && !spriteFailed ? (
        <Image
          source={{ uri: sprite }}
          style={compact ? styles.spriteCompact : styles.sprite}
          resizeMode="contain"
          onError={() => setSpriteFailed(true)}
        />
      ) : (
        <Ionicons name="image-outline" size={compact ? 18 : 36} color={COLORS.textMuted} />
      )}
      {!compact && (
        <>
          <Text style={styles.name} numberOfLines={2}>
            {name || "Unknown card"}
          </Text>
          {abbr ? <Text style={styles.set}>{abbr}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    gap: 4,
    backgroundColor: COLORS.alt,
  },
  wrapCompact: { padding: 2 },
  sprite: { width: "70%", height: "50%" },
  spriteCompact: { width: "90%", height: "90%" },
  name: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  set: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
