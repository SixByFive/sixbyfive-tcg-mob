// components/common/SelectBar.js

import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../theme/colors";

export default function SelectBar({
  count = 0,
  onAdd,
  onClear,
  onCancel,
  bottomInset,        // number (optional) – extra safe-area padding if parent already measured
  fullBleed = true,   // render flush to sheet edges
  styleOverride = {}, // optional extra styles
  addLabel = "Add to page",
  clearLabel = "Clear",
  cancelLabel = "Cancel",
}) {
  const insets = useSafeAreaInsets();
  const disabled = count <= 0;

  const containerStyles = [
    styles.container,
    fullBleed ? styles.fullBleed : styles.inset,
    { paddingBottom: Math.max(bottomInset ?? insets.bottom, 0) + 8 },
    styleOverride,
  ];

  return (
    <View style={containerStyles} pointerEvents="auto">
      {/* Top row: selection count + cancel */}
      <View style={styles.topRow}>
        <Text style={styles.countText}>
          {disabled ? "No cards selected" : `${count} selected`}
        </Text>
        <Pressable onPress={onCancel} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </Pressable>
      </View>

      {/* Bottom row: actions */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={onClear}
          disabled={disabled}
          style={({ pressed }) => [
            styles.ghostBtn,
            disabled && styles.disabledBtn,
            pressed && !disabled && styles.pressed,
          ]}
          hitSlop={8}
        >
          <Text style={[styles.ghostText, disabled && styles.disabledText]}>{clearLabel}</Text>
        </Pressable>

        <Pressable
          onPress={onAdd}
          disabled={disabled}
          style={({ pressed }) => [
            styles.primaryBtn,
            disabled && styles.disabledPrimary,
            pressed && !disabled && styles.pressed,
          ]}
          hitSlop={8}
        >
          <Text style={[styles.primaryText, disabled && styles.disabledPrimaryText]}>{addLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const CARD_RADIUS = 16;

const styles = StyleSheet.create({
  container: {
    // sits at the bottom of the parent (no gap)
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingTop: 10,
    // soft elevation/shadow (no borders/lines)
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
      },
      android: {
        elevation: 12,
      },
    }),
  },

  fullBleed: {
    // flush with sheet edges
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },

  inset: {
    // card look, if you ever want it inset (not used by default)
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  countText: {
    color: COLORS.text,
    fontWeight: "800",
  },
  cancelText: {
    color: COLORS.textMuted,
    fontWeight: "800",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },

  ghostBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: {
    color: COLORS.text,
    fontWeight: "800",
  },

  primaryBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
  },

  pressed: { opacity: 0.85 },

  disabledBtn: {
    opacity: 0.5,
  },
  disabledText: {
    color: COLORS.textMuted,
  },
  disabledPrimary: {
    backgroundColor: COLORS.alt,
  },
  disabledPrimaryText: {
    color: COLORS.textMuted,
  },
});
