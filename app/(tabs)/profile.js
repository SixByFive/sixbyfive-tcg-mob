// app/(tabs)/profile.js

import { useMutation } from "@apollo/client";
import { MeDocument, UpdateProfileDocument } from "@sixbyfive/tcg-binder/client";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";

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

export default function ProfileTab() {
  const router = useRouter();
  const toast = useToast();

  // state hooks (always called)
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("overview");
  const [showcaseIds, setShowcaseIds] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);

  // data hook (always called) — this returns avatar/bio/favouritePokemon in `me` shape
  const { data, loading, error, refetch, networkStatus } = useMeQuery({
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // ✅ ADDED: mutation to update profile
  const [updateProfileMutation] = useMutation(UpdateProfileDocument);

  const me = data?.me ?? null;

  // memoized values (always called)
  const editInitial = useMemo(() => {
    const displayName = me?.username || "";
    const username = me?.username || "";
    const bio = me?.profile?.bio || "";
    // server could expose either favouritePokemon or favoritePokemon — handle both
    const favouritePokemon =
      me?.profile?.favouritePokemon ??
      me?.profile?.favoritePokemon ??
      "";
    const avatarUrl =
      me?.avatar || me?.profile?.avatar || avatarPlaceholder(displayName || username);

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

  // effects (always called)
  useEffect(() => {
    if (showcaseIds.length === 0 && Array.isArray(me?.cardsPreview)) {
      setShowcaseIds(me.cardsPreview.slice(0, 4).map((c) => String(c.id)));
    }
  }, [me, showcaseIds.length]);

  // callbacks (always called)
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

  // derived collections (always called)
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

  // ----------------------------------------------------------------------------------
  // ✅ ADDED: small helper to upload a local (file:// or content://) avatar to your CDN
  // Replace the implementation with your actual upload flow (presigned URL or REST).
  // Returns a remote, publicly accessible URL (or the original if already remote).
  // ----------------------------------------------------------------------------------
  const uploadAvatarIfNeeded = useCallback(async (uri) => {
    if (!uri || typeof uri !== "string") return uri;

    // already remote?
    if (/^https?:\/\//i.test(uri)) return uri;

    // not remote → implement your upload here:
    // Example placeholder (FormData to your REST endpoint):
    try {
      const form = new FormData();
      // NOTE: In React Native, you must pass a file object with name/type/uri
      form.append("file", {
        uri,
        name: "avatar.jpg",
        type: "image/jpeg",
      });

      // TODO: Replace with your real endpoint
      // const res = await fetch("https://your-api.example.com/upload/avatar", {
      //   method: "POST",
      //   headers: { Authorization: `Bearer ${tokenIfYouHaveOne}` },
      //   body: form,
      // });
      // if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      // const json = await res.json();
      // return json.url; // <-- remote URL

      // TEMP: if you haven't wired an endpoint yet, just keep the local uri
      // so the UI shows immediately; the mutation below can still accept a URL later.
      return uri;
    } catch (e) {
      console.warn("Avatar upload failed:", e);
      // Fall back to original uri so UI doesn't break
      return uri;
    }
  }, []);

  // ----------------------------------------------------------------------------------
  // ✅ ADDED: robust saver that tries common variable shapes the server might expect.
  // Prefer your real shape if you know it (most likely { input: { bio, favouritePokemon, avatar } }).
  // ----------------------------------------------------------------------------------
  const saveProfile = useCallback(
    async ({ bio, favouritePokemon, avatarUrl }) => {
     // server expects 'avatar', not 'avatarUrl'
     const finalAvatar = await uploadAvatarIfNeeded(avatarUrl);

     await updateProfileMutation({
       variables: {
         bio,
         favouritePokemon,        // spelling matches the schema
         avatar: finalAvatar,
       },
       // make sure local UI updates immediately
       refetchQueries: [{ query: MeDocument }],
       awaitRefetchQueries: true,
     });
     return true;
   },
   [updateProfileMutation, uploadAvatarIfNeeded]
  );

  // ---------- UI content selection (no early returns with hooks above) ----------
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
            // ✅ CHANGED: actually save profile to server
            await saveProfile(values);
            // ✅ refresh local data so ProfileTopCard and tabs show fresh values
            await refetch();
            toast.show("Profile updated", { type: "success" });
          } catch (e) {
            const msg =
              e?.graphQLErrors?.[0]?.message || e?.message || "Failed to save profile";
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
            refreshing={refreshing || networkStatus === 4}
            onRefresh={onRefresh}
          />
        }
      >
        {/* ✅ ProfileTopCard consumes avatar/bio/favouritePokemon from `me` (useMeQuery) */}
        <ProfileTopCard
          me={me}
          onAddCards={() => router.push("/(tabs)/search")}
          onEditProfile={() => setEditMode(true)}
        />

        <SegmentTabs tabs={tabs} value={tab} onChange={setTab} />

        {tab === "overview" && (
          <OverviewTab
            stats={stats}
            isOwner={true /* or me?.id === profileOwnerId */}
            showcaseItems={showcaseItems}
            onEditStats={() => setEditMode("stats")}
            onEditShowcase={openShowcaseEditor}
            onViewCards={() => router.push("/(tabs)/collection")}
            showAccountActions
            onOpenSettings={() => router.push("/settings")}
            onLogout={handleLogout}
          />
        )}

        {/* If you add the editor back later:
        <ShowcaseEditorSheet
          visible={editorOpen}
          onClose={closeShowcaseEditor}
          onSave={handleSaveShowcase}
          candidates={me?.cardsPreview ?? []}
          initialSelected={showcaseIds}
          max={8}
        />
        */}

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

  // Single return after all hooks have been declared
  return (
    <View style={styles.container}>
      {/* Show a header on all states except edit mode (your UI choice) */}
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
