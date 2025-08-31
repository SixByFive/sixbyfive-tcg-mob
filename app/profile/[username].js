// app/profile/[username].js

import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import PageHeaderBackSimple from "../../components/common/PageHeaderBackSimple";
import RecentBinders from "../../components/profile/ProfileRecentBinders";
import ProfileTopCard from "../../components/profile/ProfileTopCard";
import WishlistGrid from "../../components/profile/WishlistGrid";
import { getUserByUsernameLocal } from "../../lib/fakeUsers";
import { COLORS } from "../../theme/colors";

export default function PublicProfileFake() {
  const router = useRouter();
  const { username = "" } = useLocalSearchParams();

  const user = getUserByUsernameLocal(username);

  if (!user) {
    // REALISTIC 404-STYLE STATE (but still fake-data world)
    return (
      <View style={styles.container}>
        <PageHeaderBackSimple
          title="Profile"
          subtitle={`@${String(username)}`}
          onBack={() => router.back()}
        />
        <View style={[styles.center, { paddingHorizontal: 24 }]}>
          <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 18, marginBottom: 6 }}>
            User not found
          </Text>
          <Text style={{ color: COLORS.textMuted, textAlign: "center", marginBottom: 12 }}>
            We couldn’t find an account named @{String(username)}.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // --- VIEW (READ-ONLY) ---
  return (
    <View style={styles.container}>
      <PageHeaderBackSimple
        title={user.displayName || user.username || "Profile"}
        subtitle={`@${user.username || ""}`}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl tintColor={COLORS.accent} refreshing={false} onRefresh={() => {}} />}
      >
        <ProfileTopCard me={user} readonly />

        <RecentBinders
          binders={user.recentBinders}
          onCreateBinder={undefined}
          onOpenBinder={(id) => router.push(`/binder/${id}`)}
        />

        <WishlistGrid
          items={user.wishlistPreview}
          onBrowse={undefined}
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

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
