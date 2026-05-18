// app/(tabs)/search.js
//
// UPDATED (2026-02-18)
//
// CHANGES:
// - FIX: Missing closing brace in setRouteKey() (was breaking the entire file)
// - ADD: buildSearchResumeRoute() helper (single source of truth for resume route)
// - ADD: Persist LAST_SEARCH_ROUTE_KEY on search AND when opening a card
// - KEEP: Hydrate search inputs from route params (Home -> Resume works)
// - KEEP: Existing search, filtering, sorting, and UI behaviour

import { useApolloClient, useLazyQuery, useMutation } from "@apollo/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import {
  AddToCollectionDocument,
  AddToWishlistDocument,
  CardByIdDocument,
  SearchCardsDocument,
} from "../../graphql/documents";
import { useMeQuery } from "../../hooks/useMeQuery";
import * as SecureStore from "expo-secure-store";

import EmptyState from "../../components/common/EmptyState";
import CardTile from "../../components/search/CardTile";
import SearchForm from "../../components/search/SearchForm";
import SearchHeader from "../../components/search/SearchHeader";
import useToast from "../../hooks/useToast";
import { COLORS } from "../../theme/colors";
import {
  buildMyCollectionRefetchQueries,
  upsertMyCollectionEntry,
} from "../../utils/apolloCollectionCache";

// We now load everything in a single query (no paging)
const CARDSEARCH_LIMIT = 1200;
const GBP_SYMBOL = "\u00A3";

/* -------------------------------------------------------------------------- */
/*  "Continue where you left off" (Home -> Resume search)                      */
/* -------------------------------------------------------------------------- */

const LAST_SEARCH_ROUTE_KEY = "sbf_last_search_route_v1";

