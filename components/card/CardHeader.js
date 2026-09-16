// components/card/CardHeader.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../theme/colors";

export default function CardHeader({ title, onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backBtnText}>‹ Back</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 56 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.alt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  backBtnText: { color: COLORS.text, fontWeight: "700" },
  headerTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800", maxWidth: "70%" },
});
