// components/profile/ProfileTopCard.js
// CHANGED: "Log out" button → "Edit Profile" button

import Avatar from "../../components/common/Avatar";
import Stat from "../../components/common/Stat";
import { COLORS } from "../../theme/colors";

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ProfileTopCard({ me, onAddCards, onEditProfile }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar name={me?.username || me?.name} src={me?.avatarUrl} size={72} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {me?.username || me?.name || "User"}
          </Text>
          {!!me?.email && (
            <Text style={styles.muted} numberOfLines={1}>
              {me.email}
            </Text>
          )}
          <View style={styles.statsRow}>
            <Stat label="Binders" value={me?.stats?.binders ?? 0} />
            <Stat label="Cards" value={me?.stats?.cards ?? 0} />
            <Stat label="Wishlist" value={me?.stats?.wishlist ?? 0} />
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={onAddCards}
          style={[styles.cta, { backgroundColor: COLORS.accent, flex: 1 }]}
        >
          <Text style={styles.ctaText}>Add Cards</Text>
        </Pressable>
        <Pressable onPress={onEditProfile} style={[styles.ctaOutline, { flex: 1 }]}>
          <Text style={styles.ctaOutlineText}>Edit Profile</Text>
        </Pressable>
      </View>
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
  row: { flexDirection: "row", alignItems: "center" },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  muted: { color: COLORS.textMuted },

  statsRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },

  cta: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },

  ctaOutline: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.alt,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  ctaOutlineText: { color: COLORS.accent, fontWeight: "800", letterSpacing: 0.3 },
});
