// app/(tabs)/profile/[username].js
import { useMeQuery, useUserProfileQuery } from "@sixbyfive/tcg-binder/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
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
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=2963FF&color=fff`;

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  try {
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dt.toISOString().slice(0, 10);
  }
};

export default function PublicProfile() {
  const router = useRouter();
  const { username: raw = "" } = useLocalSearchParams();
  const username = String(raw).replace(/^@/, "");

  // stable hook order
  const [tab, setTab] = useState("overview");
  const { data: meData } = useMeQuery({ fetchPolicy: "cache-first" });
  const meUsername = meData?.me?.username || "";
  const isOwner = meUsername.toLowerCase() === username.toLowerCase();

  const { data, loading, error, refetch, networkStatus } = useUserProfileQuery({
    variables: { username },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  const vm = useMemo(() => {
    const p = data?.userProfile;
    if (!p) return null;
    const uname = p.user?.username || username;

    const stats = {
      binders: p?.stats?.binders ?? p?.bindersCount ?? 0,
      cards: p?.stats?.cards ?? p?.cardsCount ?? 0,
      wishlist: p?.stats?.wishlist ?? p?.wishlistCount ?? 0,
      trades: p?.stats?.trades ?? p?.tradesCount ?? 0,
      sales: p?.stats?.sales ?? p?.salesCount ?? 0,
    };

    return {
      id: p.userId || p.id,
      username: uname,
      avatar: p.user?.avatar || p.avatar || avatarPlaceholder(uname),
      profile: {
        bio: p.bio || "",
        favouritePokemon: p.favouritePokemon || "",
        avatar: p.avatar || p.user?.avatar || null,
      },
      meta: {
        joined: fmtDate(p.user?.createdAt),
        lastActive: fmtDate(p.user?.lastLogin || p.user?.updatedAt),
      },
      isFollowing: !!p.user?.isFollowing,
      stats,
      recentBinders: Array.isArray(p.recentBinders) ? p.recentBinders : [],
      wishlistPreview: Array.isArray(p.wishlistPreview) ? p.wishlistPreview : [],
      cardsPreview: Array.isArray(p.cardsPreview) ? p.cardsPreview : [],
      forSalePreview: Array.isArray(p.forSalePreview) ? p.forSalePreview : [],
      forTradePreview: Array.isArray(p.forTradePreview) ? p.forTradePreview : [],
      achievements: Array.isArray(p.achievements) ? p.achievements : [],
    };
  }, [data, username]);

  // follow state synced from vm
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
      <View style={[styles.container, styles.center, { paddingHorizontal: 24 }]}>
        <Text style={{ color: COLORS.error, textAlign: "center", marginBottom: 12 }}>
          {error.message}
        </Text>
        <Text onPress={() => refetch()} style={{ color: COLORS.accent, fontWeight: "800" }}>
          Try again
        </Text>
      </View>
    );
  }
  if (!vm) {
    return (
      <View style={styles.container}>
        <PageHeaderBackSimple title="User not found" subtitle={`@${username}`} onBack={() => router.back()} />
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
      <PageHeaderBackSimple title={vm.username} subtitle={`@${vm.username}`} onBack={() => router.back()} />

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

        {/* visitor actions */}
        {/* {!isOwner && (
          <View style={styles.actionBar}>
            <Pressable
              onPress={() => setFollowing((f) => !f)}
              accessibilityRole="button"
              accessibilityLabel={following ? "Unfollow" : "Follow"}
              android_ripple={{ color: "#1f3fb866" }}
              style={({ pressed }) => [
                styles.button,
                following ? styles.buttonFollowing : styles.buttonPrimary,
                pressed && styles.buttonPressed,
              ]}
            >
              <View
                style={[
                  styles.iconPill,
                  following ? styles.iconPillFollowing : styles.iconPillPrimary,
                ]}
              >
                <Ionicons
                  name={following ? "checkmark" : "person-add-outline"}
                  size={16}
                  color={following ? COLORS.accent : "#fff"}
                />
              </View>
              <Text
                style={[
                  styles.buttonText,
                  following ? styles.buttonTextFollowing : styles.buttonTextPrimary,
                ]}
                numberOfLines={1}
              >
                {following ? "Following" : "Follow"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push(`/messages/compose?to=${encodeURIComponent(vm.username)}`)
              }
              accessibilityRole="button"
              accessibilityLabel="Message"
              android_ripple={{ color: "#2a2f3a66" }}
              style={({ pressed }) => [
                styles.button,
                styles.buttonSecondary,
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={[styles.iconPill, styles.iconPillSecondary]}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.text} />
              </View>
              <Text style={[styles.buttonText, styles.buttonTextSecondary]} numberOfLines={1}>
                Message
              </Text>
            </Pressable>
          </View>
        )} */}

        <SegmentTabs tabs={tabs} value={tab} onChange={setTab} />

        {tab === "overview" && (
          <OverviewTab
            stats={vm.stats}
            meta={vm.meta}
            onViewCards={() => setTab("cards")}
            showAccountActions={false}
          />
        )}

        {tab === "cards" && (
          <CardsTab
            cards={vm.cardsPreview}
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
          <BindersTab binders={vm.recentBinders} onOpenBinder={(id) => router.push(`/binder/${id}`)} />
        )}

        {tab === "wishlist" && (
          <WishlistTab
            items={vm.wishlistPreview}
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
            onOpenCard={(c) => router.push({ pathname: "/card/[id]", params: { id: String(c.id) } })}
          />
        )}

        {tab === "forTrade" && (
          <SaleTradeTab
            title="For Trade"
            items={vm.forTradePreview}
            onOpenCard={(c) => router.push({ pathname: "/card/[id]", params: { id: String(c.id) } })}
          />
        )}

        {tab === "achievements" && <AchievementsTab items={vm.achievements} />}

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // visitor actions
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
  buttonFollowing: { backgroundColor: COLORS.background, borderColor: COLORS.accent },

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
  iconPillPrimary: { backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.22)" },
  iconPillSecondary: { backgroundColor: COLORS.background, borderColor: COLORS.border },
  iconPillFollowing: { backgroundColor: "rgba(41,99,255,0.12)", borderColor: COLORS.accent },
});
