// components/common/SegmentTabs.js
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const BAR_W = 18;     // width of the overlay bars
const EDGE_PAD = 4;   // small breathing space inside the bars

export default function SegmentTabs({
  tabs,
  value,
  onChange,
  scrollable = true,
}) {
  const scrollRef = useRef(null);
  const [containerW, setContainerW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [scrollX, setScrollX] = useState(0);

  // store measured x/width for each tab for snapping
  const tabLayoutsRef = useRef(new Map());

  const canScroll = scrollable && contentW > containerW + 2;
  const atStart = scrollX <= 2;
  const atEnd = contentW - (scrollX + containerW) <= 2;

  // visible edges *inside* the bars
  const leftVisible = scrollX + BAR_W + EDGE_PAD;
  const rightVisible = scrollX + containerW - BAR_W - EDGE_PAD;

  const clampX = (x) =>
    Math.max(0, Math.min(x, Math.max(0, contentW - containerW)));

  const scrollToX = (x, animated = true) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ x: clampX(x), animated });
  };

  const nudge = (dir) => {
    if (!scrollRef.current) return;
    const delta = Math.max(120, containerW * 0.6);
    const nextX = clampX(scrollX + (dir === "right" ? delta : -delta));
    scrollToX(nextX, true);
  };

  // Ensure a tab is fully visible, aligning its start just after the left bar
  const ensureTabVisible = (key) => {
    const lay = tabLayoutsRef.current.get(key);
    if (!lay || !canScroll) return;

    const tabLeft = lay.x;
    const tabRight = lay.x + lay.w;

    if (tabLeft < leftVisible) {
      const target = tabLeft - (BAR_W + EDGE_PAD);
      scrollToX(target, true);
    } else if (tabRight > rightVisible) {
      const target = tabRight - (containerW - BAR_W - EDGE_PAD);
      scrollToX(target, true);
    }
  };

  // Snap to the nearest tab start after user scrolls
  const snapToNearest = () => {
    if (!canScroll || tabLayoutsRef.current.size === 0) return;
    const ideal = leftVisible; // align starts to this guideline
    let bestKey = null;
    let bestDist = Infinity;

    tabs.forEach((t) => {
      const lay = tabLayoutsRef.current.get(t.key);
      if (!lay) return;
      const dist = Math.abs(lay.x - ideal);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = t.key;
      }
    });

    if (!bestKey) return;
    const lay = tabLayoutsRef.current.get(bestKey);
    const target = lay.x - (BAR_W + EDGE_PAD);
    if (Math.abs(scrollX - target) > 2) scrollToX(target, true);
  };

  // When selected tab changes (tap) or sizes change, make it visible
  useEffect(() => {
    ensureTabVisible(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, containerW, contentW]);

  const content = (
    <View style={styles.inner}>
      {tabs.map((t, idx) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              onChange?.(t.key);
              requestAnimationFrame(() => ensureTabVisible(t.key));
            }}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              tabLayoutsRef.current.set(t.key, { x, w: width });
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={6}
            style={({ pressed }) => [
              styles.tab,
              idx !== tabs.length - 1 && styles.tabMargin,
              active && styles.tabActive,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={styles.wrap}
      accessibilityRole="tablist"
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      {/* Scroll area — reserve gutters so bars never cover text */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          canScroll
            ? { paddingLeft: BAR_W + EDGE_PAD, paddingRight: BAR_W + EDGE_PAD }
            : { flexGrow: 1, justifyContent: "center" },
        ]}
        onContentSizeChange={(w /*, h*/) => setContentW(w)}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        onScrollEndDrag={snapToNearest}
        onMomentumScrollEnd={snapToNearest}
        scrollEventThrottle={16}
      >
        {content}
      </ScrollView>

      {/* Left/Right overlay bars — only rendered when scrolling is actually needed */}
      {canScroll && (
        <View
          pointerEvents={atStart ? "none" : "auto"}
          style={[styles.bar, styles.barLeft]}
        >
          <Pressable
            onPress={() => nudge("left")}
            disabled={atStart}
            style={({ pressed }) => [
              styles.chevBtn,
              atStart && styles.chevDisabled,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Scroll left"
            accessibilityState={{ disabled: atStart }}
            hitSlop={6}
          >
            <Ionicons
              name="chevron-back"
              size={16}
              color={atStart ? COLORS.textMuted + "66" : COLORS.textMuted}
            />
          </Pressable>
        </View>
      )}

      {canScroll && (
        <View
          pointerEvents={atEnd ? "none" : "auto"}
          style={[styles.bar, styles.barRight]}
        >
          <Pressable
            onPress={() => nudge("right")}
            disabled={atEnd}
            style={({ pressed }) => [
              styles.chevBtn,
              atEnd && styles.chevDisabled,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Scroll right"
            accessibilityState={{ disabled: atEnd }}
            hitSlop={6}
          >
            <Ionicons
              name="chevron-forward"
              size={16}
              color={atEnd ? COLORS.textMuted + "66" : COLORS.textMuted}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginTop: 12,
    marginBottom: 8,
    overflow: "hidden",
  },

  inner: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollContent: {
    alignItems: "center",
  },

  tab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabMargin: { marginRight: 6 },
  tabActive: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { color: COLORS.textMuted, fontWeight: "800", fontSize: 13.5 },
  labelActive: { color: COLORS.text },

  bar: {
    position: "absolute",
    top: 2,
    bottom: 2,
    width: BAR_W,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  barLeft: {
    left: 2,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
  },
  barRight: {
    right: 2,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: COLORS.border,
  },

  chevBtn: {
    width: BAR_W,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  chevDisabled: { opacity: 0.45 },
});
