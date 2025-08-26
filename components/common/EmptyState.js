// components/common/EmptyState.js

import React from "react";
import { StyleSheet, Text } from "react-native";
import { COLORS } from "../../theme/colors";

export default function EmptyState({ message }) {
  return <Text style={styles.emptyText}>{message}</Text>;
}

const styles = StyleSheet.create({
  emptyText: { color: COLORS.textMuted, textAlign: "center", marginTop: 24 },
});
