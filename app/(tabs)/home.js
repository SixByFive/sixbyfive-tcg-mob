// app/(tabs)/home.js

import { MeDocument } from "@sixbyfive/tcg-binder";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { COLORS } from "../../theme/colors";

import { useQuery } from "@apollo/client";
import ActionRow, { ActionCard } from "../../components/home/ActionRow";
import DiscordCard from "../../components/home/DiscordCard";
// HIDDEN: not ready yet
// import PriceWatchCard from "../../components/home/PriceWatchCard";
// import SubscriptionCard from "../../components/home/SubscriptionCard";
import SnapshotCard from "../../components/home/SnapshotCard";
import UserSearchCard from "../../components/home/UserSearchCard";
import VerificationBanner from "../../components/home/VerificationBanner";

// ADDED: lightweight replacement cards
import GettingStartedCard from "../../components/home/GettingStartedCard";
import EvolvedSpotlightBanner from "../../components/partners/EvolvedSpotlightBanner";

const DISCORD_INVITE = "https://discord.gg/PRMbMbRE2H";

// Feature switches (hardcoded off for now)
const SHOW_SUBSCRIPTION = false;
const SHOW_PRICE_WATCH = false;

export default function Home() {
  // UI state for user search (separate from ME document loading)
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading: meLoading, refetch, networkStatus } = useQuery(MeDocument, {
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const user = data?.me;
  const greeting = meLoading ? "…" : `Hey ${user?.username || "Trainer"} 👋`;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setRefreshing(false), 350);
    }
  }, [refetch]);

  // subscription bits
  const planName = user?.subscription?.planName ?? "Free";
  const renewalText =
    user?.subscription?.renewalDateRelative ??
    ((planName || "").toLowerCase() !== "free" ? "Renews monthly" : "—");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 35, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
          progressBackgroundColor={COLORS.surface}
          refreshing={refreshing || networkStatus === 4 /* refetching */}
          onRefresh={onRefresh}
        />
      }
    >
      {/* Header */}
      <Text style={styles.h1}>{greeting}</Text>
      <Text style={styles.sub}>Track your collection, check prices, and build binders.</Text>

      {/* Subscriptions (hidden) */}
      {SHOW_SUBSCRIPTION ? (
        // <SubscriptionCard planName={planName} renewalText={renewalText} />
        <View />
      ) : (
        <GettingStartedCard />
      )}

      {/* User Search */}
      <UserSearchCard
        recent={recent}
        onCommitRecent={(term) => {
          setRecent((prev) => {
            const next = [term, ...prev.filter((t) => t.toLowerCase() !== term.toLowerCase())];
            return next.slice(0, 5);
          });
        }}
        onClearRecent={() => setRecent([])}
        onSelectUser={(u) => {
          router.push(`/profile/${encodeURIComponent(u.username)}`);
        }}
        onToggleFollow={(u) => {
          // optional
        }}
      />

      {/* Verify banner */}
      {user && user.emailVerified === false && <VerificationBanner />}

      {/* Price watch (hidden) */}

        {/* <PriceWatchCard loading={meLoading} user={user} watchlist={watchlist} /> */}
        <View />
      

      {/* Snapshot */}
      <SnapshotCard loading={meLoading} user={user} />

      <DiscordCard inviteUrl={DISCORD_INVITE} />

      {/* Shortcuts */}
      <ActionRow>
        <ActionCard label="Create binder" onPress={() => router.push("/binder/new")} />
        <ActionCard label="Search cards" onPress={() => router.push("/(tabs)/search")} />
      </ActionRow>
      <ActionRow>
        <ActionCard label="Browse sets" onPress={() => router.push("/sets")} />
        <ActionCard label="Settings" onPress={() => router.push("/settings")} />
      </ActionRow>

      <EvolvedSpotlightBanner
        tagline={<Text><Text style={{fontStyle:"italic"}}>Evolve</Text> the way you protect your cards</Text>}
        bullets={["Sleeves that actually fit", "Toploaders you can trust"]}
        ctaLabel="Shop Evolved"
        ctaHref="https://evolvedcardprotection.co.uk?sca_ref=9820478.MfkcaLj4ToIM"
      />

      {/* Removed: Recent activity block (not in app yet) */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  sub: { color: COLORS.textMuted, marginTop: 6, marginBottom: 14 },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: COLORS.text, fontWeight: "800" },
  activityRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  activityText: { color: COLORS.text },
  activityMeta: { color: COLORS.textMuted, fontSize: 12 },
  link: { color: COLORS.accent, fontWeight: "800", marginTop: 10 },
});
