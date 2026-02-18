// components/profile/ProfileTopCard.js
//
// UPDATED (2026-02-18)
//
// CHANGES:
// - ADD: "Message" button when viewing someone else's profile
// - ADD: Always fetch self (me) to reliably detect ownership
// - ADD: Bulletproof viewed userId resolution (base -> public profile fallback)
// - ADD: Safe routing to /messages/[userId] only when a valid userId exists
// - KEEP: Existing Add Cards / Edit Profile actions for owner-only flows

import { useMeQuery, useUserProfileQuery } from "@sixbyfive/tcg-binder/react";
import { useRouter } from "expo-router"; // ADD
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import Avatar from "../common/Avatar";

// Change this to your actual public files host:
const ASSET_BASE_URL =
  process.env.EXPO_PUBLIC_ASSET_BASE_URL || "https://backendtcg.sixbyfive.com";

function cleanString(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function toLowerSafe(v) {
  return cleanString(v).toLowerCase();
}

export default function ProfileTopCard({
  me,
  readonly = false,
  onAddCards,
  onEditProfile,
}) {
  const router = useRouter(); // ADD

  // IMPORTANT:
  // Always fetch self so we can reliably decide "isOwner" even on public profiles
  // (cache-first keeps it cheap).
  const { data: selfData } = useMeQuery({ fetchPolicy: "cache-first" });
  const self = selfData?.me || null;

  // "base" is the profile being displayed (passed in), not the signed-in user.
  const base = me || null;

  const baseUsername =
    base?.username || base?.user?.username || base?.name || "User";

  const baseAvatar =
    base?.avatar ||
    base?.avatarUrl ||
    base?.profile?.avatar ||
    base?.user?.avatar ||
    null;

  const baseBio = (base?.profile?.bio ?? base?.bio ?? "").trim();

  const baseFav = (
    base?.profile?.favouritePokemon ??
    base?.profile?.favoritePokemon ??
    base?.favouritePokemon ??
    base?.favoritePokemon ??
    ""
  ).trim();

  // Resolve a userId for messaging/ownership checks.
  // Prefer actual user UUID (base.user.id), then base.userId, then base.id.
  const baseUserId =
    (base?.user?.id ? String(base.user.id) : null) ||
    (base?.userId ? String(base.userId) : null) ||
    (base?.id ? String(base.id) : null);

  // If we are missing fields, fetch the public profile by username (you already had this)
  const needPublicFetch =
    !!baseUsername && (!baseAvatar || !baseBio || !baseFav || !baseUserId);

  const { data: publicData } = useUserProfileQuery({
    variables: { username: String(baseUsername || "") },
    skip: !needPublicFetch,
    fetchPolicy: "cache-first",
  });

  const p = publicData?.userProfile;

  const publicAvatar = p?.user?.avatar || p?.avatar || null;
  const publicBio = (p?.bio || "").trim();
  const publicFav = (p?.favouritePokemon || p?.favoritePokemon || "").trim();

  // Public profile can also carry the correct user UUID.
  const publicUserId =
    (p?.user?.id ? String(p.user.id) : null) ||
    (p?.userId ? String(p.userId) : null) ||
    (p?.id ? String(p.id) : null);

  const model = useMemo(() => {
    const resolvedUserId = baseUserId || publicUserId || null;

    return {
      userId: resolvedUserId, // ADD: used for messaging + ownership checks
      username: baseUsername || "User",
      email: base?.email || null,
      avatar: baseAvatar || publicAvatar || null, // may be string/object/relative
      bio: baseBio || publicBio || "",
      favouritePokemon: baseFav || publicFav || "",
      stats: {
        binders: base?.stats?.binders ?? base?.bindersCount ?? 0,
        cards: base?.stats?.cards ?? base?.cardsCount ?? 0,
        wishlist: base?.stats?.wishlist ?? base?.wishlistCount ?? 0,
      },
    };
  }, [
    baseUsername,
    base,
    baseAvatar,
    publicAvatar,
    baseBio,
    publicBio,
    baseFav,
    publicFav,
    baseUserId,
    publicUserId,
  ]);

  // Owner check (prefer id match; fallback to username match)
  const isOwner = useMemo(() => {
    const selfId = self?.id ? String(self.id) : "";
    const viewedId = model?.userId ? String(model.userId) : "";

    if (selfId && viewedId) return selfId === viewedId;

    const selfU = toLowerSafe(self?.username);
    const viewedU = toLowerSafe(model?.username);
    if (selfU && viewedU) return selfU === viewedU;

    return false;
  }, [self?.id, self?.username, model?.userId, model?.username]);

  // Message button should appear ONLY when viewing someone else AND we have their userId.
  const canMessage = useMemo(() => {
    if (!self?.id) return false; // not logged in / no me
    if (!model?.userId) return false; // missing target id (would route to undefined)
    if (isOwner) return false; // don't message yourself
    return true;
  }, [self?.id, model?.userId, isOwner]);

  // Existing owner actions (Add/Edit) remain controlled by readonly + callbacks
  const showActions = !readonly && (onAddCards || onEditProfile);

  const onPressMessage = () => {
    // Safety: never route without a valid id
    const targetId = cleanString(model?.userId);
    if (!targetId) return;

    router.push(`/messages/${encodeURIComponent(targetId)}`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar
          name={model.username}
          src={model.avatar}
          baseUrl={ASSET_BASE_URL} // ✅ makes "/uploads/…" work on mobile
          size={72}
        />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {model.username}
          </Text>

          {!!model.email && !readonly && (
            <Text style={styles.muted} numberOfLines={1}>
              {model.email}
            </Text>
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

      {/* ADD: Message button for non-owner profiles */}
      {canMessage && (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={onPressMessage}
            style={({ pressed }) => [
              styles.ctaOutline,
              { flex: 1, opacity: pressed ? 0.9 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Message ${model.username}`}
          >
            <Text style={styles.ctaOutlineText}>Message</Text>
          </Pressable>
        </View>
      )}

      {/* Existing actions (owner flows) */}
      {showActions && (
        <View style={styles.actionsRow}>
          {onAddCards && (
            <Pressable
              onPress={onAddCards}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: COLORS.accent,
                  flex: 1,
                  opacity: pressed ? 0.9 : 1,
                },
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

// styles unchanged…
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
  cta: { alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  ctaOutline: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.alt,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  ctaOutlineText: {
    color: COLORS.accent,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
