import { useQuery } from "@apollo/client";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BrowseBindersDocument, MeDocument, MyBindersDocument } from "@sixbyfive/tcg-binder/client";
import { COLORS } from "../../../theme/colors";

// Same grid used in Collection tab → visual parity
import BinderGrid from "../../collection/BinderGrid";

let MY_BINDERS_QUERY = MyBindersDocument;
try {
  const maybeSafe = require("../../../graphql/binders-temp");
  if (maybeSafe?.MY_BINDERS_SAFE) MY_BINDERS_QUERY = maybeSafe.MY_BINDERS_SAFE;
} catch (err) {
  if (__DEV__) console.warn("[BindersTab] Safe myBinders query unavailable", err?.message ?? err);
}

/* ---------------- helpers ---------------- */

function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.edges)) return input.edges.map((e) => e?.node ?? e).filter(Boolean);
  if (Array.isArray(input.nodes)) return input.nodes.filter(Boolean);
  if (Array.isArray(input.items)) return input.items.filter(Boolean);
  if (Array.isArray(input.results)) return input.results.filter(Boolean);
  if (Array.isArray(input.entries)) return input.entries.filter(Boolean);
  for (const k of Object.keys(input || {})) {
    const v = input[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      if (Array.isArray(v.edges)) return v.edges.map((e) => e?.node ?? e).filter(Boolean);
      if (Array.isArray(v.nodes)) return v.nodes.filter(Boolean);
    }
  }
  return [];
}

const countCardsFromPages = (pages) => {
  if (!Array.isArray(pages)) return undefined;
  let total = 0;
  for (const p of pages) {
    const slots = Array.isArray(p?.slots) ? p.slots : [];
    for (const slot of slots) {
      if (!slot) continue;
      const hasCard =
        (typeof slot.cardId === "string" && slot.cardId) || slot?.card?.id || slot?.card?.cardId;
      if (!hasCard) continue;
      const qty = Number(slot.quantity ?? 1);
      total += Number.isFinite(qty) ? qty : 1;
    }
  }
  return total;
};

const normalizeBinder = (b) => {
  if (!b) return null;
  return {
    ...b,
    id: String(b.id ?? ""),
    userId: b?.userId ? String(b.userId) : undefined,
    name: b?.name ?? b?.title ?? "Binder",
    // match Collection tab defaults
    coverColor: b?.coverColor ?? b?.cover?.coverColor ?? "#23243c",
    accentColor: b?.accentColor ?? b?.cover?.accentColor ?? "#424a80",
    updatedAt: b?.updatedAt ?? b?.modifiedAt ?? b?.createdAt ?? null,
    pages: Array.isArray(b?.pages) ? b.pages : [],
    cardsCount: b?.cardsCount ?? countCardsFromPages(b?.pages),
    // aliases some grids expect
    color: b?.coverColor ?? b?.cover?.coverColor ?? "#23243c",
    cardCount: b?.cardsCount ?? countCardsFromPages(b?.pages),
    pageCount: Array.isArray(b?.pages) ? b.pages.length : undefined,
  };
};

const normalizeBindersInput = (src) => {
  const root = (!src || Array.isArray(src)) ? src : (
    src.binders ?? src.myBinders ?? src.items ?? src.results ?? src.entries ??
    src.edges ?? src.nodes ?? src.data ?? src.list ?? src
  );
  return toArray(root).map(normalizeBinder).filter(Boolean);
};

/* ---------------- Create Binder banner (parity with Collection tab) ---------------- */

