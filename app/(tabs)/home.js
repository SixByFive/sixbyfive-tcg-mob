// app/(tabs)/home.js (or wherever your Home lives)
// CHANGED: enrich the dashboard with banners, continue section, watchlist, inbox preview, shortcuts, and pull-to-refresh.

import { useQuery } from "@apollo/client";
import { MeDocument } from "@sixbyfive/tcg-binder";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

const COLORS = {
  bg: "#16171c",
  surface: "#191a20",
  alt: "#23243c",
  text: "#f7f8fa",
  textMuted: "#8f98bc",
  border: "#31365e",
  accent: "#2963FF",
  error: "#ff6b6b",
  success: "#1dd1a1",
};

export default function Home() {
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, refetch } = useQuery(MeDocument, {
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const user = data?.me;
  const greeting = loading ? "…" : `Hey ${user?.username || "Trainer"} 👋`;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setRefreshing(false), 350);
    }
  }, [refetch]);

  // ---- MOCK FALLBACKS (UI-only) ----
  const recentBinders = (user?.recentBinders?.length ? user.recentBinders : [
    { id: "b1", name: "Main Binder", pages: 32, updatedAtRelative: "2d" },
    { id: "b2", name: "Trades", pages: 12, updatedAtRelative: "5d" },
  ]).slice(0, 4);

  const watchlist = (user?.watchlistPreview?.length ? user.watchlistPreview : [
    { id: "c1", name: "Charizard ex", set: "Obsidian Flames", price: "£24.10", change: "+3.1%" },
    { id: "c2", name: "Lugia V", set: "Silver Tempest", price: "£18.40", change: "-1.2%" },
    { id: "c3", name: "Pikachu", set: "Crown Zenith", price: "£6.90", change: "+0.4%" },
  ]).slice(0, 6);

  const unreadDMs = user?.unreadDMs ?? 2;
  const unreadSystem = user?.unreadSystem ?? 3;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: 25, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
          progressBackgroundColor={COLORS.surface}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
    >
      {/* Header */}
      <Text style={styles.h1}>{greeting}</Text>
      <Text style={styles.sub}>Track your collection, check prices, and build binders.</Text>

      {/* NEW: Verification banner (only if not verified) */}
      {user && user.verified === false && (
        <View style={[styles.banner, { borderLeftColor: COLORS.accent }]}>
          <Text style={styles.bannerTitle}>Verify your email</Text>
          <Text style={styles.bannerBody}>Tap to resend the verification link.</Text>
          <Pressable
            onPress={() => router.push("/verify")} // or trigger resend
            style={({ pressed }) => [styles.bannerBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.bannerBtnText}>Resend</Text>
          </Pressable>
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.row}>
        <ActionCard label="Search cards" onPress={() => router.push("/(tabs)/search")} />
        <ActionCard label="Wishlist" onPress={() => router.push("/(tabs)/collection?tab=wishlist")} />
      </View>

      {/* CHANGED: Snapshot / stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your snapshot</Text>
        {loading && !user ? (
          <RowSkeleton />
        ) : (
          <View style={styles.statsRow}>
            <Stat label="Cards" value={user?.stats?.totalCards ?? 0} />
            <Stat label="Binders" value={user?.stats?.binders ?? 0} />
            <Stat label="Wishlist" value={user?.stats?.wishlist ?? 0} />
          </View>
        )}
      </View>

      {/* NEW: Continue where you left off (recent binders) */}
      <View style={styles.card}>
        <SectionHeader title="Continue" actionLabel="New binder" onAction={() => router.push("/binders/new")} />
        {loading && !user ? (
          <BinderGridSkeleton />
        ) : (
          <View style={styles.binderGrid}>
            {recentBinders.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/binder/${b.id}`)}
                style={({ pressed }) => [styles.binder, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.binderCover} />
                <Text style={styles.binderName} numberOfLines={1}>{b.name}</Text>
                <Text style={styles.binderMeta} numberOfLines={1}>
                  {b.pages} pages • {b.updatedAtRelative || "—"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* NEW: Price watch (chips) */}
      <View style={styles.card}>
        <SectionHeader title="Price watch" actionLabel="Manage" onAction={() => router.push("/(tabs)/collection?tab=watch")} />
        {loading && !user ? (
          <ChipsSkeleton />
        ) : watchlist.length ? (
          <View style={styles.chipsWrap}>
            {watchlist.map((w) => (
              <Pressable
                key={w.id}
                onPress={() =>
                  router.push({
                    pathname: "/card/[id]",
                    params: {
                      id: String(w.id),
                      name: w.name, setName: w.set, prices: JSON.stringify([{ label: "Market", value: w.price }]),
                    },
                  })
                }
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.chipName} numberOfLines={1}>{w.name}</Text>
                <Text style={styles.chipMeta} numberOfLines={1}>{w.price} • {w.change}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Empty hint="No items in watchlist yet. Add from any card." />
        )}
      </View>

      {/* NEW: Inbox preview */}
      <View style={styles.card}>
        <SectionHeader title="Inbox" actionLabel="Open" onAction={() => router.push("/(tabs)/messages")} />
        <View style={[styles.row, { marginBottom: 0 }]}>
          <Pressable
            onPress={() => router.push("/(tabs)/messages")}
            style={({ pressed }) => [styles.inboxTile, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.inboxNumber}>{unreadDMs}</Text>
            <Text style={styles.inboxLabel}>Messages</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/messages?tab=system")}
            style={({ pressed }) => [styles.inboxTile, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.inboxNumber}>{unreadSystem}</Text>
            <Text style={styles.inboxLabel}>System</Text>
          </Pressable>
        </View>
      </View>

      {/* NEW: Shortcuts */}
      <View style={styles.row}>
        <ActionCard label="Create binder" onPress={() => router.push("/binders/new")} />
        <ActionCard label="Scan card" onPress={() => router.push("/scan")} />
      </View>
      <View style={styles.row}>
        <ActionCard label="Browse sets" onPress={() => router.push("/sets")} />
        <ActionCard label="App settings" onPress={() => router.push("/settings")} />
      </View>

      {/* Recent activity (kept) */}
      {user?.recentActivity?.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent activity</Text>
          {user.recentActivity.slice(0, 5).map((it) => (
            <View key={it.id} style={styles.activityRow}>
              <Text style={styles.activityText}>{it.title}</Text>
              <Text style={styles.activityMeta}>{it.timestampRelative}</Text>
            </View>
          ))}
          <Pressable onPress={() => router.push("/(tabs)/collection")}>
            <Text style={styles.link}>View collection →</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

/* ------------------ Small UI pieces (inline) ------------------ */

function ActionCard({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: COLORS.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      {onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionLink}>{actionLabel} →</Text>
        </Pressable>
      )}
    </View>
  );
}

function Empty({ hint }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{hint}</Text>
    </View>
  );
}

/* ------------------ Skeletons (super lightweight) ------------------ */

function RowSkeleton() {
  return (
    <View style={[styles.statsRow, { opacity: 0.7 }]}>
      <SkelBox />
      <SkelBox />
      <SkelBox />
    </View>
  );
}
function BinderGridSkeleton() {
  return (
    <View style={styles.binderGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={[styles.binder, { opacity: 0.7 }]}>
          <View style={styles.binderCover} />
          <View style={{ height: 12, backgroundColor: COLORS.alt, borderRadius: 6, marginTop: 8 }} />
          <View style={{ height: 10, backgroundColor: COLORS.alt, borderRadius: 5, marginTop: 6, width: "60%" }} />
        </View>
      ))}
    </View>
  );
}
function ChipsSkeleton() {
  return (
    <View style={styles.chipsWrap}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.chip, { backgroundColor: COLORS.alt, borderColor: COLORS.border }]} />
      ))}
    </View>
  );
}
function SkelBox() {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <View style={{ width: 38, height: 20, backgroundColor: COLORS.alt, borderRadius: 6 }} />
      <View style={{ width: 52, height: 12, backgroundColor: COLORS.alt, borderRadius: 6, marginTop: 8 }} />
    </View>
  );
}

/* ------------------ Styles ------------------ */

const styles = StyleSheet.create({
  h1: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  sub: { color: COLORS.textMuted, marginTop: 6, marginBottom: 14 },

  row: { flexDirection: "row", gap: 12, marginBottom: 14 },

  action: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
  },
  actionLabel: { color: COLORS.text, fontWeight: "700" },

  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: COLORS.text, fontWeight: "800" },

  statsRow: { flexDirection: "row", gap: 12, marginTop: 10 },

  activityRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  activityText: { color: COLORS.text },
  activityMeta: { color: COLORS.textMuted, fontSize: 12 },
  link: { color: COLORS.accent, fontWeight: "800", marginTop: 10 },

  // NEW: verification banner
  banner: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  bannerTitle: { color: COLORS.text, fontWeight: "900" },
  bannerBody: { color: COLORS.textMuted, marginTop: 2 },
  bannerBtn: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerBtnText: { color: "#fff", fontWeight: "800" },

  // NEW: section header with inline action
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionLink: { color: COLORS.accent, fontWeight: "800" },

  // NEW: binder grid
  binderGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  binder: {
    width: "47.5%",
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  binderCover: {
    height: 90,
    borderRadius: 8,
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  binderName: { color: COLORS.text, fontWeight: "800", marginTop: 8 },
  binderMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },

  // NEW: price watch chips
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    minWidth: "47%",
  },
  chipName: { color: COLORS.text, fontWeight: "800" },
  chipMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  // NEW: inbox tiles
  inboxTile: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  inboxNumber: { color: COLORS.accent, fontWeight: "900", fontSize: 20 },
  inboxLabel: { color: COLORS.textMuted, marginTop: 4 },

  // NEW: empty + skeleton helpers
  empty: { alignItems: "center", paddingVertical: 10 },
  emptyText: { color: COLORS.textMuted },
});
