// components/profile/tabs/SaleTradeTab.js
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";

function MiniCard({ title = "Card", image, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.miniCard}>
      {image ? (
        <Image source={{ uri: image }} style={styles.miniThumb} />
      ) : (
        <View style={styles.miniThumb} />
      )}
      <Text style={styles.miniTitle} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

export default function SaleTradeTab({
  title,                 // "For Sale" | "For Trade"
  items = [],
  onOpenCard,
  emptyText,             // optional override
  limit = 24,            // optional: cap how many to render
}) {
  const nothing = emptyText ?? (title === "For Sale" ? "No sale listings yet." : "No trade listings yet.");

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {items.length ? (
        <View style={styles.gridWrap}>
          {items.slice(0, limit).map((c) => (
            <MiniCard
              key={String(c.id)}
              title={c.name || "Card"}
              image={c.image}
              onPress={() => onOpenCard?.(c)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.bodyText}>{nothing}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  cardTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  bodyText: { color: COLORS.text, lineHeight: 20 },
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  miniCard: { width: "30%" },
  miniThumb: {
    width: "100%",
    aspectRatio: 63 / 88,
    backgroundColor: COLORS.alt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniTitle: { color: COLORS.text, fontSize: 12, marginTop: 6 },
});
