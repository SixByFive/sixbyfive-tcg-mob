// app/home.js
import { useApolloClient, useQuery } from "@apollo/client";
import { MeDocument } from "@sixbyfive/tcg-binder";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { clearToken } from "../lib/auth";

const COLORS = {
  background: "#16171c",
  surface: "#191a20",
  alt: "#23243c",
  text: "#f7f8fa",
  textSecondary: "#b9bedd",
  textMuted: "#8f98bc",
  border: "#31365e",
  accent: "#2963FF",
  accentLight: "#548dff",
};

export default function Home() {
  const client = useApolloClient();
  const { data, loading, error, refetch } = useQuery(MeDocument, { fetchPolicy: "cache-and-network" });
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // refetch each time the screen gains focus
      refetch?.();
    }, [refetch])
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const logout = async () => {
    await clearToken();
    await client.clearStore();
    router.replace("/auth");
  };

  const user = data?.me || null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl tintColor="#fff" colors={["#fff"]} refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={require("../assets/images/icon.png")} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SixByFive TCG</Text>
            <Text style={styles.title}>
              {loading ? "Loading…" : user ? `Hey, ${user.username || user.email}!` : "Welcome 👋"}
            </Text>
          </View>

          <Pressable style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        {/* Status / error */}
        {loading && !data ? (
          <View style={styles.card}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.cardText}>Fetching your profile…</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={[styles.cardText, { color: "#ff6b6b" }]}>
              {error.message || "Something went wrong."}
            </Text>
            <Pressable onPress={onRefresh} style={[styles.cta, { marginTop: 10 }]}>
              <Text style={styles.ctaText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Profile summary */}
        {user && (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user.username?.[0] || user.email?.[0] || "U").toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{user.username || "User"}</Text>
                <Text style={styles.muted}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>Quick actions</Text>

              <View style={styles.actionsRow}>
                <ActionTile label="My Binders" onPress={() => { /* TODO: route later */ }} />
                <ActionTile label="Search Cards" onPress={() => { /* TODO */ }} />
                <ActionTile label="Settings" onPress={() => { /* TODO */ }} />
              </View>
            </View>
          </View>
        )}

        {/* Empty state if no user (shouldn't happen if auth gated) */}
        {!loading && !user && !error ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>You’re not logged in.</Text>
            <Pressable onPress={() => router.replace("/auth")} style={[styles.cta, { marginTop: 10 }]}>
              <Text style={styles.ctaText}>Go to login</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Spacer */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function ActionTile({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}>
      <Text style={styles.tileText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingTop: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  logo: { width: 36, height: 36, borderRadius: 8 },
  eyebrow: { color: COLORS.textMuted, fontSize: 12, marginBottom: 2 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },
  logoutBtn: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: { color: COLORS.text, fontWeight: "700" },

  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  cardText: { color: COLORS.text, textAlign: "center" },

  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.alt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  avatarText: { color: COLORS.text, fontWeight: "800", fontSize: 20 },
  name: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  muted: { color: COLORS.textSecondary, fontSize: 13 },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
    opacity: 0.7,
  },

  sectionTitle: { color: COLORS.text, fontWeight: "800", marginBottom: 6 },
  actionsRow: { flexDirection: "row", gap: 10 },

  tile: {
    flex: 1,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  tileText: { color: COLORS.text, fontWeight: "700" },

  cta: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
});
