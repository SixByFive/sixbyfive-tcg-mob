// components/sets/SetPageHeader.js
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import getSetLogo from "../../utils/setLogos.native";

export default function SetPageHeader({
  name,
  code,
  abbr,          // prefer this over code for the subtitle
  completed = 0,
  total = 0,
  onBack,
  right = null,
}) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  // Prefer abbr if present; fall back to code; otherwise hide subtitle
  const subtitleText = (() => {
    const a = (abbr ?? "").trim();
    if (a) return a.toUpperCase();
    const c = (code ?? "").trim();
    return c ? c.toUpperCase() : null;
  })();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {/* Back */}
        <Pressable
          onPress={onBack || (() => router.back())}
          hitSlop={10}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 6, marginRight: 6 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>

        {/* Logo + Title + Abbr/Code */}
        <View style={styles.infoBlock}>
          <View style={styles.logoWrap}>
            <Image
              source={getSetLogo(name, code)}
              style={{ width: "80%", height: "80%" }}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {name}
            </Text>
            {!!subtitleText && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitleText}
              </Text>
            )}
          </View>
        </View>

        {/* Optional right content */}
        {right && <View style={{ marginLeft: 8 }}>{right}</View>}
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>Completion</Text>
        <Text style={styles.progressValue}>
          {completed}/{total} • {pct}%
        </Text>
      </View>
      <View style={styles.progressBarOuter}>
        <View style={[styles.progressBarInner, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 35,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
  },
  row: { flexDirection: "row", alignItems: "center" },

  infoBlock: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  title: { color: COLORS.text, fontSize: 18, fontWeight: "900", letterSpacing: 0.2 },
  subtitle: { color: COLORS.textMuted, marginTop: 2, fontSize: 12.5 },

  progressRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  progressValue: { color: COLORS.text, fontSize: 12, fontWeight: "900" },

  progressBarOuter: {
    marginTop: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  progressBarInner: { height: "100%", backgroundColor: COLORS.accent },
});