function cleanString(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

async function setRouteKey(key, route) {
  const next = cleanString(route);
  if (!next) return;

  try {
    const prev = await SecureStore.getItemAsync(key);
    if (prev === next) return; // no-op if unchanged
    await SecureStore.setItemAsync(key, next);
  } catch {
    // Non-fatal
  }
} // ✅ FIX: this brace was missing in your pasted file

function buildSearchResumeRoute({ name, setCode, number }) {
  const qName = cleanString(name);
  const qSet = cleanString(setCode);
  const qNum = cleanString(number);

  const qs = [
    qName ? `name=${encodeURIComponent(qName)}` : null,
    qSet ? `setCode=${encodeURIComponent(qSet)}` : null,
    qNum ? `number=${encodeURIComponent(qNum)}` : null,
  ]
    .filter(Boolean)
    .join("&");

  return qs ? `/(tabs)/search?${qs}` : `/(tabs)/search`;
}

/* -------------------------------------------------------------------------- */
/*  RARITY CONFIG                                                             */
/* -------------------------------------------------------------------------- */

const RARITY_CONFIG = [
  { id: "common", label: "Common" },
  { id: "uncommon", label: "Uncommon" },
  { id: "rare", label: "Rare" },
  { id: "double-rare", label: "Double Rare" },
  { id: "art-rare", label: "Art Rare" },
  { id: "ace-spec", label: "ACE SPEC Rare" },
  { id: "sir", label: "Special Illustration Rare" },
  { id: "ur", label: "Ultra Rare" },
  { id: "hr", label: "Hyper Rare" },
];

const normaliseRarity = (value) =>
  (value || "").toString().trim().toLowerCase();

/**
 * Central, explicit map of normalised rarity string -> canonical group id.
 * NOTE: keys must be lowercase because we normalise input to lowercase.
 */
const RAW_RARITY_GROUP_MAP = {
  common: "common",
  uncommon: "uncommon",
  rare: "rare",

  "double rare": "double-rare",
  "double-rare": "double-rare",
  "art rare": "art-rare",
  "illustration rare": "art-rare",

  "special illustration rare": "sir",
  "hyper rare": "hr",
  "ultra rare": "ur",

  "ace spec": "ace-spec",
  "ace-spec": "ace-spec",
  "ace spec rare": "ace-spec",
};

function getRarityGroupId(raw) {
  const norm = normaliseRarity(raw);
  if (!norm) return null;

  if (RAW_RARITY_GROUP_MAP[norm]) return RAW_RARITY_GROUP_MAP[norm];

  if (norm.includes("ace spec")) return "ace-spec";
  if (norm.includes("special") && norm.includes("illustration")) return "sir";
  if (norm.includes("hyper") && norm.includes("rare")) return "hr";
  if (norm.includes("ultra") && norm.includes("rare")) return "ur";
  if (norm.includes("double") && norm.includes("rare")) return "double-rare";
  if (norm.includes("art") && norm.includes("rare")) return "art-rare";
  if (norm.includes("illustration") && norm.includes("rare")) return "art-rare";

  if (norm === "common" || norm.endsWith(" common")) return "common";
  if (norm === "uncommon" || norm.endsWith(" uncommon")) return "uncommon";
  if (norm === "rare" || norm.endsWith(" rare")) return "rare";

  return null;
}

const RARITY_RANK = RARITY_CONFIG.reduce((acc, cfg, index) => {
  acc[cfg.id] = index + 1;
  return acc;
}, {});

/* ---------------- Helpers ---------------- */

function extractErrorMessage(error) {
  if (!error) return "";
  const graphQlMessage =
    (Array.isArray(error.graphQLErrors) &&
      error.graphQLErrors.map((err) => err?.message).find(Boolean)) ||
    null;
  if (graphQlMessage) return graphQlMessage;
  if (typeof error.message === "string" && error.message.trim())
    return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "";
}
function isForeignKeyConstraintError(error) {
  const message = extractErrorMessage(error);
  return typeof message === "string" && /foreign key/i.test(message);
}

function canonicalVariantKey(raw) {
  const value = String(raw ?? "normal")
    .trim()
    .toLowerCase();
  if (!value || value === "normal") return "Normal";
  if (
    [
      "reverse",
      "reverse holo",
      "reverse-holo",
      "reverseholo",
      "reverseholofoil",
    ].includes(value)
  )
    return "Reverse Holo";
  if (["holo", "holofoil", "holo foil"].includes(value)) return "Holo";
  if (
    ["firstedition", "first edition", "1stedition", "1st edition"].includes(
      value,
    )
  )
    return "1st Ed";
  return "Normal";
}

function firstNumber(...values) {
  for (const v of values)
    if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/* ---------------- PRICE HANDLING (GBP-only) ----------------- */

function normalizePriceEntry(price) {
  if (!price || typeof price !== "object") return null;

  const variation = canonicalVariantKey(
    price.variation ?? price.variant ?? "normal",
  );

  const market =
    firstNumber(price.gbp, price.market, price.mid, price.low, price.high) ??
    null;

  return { variation, market };
}

function normalizePriceList(list) {
  if (!Array.isArray(list)) return [];
  const byVariant = new Map();

  for (const price of list) {
    const entry = normalizePriceEntry(price);
    if (!entry) continue;
    const key = entry.variation || "Normal";
    const existing = byVariant.get(key);
    if (!existing) {
      byVariant.set(key, { ...entry });
      continue;
    }
    if (entry.market != null && existing.market == null) {
      existing.market = entry.market;
    }
  }

  return Array.from(byVariant.values());
}

function hasPrice(entry) {
  return !!(
    entry &&
    typeof entry.market === "number" &&
    Number.isFinite(entry.market)
  );
}

function computeAveragePrice(entry) {
  if (!entry || !hasPrice(entry)) return null;
  return entry.market;
}

function formatGBP(value) {
  if (value == null || Number.isNaN(value)) return `${GBP_SYMBOL}--`;
  return `${GBP_SYMBOL}${Number(value).toFixed(2)}`;
}

function getBestPrice(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return null;

  const pref = ["Normal", "Holo", "Reverse Holo", "1st Ed"];

  for (const key of pref) {
    const hit = prices.find(
      (p) => (p?.variation ?? p?.variant) === key && hasPrice(p),
    );
    if (hit) return hit;
  }
  return prices.find((p) => hasPrice(p)) || null;
}

/* ---------------- CARD NORMALISATION ---------------- */

function collectVariantList(item) {
  const variants = new Set();
  const push = (v) => {
    const key =
      typeof v === "string"
        ? canonicalVariantKey(v)
        : canonicalVariantKey(
            v?.key || v?.variant || v?.label || v?.displayName,
          );
    if (key) variants.add(key);
  };

  if (Array.isArray(item?.variants)) for (const v of item.variants) push(v);
  if (Array.isArray(item?.variations)) for (const v of item.variations) push(v);

  const source = Array.isArray(item?.latestPrices)
    ? item.latestPrices
    : Array.isArray(item?.prices)
      ? item.prices
      : [];
  for (const p of source) {
    if (typeof p === "string") push(p);
    else if (p?.variation || p?.variant) push(p.variation || p.variant);
  }

  const out = Array.from(variants).filter(Boolean);
  return out.length ? out : ["Normal"];
}

function resolveCardIdentifier(card) {
  const normalize = (value) => {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str) return null;
    if (/^card-\d+$/i.test(str)) return null;
    if (/^local-\w+/i.test(str)) return null;
    return str;
  };
  const looksLikeCode = (value) => {
    if (!value) return false;
    const upper = value.toUpperCase();
    if (upper.startsWith("CARD-")) return false;
    return upper.includes("-") || upper.includes("/") || /\d/.test(upper);
  };
  const candidates = [
    normalize(card?.cardId),
    normalize(card?.id),
    normalize(card?.code),
    normalize(card?.card?.id),
    normalize(card?.cardCode),
    normalize(card?.card?.code),
    normalize(
      card?.setCode && card?.number ? `${card.setCode}-${card.number}` : null,
    ),
  ].filter(Boolean);
  for (const candidate of candidates)
    if (looksLikeCode(candidate)) return candidate;
  return candidates[0] ?? null;
}

function resolveVariation(card) {
  if (!card) return "Normal";

  if (Array.isArray(card?.variations) && card.variations.length > 0) {
    for (const entry of card.variations) {
      if (!entry) continue;
      if (typeof entry === "string") return canonicalVariantKey(entry);
      if (typeof entry === "object")
        return canonicalVariantKey(
          entry.variant || entry.variation || entry.displayName || entry.key,
        );
    }
  }

  if (Array.isArray(card?.variants) && card.variants.length > 0) {
    for (const entry of card.variants) {
      if (entry?.default)
        return canonicalVariantKey(entry.key || entry.label || "normal");
    }
  }

  if (card?.variation) return canonicalVariantKey(card.variation);
  return "Normal";
}

function normalizeCardsearchItem(item, index = 0) {
  if (!item) return null;
  const setRecord = item.set || {};
  const setCode = item.setCode || setRecord.code || "";
  const number = item.number || "";
  const setName = setRecord.name || item.setName || setCode || "";
  const image = item.images?.large || item.images?.small || item.image || null;
  const variations = collectVariantList(item);
  const prices = normalizePriceList(item.latestPrices ?? item.prices ?? []);

  const rawRarity = item.rarity || null;
  const rarityGroupId = getRarityGroupId(rawRarity);

  const preferredId =
    item.cardId ||
    item.id ||
    (setCode && number ? `${setCode}-${number}` : null);
  const id = preferredId || `card-${index}`;

  return {
    id,
    cardId: preferredId || id,
    name: item.name || "",
    set: setCode || "",
    setCode,
    setName,
    number: number || "",
    image,
    tcgImageUrl: image,
    rarity: rawRarity,
    rarityGroupId,
    variations,
    prices,
  };
}

function mapCardsearchItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  return items
    .map((item, i) => normalizeCardsearchItem(item, i))
    .filter(Boolean);
}

