// app/(profile)/[username].js
//
// BULLETPROOF UPDATE:
//
// - Achievements are NOT a field on Profile in GraphQL. Never query userProfile.achievements.
// - Achievements are fetched via userAchievements(userId) ONLY.
// - Bulletproof tab handling: SegmentTabs sometimes emits label/value inconsistently.
// - Bulletproof userId resolution: prefer user.id, then userId, then id.
// - Bulletproof AchievementsTab integration: pass BOTH shapes:
//    1) userAchievements (schema-native UserAchievement[])
//    2) items (flattened Achievement-like array, with earnedAt/meta)
// - Clear dev-only logs for "why isn't it fetching" scenarios.
// - Graceful empty state (no achievements yet).

import { gql, useQuery } from "@apollo/client";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import PageHeaderBackSimple from "../../components/common/PageHeaderBackSimple";
import SegmentTabs from "../../components/common/SegmentTabs";
import ProfileTopCard from "../../components/profile/ProfileTopCard";
import AchievementsTab from "../../components/profile/tabs/AchievementsTab";
import BindersTab from "../../components/profile/tabs/BindersTab";
import CardsTab from "../../components/profile/tabs/CardsTab";
import OverviewTab from "../../components/profile/tabs/OverviewTab";
import WishlistTab from "../../components/profile/tabs/WishlistTab";
import { COLORS } from "../../theme/colors";

const avatarPlaceholder = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&background=2963FF&color=fff`;

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  try {
    return dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dt.toISOString().slice(0, 10);
  }
};

/**
 * Schema-safe public userProfile query.
 * NOTE: achievements is NOT on Profile, so do not request it here.
 */
const USER_PROFILE_PUBLIC = gql`
  query UserProfile_Public($username: String!) {
    userProfile(username: $username) {
      id
      userId

      bio
      avatar
      favouritePokemon
      status
      createdAt
      updatedAt

      user {
        id
        username
        avatar
        createdAt
        lastLogin
        updatedAt
      }
    }
  }
`;

/**
 * Achievements query supported by backend schema:
 * userAchievements(userId: ID!) -> [UserAchievement!]!
 */
const USER_ACHIEVEMENTS_BY_USER = gql`
  query UserAchievementsByUser($userId: ID!) {
    userAchievements(userId: $userId) {
      id
      userId
      achievementId
      earnedAt
      meta
      createdAt
      achievement {
        id
        code
        name
        description
        tier
        iconUrl
        points
        isActive
        isHidden
      }
    }
  }
