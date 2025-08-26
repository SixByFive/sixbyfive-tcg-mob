// components/common/Avatar.js

import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function Avatar({ name, src, size = 72 }) {
  const initials = useMemo(() => {
    if (!name) return "U";
    const parts = String(name).trim().split(/\s+/);
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
  }, [name]);

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS.alt }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: size * 0.34 }}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
