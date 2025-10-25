// components/profile/tabs/WishlistTab.js
// PURPOSE: Wishlist grid inside a profile with robust fetching & hydration.
//
// CHANGES (this revision):
// - Drops `card.setCode` from queries to avoid "Cannot return null for non-nullable field" 400s.
// - Still sanitizes away the literal "set" and backfills a human name or UPPER code from the id.
// - Keeps inline schema-safe queries + lazy hydration + image fallbacks.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";
import WishlistGrid from "../WishlistGrid";

import { gql, useLazyQuery, useQuery } from "@apollo/client";
import { CardByIdDocument } from "@sixbyfive/tcg-binder/client";

/* -------------------- INLINE GraphQL (schema-safe) -------------------- */

const MY_WISHLIST_MIN = gql`
  query MyWishlist_Min($page: Int, $pageSize: Int) {
    myWishlist(page: $page, pageSize: $pageSize) {
      total
      entries {
        id
        cardId
        variation
        card {
          id
          name
          number
          image
          setName
        }
      }
    }
  }
`;

const WISHLIST_MIN = gql`
  query Wishlist_Min($userId: ID!, $page: Int, $pageSize: Int) {
    wishlist(userId: $userId, page: $page, pageSize: $pageSize) {
      total
      entries {
        id
        cardId
        variation
        card {
          id
          name
          number
          image
          setName
        }
      }
    }
  }
`;

/* -------------------- helpers -------------------- */

// tiny safe-getter
function get(obj, path) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

// flatten arbitrary list-ish shapes
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

function unwrapEntry(item) {
  const n = item?.node ?? item;
  return { entry: n, card: n?.card ?? null };
}

/* -------------------- image fallbacks -------------------- */

function forceHttps(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/^http:\/\//i, "https://");
}
function isAbs(url) {
  return /^https?:\/\//i.test(url || "");
}
function parseIdParts(id) {
  if (typeof id !== "string") return { setCode: null, number: null };
  const [setCode, ...rest] = id.split("-");
  const number = rest.join("-") || null;
  return { setCode: setCode || null, number };
}
function pad3(n) {
  if (!n) return null;
  const s = String(n).replace(/^0+/, "");
  return s.padStart(3, "0");
}
function eraFromSetCode(setCode) {
  if (!setCode || typeof setCode !== "string") return null;
  const m = setCode.match(/^[A-Za-z]+/);
  return m ? m[0].toLowerCase() : null;
}
// TCGdex: https://assets.tcgdex.net/en/{era}/{setCode}/{number}/[high|low].webp
function tcgdexUrl(idOrSet, numMaybe) {
  const { setCode, number } =
    numMaybe ? { setCode: idOrSet, number: numMaybe } : parseIdParts(idOrSet);
  if (!setCode || !number) return null;
  const era = eraFromSetCode(setCode);
  const n3 = pad3(number);
  if (!era || !n3) return null;
  return {
    high: `https://assets.tcgdex.net/en/${era}/${setCode}/${n3}/high.webp`,
    low: `https://assets.tcgdex.net/en/${era}/${setCode}/${n3}/low.webp`,
  };
}
// PokemonTCG: https://images.pokemontcg.io/{setCode}/{number}[_hires].png
function pokemontcgUrl(idOrSet, numMaybe) {
  const { setCode, number } =
    numMaybe ? { setCode: idOrSet, number: numMaybe } : parseIdParts(idOrSet);
  if (!setCode || !number) return null;
  const n = String(number).replace(/^0+/, "");
  return {
    hires: `https://images.pokemontcg.io/${setCode}/${n}_hires.png`,
    std: `https://images.pokemontcg.io/${setCode}/${n}.png`,
  };
}