`;

/**
 * Normalize SegmentTabs output defensively.
 * Some tab components return label (e.g. "Achievements") instead of key ("achievements").
 * This ensures we always work with the canonical keys.
 */
function normalizeTabValue(value) {
  const v = String(value || "").trim();
  const lower = v.toLowerCase();

  // If we already have a canonical key, keep it.
  if (
    lower === "overview" ||
    lower === "cards" ||
    lower === "binders" ||
    lower === "wishlist" ||
    lower === "achievements"
  ) {
    return lower;
  }

  // Map common label variants -> keys
  if (lower.includes("overview")) return "overview";
  if (lower.includes("card")) return "cards";
  if (lower.includes("binder")) return "binders";
  if (lower.includes("wish")) return "wishlist";
  if (lower.includes("achieve")) return "achievements";

  // Fallback (safe default)
  return "overview";
}

export default function PublicProfile() {
  const router = useRouter();
  const { username: raw = "" } = useLocalSearchParams();
  const username = String(raw).replace(/^@/, "");

  // Keep stable hook order; tab is normalized for robustness
  const [tab, setTab] = useState("overview");

  const { data: meData } = useMeQuery({ fetchPolicy: "cache-first" });
  const meUsername = meData?.me?.username || "";
  const isOwner = meUsername.toLowerCase() === username.toLowerCase();

  const {
    data,
    loading,
    error,
    refetch,
    networkStatus,
  } = useQuery(USER_PROFILE_PUBLIC, {
    variables: { username },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  const vm = useMemo(() => {
    const p = data?.userProfile;
    if (!p) return null;

    const uname = p.user?.username || username;

    const bio = p.bio ?? "";
    const favouritePokemon = p.favouritePokemon ?? "";

    const avatarResolved =
      p.avatar ?? p.user?.avatar ?? avatarPlaceholder(uname);

    const stats = {
      binders: 0,
      cards: 0,
      wishlist: 0,
      trades: 0,
      sales: 0,
    };

    // IMPORTANT: always prefer the real user UUID
    const resolvedUserId = p.user?.id || p.userId || p.id;

    const vmObj = {
      id: resolvedUserId, // userId used by collection/wishlist/binders/achievements
      username: uname,
      avatar: avatarResolved,
      profile: {
        bio,
        favouritePokemon,
        avatar: avatarResolved,
      },
      meta: {
        joined: fmtDate(p.user?.createdAt),
        lastActive: fmtDate(p.user?.lastLogin || p.user?.updatedAt),
      },
      isFollowing: !!p.user?.isFollowing,
      stats,
      recentBinders: [],
      wishlistPreview: [],
      cardsPreview: [],
      forSalePreview: [],
      forTradePreview: [],
    };

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[PublicProfile vm]", vmObj);
    }

    return vmObj;
  }, [data, username]);

  // Achievements are lazy-loaded ONLY when the Achievements tab is active.
  // Bulletproof: we normalize `tab` so this condition can't get stuck due to label/key mismatch.
  const activeTab = useMemo(() => normalizeTabValue(tab), [tab]);
  const shouldLoadAchievements = activeTab === "achievements" && !!vm?.id;

  const {
    data: achData,
    loading: achLoading,
    error: achError,
    refetch: refetchAchievements,
    networkStatus: achNetworkStatus,
  } = useQuery(USER_ACHIEVEMENTS_BY_USER, {
    variables: { userId: vm?.id },
    skip: !shouldLoadAchievements,
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // Schema-native rows (UserAchievement[])
  const userAchievementsRows = useMemo(() => {
    const rows = achData?.userAchievements;
    return Array.isArray(rows) ? rows : [];
  }, [achData]);

  // Flattened view model (Achievement + earnedAt/meta) for UIs that expect a single object.
  const achievementsVm = useMemo(() => {
    if (!userAchievementsRows.length) return [];

    return userAchievementsRows
      .filter((ua) => ua?.achievement)
      .map((ua) => ({
        id: ua.achievement.id,
        code: ua.achievement.code,
        name: ua.achievement.name,
        description: ua.achievement.description,
        tier: ua.achievement.tier,
        iconUrl: ua.achievement.iconUrl,
        points: ua.achievement.points,
        isHidden: ua.achievement.isHidden,
        isActive: ua.achievement.isActive,

        earnedAt: ua.earnedAt || ua.createdAt,
        meta: ua.meta || null,
        userAchievementId: ua.id,
      }));
  }, [userAchievementsRows]);

  // Dev-only logging to explain "why isn't it fetching"
  useEffect(() => {
    if (!__DEV__) return;

    // eslint-disable-next-line no-console
    console.log("[Achievements debug]", {
      tab,
      activeTab,
      userId: vm?.id,
      shouldLoadAchievements,
      achLoading,
      achError: achError?.message,
      rows: userAchievementsRows.length,
      flattened: achievementsVm.length,
      achNetworkStatus,
    });
  }, [
    tab,
    activeTab,
    vm?.id,
    shouldLoadAchievements,
    achLoading,
    achError,
    userAchievementsRows.length,
    achievementsVm.length,
    achNetworkStatus,
  ]);

  const [following, setFollowing] = useState(false);
  useEffect(() => {
    setFollowing(!!vm?.isFollowing);
  }, [vm?.isFollowing]);

  // ---------- Early states ----------
  if (loading && !vm) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { paddingHorizontal: 24 }]}>
        <Text
          style={{
            color: COLORS.error,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {error.message}
        </Text>
        <Text
          onPress={() => refetch()}
          style={{ color: COLORS.accent, fontWeight: "800" }}
        >
          Try again
        </Text>
      </View>
    );
  }

  if (!vm) {
    return (
      <View style={styles.container}>
        <PageHeaderBackSimple
          title="User not found"
          subtitle={`@${username}`}
          onBack={() => router.back()}
        />
        <View style={[styles.center, { paddingHorizontal: 24 }]}>
          <Text style={{ color: COLORS.textMuted, textAlign: "center" }}>
            We couldn’t find “@{username}”.
          </Text>
        </View>
      </View>
    );
  }

  // Canonical tabs (keys are canonical; SegmentTabs may emit label -> we normalize above)
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "cards", label: "Cards" },
    { key: "binders", label: "Binders" },
    { key: "wishlist", label: "Wishlist" },
    { key: "achievements", label: "Achievements" },
  ];

  const isRefreshing = networkStatus === 4;
  const isAchRefreshing = achNetworkStatus === 4;

  return (
    <View style={styles.container}>
      <PageHeaderBackSimple
        title={vm.username}
        subtitle={`@${vm.username}`}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            tintColor={COLORS.accent}
            refreshing={isRefreshing}
            onRefresh={() => {
              // Refresh profile always
              refetch();

              // Refresh achievements only if we are on the achievements tab
              if (normalizeTabValue(tab) === "achievements") {
                refetchAchievements();
              }
            }}
          />
        }
      >
        <ProfileTopCard me={vm} readonly />

        <SegmentTabs
          tabs={tabs}
          value={tab}
          onChange={(next) => setTab(normalizeTabValue(next))}
        />

        {activeTab === "overview" && (
          <OverviewTab
            stats={vm.stats}
            isOwner={isOwner}
            userId={vm.id}
            onViewCards={() => setTab("cards")}
            showAccountActions={false}
          />
        )}

        {activeTab === "cards" && (
          <CardsTab
            title={`${vm.username}'s Cards`}
            cards={vm.cardsPreview}
            userId={vm.id}
            loading={loading && !vm}
            onOpenCard={(c) =>
              router.push({
                pathname: "/card/[id]",
                params: {
                  id: String(c.id),
                  name: c.name ?? "",
                  setName: c.setName ?? "",
                  number: String(c.number ?? ""),
                  image: c.image ?? "",
                  prices: JSON.stringify(c.prices || []),
                },
              })
            }
          />
        )}

        {activeTab === "binders" && (
          <BindersTab
            title="Binders"
            isOwner={isOwner}
            binders={vm.recentBinders}
            userId={vm.id}
          />
        )}

        {activeTab === "wishlist" && (
          <WishlistTab
            items={vm.wishlistPreview}
            userId={vm.id}
            onOpenCard={(card) =>
              router.push({
                pathname: "/card/[id]",
                params: {
                  id: String(card.id),
                  name: card.name ?? "",
                  setName: card.setName ?? "",
                  number: String(card.number ?? ""),
                  image: card.image ?? "",
                  prices: JSON.stringify(card.prices || []),
                },
              })
            }
          />
        )}

        {activeTab === "achievements" && (
          <View>
            {/* Error state */}
            {achError ? (
              <View style={{ paddingVertical: 14 }}>
                <Text
                  style={{
                    color: COLORS.error,
                    textAlign: "center",
                    marginBottom: 10,
                  }}
                >
                  {achError.message}
                </Text>
                <Text
                  onPress={() => refetchAchievements()}
                  style={{
                    color: COLORS.accent,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  Try again
                </Text>
              </View>
            ) : achLoading && userAchievementsRows.length === 0 ? (
              // Loading state
              <View style={{ paddingVertical: 18, alignItems: "center" }}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={{ color: COLORS.textMuted, marginTop: 10 }}>
                  Loading achievements…
                </Text>
              </View>
            ) : userAchievementsRows.length === 0 ? (
              // Empty state (prevents "blank tab looks broken")
              <View style={{ paddingVertical: 16 }}>
                <Text style={{ color: COLORS.textMuted, textAlign: "center" }}>
                  No achievements yet.
                </Text>
                {isAchRefreshing ? (
                  <View style={{ marginTop: 12, alignItems: "center" }}>
                    <ActivityIndicator color={COLORS.accent} />
                  </View>
                ) : null}
              </View>
            ) : (
              // Bulletproof: pass BOTH shapes so AchievementsTab can render either way
              <AchievementsTab
  // UPDATED: pass schema-native items first (most likely what the component expects)
  items={userAchievementsRows}
  // ALSO pass flattened for components expecting that
  flattenedItems={achievementsVm}
  loading={achLoading}
  refreshing={isAchRefreshing}
  onRefresh={refetchAchievements}
/>

            )}
          </View>
        )}

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  actionBar: { flexDirection: "row", gap: 10, marginTop: 10, marginBottom: 4 },

  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  buttonPrimary: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  buttonSecondary: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  buttonFollowing: {
    backgroundColor: "rgba(41,99,255,0.12)",
    borderColor: COLORS.accent,
  },

  buttonText: { fontWeight: "900", letterSpacing: 0.2 },
  buttonTextPrimary: { color: "#fff" },
  buttonTextSecondary: { color: COLORS.text },
  buttonTextFollowing: { color: COLORS.accent },

  iconPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
  },
  iconPillPrimary: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.22)",
  },
  iconPillSecondary: { backgroundColor: COLORS.background, borderColor: COLORS.border },
  iconPillFollowing: {
    backgroundColor: "rgba(41,99,255,0.12)",
    borderColor: COLORS.accent,
  },
});
