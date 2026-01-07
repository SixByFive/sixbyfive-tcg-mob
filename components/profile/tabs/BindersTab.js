import { gql, useQuery } from "@apollo/client";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  MeDocument,
  MyBindersDocument
} from "@sixbyfive/tcg-binder/client";
import { COLORS } from "../../../theme/colors";

// Same grid used in Collection tab → visual parity
import BinderGrid from "../../collection/BinderGrid";

let MY_BINDERS_QUERY = MyBindersDocument;
try {
  const maybeSafe = require("../../../graphql/binders-temp");
  if (maybeSafe?.MY_BINDERS_SAFE) MY_BINDERS_QUERY = maybeSafe.MY_BINDERS_SAFE;
} catch (err) {
  if (__DEV__)
    console.warn(
      "[BindersTab] Safe myBinders query unavailable",
      err?.message ?? err
    );
}

/**
 * ADDED: schema-correct safe browse query
 * - because browseBinders returns BinderPageResult { binders, total, page, pageSize }
 * - generated BrowseBindersDocument might not match that shape in your client
 */
const BROWSE_BINDERS_SAFE = gql`
  query BrowseBinders_Safe($userId: ID!, $page: Int, $pageSize: Int) {
    browseBinders(userId: $userId, page: $page, pageSize: $pageSize) {
      total
      page
      pageSize
      binders {
        id
        userId
        name
        description
        coverColor
        accentColor
        visibility
        slug
        createdAt
        updatedAt
        pages {
          id
          slots {
            id
            cardId
            quantity
          }
        }
      }
    }
  }
`;

/* ---------------- helpers ---------------- */

function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.edges))
    return input.edges.map((e) => e?.node ?? e).filter(Boolean);
  if (Array.isArray(input.nodes)) return input.nodes.filter(Boolean);
  if (Array.isArray(input.items)) return input.items.filter(Boolean);
  if (Array.isArray(input.results)) return input.results.filter(Boolean);
  if (Array.isArray(input.entries)) return input.entries.filter(Boolean);
  for (const k of Object.keys(input || {})) {
    const v = input[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      if (Array.isArray(v.edges))
        return v.edges.map((e) => e?.node ?? e).filter(Boolean);
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
        (typeof slot.cardId === "string" && slot.cardId) ||
        slot?.card?.id ||
        slot?.card?.cardId;
      if (!hasCard) continue;
      const qty = Number(slot.quantity ?? 1);
      total += Number.isFinite(qty) ? qty : 1;
    }
  }
  return total;
};

const normalizeBinder = (b) => {
  if (!b) return null;
  const pages = Array.isArray(b?.pages) ? b.pages : [];
  const cardCount = b?.cardsCount ?? countCardsFromPages(pages);

  return {
    ...b,
    id: String(b.id ?? ""),
    userId: b?.userId ? String(b.userId) : undefined,
    name: b?.name ?? b?.title ?? "Binder",
    // match Collection tab defaults
    coverColor: b?.coverColor ?? b?.cover?.coverColor ?? "#23243c",
    accentColor: b?.accentColor ?? b?.cover?.accentColor ?? "#424a80",
    updatedAt: b?.updatedAt ?? b?.modifiedAt ?? b?.createdAt ?? null,
    pages,
    cardsCount: cardCount,
    // aliases some grids expect
    color: b?.coverColor ?? b?.cover?.coverColor ?? "#23243c",
    cardCount: cardCount,
    pageCount: pages.length,
  };
};

/**
 * CHANGED: explicitly handle BinderPageResult by preferring `.binders`
 */
const normalizeBindersInput = (src) => {
  if (!src) return [];

  // browseBinders -> { binders, total, page, pageSize }
  const root =
    (!src || Array.isArray(src))
      ? src
      : (src.binders ?? // <-- ADDED: crucial
          src.myBinders ??
          src.items ??
          src.results ??
          src.entries ??
          src.edges ??
          src.nodes ??
          src.data ??
          src.list ??
          src);

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
        <Ionicons name="add" size={16} color={COLORS.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.createBannerTitle}>Create a new binder</Text>
        <Text style={styles.createBannerSub}>Start organising your cards</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </Pressable>
  );
}

/* ---------------- component ---------------- */

