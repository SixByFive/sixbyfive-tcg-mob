// components/profile/tabs/BindersTab.js

// CHANGED: profile-aware fetching with BrowseBindersDocument → fallback to MyBindersDocument,
//          robust normalization for arrays/connections/node.binder.

import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";
import RecentBinders from "../ProfileRecentBinders";

// NEW: Apollo fetch for profile + fallback
import { useQuery } from "@apollo/client";
import { BrowseBindersDocument, MyBindersDocument } from "@sixbyfive/tcg-binder/client";

/* ---------------- helpers: normalizers ---------------- */

// flatten containers → array
function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;

  // common connection containers
  if (Array.isArray(input.edges)) return input.edges.map((e) => e?.node ?? e).filter(Boolean);
  if (Array.isArray(input.nodes)) return input.nodes.filter(Boolean);
  if (Array.isArray(input.items)) return input.items.filter(Boolean);
  if (Array.isArray(input.results)) return input.results.filter(Boolean);
  if (Array.isArray(input.entries)) return input.entries.filter(Boolean);

  // one nested layer (handles { list:{ edges:[] } } etc.)
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

// unwrap common wrappers (entry/node/binder)
function unwrapBinderish(item) {
  const n = item?.node ?? item;
  return n?.binder ?? n;
}

// normalize binder object into something RecentBinders can render
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
    ...b, // pass through original fields just in case RecentBinders reads more
  };
}

// accept ANY incoming `binders` prop (array or connection-like)
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
      if (bindersProp[k]) return toArray(bindersProp[k]).map(normalizeBinder).filter(Boolean);
    }
    return toArray(bindersProp).map(normalizeBinder).filter(Boolean);
  }
  return toArray(bindersProp).map(normalizeBinder).filter(Boolean);
}

/* ---------------- component ---------------- */

export default function BindersTab({
  // NEW: parity with other tabs
  title = "Binders",
  binders = [],               // may be array or connection-ish; normalized below
  userId,                     // NEW: if provided and binders empty → fetch THIS user's public binders
  onOpenBinder,
  onViewAll,                  // NEW: optional “View all” CTA
  pageSize = 12,              // NEW: how many to show on profile tab
  loading = false,            // NEW: optional external loading flag
}) {
  // 1) normalize from props
  const fromProp = useMemo(() => normalizeBindersInput(binders), [binders]);

  // 2) fetch public binders for this profile (when prop is empty)
  const shouldFetchBrowse = fromProp.length === 0 && !!userId;
  const {
    data: browseData,
    loading: loadingBrowse,
    error: browseError,
  } = useQuery(BrowseBindersDocument, {
    variables: { userId, page: 1, pageSize }, // CHANGED: use page/pageSize like other tabs
    skip: !shouldFetchBrowse,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  // 3) normalize the browse result (supports { browseBinders: … } or flat)
  const fromBrowse = useMemo(() => {
    const root = browseData?.browseBinders ?? browseData ?? [];
    return normalizeBindersInput(root);
  }, [browseData]);

  // 4) fallback to "my binders" if:
  //    - no userId (owner profile), or
  //    - we tried browse for a profile but got nothing back
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
  const display = (fromProp.length ? fromProp : (fromBrowse.length ? fromBrowse : fromMine)).slice(
    0,
    pageSize
  );

  // 6) UX states
  const isLoading = loading || loadingBrowse || loadingMine;
  const showSkeleton = isLoading && fromProp.length === 0 && display.length === 0;
  const error = browseError || myError;

  // DEV insight
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[BindersTab] source", {
      propCount: fromProp.length,
      browseCount: fromBrowse.length,
      mineCount: fromMine.length,
      used: display.length,
      via: fromProp.length ? "prop" : fromBrowse.length ? "BrowseBindersDocument" : "MyBindersDocument",
      error: error?.message,
    });
  }

  if (display.length) {
    return (
      <>
        {typeof onViewAll === "function" && (
          <View style={[styles.card, { paddingVertical: 8, marginBottom: 8 }]}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text onPress={onViewAll} style={styles.viewAll}>View all →</Text>
            </View>
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

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.bodyText}>No public binders yet.</Text>
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  viewAll: { color: COLORS.accent, fontWeight: "800" },
  bodyText: { color: COLORS.text },
});
