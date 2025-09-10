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
import PriceWatchCard from "../../components/home/PriceWatchCard";
import SnapshotCard from "../../components/home/SnapshotCard";
import SubscriptionCard from "../../components/home/SubscriptionCard";
import UserSearchCard from "../../components/home/UserSearchCard";
import VerificationBanner from "../../components/home/VerificationBanner";

const DISCORD_INVITE = "https://tcg.sixbyfive.com/discord";

export default function Home() {
  // UI state for user search (separate from ME document loading)
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading: meLoading, refetch, networkStatus } = useQuery(MeDocument,{
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
      // small delay for nicer UX
      setTimeout(() => setRefreshing(false), 350);
    }
  }, [refetch]);

  // UI fallbacks
  const recentBinders = (user?.recentBinders?.length
    ? user.recentBinders
    : [
        { id: "b1", name: "Main Binder", pages: 32, updatedAtRelative: "2d" },
        { id: "b2", name: "Trades", pages: 12, updatedAtRelative: "5d" },
      ]
  ).slice(0, 4);

  const watchlist = (user?.watchlistPreview?.length
    ? user.watchlistPreview
    : [
        { id: "c1", name: "Charizard ex", set: "Obsidian Flames", price: "£24.10", change: "+3.1%" },
        { id: "c2", name: "Lugia V", set: "Silver Tempest", price: "£18.40", change: "-1.2%" },
        { id: "c3", name: "Pikachu", set: "Crown Zenith", price: "£6.90", change: "+0.4%" },
      ]
  ).slice(0, 6);

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

      {/* Subscriptions + Discord */}
      <SubscriptionCard planName={planName} renewalText={renewalText} />

      {/* User Search */}
      <UserSearchCard
        recent={recent}
        onCommitRecent={(term) => {
          setRecent((prev) => {
            const next = [term, ...prev.filter((t) => t.toLowerCase() !== term.toLowerCase())];
            return next.slice(0, 5); // cap to 5
          });
        }}
        onClearRecent={() => setRecent([])}
        onSelectUser={(u) => {
          router.push(`/profile/${encodeURIComponent(u.username)}`);
        }}
        onToggleFollow={(u) => {
          // optional: if you keep results in parent for other reasons
        }}
      />


      {/* Verify banner (schema uses emailVerified on User) */}
      {user && user.emailVerified === false && <VerificationBanner />}

      {/* Price watch */}
      <PriceWatchCard loading={meLoading} user={user} watchlist={watchlist} />

      {/* Snapshot */}
      <SnapshotCard loading={meLoading} user={user} />

      <DiscordCard inviteUrl={DISCORD_INVITE} />

      {/* Shortcuts */}
      <ActionRow>
        <ActionCard label="Create binder" onPress={() => router.push("/binder/new")} />
        <ActionCard label="Scan card" onPress={() => router.push("/scan")} />
      </ActionRow>
      <ActionRow>
        <ActionCard label="Browse sets" onPress={() => router.push("/sets")} />
        <ActionCard label="App settings" onPress={() => router.push("/settings")} />
      </ActionRow>

      {/* Recent activity (optional) */}
      {user?.recentActivity?.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent activity</Text>
          {user.recentActivity.slice(0, 5).map((it) => (
            <View key={it.id} style={styles.activityRow}>
              <Text style={styles.activityText}>{it.title}</Text>
              <Text style={styles.activityMeta}>{it.timestampRelative}</Text>
            </View>
          ))}
          <Text onPress={() => router.push("/(tabs)/collection")} style={styles.link}>
            View collection →
          </Text>
        </View>
      ) : null}
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
