import { useMutation } from "@apollo/client";
import { useFocusEffect } from "@react-navigation/native";
import { MeDocument, UpdateProfileDocument } from "@sixbyfive/tcg-binder/client";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";
import { AppState } from "react-native";

import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import SegmentTabs from "../../components/common/SegmentTabs";
import ProfileEditForm from "../../components/profile/ProfileEditForm";
import ProfileTopCard from "../../components/profile/ProfileTopCard";
import AchievementsTab from "../../components/profile/tabs/AchievementsTab";
import BindersTab from "../../components/profile/tabs/BindersTab";
import CardsTab from "../../components/profile/tabs/CardsTab";
import OverviewTab from "../../components/profile/tabs/OverviewTab";
import SaleTradeTab from "../../components/profile/tabs/SaleTradeTab";
import WishlistTab from "../../components/profile/tabs/WishlistTab";
import useToast from "../../hooks/useToast";
import { COLORS } from "../../theme/colors";

const avatarPlaceholder = (nameOrUsername) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    nameOrUsername || "User"
  )}&background=2963FF&color=fff`;

// Helper: detect if a URL is the ui-avatars placeholder  ✅ precedence fixed
const isPlaceholderAvatar = (url) =>
  typeof url === "string" &&
  (url.startsWith("https://ui-avatars.com/api?") ||
    url.startsWith("https://ui-avatars.com/api/"));

export default function ProfileTab() {
  const router = useRouter();
  const toast = useToast();

  // state hooks
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("overview");
  const [showcaseIds, setShowcaseIds] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);

  // data hook — returns avatar/bio/favouritePokemon in `me`
  const { data, loading, error, refetch } = useMeQuery({
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const [updateProfileMutation] = useMutation(UpdateProfileDocument);

  const me = data?.me ?? null;

  // memoized initial values for the edit form
  const editInitial = useMemo(() => {
    const displayName = me?.username || "";
    const username = me?.username || "";
    const bio = me?.profile?.bio || "";
    const favouritePokemon =
      me?.profile?.favouritePokemon ?? me?.profile?.favoritePokemon ?? "";
    // Prefer nested profile.avatar, else root avatar, else placeholder
    const rawAvatar = me?.profile?.avatar || me?.avatar || "";
    const avatarUrl = rawAvatar || avatarPlaceholder(displayName || username);

    return { displayName, username, bio, favouritePokemon, avatarUrl };
  }, [me]);

  const showcaseItems = useMemo(() => {
    const map = new Map((me?.cardsPreview ?? []).map((c) => [String(c.id), c]));
    return showcaseIds.map((id) => map.get(String(id))).filter(Boolean);
  }, [me?.cardsPreview, showcaseIds]);

  const tabs = useMemo(
    () => [
      { key: "overview", label: "Overview" },
      { key: "cards", label: "Cards" },
      { key: "binders", label: "Binders" },
      { key: "wishlist", label: "Wishlist" },
      // { key: "forSale", label: "For Sale" },
      // { key: "forTrade", label: "For Trade" },
      { key: "achievements", label: "Achievements" },
    ],
    []
  );

  // seed showcase from preview
  useEffect(() => {
    if (showcaseIds.length === 0 && Array.isArray(me?.cardsPreview)) {
      setShowcaseIds(me.cardsPreview.slice(0, 4).map((c) => String(c.id)));
    }
  }, [me, showcaseIds.length]);

  // Refetch whenever the screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Also refetch when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  // Pull-to-refresh: only use the `refreshing` state to control the spinner
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

  const openShowcaseEditor = useCallback(() => setEditorOpen(true), []);
  const closeShowcaseEditor = useCallback(() => setEditorOpen(false), []);
  const handleSaveShowcase = useCallback(
    (ids) => {
      setShowcaseIds(ids.slice(0, 8));
      closeShowcaseEditor();
    },
    [closeShowcaseEditor]
  );

  // derived collections
  const stats = {
    binders: me?.stats?.binders ?? me?.bindersCount ?? 0,
    cards: me?.stats?.cards ?? me?.cardsCount ?? 0,
    wishlist: me?.stats?.wishlist ?? me?.wishlistCount ?? 0,
    trades: me?.stats?.trades ?? me?.tradesCount ?? 0,
    sales: me?.stats?.sales ?? me?.salesCount ?? 0,
  };
  const cardsPreview = Array.isArray(me?.cardsPreview) ? me.cardsPreview : [];
  const forSalePreview = Array.isArray(me?.forSalePreview) ? me.forSalePreview : [];
  const forTradePreview = Array.isArray(me?.forTradePreview) ? me.forTradePreview : [];
  const achievements = Array.isArray(me?.achievements) ? me.achievements : [];

  // Upload helper (placeholder; wire up to your API when ready)
  const uploadAvatarIfNeeded = useCallback(async (uri) => {
    if (!uri || typeof uri !== "string") return uri;
    // local file/content indicates a new image selected
    if (/^file:|^content:/i.test(uri)) {
      try {
        const form = new FormData();
        form.append("file", { uri, name: "avatar.jpg", type: "image/jpeg" });
        // TODO: POST to your upload endpoint & return URL (e.g., "/uploads/avatars/..png")
        return uri; // temporary so UI keeps showing
      } catch {
        return uri;
      }
    }
    // existing remote/relative value: pass through
    return uri;
  }, []);

  /**
   * Save a minimal patch:
   * - only send fields that changed AND are non-empty
   * - never send the ui-avatars placeholder
   */
  const saveProfile = useCallback(
    async ({ bio, favouritePokemon, avatarUrl }) => {
      const currentBio = me?.profile?.bio ?? "";
      const currentFav =
        me?.profile?.favouritePokemon ?? me?.profile?.favoritePokemon ?? "";
      const currentAvatar = me?.profile?.avatar || me?.avatar || "";

      const patch = {};

      // bio (trim and avoid blank overwrite)
      const bioTrim = (bio ?? "").trim();
      if (bioTrim && bioTrim !== (currentBio || "").trim()) {
        patch.bio = bioTrim;
      }

      // favouritePokemon (trim and avoid blank overwrite)
      const favTrim = (favouritePokemon ?? "").trim();
      if (favTrim && favTrim !== (currentFav || "").trim()) {
        patch.favouritePokemon = favTrim; // match server spelling
      }

      // avatar:
      // - if user picked a new local image -> upload and set
      // - if value equals placeholder -> skip
      // - if unchanged -> skip
      // - if relative/remote but different and not placeholder -> set
      let nextAvatar = avatarUrl || "";
      if (/^file:|^content:/i.test(nextAvatar)) {
        nextAvatar = await uploadAvatarIfNeeded(nextAvatar);
      }

      if (
        nextAvatar &&
        !isPlaceholderAvatar(nextAvatar) &&
        nextAvatar !== currentAvatar
      ) {
        patch.avatar = nextAvatar;
      }

      // Nothing to change? bail out quietly
      if (Object.keys(patch).length === 0) return false;

      await updateProfileMutation({
        variables: patch,
        refetchQueries: [{ query: MeDocument }],
        awaitRefetchQueries: true,
      });
      return true;
    },
    [me, updateProfileMutation, uploadAvatarIfNeeded]
  );

  // ---------- UI selection ----------
  let content = null;

  if (loading && !me) {
    content = (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  } else if (error) {
    content = (
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
  } else if (editMode) {
    content = (
      <ProfileEditForm
        initial={editInitial}
        saving={saving}
        onCancel={() => setEditMode(false)}
        onSave={async (values) => {
          if (saving) return;
          setSaving(true);
          try {
            const changed = await saveProfile(values);
            if (changed) {
              await refetch();
              toast.show("Profile updated", { type: "success" });
            } else {
              toast.show("No changes to save", { type: "info" });
            }
          } catch (e) {
            const msg = e?.graphQLErrors?.[0]?.message || e?.message || "Failed to save profile";
            toast.show(msg, { type: "error" });
          } finally {
            setSaving(false);
            setEditMode(false);
          }
        }}
      />
    );
  } else {
    content = (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            tintColor={COLORS.accent}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <ProfileTopCard
          me={me}
          onAddCards={() => router.push("/(tabs)/search")}
          onEditProfile={() => setEditMode(true)}
        />

        <SegmentTabs tabs={tabs} value={tab} onChange={setTab} />

        {tab === "overview" && (
          <OverviewTab
            stats={stats}
            isOwner
            showcaseItems={showcaseItems}
            onEditStats={() => setEditMode("stats")}
            onEditShowcase={openShowcaseEditor}
            onViewCards={() => router.push("/(tabs)/collection")}
            showAccountActions
            onOpenSettings={() => router.push("/settings")}
            onLogout={handleLogout}
          />
        )}

        {tab === "cards" && (
          <CardsTab
            title="Your Cards"
            cards={cardsPreview}
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
            isOwner
            binders={me?.recentBinders ?? []}
            onCreateBinder={() => router.push("/binders/new")}
            onOpenBinder={(id) => router.push(`/binder/${id}`)}
          />
        )}

        {tab === "wishlist" && (
          <WishlistTab
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
        )}

        {tab === "forSale" && (
          <SaleTradeTab
            title="For Sale"
            items={forSalePreview}
            onOpenCard={(c) =>
              router.push({ pathname: "/card/[id]", params: { id: String(c.id) } })
            }
          />
        )}

        {tab === "forTrade" && (
          <SaleTradeTab
            title="For Trade"
            items={forTradePreview}
            onOpenCard={(c) =>
              router.push({ pathname: "/card/[id]", params: { id: String(c.id) } })
            }
          />
        )}

        {tab === "achievements" && <AchievementsTab items={achievements} />}

        <View style={{ height: 28 }} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {!editMode && <PageHeader title="Profile" subtitle="Manage your account and collection" />}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },
  cta: { alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
