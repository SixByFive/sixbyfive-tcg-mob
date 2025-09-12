// components/profile/ProfileTopCard.js
import { useMeQuery, useUserProfileQuery } from "@sixbyfive/tcg-binder/react";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import Avatar from "../common/Avatar";

// Change this to your actual public files host:
const ASSET_BASE_URL = process.env.EXPO_PUBLIC_ASSET_BASE_URL || "https://backendtcg.sixbyfive.com";

export default function ProfileTopCard({ me, readonly = false, onAddCards, onEditProfile }) {
  const shouldFetchSelf = !me;
  const { data: selfData } = useMeQuery({ skip: !shouldFetchSelf, fetchPolicy: "cache-first" });
  const base = me || selfData?.me || null;

  const baseUsername = base?.username || base?.user?.username || base?.name || "User";
  const baseAvatar = base?.avatar || base?.avatarUrl || base?.profile?.avatar || base?.user?.avatar || null;
  const baseBio = (base?.profile?.bio ?? base?.bio ?? "").trim();
  const baseFav = (
    base?.profile?.favouritePokemon ??
    base?.profile?.favoritePokemon ??
    base?.favouritePokemon ??
    base?.favoritePokemon ??
    ""
  ).trim();

  const needPublicFetch = !!baseUsername && (!baseAvatar || !baseBio || !baseFav);
  const { data: publicData } = useUserProfileQuery({
    variables: { username: String(baseUsername || "") },
    skip: !needPublicFetch,
    fetchPolicy: "cache-first",
  });

  const p = publicData?.userProfile;
  const publicAvatar = p?.user?.avatar || p?.avatar || null;
  const publicBio = (p?.bio || "").trim();
  const publicFav = (p?.favouritePokemon || p?.favoritePokemon || "").trim();

  const model = useMemo(() => ({
    username: baseUsername || "User",
    email: base?.email || null,
    avatar: baseAvatar || publicAvatar || null,     // may be string/object/relative
    bio: baseBio || publicBio || "",
    favouritePokemon: baseFav || publicFav || "",
    stats: {
      binders: base?.stats?.binders ?? base?.bindersCount ?? 0,
      cards: base?.stats?.cards ?? base?.cardsCount ?? 0,
      wishlist: base?.stats?.wishlist ?? base?.wishlistCount ?? 0,
    },
  }), [baseUsername, base, baseAvatar, publicAvatar, baseBio, publicBio, baseFav, publicFav]);

  const showActions = !readonly && (onAddCards || onEditProfile);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar
          name={model.username}
          src={model.avatar}
          baseUrl={ASSET_BASE_URL}   // ✅ makes "/uploads/…" work on mobile
          size={72}
        />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{model.username}</Text>
          {!!model.email && !readonly && (
            <Text style={styles.muted} numberOfLines={1}>{model.email}</Text>
          )}
        </View>
      </View>

      <View style={styles.aboutBlock}>
        <Text style={styles.bio}>{model.bio || "No bio yet."}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Favourite Pokémon</Text>
          <Text style={styles.metaValue}>{model.favouritePokemon || "—"}</Text>
        </View>
      </View>

      {showActions && (
        <View style={styles.actionsRow}>
          {onAddCards && (
            <Pressable
              onPress={onAddCards}
              style={({ pressed }) => [styles.cta, { backgroundColor: COLORS.accent, flex: 1, opacity: pressed ? 0.9 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Add cards"
            >
              <Text style={styles.ctaText}>Add Cards</Text>
            </Pressable>
          )}
          {onEditProfile && (
            <Pressable
              onPress={onEditProfile}
              style={({ pressed }) => [styles.ctaOutline, { flex: 1, opacity: pressed ? 0.9 : 1 }]}
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

// styles unchanged…
const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center" },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  muted: { color: COLORS.textMuted },
  aboutBlock: { marginTop: 10, gap: 6 },
  bio: { color: COLORS.text, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  metaLabel: { color: COLORS.textMuted, fontWeight: "800" },
  metaValue: { color: COLORS.text, fontWeight: "800" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  cta: { alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  ctaOutline: { alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.alt, borderWidth: 2, borderColor: COLORS.accent },
  ctaOutlineText: { color: COLORS.accent, fontWeight: "800", letterSpacing: 0.3 },
});
