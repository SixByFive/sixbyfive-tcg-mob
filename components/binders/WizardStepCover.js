// components/binders/WizardStepCover.js
// Match web's STANDARD_COLOURS and return the same data shape.
// onChange receives an object: { name, color, accent, elasticColor }

import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

// EXACT palette from web (added elasticColor default)
export const STANDARD_COLOURS = [
  { name: "Black",  color: "#181822", accent: "#7de95a", elasticColor: "#181822" },
  { name: "Blue",   color: "#2963FF", accent: "#85e085", elasticColor: "#181822" },
  { name: "Red",    color: "#C83C3C", accent: "#FFB800", elasticColor: "#181822" },
  { name: "Green",  color: "#1CC88A", accent: "#F0FFB7", elasticColor: "#181822" },
  { name: "Purple", color: "#7C3AED", accent: "#FFD6E0", elasticColor: "#181822" },
  { name: "Grey",   color: "#8F8F99", accent: "#FFDB70", elasticColor: "#181822" },
  { name: "White",  color: "#F6F6FB", accent: "#7de95a", elasticColor: "#181822" },
  { name: "Yellow", color: "#FFD600", accent: "#FFD6E0", elasticColor: "#181822" },
  { name: "Pink",   color: "#FF89BB", accent: "#FFF3B0", elasticColor: "#181822" },
];

const DEFAULT_COVER = STANDARD_COLOURS[0]; // Black

/**
 * Props:
 * - value: { name, color, accent, elasticColor } | string (name) | undefined
 * - onChange: (coverObj) => void
 */
export default function WizardStepCover({ value, onChange }) {
  // Normalize selected cover
  const selected = useMemo(() => {
    if (!value) return DEFAULT_COVER;
    if (typeof value === "string") {
      return STANDARD_COLOURS.find((c) => c.name === value) || DEFAULT_COVER;
    }
    if (value && typeof value === "object") {
      const byName = value.name
        ? STANDARD_COLOURS.find((c) => c.name === value.name)
        : null;
      if (byName) return byName;

      // Try by color+accent match
      const byPair = STANDARD_COLOURS.find(
        (c) => c.color?.toLowerCase() === (value.color || "").toLowerCase() &&
               c.accent?.toLowerCase() === (value.accent || "").toLowerCase()
      );
      return byPair || { ...DEFAULT_COVER, ...value };
    }
    return DEFAULT_COVER;
  }, [value]);

  const handlePick = (cover) => {
    onChange?.({
      name: cover.name,
      color: cover.color,
      accent: cover.accent,
      elasticColor: cover.elasticColor || "#181822",
    });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Choose a cover</Text>
      <Text style={styles.sub}>Pick a colour theme for your binder.</Text>

      <View style={styles.grid}>
        {STANDARD_COLOURS.map((c) => {
          const active = selected?.name === c.name;
          const textOnLight = c.color?.toLowerCase() === "#f6f6fb" ? "#222234" : "#fff";
          return (
            <Pressable
              key={c.name}
              onPress={() => handlePick(c)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: c.color },
                active && styles.tileActive,
                pressed && { opacity: 0.95 },
              ]}
            >
              {/* Accent stripe to mirror web UI */}
              <View style={[styles.accent, { backgroundColor: c.accent }]} />
              <Text style={[styles.name, { color: textOnLight }]} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  title: { color: COLORS.text, fontWeight: "900" },
  sub: { color: COLORS.textMuted, marginBottom: 10 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  tile: {
    width: "48.2%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  tileActive: { borderColor: COLORS.accent, borderWidth: 2 },

  accent: {
    height: 10,
    borderRadius: 5,
    marginBottom: 10,
    opacity: 0.95,
  },
  name: { fontWeight: "900" },
});
