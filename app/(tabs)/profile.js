// app/(tabs)/profile.js

import { useQuery } from "@apollo/client";
import { MeDocument } from "@sixbyfive/tcg-binder";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import ProfileEditForm from "../../components/profile/ProfileEditForm";
import RecentBinders from "../../components/profile/ProfileRecentBinders";
import ProfileTopCard from "../../components/profile/ProfileTopCard";
import WishlistGrid from "../../components/profile/WishlistGrid";
import useToast from "../../hooks/useToast";
import { COLORS } from "../../theme/colors";

const avatarPlaceholder = (nameOrUsername) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(nameOrUsername || "User")}&background=2963FF&color=fff`;

export default function ProfileTab() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false); 
  const [saving, setSaving] = useState(false);     
  const toast = useToast;

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

  // Seed values for the edit component
  const editInitial = useMemo(() => {
    const displayName = me?.displayName || me?.username || "";
    const username = me?.username || "";
    const bio = me?.bio || "";
    const favouritePokemon = me?.favouritePokemon || "";
    const avatarUrl = me?.avatarUrl || avatarPlaceholder(displayName || username);
    return { displayName, username, bio, favouritePokemon, avatarUrl };
  }, [me]);

  // ----- Error/Loading -----
  if (loading && !me) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
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
    );
  }

  // ----- EDIT MODE -----
  if (editMode) {
    return (
      <ProfileEditForm
        initial={editInitial}
        saving={saving}
        onCancel={() => setEditMode(false)}
        onSave={async (values) => {
          if (saving) return;
          setSaving(true);
          try {
            // TODO: call updateProfile mutation here:
            // await updateProfile({ variables: { input: {
            //   bio: values.bio,
            //   favouritePokemon: values.favouritePokemon,
            //   avatarUrl: values.avatarUrl,
            // }}})
            // await refetch();
            toast.show("Profile updated", { type: "success" });
          } catch (e) {
            toast.show("Failed to save profile", { type: "error" });
          } finally {
            setSaving(false);
            setEditMode(false);
          }
        }}
      />
    );
  }

  // ----- VIEW MODE -----
  return (
    <View style={styles.container}>
      <PageHeader title="Profile" subtitle="Manage your account and collection" />

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
          onEditProfile={() => setEditMode(true)}
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

        {/* Account actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <Pressable style={styles.actionRow} onPress={() => router.push("/settings")}>
            <Text style={styles.actionText}>App Settings</Text>
          </Pressable>

          <Pressable style={styles.actionRow} onPress={handleLogout}>
            <Text style={styles.actionText}>Log out</Text>
          </Pressable>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },

  cta: { alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  section: { marginTop: 20, paddingHorizontal: 12, gap: 10 },
  sectionTitle: { color: COLORS.textMuted, fontWeight: "800", marginBottom: 2 },
  actionRow: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionText: { color: COLORS.text, fontWeight: "800" },
});
