// app/(tabs)/profile.js

import { useQuery } from "@apollo/client";
import { MeDocument } from "@sixbyfive/tcg-binder";
import { useRouter } from "expo-router"; // CHANGED: use hook (was `router` singleton)
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { clearToken } from "../../lib/auth";

import PageHeader from "../../components/common/PageHeader";
import RecentBinders from "../../components/profile/ProfileRecentBinders";
import ProfileTopCard from "../../components/profile/ProfileTopCard";
import WishlistGrid from "../../components/profile/WishlistGrid";
import { COLORS } from "../../theme/colors";

export default function ProfileTab() {
  const router = useRouter(); // CHANGED: hook
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading, error, refetch, networkStatus } = useQuery(MeDocument, {
    notifyOnNetworkStatusChange: true,
  });

  const me = data?.me ?? null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleLogout = useCallback(async () => {
    await clearToken();
    router.replace("/auth");
  }, [router]);

  return (
    <View style={styles.container}>
      <PageHeader
        title="Profile"
        subtitle="Manage your account and collection"
      />

      {loading && !me ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.error, textAlign: "center", paddingHorizontal: 24 }}>
            {error.message}
          </Text>
          <Pressable
            onPress={onRefresh}
            style={[styles.cta, { marginTop: 12, backgroundColor: COLORS.accent }]}
          >
            <Text style={styles.ctaText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              tintColor={COLORS.accent}
              refreshing={refreshing || networkStatus === 4}
              onRefresh={onRefresh}
            />
          }
        >
          {/* Top identity + actions */}
          <ProfileTopCard
            me={me}
            onAddCards={() => router.push("/(tabs)/search")}
            onLogout={handleLogout}
          />

          {/* Recent binders */}
          <RecentBinders
            binders={me?.recentBinders ?? []}
            onCreateBinder={() => router.push("/binders/new")}
            onOpenBinder={(id) => router.push(`/binder/${id}`)}
          />

          {/* Wishlist preview */}
          <WishlistGrid
            items={me?.wishlistPreview ?? []}
            onBrowse={() => router.push("/(tabs)/search")}
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

          {/* Footer space */}
          <View style={{ height: 28 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },

  // reused button styles for error state
  cta: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
