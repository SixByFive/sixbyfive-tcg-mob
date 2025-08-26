// components/profile/RecentBinders.js

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import EmptyState from "../../components/common/EmptyState";
import { COLORS } from "../../theme/colors";

export default function RecentBinders({ binders, onOpenBinder, onCreateBinder }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Recent binders</Text>

      {binders?.length ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          {binders.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => onOpenBinder(b.id)}
              style={styles.itemRow}
            >
              <View style={styles.itemBadge}>
                <Text style={styles.itemBadgeText}>
                  {(b.name || "?").slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text style={styles.itemSub} numberOfLines={1}>
                  {b.count ?? 0} cards · Updated{" "}
                  {b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : "—"}
                </Text>
              </View>
              <Text style={styles.chev}>{">"}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState message="No binders yet." />
          <Pressable
            onPress={onCreateBinder}
            style={[styles.ctaSmall, { backgroundColor: COLORS.accent }]}
          >
            <Text style={styles.ctaSmallText}>Create a binder</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
  },
  itemBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBadgeText: { color: COLORS.text, fontWeight: "800" },
  itemTitle: { color: COLORS.text, fontWeight: "700" },
  itemSub: { color: COLORS.textMuted, fontSize: 12 },
  chev: { color: COLORS.textMuted, fontWeight: "800" },

  emptyWrap: { alignItems: "center", gap: 8, marginTop: 10 },
  ctaSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  ctaSmallText: { color: "#fff", fontWeight: "800" },
});
