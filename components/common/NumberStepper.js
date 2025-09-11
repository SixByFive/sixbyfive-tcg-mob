// components/common/NumberStepper.js
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function NumberStepper({
  value = 1,
  min = 0,
  max = 999,
  onChange,
}) {
  const dec = () => onChange?.(Math.max(min, Number(value || 0) - 1));
  const inc = () => onChange?.(Math.min(max, Number(value || 0) + 1));

  return (
    <View style={styles.wrap}>
      <Pressable onPress={dec} style={[styles.btn, styles.left]}>
        <Ionicons name="remove" size={16} color={COLORS.text} />
      </Pressable>
      <View style={styles.valueWrap}>
        <Text style={styles.valueText}>{value}</Text>
      </View>
      <Pressable onPress={inc} style={[styles.btn, styles.right]}>
        <Ionicons name="add" size={16} color={COLORS.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center" },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  left: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  right: { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  valueWrap: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  valueText: { color: COLORS.text, fontWeight: "800" },
});
