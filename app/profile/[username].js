// app/(profile)/[username].js
// Public profile screen (viewing someone else's profile)
//
// - Uses USER_PROFILE_PUBLIC with only schema-safe fields
// - Passes userId + stats into OverviewTab so it can show real counts
// - WishlistTab now correctly shows the visited user's wishlist (via userId)

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
import SaleTradeTab from "../../components/profile/tabs/SaleTradeTab";
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

      # achievements {
      #   id
      #   code
      #   name
      #   description
      #   points
      #   iconUrl
      #   createdAt
      # }
    }
  }
`;

export default function PublicProfile() {
  const router = useRouter();
  const { username: raw = "" } = useLocalSearchParams();
  const username = String(raw).replace(/^@/, "");

  // stable hook order
  const [tab, setTab] = useState("overview");

  const { data: meData } = useMeQuery({ fetchPolicy: "cache-first" });
  const meUsername = meData?.me?.username || "";
  const isOwner = meUsername.toLowerCase() === username.toLowerCase();

  // Use our schema-safe query instead of the generated hook that we can't edit
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

    // These fields live directly on Profile in your schema
    const bio = p.bio ?? "";
    const favouritePokemon = p.favouritePokemon ?? "";

    const avatarResolved =
      p.avatar ??
      p.user?.avatar ??
      avatarPlaceholder(uname);

    // Stats for public profiles:
    // counts themselves are now loaded inside OverviewTab via userId
    // using collection(userId), browseBinders(userId), wishlist(userId)
    const stats = {
      binders: 0,
      cards: 0,
      wishlist: 0,
      trades: 0,
      sales: 0,
    };

    const vmObj = {
      id: p.userId || p.id, // this is the userId used by collection/wishlist/browseBinders
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
      achievements: Array.isArray(p.achievements) ? p.achievements : [],
    };

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[PublicProfile vm]", vmObj);
    }

    return vmObj;
  }, [data, username]);

  // follow state synced from vm (even though we don't render follow buttons yet)
  const [following, setFollowing] = useState(false);
  useEffect(() => {
    setFollowing(!!vm?.isFollowing);
  }, [vm?.isFollowing]);

  // early states
  if (loading && !vm) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.container, styles.center, { paddingHorizontal: 24 }]}
      >
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

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "cards", label: "Cards" },
    { key: "binders", label: "Binders" },
    { key: "wishlist", label: "Wishlist" },
    // { key: "forSale", label: "For Sale" },
    // { key: "forTrade", label: "For Trade" },
    { key: "achievements", label: "Achievements" },
  ];

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
            refreshing={networkStatus === 4}
            onRefresh={() => refetch()}
          />
        }
      >
        <ProfileTopCard me={vm} readonly />

        <SegmentTabs tabs={tabs} value={tab} onChange={setTab} />

        {tab === "overview" && (
          <OverviewTab
            stats={vm.stats}
            isOwner={isOwner}
            userId={vm.id}   // <- IMPORTANT: lets OverviewTab run PROFILE_* queries
            // NOTE: no cardsCount / bindersCount / wishlistCount overrides here
            onViewCards={() => setTab("cards")}
            showAccountActions={false}
          />
        )}

        {tab === "cards" && (
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

        {tab === "binders" && (
          <BindersTab
            title="Binders"
            isOwner={isOwner}
            binders={vm.recentBinders}
            userId={vm.id}
          />
        )}

        {tab === "wishlist" && (
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

        {tab === "forSale" && (
          <SaleTradeTab
            title="For Sale"
            items={vm.forSalePreview}
            onOpenCard={(c) =>
              router.push({
                pathname: "/card/[id]",
                params: { id: String(c.id) },
              })
            }
          />
        )}

        {tab === "forTrade" && (
          <SaleTradeTab
            title="For Trade"
            items={vm.forTradePreview}
            onOpenCard={(c) =>
              router.push({
                pathname: "/card/[id]",
                params: { id: String(c.id) },
              })
            }
          />
        )}

        {tab === "achievements" && (
          <AchievementsTab items={vm.achievements} />
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

  // visitor actions (kept for future follow/message buttons etc.)
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
  buttonSecondary: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
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
  iconPillSecondary: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  iconPillFollowing: {
    backgroundColor: "rgba(41,99,255,0.12)",
    borderColor: COLORS.accent,
  },
});
