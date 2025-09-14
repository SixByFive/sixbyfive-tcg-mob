// components/binder/PagePager.js
import React, { useEffect, useMemo, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function PagePager({
  pages = [],
  activeIndex = 0,
  onSelectIndex,
  onAddPage,
  onDeletePage,
}) {
  const listRef = useRef(null);

  // Guarded values
  const count = Array.isArray(pages) ? pages.length : 0;
  const canDelete = count > 1;
  const clampedActive = Math.max(0, Math.min(activeIndex ?? 0, Math.max(0, count - 1)));

  // Precompute layout for FlatList (stable item size)
  const ITEM_WIDTH = 48; // minWidth 32 + padding/gap; adjust if you change styles
  const getItemLayout = useMemo(
    () => (_data, index) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index }),
    [ITEM_WIDTH]
  );

  // Keep active page in view
  useEffect(() => {
    if (!listRef.current || count === 0) return;
    try {
      listRef.current.scrollToIndex({
        index: clampedActive,
        animated: true,
        viewPosition: 0.5, // center
      });
    } catch {
      // In rare cases FlatList hasn't measured yet; ignore.
    }
  }, [clampedActive, count]);

  return (
    <View style={styles.wrap}>
      <CircleBtn
        label="–"
        disabled={!canDelete}
        onPress={canDelete ? onDeletePage : undefined}
        accessibilityLabel={canDelete ? "Remove page" : "Cannot remove page"}
      />

      <FlatList
        ref={listRef}
        horizontal
        data={pages}
        keyExtractor={(p, i) => String(p?.id ?? i)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, gap: 8 }}
        getItemLayout={getItemLayout}
        renderItem={({ index }) => {
          const active = index === clampedActive;
          return (
            <Pressable
              onPress={() => onSelectIndex?.(index)}
              style={({ pressed }) => [styles.dot, active && styles.dotActive, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={`Go to page ${index + 1}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.dotText, active && styles.dotTextActive]}>{index + 1}</Text>
            </Pressable>
          );
        }}
      />

      <CircleBtn
        label="+"
        onPress={onAddPage}
        accessibilityLabel="Add page"
      />
    </View>
  );
}

function CircleBtn({ label, onPress, disabled, accessibilityLabel }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.circle,
        disabled && styles.circleDisabled,
        pressed && !disabled && { opacity: 0.92 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
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
  circleDisabled: {
    backgroundColor: "#2f3550",
    opacity: 0.6,
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
