// components/collection/Fab.js

import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { COLORS } from "../../theme/colors";

export default function Fab({ label = "＋", onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.fab}
      accessibilityRole="button"
      accessibilityLabel="Create new binder"
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
});
