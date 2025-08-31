// components/common/PageHeaderBackSimple.js

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function PageHeaderBackSimple({
  title,
  subtitle,
  onBack,          // optional custom back handler
  right = null,    // optional right-side content
  right2 = null
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {/* Back */}
        <Pressable
          onPress={onBack || (() => router.back())}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>

        {/* Title / Subtitle */}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Optional right content */}
        {right && <View style={{ marginLeft: 8 }}>{right}</View>}
        {right2 && <View style={{ marginLeft: 8 }}>{right2}</View> || null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // match PageHeader paddings
  wrap: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 6 },
  row: { flexDirection: "row", alignItems: "center" },

  backBtn: { padding: 6, marginRight: 8 },

  // match PageHeader typography
  title: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: COLORS.textMuted, marginTop: 4, fontSize: 13.5 },
});
