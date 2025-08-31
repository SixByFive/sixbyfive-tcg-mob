// components/home/VerificationBanner.js

import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function VerificationBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Verify your email</Text>
      <Pressable onPress={() => router.push("/verify")} hitSlop={6}>
        <Text style={styles.link}>Resend →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: 1,
    borderLeftWidth: 4, borderLeftColor: COLORS.accent, borderRadius: 12,
    padding: 10, marginBottom: 12,
  },
  title: { color: COLORS.text, fontWeight: "900" },
  link: { color: COLORS.accent, fontWeight: "800" },
});
