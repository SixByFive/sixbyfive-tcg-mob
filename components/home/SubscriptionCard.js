// components/home/SubscriptionCard.js
// Tiered excitement v2: Free (neutral) < Pro (accent blue) < Elite (gold)
// Compact, no new deps.

import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function SubscriptionCard({ planName = "Elite", renewalText = "—" }) {
  const normalized = (planName || "").trim();
  const tier = getTier(normalized); // "free" | "pro" | "elite"
  const t = TIERS[tier];

  // CHANGED: always send to /subscriptions for Free/Pro (upgrade flow)
  // Elite has no buttons, so this won't be used for elite anyway.
  const onPrimary = () => router.push("/subscriptions");
  const onPlans = () => router.push("/subscriptions");

  // ADDED: hide CTAs when Elite
  const showCtas = tier !== "elite";

  // ADDED: force "Upgrade" label for Pro (even if theme says otherwise)
  const primaryLabel = tier === "pro" ? "Upgrade" : t.primaryLabel;

  return (
    <View
      style={[
        styles.card,
        t.cardExtra,
        Platform.OS === "ios" ? t.iosShadow : t.androidElevation,
      ]}
    >
      {t.topBar && <View style={[styles.topBar, t.topBar]} />}

      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {t.emoji} Subscription
        </Text>
        <Text
          style={[
            styles.pill,
            { backgroundColor: t.pillBg, color: t.pillTextColor },
          ]}
          numberOfLines={1}
        >
          {formattedLabel(normalized)}
        </Text>
      </View>

      <Text style={styles.sub} numberOfLines={1}>
        {t.subline(renewalText, normalized)}
      </Text>

      {/* CHANGED: Only render buttons for non-elite tiers */}
      {showCtas && (
        <View style={styles.ctaRow}>
          <Pressable
            onPress={onPrimary}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: t.primaryBg },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.primaryText, { color: t.primaryTextColor }]}>
              {primaryLabel}
            </Text>
          </Pressable>

          <Pressable onPress={onPlans} hitSlop={8}>
            <Text style={[styles.link, { color: t.linkColor }]}>Plans</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* ---------------- helpers ---------------- */

function getTier(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("elite")) return "elite";
  if (n.includes("pro") || n.includes("plus") || n.includes("premium")) return "pro";
  if (n.includes("free") || !n) return "free";
  return "pro";
}

function formattedLabel(name) {
  const n = (name || "").trim();
  if (!n) return "Free";
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/* ---------------- tier themes ---------------- */

const GOLD = "#F5C542";

const TIERS = {
  free: {
    emoji: "✨",
    pillBg: COLORS.accent,
    pillTextColor: "#fff",
    primaryBg: COLORS.accent,
    primaryTextColor: "#fff",
    primaryLabel: "Upgrade to Pro",
    subline: () => "Hourly prices • Advanced filters • Trade tools",
    linkColor: COLORS.text,
    topBar: null,
    cardExtra: { borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
    iosShadow: { shadowColor: "transparent" },
    androidElevation: { elevation: 0 },
  },
  pro: {
    emoji: "🛡️",
    pillBg: COLORS.accent,
    pillTextColor: "#fff",
    primaryBg: COLORS.accent,
    primaryTextColor: "#fff",
    // CHANGED: default label for pro is now "Upgrade"
    primaryLabel: "Upgrade",
    subline: (renewalText, label) => `You're on ${formattedLabel(label)} — ${renewalText}`,
    linkColor: "#ffffff",
    topBar: { backgroundColor: COLORS.accent, height: 3, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    cardExtra: { borderWidth: 1, borderColor: COLORS.border },
    iosShadow: { shadowColor: COLORS.accent, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    androidElevation: { elevation: 2 },
  },
  elite: {
    emoji: "👑",
    pillBg: GOLD,
    pillTextColor: "#111",
    primaryBg: GOLD,
    primaryTextColor: "#111",
    primaryLabel: "Manage", // UNUSED now (no buttons for elite)
    subline: (renewalText, label) => `You're on ${formattedLabel(label)} — ${renewalText}`,
    linkColor: "#ffffff",
    topBar: { backgroundColor: GOLD, height: 4, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    cardExtra: { borderWidth: 1, borderColor: "#6a571a" },
    iosShadow: { shadowColor: GOLD, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    androidElevation: { elevation: 3 },
  },
};

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  card: {
    position: "relative",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14.5,
    letterSpacing: 0.2,
    flex: 1,
    marginRight: 8,
  },
  pill: {
    fontWeight: "900",
    fontSize: 11.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sub: {
    color: COLORS.textMuted,
    marginTop: 6,
    fontSize: 12.5,
  },
  ctaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  pressed: { opacity: 0.92 },
  primaryText: { fontWeight: "900" },
  link: { fontWeight: "800" },
});
