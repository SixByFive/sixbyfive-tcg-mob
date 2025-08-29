// components/home/SectionHeader.js
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      {onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionLink}>{actionLabel} →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { color: COLORS.text, fontWeight: "800" },
  sectionLink: { color: COLORS.accent, fontWeight: "800" },
});
