// components/common/CardImage.js
//
// Card image that falls back to CardImageFallback (sprite + name + set) when
// there is no uri or the image fails to load. `style` is applied to a wrapping
// View, so pass the same sizing you would have given the <Image>.

import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import CardImageFallback from "./CardImageFallback";

export default function CardImage({
  uri,
  name,
  cardId,
  setCode,
  style,
  resizeMode = "contain",
}) {
  const [failed, setFailed] = useState(false);
  const [mini, setMini] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  return (
    <View
      style={[styles.wrap, style]}
      onLayout={(e) => setMini(e.nativeEvent.layout.width < 90)}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onError={() => setFailed(true)}
        />
      ) : (
        <CardImageFallback name={name} cardId={cardId} setCode={setCode} compact={mini} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
});
