// app/settings.js

import Constants from "expo-constants";
import { router } from "expo-router";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import PageHeaderBackSimple from "../components/common/PageHeaderBackSimple";
import { COLORS } from "../theme/colors";

export default function Settings() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [darkMode] = useState(true); // app is dark-only for now (read-only here)

  const openURL = (url) => Linking.openURL(url).catch(() => {});
  const appVersion = Constants.expoConfig?.version ?? "1.0.0"; // fallback

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple title="App Settings" subtitle="Notifications & preferences" />

      {/* Subscription section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>

        <Pressable style={styles.rowBtn} onPress={() => router.push("/subscriptions/manage")}>
          <Text style={styles.label}>Manage subscription</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable style={styles.rowBtn} onPress={() => router.push("/subscriptions")}>
          <Text style={styles.label}>Upgrade</Text>
          <Text style={styles.value}>View plans</Text>
        </Pressable>

        <Pressable
          style={styles.rowBtn}
          onPress={() => openURL("https://tcg.sixbyfive.com/billing")}
        >
          <Text style={styles.label}>Billing portal</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>
      </View>

      {/* Notifications section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Push notifications</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>
      </View>

      {/* Preferences section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Theme</Text>
          <Text style={styles.value}>{darkMode ? "Dark" : "Light"}</Text>
        </View>
      </View>

      {/* Help & Legal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Legal</Text>

        <Pressable style={styles.rowBtn} onPress={() => openURL("https://tcg.sixbyfive.com/privacy")}>
          <Text style={styles.label}>Privacy Policy</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable style={styles.rowBtn} onPress={() => openURL("https://tcg.sixbyfive.com/terms")}>
          <Text style={styles.label}>Terms of Service</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable style={styles.rowBtn} onPress={() => openURL("mailto:support@sixbyfive.com")}>
          <Text style={styles.label}>Contact support</Text>
          <Text style={styles.value}>Email</Text>
        </Pressable>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{appVersion}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16 },
  sectionTitle: { color: COLORS.textMuted, fontWeight: "800", marginBottom: 6 },

  row: {
    paddingVertical: 14,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  rowBtn: {
    paddingVertical: 14,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  label: { color: COLORS.textSecondary, fontWeight: "700" },
  value: { color: COLORS.textMuted },
});
