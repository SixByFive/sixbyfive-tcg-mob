// app/settings.js
// CHANGED: Added router + Linking, new "Subscription" rows, and a few helpful settings links.
// UI-only — wire real URLs and actions later.

import { router } from "expo-router"; // NEW
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native"; // CHANGED: +Pressable, +Linking
import PageHeaderBack from "../components/common/PageHeaderBack";
import { COLORS } from "../theme/colors";

export default function Settings() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [darkMode] = useState(true); // app is dark-only for now (read-only here)

  // NEW: small helper to open external links safely
  const openURL = (url) => Linking.openURL(url).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBack title="App Settings" subtitle="Notifications & preferences" />

      {/* NEW: Subscription section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>

        <Pressable
          style={styles.rowBtn}
          onPress={() => router.push("/subscriptions/manage")}
        >
          <Text style={styles.label}>Manage subscription</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable
          style={styles.rowBtn}
          onPress={() => router.push("/subscriptions")}
        >
          <Text style={styles.label}>Upgrade</Text>
          <Text style={styles.value}>View plans</Text>
        </Pressable>

        <Pressable
          style={styles.rowBtn}
          onPress={() => openURL("https://tcg.sixbyfive.com/billing")} // TODO: replace with portal URL from backend
        >
          <Text style={styles.label}>Billing portal</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>
      </View>

      {/* CHANGED: Notifications section kept, same toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Push notifications</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>
      </View>

      {/* NEW: Preferences section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Theme</Text>
          <Text style={styles.value}>{darkMode ? "Dark" : "Light"}</Text>
        </View>
      </View>

      {/* NEW: Help & Legal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Legal</Text>

        <Pressable
          style={styles.rowBtn}
          onPress={() => openURL("https://tcg.sixbyfive.com/privacy")}
        >
          <Text style={styles.label}>Privacy Policy</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable
          style={styles.rowBtn}
          onPress={() => openURL("https://tcg.sixbyfive.com/terms")}
        >
          <Text style={styles.label}>Terms of Service</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable
          style={styles.rowBtn}
          onPress={() => openURL("mailto:support@sixbyfive.com")}
        >
          <Text style={styles.label}>Contact support</Text>
          <Text style={styles.value}>Email</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16 },
  sectionTitle: { color: COLORS.textMuted, fontWeight: "800", marginBottom: 6 }, // NEW

  // Existing row (switch style)
  row: {
    paddingVertical: 14,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // NEW: row style for pressable rows
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
