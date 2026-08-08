import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

export default function Collapsible({ open, children, duration = 220 }) {
  const [measured, setMeasured] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [fullyOpen, setFullyOpen] = useState(false);
  const hAnim = useRef(new Animated.Value(0)).current;
  const oAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!measured) return;
    if (!open) setFullyOpen(false);
    Animated.timing(hAnim, {
      toValue: open ? contentH : 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && open) setFullyOpen(true);
    });
    Animated.timing(oAnim, {
      toValue: open ? 1 : 0,
      duration: Math.max(120, duration - 40),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [open, measured, contentH, duration, hAnim, oAnim]);

  return (
    <>
      {!measured && (
        <View
          style={{ position: "absolute", opacity: 0, left: -10000, right: 0 }}
          pointerEvents="none"
          onLayout={(e) => {
            setContentH(e.nativeEvent.layout.height);
            setMeasured(true);
          }}
        >
          <View style={styles.card}>{children}</View>
        </View>
      )}
      {measured ? (
        <Animated.View
          style={
            fullyOpen
              ? { opacity: oAnim, overflow: "visible" }
              : { height: hAnim, opacity: oAnim, overflow: "hidden" }
          }
        >
          <View style={styles.card}>{children}</View>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
});