function CreateBinderBanner({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#00000018" }}
      style={({ pressed }) => [
        styles.createBanner,
        pressed && { transform: [{ scale: 0.99 }], opacity: 0.96 },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.createBannerIcon}>
        {/* was a raw "＋" string inside <Text>; use an icon instead */}
        <Ionicons name="add" size={16} color={COLORS.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.createBannerTitle}>Create a new binder</Text>
        <Text style={styles.createBannerSub}>Start organising your cards</Text>
      </View>
      {/* chevron as icon (no bare strings) */}
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </Pressable>
  );
}

/* ---------------- component ---------------- */

export default function BindersTab({
  title = "Binders",
  binders = [],
  userId,              // profile owner id if viewing someone else
  isOwner,             // optional override
  onOpenBinder,        // optional (id, ownerId) => void
  onViewAll,
  onCreateBinder,      // optional override for "new binder" CTA
  pageSize = 12,
  loading = false,
}) {
  const { data: meData } = useQuery(MeDocument, { fetchPolicy: "cache-first" });
  const meId = meData?.me?.id ? String(meData.me.id) : null;

  // 1) from props
  const fromProp = useMemo(() => normalizeBindersInput(binders), [binders]);

  // 2) browse (public for this profile)
  const shouldFetchBrowse = fromProp.length === 0 && !!userId;
  const { data: browseData, loading: browseLoading } = useQuery(
    BrowseBindersDocument,
    { variables: { userId: userId || "" }, skip: !shouldFetchBrowse }
  );
  const fromBrowse = useMemo(() => normalizeBindersInput(browseData?.browseBinders), [browseData]);

  // 3) my binders fallback
  const shouldFetchMine = fromProp.length === 0 && !userId;
  const { data: mineData, loading: mineLoading } = useQuery(MY_BINDERS_QUERY, { skip: !shouldFetchMine });
  const fromMine = useMemo(() => normalizeBindersInput(mineData?.myBinders), [mineData]);

  const display = (fromProp.length ? fromProp : (fromBrowse.length ? fromBrowse : fromMine)).slice(0, pageSize);
  const showSkeleton = loading || browseLoading || mineLoading;

  const openCreate = useCallback(() => {
    if (typeof onCreateBinder === "function") return onCreateBinder();
    router.push("/binder/new");
  }, [onCreateBinder]);

  const openBinderDefault = useCallback(
    (id, ownerId) => {
      const binderId = id ? String(id) : "";
      if (!binderId) return;

      const iOwnThis =
        (typeof isOwner === "boolean" && isOwner) ||
        (!!meId && !!ownerId && meId === ownerId) ||
        (!userId);

      // use direct string paths to avoid param binding issues
      router.push(iOwnThis ? `/binder/${binderId}/edit` : `/binder/${binderId}`);
    },
    [isOwner, meId, userId]
  );

  const handleOpenBinder = useCallback(
    (id, ownerId) => {
      if (typeof onOpenBinder === "function") onOpenBinder(id, ownerId);
      else openBinderDefault(id, ownerId);
    },
    [onOpenBinder, openBinderDefault]
  );

  /* -------- render -------- */

  if (showSkeleton) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={{ paddingVertical: 8, alignItems: "center" }}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      </View>
    );
  }

  if (!display.length) {
    // Empty-state card kept the same (all text wrapped in <Text>)
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>
          No binders yet. Create one to start organizing your collection.
        </Text>
        <View style={{ marginTop: 10 }}>
          <Pressable
            onPress={openCreate}
            style={({ pressed }) => [
              styles.createTile,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
          >
            <View style={styles.createIconBubble}>
              <Ionicons name="add" size={18} color="#fff" />
            </View>
            <Text style={styles.createTitle}>New Binder</Text>
            <Text style={styles.createSub}>Start organizing your cards</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Match the "binders" segment layout from Collection tab
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Banner only on your own profile */}
      {!userId && <CreateBinderBanner onPress={openCreate} />}

      {/* Same grid for visuals/behaviour */}
      <BinderGrid
        binders={display}
        onCreate={openCreate}
        onOpen={(id) => handleOpenBinder(id)}
      />

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // loading/empty states
  card: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },

  createTile: {
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  createIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  createTitle: { color: COLORS.text, fontWeight: "900" },
  createSub: { color: COLORS.textMuted, marginTop: 2, fontSize: 12 },

  // layout parity with Collection tab
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },

  /* Create binder banner */
  createBanner: {
    marginTop: 10,
    marginHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    // `gap` is supported on newer RN; if you're on older RN and this warns, replace with explicit margins
    gap: 10,
  },
  createBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.alt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  createBannerTitle: { color: COLORS.text, fontWeight: "800" },
  createBannerSub: { color: COLORS.textMuted, fontSize: 12 },
});
