// app/sets/[code].js

import { useApolloClient, useQuery } from "@apollo/client"; // CHANGED: import client
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { parse } from "graphql";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import CardImage from "../../components/common/CardImage";
import SetPageHeader from "../../components/sets/SetPageHeader";
import useSetOwned from "../../hooks/useSetOwned";
import { COLORS } from "../../theme/colors";
import inferSetEra from "../../utils/setEra.native";

/* ---------------- GraphQL (via parse → DocumentNode) ---------------- */

const CARDSEARCH_SET = parse(`
  query CardsearchSetMobile($code: String!) {
    cardsearchSetByCode(code: $code) {
      code
      name
      abbr
      series
      total
    }
  }
`);

const CARDSEARCH_SET_CARDS = parse(`
  query CardsearchSetCardsMobile($input: CardSearchInput!) {
    cardsearchSearchCards(input: $input) {
      total
      offset
      limit
      items {
        cardId
        number
        name
        rarity
        images { small large }
      }
    }
  }
`);

// Minimal list so we can recover a missing `abbr` for the current code
const CARDSEARCH_SETS_MIN = parse(`
  query CardsearchSetsMinMobile($limit: Int!, $offset: Int!) {
    cardsearchSets(limit: $limit, offset: $offset) {
      code
      abbr
    }
  }
`);

/* ---------------- Utils ---------------- */