function isPocketCard(card) {
  const name = (card?.setName || "").toLowerCase();
  const code = (card?.set || "").toLowerCase();
  return (
    name.includes("pocket") ||
    code.startsWith("pocket") ||
    code.startsWith("pkp")
  );
}
function filterOutPocket(cards, exclude = true) {
  if (!exclude) return cards;
  return cards.filter((c) => !isPocketCard(c));
}

/* -------------------------------------------------------------------------- */
/*  Filters + sorting                                                         */
/* -------------------------------------------------------------------------- */

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "£ Low → High" },
  { value: "price-desc", label: "£ High → Low" },
  { value: "rarity-asc", label: "Rarity ↑" },
  { value: "rarity-desc", label: "Rarity ↓" },
  { value: "number-asc", label: "Card # ↑" },
  { value: "number-desc", label: "Card # ↓" },
  { value: "name-asc", label: "Name A → Z" },
  { value: "name-desc", label: "Name Z → A" },
];

function applyFiltersAndSort(cards, filters) {
  if (!Array.isArray(cards) || cards.length === 0 || !filters) return cards;

  const {
    minPrice,
    maxPrice,
    rarities,
    variations,
    sortBy,
    onlyHasPrices,
    onlyHasReverse,
  } = filters;

  const min = minPrice !== "" ? parseFloat(minPrice) : null;
  const max = maxPrice !== "" ? parseFloat(maxPrice) : null;

  const raritySet = new Set((rarities || []).map((r) => String(r)));
  const variationSet = new Set(variations || []);

  const hasRarityFilter = raritySet.size > 0;
  const hasVariationFilter = variationSet.size > 0;

  let filtered = cards.filter((card) => {
    const bestRow = getBestPrice(card.prices || []);
    const price = computeAveragePrice(bestRow);

    if (onlyHasPrices && (price == null || Number.isNaN(price))) return false;

    if (min != null && price != null && price < min) return false;
    if (max != null && price != null && price > max) return false;

    if (hasRarityFilter) {
      const groupId = card.rarityGroupId || getRarityGroupId(card.rarity || "");
      if (!groupId || !raritySet.has(groupId)) return false;
    }

    if (onlyHasReverse) {
      const hasReverse =
        Array.isArray(card.variations) &&
        card.variations.some((v) =>
          String(v).toLowerCase().includes("reverse"),
        );
      if (!hasReverse) return false;
    }

    if (hasVariationFilter) {
      const hasAny =
        Array.isArray(card.variations) &&
        card.variations.some((v) => variationSet.has(v));
      if (!hasAny) return false;
    }

    return true;
  });

  if (!sortBy || sortBy === "relevance") return filtered;

  const sorted = [...filtered];

  sorted.sort((a, b) => {
    const aBest = getBestPrice(a.prices || []);
    const bBest = getBestPrice(b.prices || []);
    const aPrice = computeAveragePrice(aBest);
    const bPrice = computeAveragePrice(bBest);

    const aNorm = normaliseRarity(a.rarity);
    const bNorm = normaliseRarity(b.rarity);
    const aGroup = a.rarityGroupId || getRarityGroupId(a.rarity || "");
    const bGroup = b.rarityGroupId || getRarityGroupId(b.rarity || "");
    const aRank = aGroup ? (RARITY_RANK[aGroup] ?? 999) : 999;
    const bRank = bGroup ? (RARITY_RANK[bGroup] ?? 999) : 999;

    const aNum = parseInt(a.number, 10);
    const bNum = parseInt(b.number, 10);

    switch (sortBy) {
      case "price-asc": {
        if (aPrice == null && bPrice == null) return 0;
        if (aPrice == null) return 1;
        if (bPrice == null) return -1;
        return aPrice - bPrice;
      }
      case "price-desc": {
        if (aPrice == null && bPrice == null) return 0;
        if (aPrice == null) return 1;
        if (bPrice == null) return -1;
        return bPrice - aPrice;
      }
      case "rarity-asc":
        return aRank - bRank || aNorm.localeCompare(bNorm);
      case "rarity-desc":
        return bRank - aRank || bNorm.localeCompare(aNorm);
      case "number-asc": {
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return 0;
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return aNum - bNum;
      }
      case "number-desc": {
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return 0;
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return bNum - aNum;
      }
      case "name-asc":
        return String(a.name).localeCompare(String(b.name));
      case "name-desc":
        return String(b.name).localeCompare(String(a.name));
      default:
        return 0;
    }
  });

  return sorted;
}

