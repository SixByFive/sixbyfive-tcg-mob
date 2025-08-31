// components/lists/SwipeRow.js

import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";
import { COLORS } from "../../theme/colors";

const ACTION_WIDTH = 90;     // width per action button
const MAX_ACTIONS = 3;       // cap total width
const SNAP_THRESHOLD = 0.35; // open if dragged > 35% of total

export default function SwipeRow({ children, rightActions = [] }) {
  const actions = useMemo(() => rightActions.slice(0, MAX_ACTIONS), [rightActions]);
  const totalWidth = actions.length * ACTION_WIDTH;

  const translateX = useSharedValue(0);
  const openX = -totalWidth; // negative to slide left

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // clamp to [-totalWidth, 0]
      const next = Math.max(openX, Math.min(0, translateX.value + e.changeX));
      translateX.value = next;
    })
    .onEnd(() => {
      const shouldOpen = Math.abs(translateX.value) > totalWidth * SNAP_THRESHOLD;
      translateX.value = withSpring(shouldOpen ? openX : 0, { damping: 18, stiffness: 220 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const close = () => {
    translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
  };

  return (
    <View style={[styles.wrap, { height: "auto" }]}>
      {/* Right actions behind the row */}
      <View style={[styles.actionsWrap, { width: totalWidth }]}>
        {actions.map((a, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [
              styles.action,
              a.type === "danger" ? styles.actionDanger : styles.actionPrimary,
              { opacity: pressed ? 0.85 : 1, width: ACTION_WIDTH },
            ]}
            onPress={() => {
              // close row then fire action (feels better)
              close();
              a.onPress && a.onPress();
            }}
          >
            <Text style={styles.actionText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Foreground (your row) */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.foreground, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderRadius: 12,
  },
  actionsWrap: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  action: {
    justifyContent: "center",
    alignItems: "center",
    borderLeftColor: COLORS.border,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  actionPrimary: { backgroundColor: COLORS.alt },
  actionDanger: { backgroundColor: "#2b0000" },
  actionText: { color: "#fff", fontWeight: "800" },
  foreground: {
    // let the row supply its own background; we’ll still round the corners
  },
});