function parseIntSafe(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function safeIdFromItem(it, setCode) {
  if (it?.cardId) return String(it.cardId).toLowerCase();
  if (it?.number) return `${String(setCode).toLowerCase()}-${String(it.number)}`.toLowerCase();
  return `tmp-${Math.random().toString(36).slice(2)}`.toLowerCase();
}

/* ---------------- Card Tile ---------------- */

function CardTile({ card, owned }) {
  return (
    <View style={styles.cardTile} accessible>
      <View style={styles.imageWrap}>
        <CardImage uri={card?.imageUrl} name={card?.name} cardId={card?.id} style={styles.cardImage} />
        {owned && (
          <View style={styles.ownedPill}>
            <Text style={styles.ownedPillText}>Owned</Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={styles.cardName} numberOfLines={1}>
            {card.name}
          </Text>
          <Text style={styles.cardNum}>#{card.number}</Text>
        </View>
        <Text style={styles.cardRarity} numberOfLines={1}>
          {card.rarity || "—"}
        </Text>
      </View>
    </View>
  );
}

/* ---------------- Screen ---------------- */

export default function SetScreen() {
  const apollo = useApolloClient(); // NEW
  const { code } = useLocalSearchParams();
  const setCode = String(code || "").trim();

  // Base set metadata
  const { data: setData, loading: loadingSet, error: setError } = useQuery(CARDSEARCH_SET, {
    variables: { code: setCode },
    skip: !setCode,
  });

  // PAGINATION STATE
  const PAGE_SIZE = 96;
  const [cards, setCards] = useState([]); // unified list across pages (for grid)
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // **ALL IDS** state (for accurate completion)
  const [allIds, setAllIds] = useState(() => new Set()); // NEW
  const idsPreloadingRef = useRef(false); // NEW
  const unmountedRef = useRef(false); // NEW

  // First page
  const {
    data: cardsData,
  // loading: loadingCards,   // we’ll derive loading state by data presence
    error: cardsError,
    refetch: refetchCards,
    networkStatus,
  } = useQuery(CARDSEARCH_SET_CARDS, {
    variables: { input: { set: setCode, limit: PAGE_SIZE, offset: 0 } },
    skip: !setCode,
    notifyOnNetworkStatusChange: true,
  });

  // Fallback source for abbr if the single-set query doesn't provide it
  const { data: setsMinData } = useQuery(CARDSEARCH_SETS_MIN, {
    variables: { limit: 500, offset: 0 },
    skip: !setCode,
    fetchPolicy: "cache-first",
  });

  // Seed from first page response
  useEffect(() => {
    const page = cardsData?.cardsearchSearchCards;
    if (!page) return;
    const items = Array.isArray(page.items) ? page.items : [];
    const mapped = items.map((it) => ({
      id: safeIdFromItem(it, setCode),
      number: it.number || "",
      name: it.name || "",
      rarity: it.rarity || null,
      imageUrl: it.images?.large || it.images?.small || null,
    }));
    setCards(mapped);
    setOffset(page.offset ?? 0);
    // CHANGED: prefer set metadata total if present; otherwise fall back to page total
    const metaTotal = parseIntSafe(setData?.cardsearchSetByCode?.total);
    setTotal(metaTotal > 0 ? metaTotal : page.total ?? mapped.length);

    // Seed allIds with first page ids
    setAllIds((prev) => {
      const next = new Set(prev);
      for (const it of items) next.add(safeIdFromItem(it, setCode));
      return next;
    });
  }, [cardsData, setCode, setData?.cardsearchSetByCode?.total]);

  // Load more (pagination for grid only)
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    if (cards.length >= total) return;
    setLoadingMore(true);
    try {
      const nextOffset = offset + PAGE_SIZE;
      const { data } = await refetchCards({ input: { set: setCode, limit: PAGE_SIZE, offset: nextOffset } });
      const page = data?.cardsearchSearchCards;
      const items = Array.isArray(page?.items) ? page.items : [];
      const mapped = items.map((it) => ({
        id: safeIdFromItem(it, setCode),
        number: it.number || "",
        name: it.name || "",
        rarity: it.rarity || null,
        imageUrl: it.images?.large || it.images?.small || null,
      }));
      // dedupe by id
      const seen = new Set(cards.map((c) => c.id));
      const merged = [...cards];
      for (const c of mapped) {
        if (!seen.has(c.id)) {
          merged.push(c);
          seen.add(c.id);
        }
      }
      setCards(merged);
      setOffset(page?.offset ?? nextOffset);
      setTotal((t) => {
        const metaTotal = parseIntSafe(setData?.cardsearchSetByCode?.total);
        return metaTotal > 0 ? metaTotal : (page?.total ?? merged.length);
      });

      // also add to allIds
      setAllIds((prev) => {
        const nxt = new Set(prev);
        for (const it of items) nxt.add(safeIdFromItem(it, setCode));
        return nxt;
      });
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [cards, total, loadingMore, offset, refetchCards, setCode, setData?.cardsearchSetByCode?.total]);

  // NEW: Preload *ids only* for the rest of the pages to compute completion accurately.
  useEffect(() => {
    if (!setCode) return;
    const metaTotal = parseIntSafe(setData?.cardsearchSetByCode?.total);
    const expectedTotal = metaTotal > 0 ? metaTotal : total;
    if (!expectedTotal) return;

    // already have all ids
    if (allIds.size >= expectedTotal) return;
    if (idsPreloadingRef.current) return;
    idsPreloadingRef.current = true;

    (async () => {
      try {
        // Page through remaining offsets, but only record ids; use network-only to avoid mixing
        const startOffset = PAGE_SIZE; // first page (0) already in state
        for (let off = startOffset; off < expectedTotal; off += PAGE_SIZE) {
          if (unmountedRef.current) return;
          const { data } = await apollo.query({
            query: CARDSEARCH_SET_CARDS,
            variables: { input: { set: setCode, limit: PAGE_SIZE, offset: off } },
            fetchPolicy: "network-only",
          });
          const page = data?.cardsearchSearchCards;
          const items = Array.isArray(page?.items) ? page.items : [];
          if (!items.length) break;

          setAllIds((prev) => {
            const next = new Set(prev);
            for (const it of items) next.add(safeIdFromItem(it, setCode));
            return next;
          });

          // Update total in case backend supplies it later
          if (page?.total && !total) setTotal(page.total);
          if (allIds.size + items.length >= expectedTotal) break;
        }
      } catch {
        // ignore; completion will still work with partial preloads
      } finally {
        idsPreloadingRef.current = false;
      }
    })();
  }, [apollo, setCode, setData?.cardsearchSetByCode?.total, total, allIds.size]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const set = useMemo(() => {
    const s = setData?.cardsearchSetByCode;
    if (!s) return null;

    // Prefer abbr from the detail query, fallback to list lookup
    let abbr = s.abbr ?? null;
    if (!abbr && Array.isArray(setsMinData?.cardsearchSets)) {
      const hit = setsMinData.cardsearchSets.find(
        (x) => String(x?.code || "").toLowerCase() === String(setCode).toLowerCase()
      );
      if (hit?.abbr) abbr = hit.abbr;
    }

    // CHANGED: totalCards comes from metadata total (best) then page total (fallback)
    const metaTotal = parseIntSafe(s.total);
    const pageTotal = total || cards.length;

    return {
      code: String(setCode).toLowerCase(),
      name: s.name || String(setCode).toUpperCase(),
      abbr,
      series: s.series ?? null,
      era: inferSetEra(s),
      totalCards: metaTotal > 0 ? metaTotal : pageTotal,
      cards, // grid uses paginated state
    };
  }, [setData, setsMinData, setCode, cards, total]);

  // Search / sort / rarity filters
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("number-asc");
  const [selectedRarities, setSelectedRarities] = useState(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Hide filters on scroll down; show on scroll up/top — flicker-free via hysteresis + rAF
  const [showFilters, setShowFilters] = useState(true);
  const lastY = useRef(0);
  const lastDecisionY = useRef(0); // where we last toggled state
  const rafRef = useRef(null);
  const HIDE_AFTER = 72;
  const SHOW_DELTA = 24;
  const HIDE_DELTA = 48;

  const handleScroll = useCallback(
    (e) => {
      const yNow = e.nativeEvent.contentOffset?.y ?? 0;
      const yPrev = lastY.current;
      const dy = yNow - yPrev;
      lastY.current = yNow;

      // throttle updates with rAF to avoid rapid toggles on slow/jerky scroll
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        // always show when near the very top
        if (yNow < 24) {
          if (!showFilters) {
            setShowFilters(true);
            lastDecisionY.current = yNow;
          }
          return;
        }

        // if visible → hide only after moving far enough down and past HIDE_AFTER
        if (showFilters && dy > 0 && yNow > HIDE_AFTER && yNow - lastDecisionY.current > HIDE_DELTA) {
          setShowFilters(false);
          lastDecisionY.current = yNow;
          return;
        }

        // if hidden → show only after moving far enough up
        if (!showFilters && dy < 0 && lastDecisionY.current - yNow > SHOW_DELTA) {
          setShowFilters(true);
          lastDecisionY.current = yNow;
        }
      });
    },
    [showFilters]
  );

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // ---------- Completion (ACCURATE) ----------
  // Build a lightweight, ids-only "virtual set" just for useSetOwned so it can
  // compute completedCount across the *full set*, even before the grid has paged in.
  const setForCompletion = useMemo(() => {
    if (!set) return undefined;
    const idsArray = allIds.size
      ? Array.from(allIds).map((id) => ({ id: String(id).toLowerCase() }))
      : set.cards.map((c) => ({ id: String(c.id).toLowerCase() }));
    return {
      ...set,
      cards: idsArray,
      totalCards: set.totalCards, // ensure useSetOwned has the right denominator
    };
  }, [set, allIds]);

  const { ownedSet, completedCount } = useSetOwned(setForCompletion);

  const rarityOptions = useMemo(() => {
    if (!set?.cards?.length) return [];
    const getNum = (c) => {
      const m = String(c?.number ?? "").match(/\d+/);
      return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
    };
    const sorted = [...set.cards].sort((a, b) => getNum(a) - getNum(b));
    const seen = new Set();
    const ordered = [];
    for (const c of sorted) {
      const r = (c?.rarity || "").trim();
      if (r && !seen.has(r)) {
        seen.add(r);
        ordered.push(r);
      }
    }
    return ordered;
  }, [set?.cards]);

  const toggleRarity = useCallback((r) => {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }, []);
  const clearRarities = useCallback(() => setSelectedRarities(new Set()), []);

  const filtered = useMemo(() => {
    if (!set?.cards) return [];
    const q = query.trim().toLowerCase();
    let list = set.cards.slice();

    if (q) {
      list = list.filter((c) => {
        const name = (c.name || "").toLowerCase();
        const num = String(c.number || "").toLowerCase();
        const rarity = (c.rarity || "").toLowerCase();
        return name.includes(q) || num.includes(q) || rarity.includes(q);
      });
    }
    if (selectedRarities.size > 0) {
      list = list.filter((c) => selectedRarities.has(c.rarity || ""));
    }

    list.sort((a, b) => {
      const aId = a.id || `${a.number}-${a.name}`;
      const bId = b.id || `${b.number}-${b.name}`;
      const aOwned = ownedSet.has(aId);
      const bOwned = ownedSet.has(bId);
      switch (sort) {
        case "owned-first":
          if (aOwned !== bOwned) return aOwned ? -1 : 1;
          return parseIntSafe(a.number) - parseIntSafe(b.number);
        case "number-asc":
          return parseIntSafe(a.number) - parseIntSafe(b.number);
        case "number-desc":
          return parseIntSafe(b.number) - parseIntSafe(a.number);
        case "name-asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name-desc":
          return (b.name || "").localeCompare(a.name || "");
        case "rarity-asc":
          return (a.rarity || "").localeCompare(b.rarity || "");
        case "rarity-desc":
          return (b.rarity || "").localeCompare(a.rarity || "");
        default:
          return 0;
      }
    });

    return list;
  }, [set?.cards, query, selectedRarities, sort, ownedSet]);

  const isInitialLoading =
    loadingSet || (!cards.length && (networkStatus === 1 || networkStatus === 2)); // 1=loading, 2=setVariables

  /* ---------- Loading / Error ---------- */
  if (isInitialLoading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator />
        <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>Loading set…</Text>
      </View>
    );
  }
  if (setError) {
    return (
      <View style={[styles.screen, { padding: 12 }]}>
        <View style={[styles.card, { borderColor: "#b24848", backgroundColor: "#2a1d1d" }]}>
          <Text style={[styles.h2, { color: "#ffb0b0" }]}>Unable to load set</Text>
          <Text style={{ color: COLORS.textMuted, marginTop: 6 }}>{String(setError.message)}</Text>
        </View>
      </View>
    );
  }
  if (cardsError) {
    return (
      <View style={[styles.screen, { padding: 12 }]}>
        <View style={[styles.card, { borderColor: "#b24848", backgroundColor: "#2a1d1d" }]}>
          <Text style={[styles.h2, { color: "#ffb0b0" }]}>Unable to load cards</Text>
          <Text style={{ color: COLORS.textMuted, marginTop: 6 }}>{String(cardsError.message)}</Text>
        </View>
      </View>
    );
  }

  if (!set) {
    return (
      <View style={styles.screen}>
        <Text style={{ color: COLORS.text }}>Set not found.</Text>
      </View>
    );
  }

  const headerEl = (
    <SetPageHeader
      name={set.name}
      code={set.code}
      abbr={set.abbr}
      completed={completedCount}                         // CHANGED: completed across ALL ids
      total={set.totalCards ?? (allIds.size || set.cards.length)} // CHANGED: true set total
    />
  );

  /* ---------- UI ---------- */
  return (
    <View style={styles.screen}>
      {headerEl}

      {/* FILTERS (collapsible) */}
      {showFilters && (
        <View style={styles.card}>
          {/* Search input */}
          <View style={[styles.inputRow, { marginTop: 2 }]}>
            <Ionicons name="search" size={16} color={COLORS.textMuted} />
            <TextInput
              placeholder="Search cards by name, number, or rarity…"
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={setQuery}
              style={styles.input}
            />
            {!!query && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Compact horizontal chip bar + 'More' modal trigger */}
          <View style={styles.compactBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsBarContent}
            >
              <Chip
                label="All rarities"
                active={selectedRarities.size === 0}
                onPress={clearRarities}
                compact
              />
              {rarityOptions.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  active={selectedRarities.has(r)}
                  onPress={() => toggleRarity(r)}
                  compact
                />
              ))}
            </ScrollView>

            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="More filters"
              hitSlop={6}
            >
              <Ionicons name="filter" size={14} color={COLORS.accent} />
              <Text style={styles.moreBtnText}>More</Text>
            </Pressable>
          </View>

          {/* Sort buttons */}
          <View style={[styles.sortRow, { marginTop: 6 }]}>
            <SortButton label="No." active={sort === "number-asc"} onPress={() => setSort("number-asc")} />
            <SortButton label="No.↓" active={sort === "number-desc"} onPress={() => setSort("number-desc")} />
            <SortButton label="Owned" active={sort === "owned-first"} onPress={() => setSort("owned-first")} />
          </View>

          <Text style={styles.count}>
            {/* CHANGED: always show full set total on the right */}
            Showing <Text style={styles.countStrong}>{filtered.length}</Text> of{" "}
            <Text style={styles.countStrong}>{set.totalCards ?? (allIds.size || set.cards.length)}</Text> cards
          </Text>
        </View>
      )}

      {/* Grid */}
      <FlatList
        data={filtered}
        keyExtractor={(c) => String(c.id).toLowerCase()} // CHANGED: stable key
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 28 }}
        renderItem={({ item }) => {
          const owned = ownedSet.has(String(item.id).toLowerCase());
          return <CardTile card={item} owned={owned} />;
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScroll}
        onEndReachedThreshold={0.2}
        onEndReached={loadMore} // keeps loading visual tiles
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />

      {/* Filters modal (multi-select rarities + sort) */}
      <Modal
        animationType="fade"
        transparent
        visible={pickerOpen}
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </Pressable>
            </View>

            {/* Rarity multi-select */}
            <Text style={[styles.modalSub, { marginBottom: 6 }]}>Rarities</Text>
            <Pressable style={styles.checkRow} onPress={clearRarities}>
              <Checkbox checked={selectedRarities.size === 0} />
              <Text style={styles.radioLabel}>All rarities</Text>
            </Pressable>
            {rarityOptions.map((r) => {
              const checked = selectedRarities.has(r);
              return (
                <Pressable key={r} style={styles.checkRow} onPress={() => toggleRarity(r)}>
                  <Checkbox checked={checked} />
                  <Text style={styles.radioLabel}>{r}</Text>
                </Pressable>
              );
            })}

            {/* Sort selection */}
            <Text style={[styles.modalSub, { marginTop: 10 }]}>Sort</Text>
            {[
              ["number-asc", "Card number (asc)"],
              ["number-desc", "Card number (desc)"],
              ["name-asc", "Name (A→Z)"],
              ["name-desc", "Name (Z→A)"],
              ["rarity-asc", "Rarity (A→Z)"],
              ["rarity-desc", "Rarity (Z→A)"],
              ["owned-first", "Owned first"],
            ].map(([key, label]) => (
              <Pressable key={key} style={styles.radioRow} onPress={() => setSort(key)}>
                <Radio checked={sort === key} />
                <Text style={styles.radioLabel}>{label}</Text>
              </Pressable>
            ))}

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={() => {
                  clearRarities();
                  setSort("number-asc");
                }}
                style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.92 }]}
              >
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
              <Pressable
                onPress={() => setPickerOpen(false)}
                style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.92 }]}
              >
                <Text style={styles.applyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- UI bits ---------------- */

function Chip({ label, active, onPress, compact = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        active ? styles.chipActive : styles.chipInactive,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Text
        style={[
          styles.chipText,
          compact && styles.chipTextCompact,
          active && styles.chipTextActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Radio({ checked }) {
  return (
    <View style={[styles.radioOuter, checked && styles.radioOuterChecked]}>
      {checked ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

function Checkbox({ checked }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
    </View>
  );
}

function SortButton({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.sortBtn, active && styles.sortBtnActive]}>
      <Text style={[styles.sortBtnText, active && styles.sortBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* ---------------- Styles ---------------- */

const TILE_BG = "#1c1d24";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingTop: 0, // header has its own padding
  },

  // Card (filters container)
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
  },

  // Typography
  h2: { color: COLORS.text, fontWeight: "900", fontSize: 16 },

  // Search input row
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TILE_BG,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: { flex: 1, color: COLORS.text, fontSize: 14, paddingVertical: 0 },

  // Compact chip bar
  compactBar: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  chipsBarContent: { paddingRight: 6, gap: 6 },

  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  chipCompact: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  chipInactive: { backgroundColor: TILE_BG, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  chipTextCompact: { fontSize: 11.5 },
  chipTextActive: { color: "#fff" },

  // Sort buttons
  sortRow: { flexDirection: "row", gap: 8 },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: TILE_BG,
  },
  sortBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  sortBtnText: { color: COLORS.textMuted, fontWeight: "800", fontSize: 12 },
  sortBtnTextActive: { color: "#fff" },

  // Count
  count: { color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
  countStrong: { color: COLORS.text, fontWeight: "900" },

  // Card tile
  cardTile: {
    flex: 1,
    backgroundColor: TILE_BG,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 12,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 245 / 337,
    backgroundColor: COLORS.alt,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardImage: { width: "100%", height: "100%" },
  noImg: { alignItems: "center", justifyContent: "center", width: "100%", height: "100%" },
  noImgText: { color: COLORS.textMuted, fontSize: 12 },

  ownedPill: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#059669",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ownedPillText: { color: "#fff", fontWeight: "800", fontSize: 10 },

  cardName: { color: COLORS.text, fontWeight: "900", flexShrink: 1, marginRight: 8 },
  cardNum: { color: COLORS.textMuted, fontSize: 12 },
  cardRarity: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  // More button
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.alt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  moreBtnText: { color: COLORS.accent, fontWeight: "800", fontSize: 12 },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  modalSub: { color: COLORS.textMuted, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },

  radioRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  radioLabel: { color: COLORS.text, fontWeight: "800" },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterChecked: { borderColor: COLORS.accent },
  radioInner: { width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.accent },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },

  applyBtn: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  applyText: { color: "#fff", fontWeight: "900" },

  resetBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetText: { color: COLORS.text, fontWeight: "900" },
});
