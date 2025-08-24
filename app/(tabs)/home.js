import { useQuery } from "@apollo/client";
import { MeDocument } from "@sixbyfive/tcg-binder";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const COLORS = {
  bg: "#16171c", surface: "#191a20", alt: "#23243c", text: "#f7f8fa",
  textMuted: "#8f98bc", border: "#31365e", accent: "#2963FF"
};

export default function Home() {
  const { data, loading } = useQuery(MeDocument, { fetchPolicy: "cache-and-network" });
  const user = data?.me;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ padding: 16, paddingTop: 25 }}>
      <Text style={styles.h1}>{loading ? "…" : `Hey ${user?.username || "Trainer"} 👋`}</Text>
      <Text style={styles.sub}>Track your collection, check prices, and build binders.</Text>

      {/* Quick actions */}
      <View style={styles.row}>
        <ActionCard label="Search cards" onPress={() => router.push("/(tabs)/search")} />
        <ActionCard label="Wishlist" onPress={() => router.push("/(tabs)/collection?tab=wishlist")} />
      </View>

      {/* Stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your snapshot</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.accent} />
        ) : (
          <View style={styles.statsRow}>
            <Stat label="Cards" value={user?.stats?.totalCards ?? 0} />
            <Stat label="Binders" value={user?.stats?.binders ?? 0} />
            <Stat label="Wishlist" value={user?.stats?.wishlist ?? 0} />
          </View>
        )}
      </View>

      {/* Recent activity (if you expose it) */}
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

const styles = StyleSheet.create({
  h1: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  sub: { color: COLORS.textMuted, marginTop: 6, marginBottom: 14 },
  row: { flexDirection: "row", gap: 12, marginBottom: 14 },
  action: {
    flex: 1, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14, padding: 14
  },
  actionLabel: { color: COLORS.text, fontWeight: "700" },
  card: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16, padding: 16, marginBottom: 14
  },
  cardTitle: { color: COLORS.text, fontWeight: "800", marginBottom: 10 },
  statsRow: { flexDirection: "row", gap: 12 },
  activityRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  activityText: { color: COLORS.text },
  activityMeta: { color: COLORS.textMuted, fontSize: 12 },
  link: { color: COLORS.accent, fontWeight: "800", marginTop: 10 }
});
