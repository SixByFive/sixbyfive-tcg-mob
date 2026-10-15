// components/card/CardImageBlock.js

import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS } from "../../theme/colors";
import CardImage from "../common/CardImage";

export default function CardImageBlock({ imageUri, name, cardId }) {
  return (
    <View style={styles.imageWrap}>
      <CardImage uri={imageUri} name={name} cardId={cardId} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  image: { width: "100%", aspectRatio: 245 / 337 },
});
