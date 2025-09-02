// app/(tabs)/profile.js

import { useMeQuery } from "@sixbyfive/tcg-binder/react";
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
import SegmentTabs from "../../components/common/SegmentTabs";
import ProfileEditForm from "../../components/profile/ProfileEditForm";
import ProfileTopCard from "../../components/profile/ProfileTopCard";
import ShowcaseEditorSheet from "../../components/profile/showcase/ShowcaseEditorSheet";
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
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("overview");
  const toast = useToast();
  const [showcaseIds, setShowcaseIds] = useState([]); 
  const [editorOpen, setEditorOpen] = useState(false); 

  const { data, loading, error, refetch, networkStatus } = useMeQuery({
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
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

  const editInitial = useMemo(() => {
    const displayName = me?.username || "";
    const username = me?.username || "";
    const bio = me?.profile?.bio || "";
    const favouritePokemon = me?.profile?.favouritePokemon || "";
    const avatarUrl =
      me?.avatar || me?.profile?.avatar || avatarPlaceholder(displayName || username);

    return { displayName, username, bio, favouritePokemon, avatarUrl };
  }, [me]);

  // ----- Loading / Error -----
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
            // TODO: call update profile mutation here
            // await updateProfile({ variables: { input: { ... } } });
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

  React.useEffect(() => {
    if (showcaseIds.length === 0 && Array.isArray(me?.cardsPreview)) {
      setShowcaseIds(me.cardsPreview.slice(0, 4).map((c) => String(c.id))); 
    }
  }, [me, showcaseIds.length]); 

  const showcaseItems = React.useMemo(() => {
    const map = new Map((me?.cardsPreview ?? []).map((c) => [String(c.id), c]));
    return showcaseIds.map((id) => map.get(String(id))).filter(Boolean); 
  }, [me?.cardsPreview, showcaseIds]);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "cards", label: "Cards" },
    { key: "binders", label: "Binders" },
    { key: "wishlist", label: "Wishlist" },
    { key: "forSale", label: "For Sale" },
    { key: "forTrade", label: "For Trade" },
    { key: "achievements", label: "Achievements" },
  ];

  const openShowcaseEditor = () => setEditorOpen(true);
  const closeShowcaseEditor = () => setEditorOpen(false);
  const handleSaveShowcase = (ids) => {
    setShowcaseIds(ids.slice(0, 8));
    closeShowcaseEditor();
  }

  // Derived collections
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
        <ShowcaseEditorSheet
          visible={editorOpen}
          onClose={closeShowcaseEditor}
          onSave={handleSaveShowcase}
          candidates={me?.cardsPreview ?? []} 
          initialSelected={showcaseIds}
          max={8}
        />

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
