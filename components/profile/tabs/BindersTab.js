// components/profile/tabs/BindersTab.js
//
// Profile-aware fetching with BrowseBindersDocument → fallback to MyBindersDocument,
// robust normalization for arrays/connections/node.binder, and an owner-only
// "Create Binder" tile + header button.

import { useQuery } from "@apollo/client";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  BrowseBindersDocument,
  MyBindersDocument,
} from "@sixbyfive/tcg-binder/client";
import { COLORS } from "../../../theme/colors";
import RecentBinders from "../ProfileRecentBinders";

/* ---------------- helpers: normalizers ---------------- */

// flatten containers → array
function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;

  if (Array.isArray(input.edges))
    return input.edges.map((e) => e?.node ?? e).filter(Boolean);
  if (Array.isArray(input.nodes)) return input.nodes.filter(Boolean);
  if (Array.isArray(input.items)) return input.items.filter(Boolean);
  if (Array.isArray(input.results)) return input.results.filter(Boolean);
  if (Array.isArray(input.entries)) return input.entries.filter(Boolean);

  // one nested layer
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

function unwrapBinderish(item) {
  const n = item?.node ?? item;
  return n?.binder ?? n;
}

function normalizeBinder(item) {
  const b = unwrapBinderish(item);
  const id = b?.id ?? item?.id;
  if (!id) return null;

  const title = b?.title ?? b?.name ?? "Binder";
  const image =
    b?.coverImage ??
    b?.image ??
    b?.thumbnail ??
    (typeof b?.cover === "string" ? b.cover : b?.cover?.image) ??
    "";

  const cardsCount =
    b?.cardsCount ??
    b?.totalCards ??
    (Array.isArray(b?.cards) ? b.cards.length : undefined);

  const pagesCount =
    b?.pagesCount ??
    b?.totalPages ??
    (Array.isArray(b?.pages) ? b.pages.length : undefined);

  return {
    id: String(id),
    name: title,
    title,
    image,
    cover: image,
    cardsCount,
    pagesCount,
    updatedAt: b?.updatedAt ?? b?.updated_at ?? b?.modifiedAt ?? b?.modified_at,
    ...b,
  };
}

function normalizeBindersInput(bindersProp) {
  if (!bindersProp) return [];
  if (!Array.isArray(bindersProp) && typeof bindersProp === "object") {
    const candidates = [
      "binders",
      "myBinders",
      "items",
      "results",
      "entries",
      "edges",
      "nodes",
      "data",
      "list",
    ];
    for (const k of candidates) {
      if (bindersProp[k])
        return toArray(bindersProp[k]).map(normalizeBinder).filter(Boolean);
    }
    return toArray(bindersProp).map(normalizeBinder).filter(Boolean);
  }
  return toArray(bindersProp).map(normalizeBinder).filter(Boolean);
}

/* ---------------- small presentational: Create tile ---------------- */

function CreateBinderTile({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.createTile,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Create a new binder"
    >
      <View style={styles.createIconBubble}>
        <Ionicons name="add" size={18} color="#fff" />
      </View>
      <Text style={styles.createTitle}>New Binder</Text>
      <Text style={styles.createSub}>Start organizing your cards</Text>
    </Pressable>
  );
}

/* ---------------- component ---------------- */

export default function BindersTab({
  title = "Binders",
  binders = [],
  userId,
  isOwner = false,
  onCreateBinder,
  onOpenBinder,
  onViewAll,
  pageSize = 12,
  loading = false,
}) {
  const canCreate = isOwner && typeof onCreateBinder === "function";

  // 1) normalize from props
  const fromProp = useMemo(() => normalizeBindersInput(binders), [binders]);

  // 2) fetch public binders for this profile (when prop is empty)
  const shouldFetchBrowse = fromProp.length === 0 && !!userId;
  const {
    data: browseData,
    loading: loadingBrowse,
    error: browseError,
  } = useQuery(BrowseBindersDocument, {
    variables: { userId, page: 1, pageSize },
    skip: !shouldFetchBrowse,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  // 3) normalize the browse result
  const fromBrowse = useMemo(() => {
    const root = browseData?.browseBinders ?? browseData ?? [];
    return normalizeBindersInput(root);
  }, [browseData]);

  // 4) fallback to "my binders"
  const shouldFetchMine =
    fromProp.length === 0 && (!userId || (userId && fromBrowse.length === 0));

  const {
    data: myData,
    loading: loadingMine,
    error: myError,
  } = useQuery(MyBindersDocument, {
    variables: userId ? { userId, page: 1, pageSize } : { page: 1, pageSize },
    skip: !shouldFetchMine,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const fromMine = useMemo(() => {
    const root = myData?.myBinders ?? myData ?? [];
    return normalizeBindersInput(root);
  }, [myData]);

  // 5) pick data source (prop > browse > mine)
  const display = (fromProp.length ? fromProp : fromBrowse.length ? fromBrowse : fromMine).slice(
    0,
    pageSize
  );

  // 6) UX states
  const isLoading = loading || loadingBrowse || loadingMine;
  const showSkeleton = isLoading && fromProp.length === 0 && display.length === 0;
  const error = browseError || myError;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[BindersTab] source", {
      propCount: fromProp.length,
      browseCount: fromBrowse.length,
      mineCount: fromMine.length,
      used: display.length,
      via: fromProp.length
        ? "prop"
        : fromBrowse.length
        ? "BrowseBindersDocument"
        : "MyBindersDocument",
      error: error?.message,
    });
  }

  if (display.length) {
    return (
      <>
        {(typeof onViewAll === "function" || canCreate) && (
          <View style={[styles.card, { paddingVertical: 8, marginBottom: 8 }]}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>{title}</Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {canCreate && (
                  <Pressable
                    onPress={onCreateBinder}
                    style={({ pressed }) => [
                      styles.createBtn,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Ionicons name="add" size={14} color="#fff" />
                    <Text style={styles.createBtnText}>New</Text>
                  </Pressable>
                )}

                {typeof onViewAll === "function" && (
                  <Text onPress={onViewAll} style={styles.viewAll}>
                    View all →
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {canCreate && (
          <View style={{ marginTop: 8 }}>
            <CreateBinderTile onPress={onCreateBinder} />
          </View>
        )}

        <RecentBinders binders={display} onOpenBinder={onOpenBinder} />
      </>
    );
  }

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

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.bodyText}>Failed to load binders.</Text>
      </View>
    );
  }

  // empty state
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {canCreate ? (
        <>
          <Text style={[styles.bodyText, { marginBottom: 10 }]}>
            You don’t have any binders yet.
          </Text>
          <CreateBinderTile onPress={onCreateBinder} />
        </>
      ) : (
        <Text style={styles.bodyText}>No public binders yet.</Text>
      )}
    </View>
  );
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  viewAll: { color: COLORS.accent, fontWeight: "800" },
  bodyText: { color: COLORS.text },

  /* create button in header */
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  createBtnText: { color: "#fff", fontWeight: "900", fontSize: 12.5 },

  /* create tile */
  createTile: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
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
});