/* ---------------- Advanced Filters UI (mobile) ---------------- */

function AdvancedFiltersMobile({
  filters,
  onChange,
  availableRarities,
  availableVariations,
}) {
  const {
    minPrice,
    maxPrice,
    rarities,
    variations,
    sortBy,
    onlyHasPrices,
    onlyHasReverse,
  } = filters;

  const [isOpen, setIsOpen] = useState(false);

  const currentRarities = useMemo(() => new Set(rarities || []), [rarities]);

  const currentSort =
    SORT_OPTIONS.find((opt) => opt.value === (sortBy || "relevance")) ||
    SORT_OPTIONS[0];

  const groupPresence = useMemo(() => {
    const presence = new Map();
    RARITY_CONFIG.forEach((g) => presence.set(g.id, false));
    (availableRarities || []).forEach((groupId) => {
      if (presence.has(groupId)) presence.set(groupId, true);
    });
    return presence;
  }, [availableRarities]);

  const updateField = (key, value) => onChange({ ...filters, [key]: value });

  const toggleArrayFilter = (key, value) => {
    const current = new Set(filters[key] || []);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    onChange({ ...filters, [key]: Array.from(current) });
  };

  const toggleRarityGroup = (group) => {
    const next = new Set(currentRarities);
    if (next.has(group.id)) next.delete(group.id);
    else next.add(group.id);
    onChange({ ...filters, rarities: Array.from(next) });
  };

  const handleClear = () => {
    onChange({
      minPrice: "",
      maxPrice: "",
      rarities: [],
      variations: [],
      sortBy: "relevance",
      onlyHasPrices: false,
      onlyHasReverse: false,
    });
  };

  return (
    <View style={styles.filtersWrapper}>
      <View style={styles.filtersHeaderRow}>
        <Text style={styles.filtersTitle}>Advanced filters</Text>

        <View style={styles.filtersHeaderRight}>
          <TouchableOpacity
            onPress={() => setIsOpen(true)}
            style={styles.sortCurrentChip}
          >
            <Text style={styles.sortCurrentChipLabel}>{currentSort.label}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsOpen((p) => !p)}
            style={styles.filtersToggle}
          >
            <Text style={styles.filtersToggleText}>
              {isOpen ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isOpen && (
        <>
          <View style={styles.filtersColumn}>
            <Text style={styles.filtersSectionTitle}>Sort by</Text>
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((opt) => {
                const active = (sortBy || "relevance") === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => updateField("sortBy", opt.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.filtersColumn}>
            <Text style={styles.filtersSectionTitle}>Price (GBP)</Text>
            <View style={styles.priceRow}>
              <TextInput
                value={minPrice}
                onChangeText={(val) => updateField("minPrice", val)}
                placeholder="Min"
                keyboardType="numeric"
                placeholderTextColor={COLORS.textMuted}
                style={styles.priceInput}
              />
              <TextInput
                value={maxPrice}
                onChangeText={(val) => updateField("maxPrice", val)}
                placeholder="Max"
                keyboardType="numeric"
                placeholderTextColor={COLORS.textMuted}
                style={styles.priceInput}
              />
            </View>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                onPress={() => updateField("onlyHasPrices", !onlyHasPrices)}
                style={[
                  styles.toggleChip,
                  onlyHasPrices && styles.toggleChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.toggleChipText,
                    onlyHasPrices && styles.toggleChipTextActive,
                  ]}
                >
                  With price only
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => updateField("onlyHasReverse", !onlyHasReverse)}
                style={[
                  styles.toggleChip,
                  onlyHasReverse && styles.toggleChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.toggleChipText,
                    onlyHasReverse && styles.toggleChipTextActive,
                  ]}
                >
                  Has reverse
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filtersColumn}>
            <Text style={styles.filtersSectionTitle}>Rarity</Text>
            {availableRarities && availableRarities.length > 0 ? (
              <View style={styles.chipWrap}>
                {RARITY_CONFIG.map((group) => {
                  const active = currentRarities.has(group.id);
                  const present = groupPresence.get(group.id) ?? false;
                  return (
                    <TouchableOpacity
                      key={group.id}
                      onPress={() => toggleRarityGroup(group)}
                      style={[
                        styles.chip,
                        active && styles.chipActive,
                        !present && styles.chipDim,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {group.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.filtersHint}>
                Rarity filters will appear after you search.
              </Text>
            )}
          </View>

          <View style={styles.filtersColumn}>
            <Text style={styles.filtersSectionTitle}>Variants</Text>
            {availableVariations && availableVariations.length > 0 ? (
              <View style={styles.chipWrap}>
                {availableVariations.map((variation) => {
                  const isActive = variations?.includes(variation);
                  return (
                    <TouchableOpacity
                      key={variation}
                      onPress={() => toggleArrayFilter("variations", variation)}
                      style={[styles.chip, isActive && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isActive && styles.chipTextActive,
                        ]}
                      >
                        {variation}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.filtersHint}>
                Variant filters will appear after you search.
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

/* ---------------- Search Tab ---------------- */

export default function SearchTab() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const didHydrateFromParamsRef = useRef(false);

  const toast = useToast();
  const apollo = useApolloClient();

  const listRef = useRef(null);

  // Scroll shared value (UI thread)
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // Fade the search form as it scrolls away inside the FlatList.
  // translateY is omitted — the FlatList's own scroll physics move the header.
  const collapsibleContentAnimatedStyle = useAnimatedStyle(() => {
    const clamp = Math.min(Math.max(scrollY.value, 0), 150);
    const opacity = interpolate(clamp, [0, 90, 150], [1, 0.35, 0], Extrapolate.CLAMP);
    return { opacity };
  }, []);

  const backToTopAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 250, 420],
      [0, 0, 1],
      Extrapolate.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 250, 420],
      [12, 12, 0],
      Extrapolate.CLAMP,
    );
    return { opacity, transform: [{ translateY }] };
  }, []);

  const onBackToTop = useCallback(() => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  }, []);

  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  // NEW: hydrate inputs from route params once (Home -> Resume)
  useEffect(() => {
    if (didHydrateFromParamsRef.current) return;

    const pName = cleanString(params?.name);
    const pSet = cleanString(params?.setCode || params?.set);
    const pNum = cleanString(params?.number);

    if (!pName && !pSet && !pNum) return;

    didHydrateFromParamsRef.current = true;

    setName((prev) => (cleanString(prev) ? prev : pName));
    setSetCode((prev) => (cleanString(prev) ? prev : pSet));
    setNumber((prev) => (cleanString(prev) ? prev : pNum));
  }, [params]);

  const [results, setResults] = useState([]);

  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    rarities: [],
    variations: [],
    sortBy: "relevance",
    onlyHasPrices: false,
    onlyHasReverse: false,
  });

  const [runSearch, { loading, error, called }] = useLazyQuery(
    SearchCardsDocument,
    {
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
      returnPartialData: false,
    },
  );

  const canSearch = useMemo(
    () =>
      (name ?? "").trim().length > 0 ||
      (setCode ?? "").trim().length > 0 ||
      (number ?? "").trim().length > 0,
    [name, setCode, number],
  );

  const persistLastSearch = useCallback(async () => {
    const resumeRoute = buildSearchResumeRoute({ name, setCode, number });
    await setRouteKey(LAST_SEARCH_ROUTE_KEY, resumeRoute);
  }, [name, setCode, number]);

  const onSearch = useCallback(async () => {
    if (!canSearch) return;

    // NEW: persist last search for Home -> Continue
    await persistLastSearch();

    const qName = cleanString(name);
    const qSet = cleanString(setCode);
    const qNum = cleanString(number);

    setResults([]);

    runSearch({
      variables: {
        input: {
          name: qName || undefined,
          set: qSet || undefined,
          number: qNum || undefined,
          limit: CARDSEARCH_LIMIT,
          offset: 0,
        },
      },
      onCompleted: (res) => {
        const payload = res?.searchCards;
        const items = mapCardsearchItems(payload?.items || []);
        const filtered = filterOutPocket(items, !/pocket/i.test(qSet || ""));
        setResults(filtered);
      },
    });
  }, [canSearch, name, setCode, number, runSearch, persistLastSearch]);

  const availableRarities = useMemo(() => {
    const set = new Set();
    results.forEach((card) => {
      if (card.rarityGroupId) set.add(card.rarityGroupId);
    });
    return Array.from(set);
  }, [results]);

  const availableVariations = useMemo(() => {
    const set = new Set();
    results.forEach((card) => {
      if (Array.isArray(card.variations)) {
        card.variations.forEach((v) => {
          if (v) set.add(v);
        });
      }
    });
    return Array.from(set);
  }, [results]);

  const filteredResults = useMemo(
    () => applyFiltersAndSort(results, filters),
    [results, filters],
  );

  const { data: meData } = useMeQuery({ fetchPolicy: "cache-first" });
  const userId = meData?.me?.id ?? null;

  const hydrateCardById = useCallback(
    async (cardId, variation = "Normal") => {
      if (!cardId) return false;
      try {
        const { data: cardData } = await apollo.query({
          query: CardByIdDocument,
          variables: { id: cardId, variant: variation || undefined },
          fetchPolicy: "network-only",
        });
        const cardRecord =
          cardData?.card ?? cardData?.cardById ?? cardData?.Card ?? null;
        return Boolean(cardRecord?.id);
      } catch {
        return false;
      }
    },
    [apollo],
  );

  const wishlistSuccess = (result) => {
    const d = result?.data || {};
    return Boolean(
      d.addToWishlist === true ||
      d.toggleWishlist === true ||
      d.addToWishlist?.id ||
      d.addToWishlist?.cardId ||
      d.wishlistEntry?.id,
    );
  };

  const collectionSuccess = (result) => {
    const d = result?.data || {};
    const entry =
      d.addToCollection || d.updateCollectionEntry || d.collectionEntry || null;
    return Boolean(entry && (entry.id || entry.cardId));
  };

  const [addToWishlist] = useMutation(AddToWishlistDocument, {
    errorPolicy: "all",
  });

  const [addToCollection] = useMutation(AddToCollectionDocument, {
    errorPolicy: "all",
    update: (cache, { data }) => {
      upsertMyCollectionEntry(cache, data?.addToCollection);
    },
    refetchQueries: () => buildMyCollectionRefetchQueries(userId),
    awaitRefetchQueries: false,
  });

  const onAddToWishlist = async (card) => {
    const cardId = resolveCardIdentifier(card);
    if (!cardId) {
      toast.show("Missing card id", { type: "error" });
      return;
    }
    const variation = resolveVariation(card);
    const variables = { cardId, variation };

    let res = await addToWishlist({ variables });
    if (wishlistSuccess(res)) {
      toast.show("Added to wishlist", { type: "success" });
      return;
    }

    const err = res?.errors?.[0];
    if (isForeignKeyConstraintError(err)) {
      const hydrated = await hydrateCardById(cardId, variation);
      if (hydrated) {
        res = await addToWishlist({ variables });
        if (wishlistSuccess(res)) {
          toast.show("Added to wishlist", { type: "success" });
          return;
        }
      }
    }

    const message = extractErrorMessage(err) || "Couldn't add to wishlist";
    toast.show(message, { type: "error" });
  };

  const onAddToCollection = async (card) => {
    const cardId = resolveCardIdentifier(card);
    if (!cardId) {
      toast.show("Missing card id", { type: "error" });
      return;
    }
    const variation = resolveVariation(card);
    const variables = { cardId, variation, quantity: 1 };

    let res = await addToCollection({ variables });
    if (collectionSuccess(res)) {
      toast.show("Added to collection", { type: "success" });
      return;
    }

    const err = res?.errors?.[0];
    if (isForeignKeyConstraintError(err)) {
      const hydrated = await hydrateCardById(cardId, variation);
      if (hydrated) {
        res = await addToCollection({ variables });
        if (collectionSuccess(res)) {
          toast.show("Added to collection", { type: "success" });
          return;
        }
      }
    }

    const message = extractErrorMessage(err) || "Couldn't add to collection";
    toast.show(message, { type: "error" });
  };

  const showPlaceholders = !loading && results.length === 0;

  return (
    <View style={styles.container}>
      <SearchHeader
        title="Pokémon Card Search"
        subtitle="Search for any Pokémon card and add it to your collection"
      />

      {/* Filters are sticky above the list — always in normal layout flow so
          opening them pushes the list down rather than overlapping it. */}
      <AdvancedFiltersMobile
        filters={filters}
        onChange={setFilters}
        availableRarities={availableRarities}
        availableVariations={availableVariations}
      />

      <Animated.FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filteredResults}
        keyExtractor={(item, idx) => (item?.id ? String(item.id) : `${idx}`)}
        numColumns={2}
        columnWrapperStyle={styles.column}
        onScroll={onScroll}
        scrollEventThrottle={16}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={50}
        windowSize={9}
        ListHeaderComponent={
          <Animated.View style={collapsibleContentAnimatedStyle}>
            <SearchForm
              name={name}
              setName={setName}
              setCode={setCode}
              setSetCode={setSetCode}
              number={number}
              setNumber={setNumber}
              canSearch={canSearch}
              loading={loading}
              onSearch={onSearch}
              errorMessage={error?.message}
            />
          </Animated.View>
        }
        ListEmptyComponent={
          showPlaceholders ? (
            <PlaceholderGrid shimmer={!called && !loading} rows={6} />
          ) : (
            <EmptyState message="No results found. Try different filters." />
          )
        }
        renderItem={({ item }) => {
          const best = getBestPrice(item?.prices || []);
          const avg = computeAveragePrice(best);

          return (
            <CardTile
              item={item}
              bestPrice={best}
              averagePrice={avg}
              averagePriceFormatted={formatGBP(avg)}
              onAddToWishlist={onAddToWishlist}
              onAddToCollection={onAddToCollection}
              onPress={async () => {
                await persistLastSearch();

                router.push({
                  pathname: `/card/${item.id}`,
                  params: {
                    id: String(item.id),
                    name: item.name ?? "",
                    number: String(item.number ?? ""),
                    setName: item.setName ?? "",
                    image: item.image ?? "",
                    prices: JSON.stringify(item?.prices || []),
                    pricing: JSON.stringify(item?.prices || []),
                  },
                });
              }}
            />
          );
        }}
      />

      <Animated.View
        pointerEvents="box-none"
        style={[styles.backToTopWrap, backToTopAnimatedStyle]}
      >
        <Pressable
          onPress={onBackToTop}
          style={styles.backToTopBtn}
          hitSlop={10}
        >
          <Text style={styles.backToTopText}>↑ Top</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ---------- visible placeholders (always 2 per row) ---------- */
function PlaceholderGrid({ shimmer = false, rows = 3 }) {
  const items = Array.from({ length: rows * 2 }, (_, i) => i);
  return (
    <View style={styles.placeholderWrap}>
      {items.map((i) => (
        <View key={i} style={styles.placeholderCell}>
          <PlaceholderTile shimmer={shimmer} />
        </View>
      ))}
    </View>
  );
}

function PlaceholderTile({ shimmer = false }) {
  return (
    <View style={styles.placeholderCard}>
      <View style={[styles.placeholderImageWrap, shimmer && styles.pulse]} />
      <View style={styles.placeholderInfo}>
        <View
          style={[
            styles.placeholderLine,
            { width: "72%" },
            shimmer && styles.pulse,
          ]}
        />
        <View
          style={[
            styles.placeholderLine,
            { width: "46%", marginTop: 6 },
            shimmer && styles.pulse,
          ]}
        />
      </View>
      <View style={[styles.placeholderBar, shimmer && styles.pulse]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 6, paddingBottom: 20 },
  column: { gap: 4 },

  placeholderWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 6,
    paddingBottom: 20,
  },
  placeholderCell: { width: "50%", padding: 6 },
  placeholderCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  placeholderImageWrap: {
    backgroundColor: COLORS.alt,
    aspectRatio: 245 / 337,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeholderInfo: { padding: 8 },
  placeholderLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.alt,
  },
  placeholderBar: {
    height: 36,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pulse: { opacity: 0.8 },

  backToTopWrap: {
    position: "absolute",
    right: 14,
    bottom: 20, // above tab bar
  },
  backToTopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  backToTopText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },

  /* ---- Advanced filters styling (single card) ---- */
  filtersWrapper: {
    marginHorizontal: 10,
    marginBottom: 8,
    padding: 8,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  filtersHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  filtersHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  filtersTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  sortCurrentChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.alt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  sortCurrentChipLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  filtersToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.alt,
    marginLeft: 4,
  },
  filtersToggleText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginLeft: 4,
  },
  clearButtonText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  filtersColumn: {
    marginTop: 8,
  },
  filtersSectionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  filtersHint: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  priceRow: {
    flexDirection: "row",
    gap: 6,
  },
  priceInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: COLORS.text,
    backgroundColor: COLORS.alt,
    fontSize: 12,
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  toggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  toggleChipActive: {
    backgroundColor: COLORS.accentSoft || COLORS.accent,
    borderColor: COLORS.accent,
  },
  toggleChipText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  toggleChipTextActive: {
    color: COLORS.onAccent || "white",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.alt,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipDim: {
    opacity: 0.6,
  },
  chipText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  chipTextActive: {
    color: COLORS.onAccent || "white",
    fontWeight: "600",
  },
});
