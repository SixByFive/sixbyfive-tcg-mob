// components/collection/TopControls.js

import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS } from "../../theme/colors";
import Stat from "../common/Stat";

export default function TopControls({ stats, segment, onChangeSegment, query, onChangeQuery }) {
  return (
    <View style={styles.topCard}>
      <View style={styles.statsRow}>
        <Stat label="Cards" value={stats.cards} />
        <Stat label="Binders" value={stats.binders} />
        <Stat label="Wishlist" value={stats.wishlist} />
      </View>

      <View style={styles.segment}>
        {["binders", "all", "wishlist"].map((key) => {
          const active = segment === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChangeSegment(key)}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {key === "binders" ? "Binders" : key === "all" ? "All Cards" : "Wishlist"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {segment === "binders" && (
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search binders…"
          placeholderTextColor={COLORS.textMuted}
          style={styles.search}
          returnKeyType="search"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    marginHorizontal: 12,
    padding: 12,
    gap: 10,
  },
  statsRow: { flexDirection: "row", gap: 16, justifyContent: "space-between" },

  segment: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    flexDirection: "row",
    padding: 4,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentText: { color: COLORS.textMuted, fontWeight: "700" },
  segmentTextActive: { color: COLORS.text },

  search: {
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
