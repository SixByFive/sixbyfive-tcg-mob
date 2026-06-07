// components/market/SegmentControl.js

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function SegmentControl({ value, onChange, options }) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 4,
  },
  scrollContent: {
    flexDirection: "row",
    gap: 4,
  },
  segmentBtn: {
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  segmentBtnActive: { backgroundColor: COLORS.alt },
  segmentText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },
  segmentTextActive: { color: COLORS.text },
});