export default function BindersTab({
  title = "Binders",
  binders = [],
  userId, // profile owner id if viewing someone else (NOTE: could be your own id!)
  isOwner, // optional override
  onOpenBinder, // optional (id, ownerId) => void
  onViewAll,
  onCreateBinder, // optional override for "new binder" CTA
  pageSize = 12,
  loading = false,
}) {
  const { data: meData } = useQuery(MeDocument, { fetchPolicy: "cache-first" });
  const meId = meData?.me?.id ? String(meData.me.id) : null;

  // ADDED: decide ownership robustly (fixes "own profile broke when userId exists")
  const effectiveIsOwner = useMemo(() => {
    if (typeof isOwner === "boolean") return isOwner;
    if (!meId) return false;
    if (!userId) return true; // "My binders" context (no userId passed)
    return String(userId) === meId; // viewing my profile by userId
  }, [isOwner, meId, userId]);

  const viewingOtherUser = !!userId && !effectiveIsOwner;

  // 1) from props
  const fromProp = useMemo(() => normalizeBindersInput(binders), [binders]);

  // 2) browse (ONLY when viewing someone else)
  // CHANGED: use safe browse query & proper paging vars
  const shouldFetchBrowse = fromProp.length === 0 && viewingOtherUser;
  const {
    data: browseData,
    loading: browseLoading,
    error: browseError,
  } = useQuery(BROWSE_BINDERS_SAFE, {
    variables: { userId: String(userId || ""), page: 1, pageSize },
    skip: !shouldFetchBrowse,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const fromBrowse = useMemo(
    () => normalizeBindersInput(browseData?.browseBinders),
    [browseData]
  );

  // 3) my binders fallback (ONLY when owner)
  // CHANGED: fetch mine even if userId exists, as long as it's my profile
  const shouldFetchMine = fromProp.length === 0 && effectiveIsOwner;
  const {
    data: mineData,
    loading: mineLoading,
    error: mineError,
  } = useQuery(MY_BINDERS_QUERY, {
    skip: !shouldFetchMine,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const fromMine = useMemo(
    () => normalizeBindersInput(mineData?.myBinders),
    [mineData]
  );

  // CHANGED: choose source correctly by mode
  const merged =
    fromProp.length
      ? fromProp
      : viewingOtherUser
      ? fromBrowse
      : fromMine;

  const display = merged.slice(0, pageSize);

  const showSkeleton = loading || browseLoading || mineLoading;

  const openCreate = useCallback(() => {
    if (typeof onCreateBinder === "function") return onCreateBinder();
    router.push("/binder/new");
  }, [onCreateBinder]);

  const openBinderDefault = useCallback(
    (id, ownerId) => {
      const binderId = id ? String(id) : "";
      if (!binderId) return;

      // CHANGED: use effectiveIsOwner first; fallback to ownerId match if available
      const iOwnThis =
        effectiveIsOwner ||
        (!!meId && !!ownerId && String(ownerId) === meId) ||
        (!userId);

      router.push(iOwnThis ? `/binder/${binderId}/edit` : `/binder/${binderId}`);
    },
    [effectiveIsOwner, meId, userId]
  );

  const handleOpenBinder = useCallback(
    (id, ownerId) => {
      if (typeof onOpenBinder === "function") onOpenBinder(id, ownerId);
      else openBinderDefault(id, ownerId);
    },
    [onOpenBinder, openBinderDefault]
  );

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[BindersTab debug]", {
      meId,
      userId,
      effectiveIsOwner,
      viewingOtherUser,
      fromProp: fromProp.length,
      fromBrowse: fromBrowse.length,
      fromMine: fromMine.length,
      browseError: browseError?.message,
      mineError: mineError?.message,
    });
  }

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
    const msg =
      (viewingOtherUser ? browseError?.message : mineError?.message) ||
      "No binders yet. Create one to start organizing your collection.";

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>{msg}</Text>

        {/* Only show create CTA if owner */}
        {effectiveIsOwner && (
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
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* CHANGED: Banner only when owner (not based on presence of userId) */}
      {effectiveIsOwner && <CreateBinderBanner onPress={openCreate} />}

      <BinderGrid
        binders={display}
        onCreate={openCreate}
        // CHANGED: pass ownerId through if BinderGrid provides it; fallback still works
        onOpen={(id, ownerId) => handleOpenBinder(id, ownerId)}
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
