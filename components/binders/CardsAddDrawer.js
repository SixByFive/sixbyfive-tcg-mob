// components/binders/CardsAddDrawer.js
//
// Self-fetches:
//  - Your collection (MyCollectionDocument) when `collection` prop is not provided
//  - Name-only search results (SearchCardsConnectionDocument) when tab === "search"
// Exposes normalized items where `item.id` is ALWAYS the card code (e.g. "sv05-052").
// This ensures we pass the correct `cardId` to the binder mutation even when coming from Search.

import { useLazyQuery, useQuery } from "@apollo/client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../theme/colors";

// GraphQL docs (generated)
import {
  MyCollectionDocument,
  SearchCardsConnectionDocument,
} from "@sixbyfive/tcg-binder/client";

// UI
import CardSelectableTile from "../card/CardSelectableTile";
import SelectBar from "../common/SelectBar";

const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 250;

/* ----------------------- helpers ----------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[a-z]{2,4}\d{1,4}-[0-9a-z]{2,6}$/i; // e.g. sv05-052, swsh9-123, etc.
function looksLikeCardCode(v) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return CODE_RE.test(s) && !UUID_RE.test(s);
}

function firstTruthy(arr) {
  for (let i = 0; i < arr.length; i += 1) {
    const v = arr[i];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

/** Extract a real card code from varied shapes (collection rows, plain cards, search nodes). */
function extractCardCode(obj) {
  if (!obj || typeof obj !== "object") return undefined;

  // Prefer explicit code fields; safe fallbacks ONLY if they look like codes (not UUIDs)
  const candidates = [
    obj.card && obj.card.code,
    obj.code,
    obj.cardCode,
    obj.cardId, // some backends return the code here
    obj.variant && obj.variant.code,
    (obj.variant && looksLikeCardCode(obj.variant.id)) ? obj.variant.id : undefined,
    // sometimes code is (wrongly) stuffed into card.id; allow ONLY if it matches code shape:
    (obj.card && looksLikeCardCode(obj.card.id)) ? obj.card.id : undefined,
    // 🔥 this is the important fallback for name-only search results:
    looksLikeCardCode(obj.id) ? obj.id : undefined,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (looksLikeCardCode(c)) return String(c).trim();
  }
  return undefined;
}

function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;

  if (Array.isArray(input.edges)) return input.edges.map((e) => (e && (e.node || e))).filter(Boolean);
  if (Array.isArray(input.nodes)) return input.nodes.filter(Boolean);
  if (Array.isArray(input.items)) return input.items.filter(Boolean);
  if (Array.isArray(input.results)) return input.results.filter(Boolean);
  if (Array.isArray(input.entries)) return input.entries.filter(Boolean);

  // try one nested layer
  const keys = Object.keys(input || {});
  for (let i = 0; i < keys.length; i += 1) {
    const v = input[keys[i]];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v && typeof v === "object") {
      if (Array.isArray(v.edges)) return v.edges.map((e) => (e && (e.node || e))).filter(Boolean);
      if (Array.isArray(v.nodes)) return v.nodes.filter(Boolean);
      if (Array.isArray(v.cards)) return v.cards.filter(Boolean);
    }
  }
  return [];
}

function normalizeCard(obj) {
  if (!obj) return null;

  // IMPORTANT: id must be the real card code that exists in `cards(id)`
  const code = extractCardCode(obj);
  if (!code) return null;

  const name =
    firstTruthy([obj.name, obj.card && obj.card.name, obj.title, obj.cardTitle]) || "";

  const image =
    firstTruthy([
      obj.image,
      obj.imageUrl,
      obj.card && obj.card.image,
      obj.images && obj.images.small,
      obj.images && obj.images.large,
      obj.thumbnail,
      obj.thumb,
      obj.variant && obj.variant.image,
    ]) || "";

  return { ...obj, id: code, name, image };
}

function normalizeCollection(data) {
  const root = (data && (data.myCollection || data.collection)) || data || [];
  return toArray(root).map(normalizeCard).filter(Boolean);
}

function normalizeSearch(data) {
  const root = (data && (data.searchCardsConnection || data.searchCards)) || data || [];
  return toArray(root).map(normalizeCard).filter(Boolean);
}

/* ------------------------------ component ------------------------------ */

