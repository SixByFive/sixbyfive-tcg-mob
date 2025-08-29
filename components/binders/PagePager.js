// components/binder/PagePager.js
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function PagePager({
  pages,
  activeIndex,
  onSelectIndex,
  onAddPage,
  onDeletePage,
}) {
  return (
    <View style={styles.wrap}>
      <CircleBtn label="–" onPress={onDeletePage} />
      <FlatList
        horizontal
        data={pages}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, gap: 8 }}
        renderItem={({ index }) => {
          const active = index === activeIndex;
          return (
            <Pressable
              onPress={() => onSelectIndex(index)}
              style={({ pressed }) => [styles.dot, active && styles.dotActive, pressed && { opacity: 0.92 }]}
            >
              <Text style={[styles.dotText, active && styles.dotTextActive]}>{index + 1}</Text>
            </Pressable>
          );
        }}
      />
      <CircleBtn label="+" onPress={onAddPage} />
    </View>
  );
}

function CircleBtn({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.circle, pressed && { opacity: 0.92 }]}>
      <Text style={styles.circleText}>{label}</Text>
    </Pressable>
  );
}

const HEIGHT = 64;

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    height: HEIGHT,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 8,
    gap: 8,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: { color: "#fff", fontWeight: "900", fontSize: 18, lineHeight: 18 },

  dot: {
    minWidth: 32,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dotActive: { borderColor: COLORS.accent, backgroundColor: COLORS.alt },
  dotText: { color: COLORS.textMuted, fontWeight: "800", fontSize: 12.5 },
  dotTextActive: { color: COLORS.text },
});
