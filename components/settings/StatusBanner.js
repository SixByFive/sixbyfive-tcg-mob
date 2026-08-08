import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function StatusBanner({ type = "info", message = "", onClose }) {
  if (!message) return null;

  const palette =
    type === "success"
      ? { bg: "#0f5132", fg: "#d1e7dd", border: "#badbcc" }
      : type === "error"
        ? { bg: "#842029", fg: "#f8d7da", border: "#f5c2c7" }
        : type === "warning"
          ? { bg: "#664d03", fg: "#fff3cd", border: "#ffecb5" }
          : { bg: "#055160", fg: "#cff4fc", border: "#b6effb" };

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{message}</Text>
      {onClose ? (
        <Pressable onPress={onClose} style={styles.close}>
          <Text style={[styles.text, { color: palette.fg }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  text: { fontSize: 12, fontWeight: "700" },
  close: { marginLeft: 12 },
});
