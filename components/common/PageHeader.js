// components/common/PageHeader.js

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function PageHeader({ title, subtitle }) {
  return (
    <View style={styles.pageHeader}>
      <Text style={styles.pageTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 6 },
  pageTitle: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  pageSubtitle: { color: COLORS.textMuted, marginTop: 4, fontSize: 13.5 },
});