// Build preferred candidates (TCGdex high → low → PokemonTCG hires → std)
function buildImageCandidatesFromIdOrImage({ id, image }) {
  const out = [];
  if (image && isAbs(image)) out.push(forceHttps(image));

  const { setCode, number } = parseIdParts(id || "");
  if (setCode && number) {
    const dex = tcgdexUrl(setCode, number);
    if (dex?.high) out.push(dex.high);
    if (dex?.low) out.push(dex.low);
    const ptcg = pokemontcgUrl(setCode, number);
    if (ptcg?.hires) out.push(ptcg.hires);
    if (ptcg?.std) out.push(ptcg.std);
  }

  const seen = new Set();
  return out.filter((u) => {
    const k = String(u || "");
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* -------------------- set-name utils -------------------- */

// Never show the literal "set"
function sanitizeSetName(val) {
  const s = (val ?? "").toString().trim();
  return s.toLowerCase() === "set" ? "" : s;
}

// Minimal, safe set-code → set-name fallback (extend anytime)
const SET_CODE_TO_NAME = {
  sv01: "Scarlet & Violet",
  sv02: "Paldea Evolved",
  sv03: "Obsidian Flames",
  sv04: "Paradox Rift",
  sv05: "Temporal Forces",
  sv06: "Twilight Masquerade",
  sv07: "Stellar Crown",
  sv08: "Surging Sparks",
};

// Decide a display set name with graceful fallbacks
function resolveSetName({ card, cid }) {
  const raw = card?.setName ?? get(card, "set.name") ?? "";
  const cleaned = sanitizeSetName(raw);
  if (cleaned) return cleaned;

  // try deriving from id like "sv05-028"
  const fromId = (() => {
    const idStr = (card?.id || cid || "").toString();
    if (!idStr.includes("-")) return null;
    return idStr.split("-")[0] || null;
  })();

  const code = (fromId || "").toLowerCase();
  if (!code) return "";

  return SET_CODE_TO_NAME[code] || code.toUpperCase();
}

/* -------------------- normalizers -------------------- */

function normalizeWishlistItem(item, hydratedMap) {
  const { entry, card: inlineCard } = unwrapEntry(item);

  // prefer inline card; else hydrated; else placeholder
  const cid = inlineCard?.id ?? entry?.cardId ?? entry?.id ?? item?.id;
  if (!cid) return null;
  const hydrated = hydratedMap?.get?.(String(cid));
  const card = inlineCard || hydrated || {};

  const prices = Array.isArray(card?.prices)
    ? card.prices
    : Array.isArray(card?.pricing)
    ? card.pricing
    : [];

  const setName = resolveSetName({ card, cid });
  const number = card?.number ?? card?.collectorNumber ?? undefined;

  // image: inline → fallbacks
  const direct =
    card?.image ??
    card?.imageUrl ??
    get(card, "images.small") ??
    get(card, "images.large") ??
    "";
  const candidates = buildImageCandidatesFromIdOrImage({ id: String(cid), image: direct });
  const image = candidates[0] || direct || "";

  const variation = typeof entry?.variation === "string" ? entry.variation : "normal";
  const name = card?.name ?? entry?.name ?? "Card";

  return {
    id: String(cid),
    name,
    image,
    setName,       // ← now always filled (name or UPPER code)
    number,
    prices,
    _wishlist: { variation },
  };
}

function normalizeItemsInput(itemsProp, hydratedMap) {
  if (!itemsProp) return [];
  if (!Array.isArray(itemsProp) && typeof itemsProp === "object") {
    const candidates = ["items", "entries", "results", "edges", "nodes", "data", "wishlist", "myWishlist"];
    for (const k of candidates) {
      if (itemsProp[k]) return toArray(itemsProp[k]).map((x) => normalizeWishlistItem(x, hydratedMap)).filter(Boolean);
    }
    return toArray(itemsProp).map((x) => normalizeWishlistItem(x, hydratedMap)).filter(Boolean);
  }
  return toArray(itemsProp).map((x) => normalizeWishlistItem(x, hydratedMap)).filter(Boolean);
}

/* -------------------- Component -------------------- */

export default function WishlistTab({
  title = "Wishlist",
  items = [],
  userId,
  onOpenCard,
  onViewAll,
  pageSize = 24,
  loading = false,
}) {
  const [hydratedMap, setHydratedMap] = useState(() => new Map());
  const hydratedIdsRef = useRef(new Set());
  const inflightRef = useRef(false);

  // 1) use incoming prop items if provided
  const normalizedFromProp = useMemo(() => normalizeItemsInput(items, hydratedMap), [items, hydratedMap]);

  // 2) profile user's wishlist (if prop empty)
  const shouldFetchProfile = normalizedFromProp.length === 0 && !!userId;
  const {
    data: wlData,
    loading: fetchingProfile,
    error: wlError,
  } = useQuery(WISHLIST_MIN, {
    variables: { userId, page: 1, pageSize },
    skip: !shouldFetchProfile,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    onError: (err) => {
      if (__DEV__) console.warn("[WishlistTab] wishlist error", err?.message || err);
    },
  });

  // 3) my wishlist (owner) fallback
  const shouldFetchMine = normalizedFromProp.length === 0 && !userId;
  const {
    data: myWlData,
    loading: fetchingMine,
    error: myWlError,
  } = useQuery(MY_WISHLIST_MIN, {
    variables: { page: 1, pageSize },
    skip: !shouldFetchMine,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    onError: (err) => {
      if (__DEV__) console.warn("[WishlistTab] myWishlist error", err?.message || err);
    },
  });

  // 4) normalize fetched results
  const normalizedFromFetch = useMemo(() => {
    const root = wlData?.wishlist ?? myWlData?.myWishlist ?? wlData ?? myWlData ?? {};
    return toArray(root).map((x) => normalizeWishlistItem(x, hydratedMap)).filter(Boolean);
  }, [wlData, myWlData, hydratedMap]);

  // 5) final list
  const displayItems = (normalizedFromProp.length ? normalizedFromProp : normalizedFromFetch).slice(0, pageSize);

  // 6) ids that still need hydration (no inline card yet & not hydrated)
  const idsNeedingHydration = useMemo(() => {
    const ids = [];
    const seen = new Set();
    const src = normalizedFromProp.length ? toArray(items) : toArray(wlData?.wishlist ?? myWlData?.myWishlist ?? {});
    for (const it of src) {
      const n = it?.node ?? it;
      const hasCard = !!n?.card;
      const cid = n?.card?.id ?? n?.cardId ?? n?.id;
      if (!cid) continue;
      const key = String(cid);
      if (!hasCard && !hydratedIdsRef.current.has(key) && !seen.has(key)) {
        ids.push(key);
        seen.add(key);
      }
    }
    return ids;
  }, [items, normalizedFromProp.length, wlData, myWlData]);

  // 7) lazy hydrate by id (sequential)
  const [fetchCardById] = useLazyQuery(CardByIdDocument, { fetchPolicy: "cache-first" });
  useEffect(() => {
    if (!idsNeedingHydration.length || inflightRef.current) return;
    inflightRef.current = true;
    (async () => {
      try {
        for (const id of idsNeedingHydration) {
          if (hydratedIdsRef.current.has(id)) continue;
          try {
            const { data } = await fetchCardById({ variables: { id } });
            const card = data?.card ?? data?.cardById ?? data?.Card ?? null;
            hydratedIdsRef.current.add(id);
            if (card?.id) {
              setHydratedMap((prev) => {
                const next = new Map(prev);
                next.set(String(card.id), card);
                return next;
              });
            }
          } catch {}
        }
      } finally {
        inflightRef.current = false;
      }
    })();
  }, [idsNeedingHydration, fetchCardById]);

  const showSkeleton = (loading || fetchingProfile || fetchingMine) && normalizedFromProp.length === 0;
  const hasError = wlError || myWlError;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[WishlistTab] source:", {
      via: normalizedFromProp.length ? "prop" : shouldFetchProfile ? "Wishlist_Min" : "MyWishlist_Min",
      propCount: normalizedFromProp.length,
      fetchedCount: normalizedFromFetch.length,
      displayCount: displayItems.length,
      needsHydration: idsNeedingHydration.length,
      errors: { wlError: wlError?.message, myWlError: myWlError?.message },
    });
  }

  // --- render ---
  if (displayItems.length) {
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

        {idsNeedingHydration.length > 0 && (
          <View style={{ paddingVertical: 4, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        )}

        <WishlistGrid items={displayItems} onOpenCard={onOpenCard} />
      </>
    );
  }

  if (showSkeleton) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={{ height: 120, borderRadius: 10, backgroundColor: COLORS.alt, opacity: 0.5 }} />
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.bodyText}>Failed to load wishlist.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.bodyText}>No wishlist items yet.</Text>
    </View>
  );
}

/* -------------------- styles -------------------- */
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