export default function AddCardsDrawer({
  visible,
  onClose,
  destination,
  onChangeDestination,
  onConfirmAdd,

  // Optional overrides (kept for backward-compat)
  collection = undefined, // If undefined → will self-fetch MyCollection
  search = undefined, // If undefined → will self-fetch search results
  ownedSet = undefined, // If undefined → will derive from (self) collection
}) {
  const [tab, setTab] = useState("collection");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());

  const insets = useSafeAreaInsets();

  // ---- Anim + Gesture ----
  const translateY = useRef(new Animated.Value(0)).current;
  const THRESHOLD = 120;
  const SHEET_CLOSE_OFFSET = 800;
  const SELECTION_BAR_HEIGHT = 64;

  useEffect(() => {
    if (visible) {
      translateY.setValue(40);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
    } else {
      translateY.setValue(0);
    }
  }, [visible, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: function (_e, g) {
        return g.dy > 5 && Math.abs(g.dx) < 20;
      },
      onPanResponderMove: function (_e, g) {
        translateY.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: function (_e, g) {
        const dy = Math.max(0, g.dy);
        if (dy > THRESHOLD) {
          Animated.timing(translateY, { toValue: SHEET_CLOSE_OFFSET, duration: 180, useNativeDriver: false }).start(
            function () {
              translateY.setValue(0);
              handleCancel();
            }
          );
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: function () {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
      },
    })
  ).current;

  /* ------------------------------ data: collection ------------------------------ */

  const shouldFetchCollection = typeof collection === "undefined";
  const {
    data: myCollectionData,
    loading: myCollectionLoading,
    error: myCollectionError,
  } = useQuery(MyCollectionDocument, {
    skip: !visible || !shouldFetchCollection,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const myCollection = useMemo(() => {
    if (!shouldFetchCollection) return Array.isArray(collection) ? collection : [];
    return normalizeCollection(myCollectionData);
  }, [shouldFetchCollection, collection, myCollectionData]);

  // Owned set (for “Not owned” badge on Search tab) — uses codes
  const derivedOwnedSet = useMemo(() => {
    if (ownedSet instanceof Set) return ownedSet;
    return new Set(myCollection.map((c) => String(c.id)));
  }, [ownedSet, myCollection]);

  /* ------------------------------ data: search ------------------------------ */

  const shouldSelfSearch = typeof search === "undefined";
  const [
    runSearch,
    { data: searchData, loading: searchLoading, error: searchError, called, networkStatus },
  ] = useLazyQuery(SearchCardsConnectionDocument, {
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    onCompleted: (d) => {
      const n =
        (d?.searchCardsConnection?.edges?.length ??
          d?.searchCardsConnection?.nodes?.length ??
          d?.searchCards?.length ??
          0) || 0;
      console.log("[Search] completed, count:", n);
    },
    onError: (e) => {
      console.warn(
        "[Search] error:",
        e?.message,
        e?.graphQLErrors?.map((x) => x.message),
        e?.networkError?.message
      );
    },
  });

  // Debounce search
  const lastFiredRef = useRef("");
  useEffect(() => {
    if (!visible || !shouldSelfSearch) return;
    if (tab !== "search") return;

    const q = (query || "").trim();
    if (q.length < SEARCH_MIN_CHARS) return;

    const t = setTimeout(function () {
      // Avoid re-firing the same string repeatedly
      if (lastFiredRef.current === q) return;
      lastFiredRef.current = q;

      const vars = { input: { name: q, first: 50, budget: 8, trustUpstream: true } };
      console.log("[Search] run", vars);
      runSearch({ variables: vars });
    }, SEARCH_DEBOUNCE_MS);

    return function cleanup() {
      clearTimeout(t);
    };
  }, [visible, tab, query, shouldSelfSearch, runSearch]);

  // Derived results + “searching” flag that won’t stick forever
  const searchResults = useMemo(() => {
    if (!shouldSelfSearch) return Array.isArray(search) ? search : [];
    if ((query || "").trim().length < SEARCH_MIN_CHARS) return [];
    return normalizeSearch(searchData);
  }, [shouldSelfSearch, search, searchData, query]);

  // Apollo’s `loading` can be true for several networkStatus values.
  // Only show the spinner when we actually fired a query for this tab+query.
  const searching =
    tab === "search" &&
    (searchLoading || (called && !searchError && !searchData && (query || "").trim().length >= SEARCH_MIN_CHARS));

  /* ------------------------------ selection & list ------------------------------ */

  const list = useMemo(() => {
    return tab === "collection" ? myCollection : searchResults;
  }, [tab, myCollection, searchResults]);

  const toggle = (id) => {
    const key = String(id);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const clear = () => setSelected(new Set());
  const handleCancel = () => {
    clear();
    if (onClose) onClose();
  };

  const confirm = () => {
    if (selected.size && onConfirmAdd) {
      // IMPORTANT: we pass card codes here — exactly what the binder expects.
      onConfirmAdd(Array.from(selected), { source: tab });
      console.log("[Drawer] selected ids (should be codes):", Array.from(selected));
    }
    clear();
    if (onClose) onClose();
  };

  const isLoading = tab === "collection" ? myCollectionLoading : searching;
  const showEmpty = !isLoading && list.length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 0),
              transform: [{ translateY }],
            },
          ]}
        >
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            {/* Grabber with gesture only here (avoids FlatList conflicts) */}
            <View style={styles.grabberHit} {...panResponder.panHandlers}>
              <View style={styles.grabber} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={onChangeDestination} hitSlop={8} style={styles.destBtn}>
                <Text style={styles.destText} numberOfLines={1}>
                  Add to{" "}
                  {destination && destination.pageLabel
                    ? destination.pageLabel
                    : "Page " + (((destination && destination.pageIndex) || 0) + 1)}
                  {typeof (destination && destination.slotsLeft) === "number"
                    ? " • " + destination.slotsLeft + " slots left"
                    : ""}
                </Text>
              </Pressable>

              <View style={styles.tabs}>
                <TabBtn label="Collection" active={tab === "collection"} onPress={() => setTab("collection")} />
                <TabBtn label="Search" active={tab === "search"} onPress={() => setTab("search")} />
              </View>

              {tab === "search" ? (
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={"Search cards… (min " + SEARCH_MIN_CHARS + ")"}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              ) : null}
            </View>

            {/* Content */}
            <FlatList
              data={list}
              keyExtractor={(c) => String(c.id)}
              numColumns={2}
              contentContainerStyle={{
                paddingHorizontal: 12,
                paddingBottom: SELECTION_BAR_HEIGHT + insets.bottom + 12,
              }}
              columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 10 }}
              renderItem={({ item }) => {
                const id = String(item.id); // card code
                const isSelected = selected.has(id);
                const notOwned = tab === "search" ? !derivedOwnedSet.has(id) : false;
                return (
                  <CardSelectableTile
                    card={item}
                    selected={isSelected}
                    notOwned={notOwned}
                    onPress={() => toggle(id)}
                    onLongPress={() => toggle(id)}
                  />
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.empty}>
                  {tab === "search" ? (
                    (query || "").trim().length < SEARCH_MIN_CHARS ? (
                      <Text style={styles.emptyText}>{"Type at least " + SEARCH_MIN_CHARS + " characters to search."}</Text>
                    ) : searching ? (
                      <>
                        <ActivityIndicator color={COLORS.accent} />
                        <Text style={[styles.emptyText, { marginTop: 8 }]}>
                          Searching… {called ? "(networkStatus " + networkStatus + ")" : ""}
                        </Text>
                      </>
                    ) : searchError ? (
                      <Text style={styles.emptyText}>Search failed. Please try again.</Text>
                    ) : (
                      <Text style={styles.emptyText}>No results.</Text>
                    )
                  ) : myCollectionError ? (
                    <Text style={styles.emptyText}>Failed to load your collection.</Text>
                  ) : (
                    <Text style={styles.emptyText}>No cards in your collection.</Text>
                  )}
                </View>
              )}
              keyboardShouldPersistTaps="handled"
            />

            {/* Selection bar */}
            <SelectBar
              count={selected.size}
              onAdd={confirm}
              onClear={clear}
              onCancel={handleCancel}
              bottomInset={insets.bottom}
              styleOverride={styles.selectBarOverride}
              fullBleed
            />
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function TabBtn({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const SHEET_HEIGHT = "78%";

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: COLORS.border,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    height: SHEET_HEIGHT,
    overflow: "hidden",
  },

  grabberHit: { paddingTop: 8, paddingBottom: 8, alignItems: "center" },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.border },

  header: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 },
  destBtn: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  destText: { color: COLORS.text, fontWeight: "800" },

  tabs: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.accent },
  tabText: { color: COLORS.text, fontWeight: "800" },
  tabTextActive: { color: "#fff" },

  searchInput: {
    marginTop: 8,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
  },

  empty: { alignItems: "center", paddingVertical: 16 },
  emptyText: { color: COLORS.textMuted },

  // thin top border to visually anchor the bar to the sheet
  selectBarOverride: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
});
