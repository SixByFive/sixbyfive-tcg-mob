// components/home/TipsCard.js
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const TIPS = [
  "Tip: Long-press on a card to quickly add it to a binder.",
  "Tip: Use the search number and set code to jump straight to a specific card.",
  "Tip: Pull to refresh on Home to update your stats and activity.",
  "Tip: Add notes to binder slots to remember condition or trade status.",
];

export default function TipsCard() {
  const [idx, setIdx] = React.useState(() => Math.floor(Math.random() * TIPS.length));
  React.useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % TIPS.length), 8000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Pro tip</Text>
      <Text style={styles.tip}>{TIPS[idx]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  title: { color: COLORS.text, fontWeight: "800", marginBottom: 6 },
  tip: { color: COLORS.text },
});
