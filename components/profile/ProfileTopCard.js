// components/profile/ProfileTopCard.js
// Reused for both "My Profile" and public profiles.
// - Pass `readonly` to hide owner-only actions.
// - Always shows an "About" block (Bio + Favourite Pokémon) with fallbacks.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import Avatar from "../common/Avatar";

export default function ProfileTopCard({
  me,
  readonly = false,
  onAddCards,       // optional (hidden in readonly)
  onEditProfile,    // optional (hidden in readonly)
}) {
  // ---- derive safe fields ----------------------------------------------------
  const username =
    me?.username ||
    me?.user?.username ||
    me?.name ||
    "User";

  const avatarSrc =
    me?.avatar ||
    me?.avatarUrl ||
    me?.profile?.avatar ||
    me?.user?.avatar ||
    null;

  const email = me?.email && !readonly ? me.email : null;

  const stats = {
    binders: me?.stats?.binders ?? me?.bindersCount ?? 0,
    cards: me?.stats?.cards ?? me?.cardsCount ?? 0,
    wishlist: me?.stats?.wishlist ?? me?.wishlistCount ?? 0,
  };

  const bio =
    (me?.profile?.bio ?? me?.bio ?? "").trim();

  const favouritePokemon =
    (me?.profile?.favouritePokemon ?? me?.favouritePokemon ?? "").trim();

  const showActions = !readonly && (onAddCards || onEditProfile);

  // ---- render ----------------------------------------------------------------
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar name={username} src={avatarSrc} size={72} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {username}
          </Text>
        </View>
      </View>

      {/* About block (always shown with fallbacks) */}
      <View style={styles.aboutBlock}>
        <Text style={styles.bio}>
          {bio || "No bio yet."}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Favourite Pokémon</Text>
          <Text style={styles.metaValue}>{favouritePokemon || "—"}</Text>
        </View>
      </View>

      {/* Owner-only actions */}
      {showActions && (
        <View style={styles.actionsRow}>
          {onAddCards && (
            <Pressable
              onPress={onAddCards}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: COLORS.accent, flex: 1, opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add cards"
            >
              <Text style={styles.ctaText}>Add Cards</Text>
            </Pressable>
          )}
          {onEditProfile && (
            <Pressable
              onPress={onEditProfile}
              style={({ pressed }) => [
                styles.ctaOutline,
                { flex: 1, opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <Text style={styles.ctaOutlineText}>Edit Profile</Text>
            </Pressable>
          )}
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

  row: { flexDirection: "row", alignItems: "center" },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  muted: { color: COLORS.textMuted },

  statsRow: { flexDirection: "row", gap: 16, marginTop: 10 },

  aboutBlock: { marginTop: 10, gap: 6 },
  bio: { color: COLORS.text, lineHeight: 20 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metaLabel: { color: COLORS.textMuted, fontWeight: "800" },
  metaValue: { color: COLORS.text, fontWeight: "800" },

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
