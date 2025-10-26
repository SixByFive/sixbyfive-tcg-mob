// components/binders/CardsAddDrawer.js
//
// CHANGES
// - Collection fetch now uses the same inline query as app/(tabs)/collection.js (MY_COLLECTION_APP).
// - Normalizes collection entries so item.id is ALWAYS the card code (e.g. "sv05-052").
// - Images now use TCGdex→PokemonTCG fallbacks derived from the code.
// - Search GQL resolution is robust (temp -> codegen -> inline fallback), so we never pass undefined.
// - Layout spacing matches collection grid (gap and padding tweaks).

import { gql, useLazyQuery, useQuery } from "@apollo/client";
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

import CardSelectableTile from "../card/CardSelectableTile";
import SelectBar from "../common/SelectBar";

const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 250;

/* ----------------------- helpers ----------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[a-z]{2,4}\d{1,4}-[0-9a-z]{2,6}$/i; // e.g. sv05-052, swsh9-123
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
function extractCardCode(obj) {
  if (!obj || typeof obj !== "object") return undefined;
  const candidates = [
    obj.card && obj.card.id,
    obj.card && obj.card.code,
    obj.code,
    obj.cardCode,
    obj.cardId, // some backends return the code here
    obj.variant && obj.variant.code,
    (obj.variant && looksLikeCardCode(obj.variant.id)) ? obj.variant.id : undefined,
    (obj.card && looksLikeCardCode(obj.card.id)) ? obj.card.id : undefined,
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

/* ---------- image helpers (TCGdex → PokemonTCG fallbacks built from code) ---------- */
function forceHttps(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/^http:\/\//i, "https://");
}
function isAbs(url) {
  return /^https?:\/\//i.test(url || "");
}
function parseCardCodeId(code) {
  if (typeof code !== "string") return { setCode: null, number: null };
  const [setCodeRaw, ...rest] = code.split("-");
  const setCode = (setCodeRaw || "").trim();
  const number = rest.join("-").trim() || null;
  return { setCode: setCode || null, number };
}
function inferEraFromSetCode(code) {
  const c = (code || "").toLowerCase().replace(/\s+/g, "");
  const m = c.match(/^[a-z]+/);
  return m ? m[0] : null; // "sv" from "sv05"
}
function tcgdexFromParts(setCode, number, era = null, quality = "high") {
  if (!setCode || !number) return null;
  const eraSlug = (era || inferEraFromSetCode(setCode) || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const numPadded = String(number).replace(/^0+/, "").padStart(3, "0");
  if (!eraSlug) return null;
  return `https://assets.tcgdex.net/en/${eraSlug}/${setCode}/${numPadded}/${quality}.webp`;
}
function pokemontcgFromParts(setCode, number, hires = true) {
  if (!setCode || !number) return null;
  const n = String(number).replace(/^0+/, "");
  const suffix = hires ? "_hires" : "";
  return `https://images.pokemontcg.io/${setCode}/${n}${suffix}.png`;
}
function buildImageCandidatesFromCode(code, explicitImage) {
  const out = [];
  if (explicitImage && isAbs(explicitImage)) out.push(forceHttps(explicitImage));

  const { setCode, number } = parseCardCodeId(code);
  if (setCode && number) {
    const era = inferEraFromSetCode(setCode);
    const dHigh = tcgdexFromParts(setCode, number, era, "high");
    const dLow  = tcgdexFromParts(setCode, number, era, "low");
    if (dHigh) out.push(dHigh);
    if (dLow)  out.push(dLow);

    const pHires = pokemontcgFromParts(setCode, number, true);
    const pStd   = pokemontcgFromParts(setCode, number, false);
    if (pHires) out.push(pHires);
    if (pStd)   out.push(pStd);
  }

  const seen = new Set();
  const list = out
    .map(forceHttps)
    .filter(Boolean)
    .filter((u) => {
      const k = String(u || "");
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  const tcgdexFirst =
    list.find((u) => u.includes("assets.tcgdex.net")) || list[0] || "";
  return [tcgdexFirst, ...list.filter((u) => u !== tcgdexFirst)];
}

/* Normalize a generic card-ish object into { id: <code>, name, image } */
function normalizeCard(obj) {
  if (!obj) return null;
  const code = extractCardCode(obj);
  if (!code) return null;

  const name =
    firstTruthy([obj.name, obj.card && obj.card.name, obj.title, obj.cardTitle]) || "";

  const rawImage =
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

  const candidates = buildImageCandidatesFromCode(code, rawImage);
  const image = candidates[0] || rawImage || "";

  return { ...obj, id: code, name, image };
}

/* ----------------------- GraphQL: COLLECTION (inline, same as collection.js) ----------------------- */

const MY_COLLECTION_APP = gql`
  query MyCollectionApp {
    myCollection {
      id
      cardId
      quantity
      variation
      condition
      wishlist
      card {
        id
        name
        number
        image
        rarity
        setName
      }
    }
  }
`;

/* ----------------------- GraphQL: SEARCH robust resolution ----------------------- */

// Inline fallback for search (connection)
const FALLBACK_SEARCH_CONNECTION = gql`
  query SearchCardsConnection_Safe($input: SearchCardsInput!) {
    searchCardsConnection(input: $input) {
      edges {
        node {
          id
          name
          image
        }
      }
    }
  }
`;

function resolveDoc(preferredKeys, fallbackDoc) {
  try {
    const temp = require("../../graphql/binders-temp");
    for (const k of preferredKeys) {
      const d = temp?.[k];
      if (d && typeof d === "object" && d.kind === "Document") return d;
    }
  } catch (_) {}
  try {
    const client = require("@sixbyfive/tcg-binder/client");
    for (const k of preferredKeys) {
      const d = client?.[k];
      if (d && typeof d === "object" && d.kind === "Document") return d;
    }
  } catch (_) {}
  return fallbackDoc || null;
}

const SEARCH_CONNECTION_DOC = resolveDoc(
  [
    "SEARCH_CARDS_CONNECTION_SAFE",
    "SearchCardsConnectionDocument",
    "SearchCardsDocument",
    "CardsSearchDocument",
  ],
  FALLBACK_SEARCH_CONNECTION
);

const HAS_SEARCH_GQL = !!(SEARCH_CONNECTION_DOC && SEARCH_CONNECTION_DOC.kind === "Document");

function normalizeSearch(data) {
  const root =
    (data && (data.searchCardsConnection || data.searchCards || data.cardsSearch)) ||
    data ||
    [];
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
  collection = undefined, // If undefined → will self-fetch via MY_COLLECTION_APP
  search = undefined,     // If undefined → self-search (if SEARCH_CONNECTION_DOC exists)
  ownedSet = undefined,   // If undefined → derive from fetched collection
}) {
  const [tab, setTab] = useState("collection");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [manual, setManual] = useState(""); // manual code input if search gql missing

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
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 5 && Math.abs(g.dx) < 20,
      onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        const dy = Math.max(0, g.dy);
        if (dy > THRESHOLD) {
          Animated.timing(translateY, { toValue: SHEET_CLOSE_OFFSET, duration: 180, useNativeDriver: false }).start(
            () => {
              translateY.setValue(0);
              handleCancel();
            }
          );
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start(),
    })
  ).current;

  /* ------------------------------ data: collection (inline query same as collection.js) ------------------------------ */

  const shouldFetchCollection = typeof collection === "undefined";
  const {
    data: collData,
    loading: collLoading,
    error: collError,
  } = useQuery(MY_COLLECTION_APP, {
    skip: !visible || !shouldFetchCollection,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const myCollection = useMemo(() => {
    if (!shouldFetchCollection) return Array.isArray(collection) ? collection : [];
    const root = collData?.myCollection;
    const rows = Array.isArray(root) ? root : toArray(root);
    // Normalize: output items with id=card code + robust image derived from code
    return rows
      .map((entry) => {
        const code = extractCardCode({ id: entry?.card?.id ?? entry?.cardId });
        if (!code) return null;
        const name = entry?.card?.name ?? "";
        const rawImage = entry?.card?.image ?? "";
        const candidates = buildImageCandidatesFromCode(code, rawImage);
        const image = candidates[0] || rawImage || "";
        return { id: code, name, image, _collection: entry };
      })
      .filter(Boolean);
  }, [shouldFetchCollection, collection, collData]);

  // Owned set for "Not owned" pills on Search tab (uses codes)
  const derivedOwnedSet = useMemo(() => {
    if (ownedSet instanceof Set) return ownedSet;
    return new Set(myCollection.map((c) => String(c.id)));
  }, [ownedSet, myCollection]);

  /* ------------------------------ data: search ------------------------------ */

  const shouldSelfSearch = typeof search === "undefined" && HAS_SEARCH_GQL;
  const [
    runSearch,
    { data: searchData, loading: searchLoading, error: searchError, called, networkStatus },
  ] = useLazyQuery(SEARCH_CONNECTION_DOC, {
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const lastFiredRef = useRef("");
  useEffect(() => {
    if (!visible || !shouldSelfSearch) return;
    if (tab !== "search") return;
    const q = (query || "").trim();
    if (q.length < SEARCH_MIN_CHARS) return;

    const t = setTimeout(() => {
      if (lastFiredRef.current === q) return;
      lastFiredRef.current = q;
      const variables = { input: { name: q, first: 50, budget: 8, trustUpstream: true } };
      runSearch({ variables });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [visible, tab, query, shouldSelfSearch, runSearch]);

  const searchResults = useMemo(() => {
    if (typeof search !== "undefined") return Array.isArray(search) ? search : [];
    if (!HAS_SEARCH_GQL) return [];
    if ((query || "").trim().length < SEARCH_MIN_CHARS) return [];
    return normalizeSearch(searchData);
  }, [search, searchData, query]);

  const searching =
    tab === "search" &&
    HAS_SEARCH_GQL &&
    (searchLoading || (called && !searchError && !searchData && (query || "").trim().length >= SEARCH_MIN_CHARS));

  /* ------------------------------ selection & list ------------------------------ */

  const manualIds = useMemo(() => {
    if (!manual) return [];
    return manual
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(looksLikeCardCode);
  }, [manual]);

  const manualResultItems = useMemo(
    () => manualIds.map((id) => {
      const candidates = buildImageCandidatesFromCode(id, "");
      const image = candidates[0] || "";
      return { id, name: id, image };
    }),
    [manualIds]
  );

  const list = useMemo(() => {
    if (tab === "collection") return myCollection;
    if (HAS_SEARCH_GQL) return searchResults;
    return manualResultItems; // manual fallback
  }, [tab, myCollection, searchResults, manualResultItems]);

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
      onConfirmAdd(Array.from(selected), { source: tab });
    }
    clear();
    if (onClose) onClose();
  };

  const isLoading = tab === "collection" ? collLoading : searching;
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
                HAS_SEARCH_GQL ? (
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={"Search cards… (min " + SEARCH_MIN_CHARS + ")"}
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.searchInput}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                ) : (
                  <TextInput
                    value={manual}
                    onChangeText={setManual}
                    placeholder={"Search offline: paste codes (e.g. sv05-052, sv05-100)"}
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.searchInput}
                    autoCorrect={false}
                    autoCapitalize="none"
                    multiline
                  />
                )
              ) : null}
            </View>

            {/* Content */}
            {isLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={[styles.emptyText, { marginTop: 8 }]}>Loading…</Text>
              </View>
            ) : showEmpty ? (
              <View style={styles.empty}>
                {tab === "search" ? (
                  HAS_SEARCH_GQL ? (
                    (query || "").trim().length < SEARCH_MIN_CHARS ? (
                      <Text style={styles.emptyText}>
                        {"Type at least " + SEARCH_MIN_CHARS + " characters to search."}
                      </Text>
                    ) : (
                      <Text style={styles.emptyText}>No results.</Text>
                    )
                  ) : manualIds.length === 0 ? (
                    <Text style={styles.emptyText}>
                      Paste one or more codes (e.g. sv05-052) separated by spaces or commas.
                    </Text>
                  ) : (
                    <Text style={styles.emptyText}>No valid codes detected.</Text>
                  )
                ) : collError ? (
                  <Text style={styles.emptyText}>Failed to load your collection.</Text>
                ) : (
                  <Text style={styles.emptyText}>No cards in your collection.</Text>
                )}
              </View>
            ) : (
              <FlatList
                data={list}
                keyExtractor={(c) => String(c.id)}
                numColumns={2}
                contentContainerStyle={{
                  paddingHorizontal: 6, // match collection grid
                  paddingBottom: SELECTION_BAR_HEIGHT + insets.bottom + 12,
                }}
                columnWrapperStyle={styles.column} // match collection grid gap
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
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={<View style={{ height: 8 }} />}
              />
            )}

            {/* Selection bar */}
            <SelectBar
              count={selected.size}
              onAdd={confirm}
              onClear={() => {
                setSelected(new Set());
                setManual("");
              }}
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

  // match collection grid spacing
  column: { gap: 4 },

  empty: { alignItems: "center", paddingVertical: 16, paddingHorizontal: 12 },
  emptyText: { color: COLORS.textMuted, textAlign: "center" },

  // thin top border to visually anchor the bar to the sheet
  selectBarOverride: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
});
