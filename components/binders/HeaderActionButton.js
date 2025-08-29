// components/binder/HeaderActionButton.js
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { COLORS } from "../../theme/colors";

export default function HeaderActionButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: { color: COLORS.text, fontWeight: "800" },
});
