// app/settings.js

import React, { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import PageHeaderBack from "../components/common/PageHeaderBack";
import { COLORS } from "../theme/colors";

export default function Settings() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [darkMode] = useState(true); // app is dark-only for now

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBack title="App Settings" subtitle="Notifications & preferences" />

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Push notifications</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Theme</Text>
          <Text style={styles.value}>{darkMode ? "Dark" : "Light"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16 },
  row: {
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
