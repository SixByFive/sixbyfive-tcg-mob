// components/common/PageHeaderBack.js
// UPDATED: Adds optional profile image on the left of title/subtitle.

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function PageHeaderBack({
  title,
  subtitle,
  avatar,       // NEW: optional image URL
  onBack,       // optional custom back handler
  right = null, // optional right-side content (e.g., menu, call icon)
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {/* Back */}
        <Pressable
          onPress={onBack || (() => router.back())}
          hitSlop={10}
          style={({ pressed }) => [
            { opacity: pressed ? 0.7 : 1, padding: 6, marginRight: 6 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>

        {/* Avatar + Title/Sub */}
        <View style={styles.userBlock}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: COLORS.alt }]} />
          )}
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
        </View>

        {/* Optional right content */}
        {right && <View style={{ marginLeft: 8 }}>{right}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 6 },
  row: { flexDirection: "row", alignItems: "center" },

  userBlock: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },

  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },

  title: { color: COLORS.text, fontSize: 18, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { color: COLORS.textMuted, marginTop: 2, fontSize: 12.5 },
});
