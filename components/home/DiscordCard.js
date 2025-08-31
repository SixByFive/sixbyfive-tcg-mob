// components/home/DiscordCard.js

import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function DiscordCard({ inviteUrl }) {
  const open = () => Linking.openURL(inviteUrl).catch(() => {});

  return (
    <View style={styles.wrap}>
      {/* Accent glow orb (decorative) */}
      <View style={styles.glow} />

      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.left}>
          <Text style={styles.emoji} accessibilityLabel="Community">💬</Text>
          <Text style={styles.title}>Discord</Text>
          <Text style={styles.pill}>Community</Text>
        </View>

        <Pressable onPress={open} hitSlop={6}>
          <Text style={styles.openLink}>Open →</Text>
        </Pressable>
      </View>

      {/* Body copy (one concise line) */}
      <Text style={styles.sub} numberOfLines={2}>
        Get help, share pulls, and trade with the community.
      </Text>

      {/* CTA */}
      <Pressable onPress={open} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.92 }]}>
        <Text style={styles.btnText}>Join Discord</Text>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,           
    marginBottom: 12,
    overflow: "hidden",
  },

  // Soft accent glow in the background
  glow: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    opacity: 0.12,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 8 },
  emoji: { fontSize: 16 },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 14.5, letterSpacing: 0.2 },
  pill: {
    color: "#fff",
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: "900",
  },
  openLink: { color: COLORS.accent, fontWeight: "800" },

  sub: { color: COLORS.textMuted, marginBottom: 10 },

  btn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "900" },

  // Decorative dots
  dotRow: { position: "absolute", right: 10, top: 10, flexDirection: "row", gap: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
});
