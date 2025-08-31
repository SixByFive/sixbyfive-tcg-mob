// components/home/PriceWatchCard.js
// REDESIGN (not compact): rich grid with timeframe filter, big price, change pill, and fake sparklines.
// Drop-in replacement. No new dependencies. UI-only wiring for timeframe.

import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function PriceWatchCard({ loading, user, watchlist }) {
  // timeframe state (UI-only; does not change data yet)
  const [range, setRange] = useState("24h"); // '24h' | '7d' | '30d'

  // Keep it to 6 for a balanced grid
  const list = useMemo(() => (watchlist || []).slice(0, 6), [watchlist]);

  // Loading state (skeleton)
  if (loading && !user) {
    return (
      <View style={styles.card}>
        <Header range={range} onRangeChange={setRange} />
        <GridSkeleton />
      </View>
    );
  }

  // Empty state
  if (!list.length) {
    return (
      <View style={styles.card}>
        <Header range={range} onRangeChange={setRange} />
        <Empty />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Header range={range} onRangeChange={setRange} />

      <View style={styles.grid}>
        {list.map((w) => (
          <Tile
            key={w.id}
            item={w}
            onPress={() =>
              router.push({
                pathname: "/card/[id]",
                params: {
                  id: String(w.id),
                  name: w.name,
                  setName: w.set,
                  // pass one price for now; can expand later
                  prices: JSON.stringify([{ label: "Market", value: w.price }]),
                },
              })
            }
          />
        ))}
      </View>

      <View style={styles.footerRow}>
        <Pressable
          onPress={() => router.push("/(tabs)/collection?tab=watch")}
          hitSlop={8}
        >
          <Text style={styles.link}>Manage watchlist →</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ---------------- subcomponents ---------------- */

function Header({ range, onRangeChange }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Price watch</Text>

      {/* timeframe segment control (UI only) */}
      <View style={styles.segmentWrap}>
        {["24h", "7d", "30d"].map((r) => {
          const active = r === range;
          return (
            <Pressable
              key={r}
              onPress={() => onRangeChange(r)}
              style={({ pressed }) => [
                styles.segment,
                active && styles.segmentActive,
                pressed && { opacity: 0.9 },
              ]}
              hitSlop={6}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {r}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Tile({ item, onPress }) {
  const { isUp, isDown, color, cleanChange } = parseChange(item.change);

  // fake sparkline bars (just a few rectangles)
  const bars = useMemo(() => generateBars(isUp, isDown), [isUp, isDown]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.92 }]}
    >
      {/* Top row: price + change pill */}
      <View style={styles.tileTop}>
        <Text style={styles.price}>{item.price}</Text>
        <View style={[styles.pill, { backgroundColor: color }]}>
          <Text style={styles.pillText}>{cleanChange}</Text>
        </View>
      </View>

      {/* Sparkline */}
      <View style={styles.sparkRow}>
        {bars.map((h, i) => (
          <View
            key={i}
            style={[
              styles.sparkBar,
              { height: h, backgroundColor: color, opacity: 0.7 },
            ]}
          />
        ))}
      </View>

      {/* Name + set */}
      <Text style={styles.cardName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.cardSet} numberOfLines={1}>
        {item.set}
      </Text>
    </Pressable>
  );
}

function Empty() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No price watch items</Text>
      <Text style={styles.emptyText}>
        Add cards to your watchlist to see live changes here.
      </Text>
    </View>
  );
}

function GridSkeleton() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.tile, { opacity: 0.6 }]}>
          <View style={styles.tileTop}>
            <View style={[styles.skelBox, { width: 60, height: 20 }]} />
            <View style={[styles.skelBox, { width: 42, height: 18, borderRadius: 999 }]} />
          </View>
          <View style={styles.sparkRow}>
            {Array.from({ length: 10 }).map((__, j) => (
              <View
                key={j}
                style={[
                  styles.skelBox,
                  { width: 6, height: 10 + (j % 4) * 6, marginRight: 4, borderRadius: 3 },
                ]}
              />
            ))}
          </View>
          <View style={[styles.skelBox, { height: 12, marginTop: 6 }]} />
          <View style={[styles.skelBox, { height: 10, marginTop: 6, width: "60%" }]} />
        </View>
      ))}
    </View>
  );
}

/* ---------------- helpers ---------------- */

function parseChange(str = "") {
  const s = String(str).trim();
  const isUp = s.startsWith("+");
  const isDown = s.startsWith("-");
  const cleanChange = s.replace(/\s+/g, "");
  const color = isUp
    ? COLORS.success || "#1dd1a1"
    : isDown
    ? "#ff6b6b"
    : COLORS.textMuted;
  return { isUp, isDown, cleanChange, color };
}

// Generate 10 bars with a directional bias (purely visual)
function generateBars(isUp, isDown) {
  const base = 10;
  const count = 10;
  const arr = [];
  for (let i = 0; i < count; i++) {
    const bias = isUp ? 8 : isDown ? 2 : 5; // rough tendency
    const h = base + Math.floor(Math.random() * 16) + Math.floor((i / count) * bias);
    arr.push(h);
  }
  return arr;
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  // header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  segment: { paddingVertical: 6, paddingHorizontal: 10 },
  segmentActive: { backgroundColor: COLORS.accent },
  segmentText: { color: COLORS.text, fontWeight: "800", fontSize: 12.5 },
  segmentTextActive: { color: "#fff" },

  // grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  // tile
  tile: {
    width: "48.2%",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: { color: COLORS.text, fontWeight: "900", fontSize: 16 },

  pill: {
    minWidth: 46,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: { color: "#000", fontWeight: "900", fontSize: 12 },

  sparkRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 32,
    marginTop: 8,
  },
  sparkBar: {
    width: 6,
    marginRight: 4,
    borderRadius: 3,
  },

  cardName: { color: COLORS.text, fontWeight: "800", marginTop: 8 },
  cardSet: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  // footer
  footerRow: { marginTop: 10, alignItems: "flex-end" },
  link: { color: COLORS.accent, fontWeight: "800" },

  // skeleton helpers
  skelBox: {
    backgroundColor: COLORS.alt || "#23243c",
    borderColor: COLORS.border,
    borderWidth: 1,
  },

  // empty
  empty: {
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
  },
  emptyTitle: { color: COLORS.text, fontWeight: "900" },
  emptyText: { color: COLORS.textMuted, marginTop: 4, textAlign: "center" },
});
