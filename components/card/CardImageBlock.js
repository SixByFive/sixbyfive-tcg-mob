// components/card/CardImageBlock.js

import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function CardImageBlock({ imageUri }) {
  return (
    <View style={styles.imageWrap}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={[styles.image, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: COLORS.textMuted }}>No image</Text>
        </View>
      )}
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
