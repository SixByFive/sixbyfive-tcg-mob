// components/ui/Toast.js

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const palettes = {
  success: { bg: COLORS.accent, text: "#fff" },
  error:   { bg: COLORS.error || "#E53935", text: "#fff" },
  info:    { bg: COLORS.surface, text: COLORS.text },
};

export default function Toast({ message, type = "info" }) {
  const pal = palettes[type] || palettes.info;
  return (
    <View style={[styles.wrap, { backgroundColor: pal.bg, borderColor: COLORS.border }]}>
      <Text style={[styles.text, { color: pal.text }]} numberOfLines={3}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  text: { fontWeight: "800", letterSpacing: 0.2 },
});
