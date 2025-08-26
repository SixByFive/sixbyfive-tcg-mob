// components/market/SegmentControl.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function SegmentControl({ value, onChange, options }) {
  return (
    <View style={styles.segment}>
      {options.map(({ key, label }) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    marginHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 6,
    flexDirection: "row",
    gap: 6,
  },
  segmentBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8 },
  segmentBtnActive: { backgroundColor: COLORS.alt },
  segmentText: { color: COLORS.textMuted, fontWeight: "700" },
  segmentTextActive: { color: COLORS.text },
});
