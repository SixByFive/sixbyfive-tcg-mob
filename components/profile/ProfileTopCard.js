// components/profile/ProfileTopCard.js

import { useMeQuery } from "../../hooks/useMeQuery";
import { useUserProfileQuery } from "../../hooks/useUserProfileQuery";
import { useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import Avatar from "../common/Avatar";
import { SellerReputationDocument, MyCapabilitiesDocument } from "../../graphql/documents";

const ASSET_BASE_URL =
  process.env.EXPO_PUBLIC_ASSET_BASE_URL || "https://backendtcg.sixbyfive.com";

function cleanString(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function toLowerSafe(v) {
  return cleanString(v).toLowerCase();
}

// ─── Seller tier logic (mirrors web) ─────────────────────────────────────────

const SELLER_TIERS = [
  { label: "Platinum", minCompleted: 75, color: "#67e8f9", bg: "rgba(103,232,249,0.12)", border: "rgba(103,232,249,0.35)" },
  { label: "Gold",     minCompleted: 20, color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)"  },
  { label: "Silver",   minCompleted: 5,  color: "#d4d4d8", bg: "rgba(212,212,216,0.12)", border: "rgba(212,212,216,0.35)" },
  { label: "Seller",   minCompleted: 1,  color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.35)" },
];

function getSellerTier(rep) {
  if (!rep || rep.completedMarketplace < 1) return null;
  const total = rep.positive + rep.negative + rep.neutral;
  const rate = total < 5 ? 100 : (rep.positive / total) * 100;
  let tier = SELLER_TIERS.find((t) => rep.completedMarketplace >= t.minCompleted) ?? SELLER_TIERS[3];
  if (rate < 50 && tier !== SELLER_TIERS[3]) {
    tier = SELLER_TIERS[SELLER_TIERS.indexOf(tier) + 1] ?? SELLER_TIERS[3];
  }
  return tier;
}

// ─── Subscription tier colors ─────────────────────────────────────────────────

function getSubTierStyle(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("trader"))    return { color: "#f472b6", bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.35)" };
  if (n.includes("vendor"))    return { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)"  };
  if (n.includes("collector")) return { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.35)"  };
  return { color: COLORS.accent, bg: `rgba(99,102,241,0.1)`, border: `rgba(99,102,241,0.3)` };
}

// ─── Small badge chip ─────────────────────────────────────────────────────────

function Badge({ label, color, bg, border, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.badge, { backgroundColor: bg, borderColor: border }]}
      disabled={!onPress}
    >
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileTopCard({
  me,
  readonly = false,
  onAddCards,
  onEditProfile,
}) {
  const router = useRouter();

  const { data: selfData } = useMeQuery({ fetchPolicy: "cache-first" });
  const self = selfData?.me || null;

  const base = me || null;
  const baseUsername = base?.username || base?.user?.username || base?.name || "User";
  const baseAvatar = base?.avatar || base?.avatarUrl || base?.profile?.avatar || base?.user?.avatar || null;
  const baseBio = (base?.profile?.bio ?? base?.bio ?? "").trim();
  const baseFav = (base?.profile?.favouritePokemon ?? base?.profile?.favoritePokemon ?? base?.favouritePokemon ?? base?.favoritePokemon ?? "").trim();
  const baseUserId =
    (base?.user?.id ? String(base.user.id) : null) ||
    (base?.userId ? String(base.userId) : null) ||
    (base?.id ? String(base.id) : null);

  const needPublicFetch = !!baseUsername && (!baseAvatar || !baseBio || !baseFav || !baseUserId);
  const { data: publicData } = useUserProfileQuery({
    variables: { username: String(baseUsername || "") },
    skip: !needPublicFetch,
    fetchPolicy: "cache-first",
  });

  const p = publicData?.userProfile;
  const publicAvatar = p?.user?.avatar || p?.avatar || null;
  const publicBio = (p?.bio || "").trim();
  const publicFav = (p?.favouritePokemon || p?.favoritePokemon || "").trim();
  const publicUserId =
    (p?.user?.id ? String(p.user.id) : null) ||
    (p?.userId ? String(p.userId) : null) ||
    (p?.id ? String(p.id) : null);
  const publicPlanName = p?.planName ?? null;

  const model = useMemo(() => ({
    userId: baseUserId || publicUserId || null,
    username: baseUsername || "User",
    email: base?.email || null,
    avatar: baseAvatar || publicAvatar || null,
    bio: baseBio || publicBio || "",
    favouritePokemon: baseFav || publicFav || "",
    planName: publicPlanName,
    stats: {
      binders: base?.stats?.binders ?? base?.bindersCount ?? 0,
      cards: base?.stats?.cards ?? base?.cardsCount ?? 0,
      wishlist: base?.stats?.wishlist ?? base?.wishlistCount ?? 0,
    },
  }), [baseUsername, base, baseAvatar, publicAvatar, baseBio, publicBio, baseFav, publicFav, baseUserId, publicUserId, publicPlanName]);

  const isOwner = useMemo(() => {
    const selfId = self?.id ? String(self.id) : "";
    const viewedId = model?.userId ? String(model.userId) : "";
    if (selfId && viewedId) return selfId === viewedId;
    const selfU = toLowerSafe(self?.username);
    const viewedU = toLowerSafe(model?.username);
    if (selfU && viewedU) return selfU === viewedU;
    return false;
  }, [self?.id, self?.username, model?.userId, model?.username]);

  const canMessage = useMemo(() => {
    if (!self?.id) return false;
    if (!model?.userId) return false;
    if (isOwner) return false;
    return true;
  }, [self?.id, model?.userId, isOwner]);

  // Own plan name from capabilities
  const { data: capData } = useQuery(MyCapabilitiesDocument, {
    fetchPolicy: "cache-first",
    skip: !isOwner,
  });
  const ownPlanName = capData?.myCapabilities?.planName ?? null;

  // Seller reputation for the viewed profile
  const { data: repData } = useQuery(SellerReputationDocument, {
    variables: { userId: model.userId },
    fetchPolicy: "cache-and-network",
    skip: !model.userId,
  });
  const reputation = repData?.sellerReputation ?? null;
  const sellerTier = getSellerTier(reputation);

  const planName = isOwner ? ownPlanName : model.planName;
  const isPaidPlan = planName && planName.toLowerCase() !== "free";
  const subStyle = isPaidPlan ? getSubTierStyle(planName) : null;

  const showActions = !readonly && (onAddCards || onEditProfile);

  const onPressMessage = () => {
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
          baseUrl={ASSET_BASE_URL}
          size={72}
        />
        <View style={{ marginLeft: 12, flex: 1, gap: 4 }}>
          <Text style={styles.name} numberOfLines={1}>
            {model.username}
          </Text>

          {/* Badges row */}
          <View style={styles.badgesRow}>
            {isPaidPlan && (
              <Badge
                label={planName}
                color={subStyle.color}
                bg={subStyle.bg}
                border={subStyle.border}
                onPress={isOwner ? () => router.push("/subscriptions") : undefined}
              />
            )}
            {sellerTier && (
              <Badge
                label={`${sellerTier.label} Seller`}
                color={sellerTier.color}
                bg={sellerTier.bg}
                border={sellerTier.border}
              />
            )}
          </View>

          {!!model.email && !readonly && (
            <Text style={styles.muted} numberOfLines={1}>
              {model.email}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.aboutBlock}>
        <Text style={styles.bio}>{model.bio || "No bio yet."}</Text>
        {!!model.favouritePokemon && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Favourite Pokémon</Text>
            <Text style={styles.metaValue}>{model.favouritePokemon}</Text>
          </View>
        )}
      </View>

      {/* Subscription CTA for owner on free plan */}
      {isOwner && !isPaidPlan && (
        <Pressable
          onPress={() => router.push("/subscriptions")}
          style={styles.upgradeBanner}
        >
          <Text style={styles.upgradeText}>Upgrade plan →</Text>
        </Pressable>
      )}

      {canMessage && (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={onPressMessage}
            style={({ pressed }) => [styles.ctaOutline, { flex: 1, opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={styles.ctaOutlineText}>Message</Text>
          </Pressable>
        </View>
      )}

      {showActions && (
        <View style={styles.actionsRow}>
          {onAddCards && (
            <Pressable
              onPress={onAddCards}
              style={({ pressed }) => [styles.cta, { backgroundColor: COLORS.accent, flex: 1, opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.ctaText}>Add Cards</Text>
            </Pressable>
          )}
          {onEditProfile && (
            <Pressable
              onPress={onEditProfile}
              style={({ pressed }) => [styles.ctaOutline, { flex: 1, opacity: pressed ? 0.9 : 1 }]}
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
  row: { flexDirection: "row", alignItems: "flex-start" },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },
  muted: { color: COLORS.textMuted, fontSize: 12 },
  aboutBlock: { marginTop: 10, gap: 6 },
  bio: { color: COLORS.text, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metaLabel: { color: COLORS.textMuted, fontWeight: "800", fontSize: 13 },
  metaValue: { color: COLORS.text, fontWeight: "800", fontSize: 13 },
  upgradeBanner: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
    backgroundColor: "rgba(99,102,241,0.07)",
    alignItems: "center",
  },
  upgradeText: { color: COLORS.accent, fontWeight: "800", fontSize: 13 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
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
  ctaOutlineText: { color: COLORS.accent, fontWeight: "800", letterSpacing: 0.3 },
});
