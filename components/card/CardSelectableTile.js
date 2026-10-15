// components/cards/CardSelectableTile.js
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import CardImage from "../common/CardImage";

export default function CardSelectableTile({
  card,
  selected = false,
  onPress,
  onLongPress,
  notOwned = false,
  disabled = false,
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.wrap,
        selected && styles.wrapSelected,
        pressed && { opacity: 0.9 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${card?.name ?? "card"}`}
    >
      {/* Thumbnail */}
      <View style={styles.thumbWrap}>
        <CardImage
          uri={card?.image}
          name={card?.name}
          cardId={card?.id}
          style={styles.thumb}
          resizeMode="cover"
        />

        {/* “Not owned” ribbon (Search) */}
        {notOwned && (
          <View style={styles.ribbon}>
            <Text style={styles.ribbonText}>Not owned</Text>
          </View>
        )}

        {/* Selection check */}
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
      </View>

      {/* Name */}
      {!!card?.name && (
        <Text style={styles.name} numberOfLines={1}>
          {card.name}
        </Text>
      )}
    </Pressable>
  );
}

const TILE_RADIUS = 12;

const styles = StyleSheet.create({
  wrap: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: TILE_RADIUS,
    padding: 8,
  },
  wrapSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.alt,
  },

  thumbWrap: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 0.72, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: 1 },

  check: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkMark: { color: "#fff", fontWeight: "900", fontSize: 12 },

  ribbon: {
    position: "absolute",
    left: -6,
    top: 10,
    backgroundColor: "#000000aa",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  ribbonText: { color: "#fff", fontWeight: "800", fontSize: 10.5 },

  name: { color: COLORS.text, fontWeight: "800", marginTop: 8 },
});
