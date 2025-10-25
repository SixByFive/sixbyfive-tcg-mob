import { useQuery } from "@apollo/client";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { BrowseBindersDocument, MeDocument } from "@sixbyfive/tcg-binder/client";
import { COLORS } from "../../../theme/colors";
import RecentBinders from "../ProfileRecentBinders";
import { MY_BINDERS_SAFE } from "../../../graphql/binders-temp";

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
      const qty = Number(slot?.quantity);
      total += Number.isFinite(qty) && qty > 0 ? qty : 1;
    }
  }
  return total;
};

const unwrap = (item) => (item?.node ?? item)?.binder ?? (item?.node ?? item);

function normalizeBinder(item) {
  const b = unwrap(item);
  const id = b?.id ?? item?.id;
  if (!id) return null;

  const name = (b?.name ?? b?.title ?? "Binder").trim();
  const updatedAt = b?.updatedAt ?? b?.updated_at ?? b?.modifiedAt ?? b?.modified_at ?? null;

  // schema fields
  const coverColor = b?.coverColor ?? "#23243c";
  const accentColor = b?.accentColor ?? "#424a80";

  const pages = Array.isArray(b?.pages) ? b.pages : undefined;

  return {
    id: String(id),
    userId: b?.userId ? String(b.userId) : undefined, // keep owner per row
    name,
    title: name,
    updatedAt,
    pagesCount: pages?.length,
    cardsCount: countCardsFromPages(pages),
    coverColor,
    accentColor,
    cover: { coverColor, accentColor },
    ...b,
  };
}

const normalizeBindersInput = (src) => {
  const root = (!src || Array.isArray(src)) ? src : (
    src.binders ?? src.myBinders ?? src.items ?? src.results ?? src.entries ??
    src.edges ?? src.nodes ?? src.data ?? src.list ?? src
  );
  return toArray(root).map(normalizeBinder).filter(Boolean);
};

/* ---------------- component ---------------- */

export default function BindersTab({
  title = "Binders",
  binders = [],
  userId,              // profile owner id if viewing someone else
  isOwner,             // optional override
  onOpenBinder,        // optional (id, ownerId) => void
  onViewAll,
  pageSize = 12,
  loading = false,
}) {
  // who am I?
  const { data: meData } = useQuery(MeDocument, { fetchPolicy: "cache-first" });
  const meId = meData?.me?.id ? String(meData.me.id) : null;

  // 1) from props
  const fromProp = useMemo(() => normalizeBindersInput(binders), [binders]);

  // 2) browse (public for this profile)
  const shouldFetchBrowse = fromProp.length === 0 && !!userId;
  const { data: browseData, loading: loadingBrowse, error: browseError } = useQuery(
    BrowseBindersDocument,
    { variables: { userId, page: 1, pageSize }, skip: !shouldFetchBrowse, fetchPolicy: "cache-and-network", notifyOnNetworkStatusChange: true }
  );
  const fromBrowse = useMemo(() => normalizeBindersInput(browseData?.browseBinders ?? browseData ?? []), [browseData]);

  // 3) mine (fallback)
  const shouldFetchMine = fromProp.length === 0 && (!userId || (userId && fromBrowse.length === 0));
  const { data: myData, loading: loadingMine, error: myError } = useQuery(
    MY_BINDERS_SAFE,
    { skip: !shouldFetchMine, fetchPolicy: "cache-and-network", notifyOnNetworkStatusChange: true }
  );
  const fromMine = useMemo(() => normalizeBindersInput(myData?.myBinders ?? myData ?? []), [myData]);

  // 4) pick a list
  const display = (fromProp.length ? fromProp : fromBrowse.length ? fromBrowse : fromMine).slice(0, pageSize);

  // UX states
  const isLoading = loading || loadingBrowse || loadingMine;
  const showSkeleton = isLoading && fromProp.length === 0 && display.length === 0;
  const error = browseError || myError;

  /* -------- routing -------- */

  const openCreate = useCallback(() => router.push("/binder/new"), []);

  // New explicit contract: handler gets (id, ownerId)
  const openBinderDefault = useCallback((id, ownerId) => {
    if (!id) return;

    const iOwnThis =
      (typeof isOwner === "boolean" && isOwner) ||          // parent told us explicitly
      (!!meId && !!ownerId && meId === ownerId) ||          // row owner matches me
      (!userId);                                            // no profile id => my hub

    router.push(iOwnThis ? `/binder/${id}/edit` : `/binder/${id}`);
  }, [isOwner, meId, userId]);

  const handleOpenBinder = useCallback((id, ownerId) => {
    if (typeof onOpenBinder === "function") onOpenBinder(id, ownerId);
    else openBinderDefault(id, ownerId);
  }, [onOpenBinder, openBinderDefault]);

  /* -------- render -------- */

  if (display.length) {
    return (
      <>
        {!userId && (
          <View style={{ marginTop: 8 }}>
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

        {/* RecentBinders will call onOpenBinder(id, ownerId) */}
        <RecentBinders binders={display} onOpenBinder={handleOpenBinder} />
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
      {!userId ? (
        <>
          <Text style={[styles.bodyText, { marginBottom: 10 }]}>You don’t have any binders yet.</Text>
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  viewAll: { color: COLORS.accent, fontWeight: "800" },
  bodyText: { color: COLORS.text },
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
