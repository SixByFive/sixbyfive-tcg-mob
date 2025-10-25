// app/card/[id].js
// UPDATED (set name + image):
// • Correct set mapping: sv05 → Temporal Forces, sv08 → Surging Sparks.
// • Normalizes set codes (case/spacing/dots) before lookup.
// • Uses nested set { name, code } if present.
// • Keeps TCGdex image preference regardless of caller order.

import { useMutation, useQuery } from "@apollo/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CardByIdDocument as CARD_BY_ID } from "@sixbyfive/tcg-binder";
import {
  AddToCollectionDocument,
  AddToWishlistDocument,
  CardPriceHistoryDocument,
} from "@sixbyfive/tcg-binder/client";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";

import useToast from "../../hooks/useToast";
import { COLORS } from "../../theme/colors";
import {
  buildMyCollectionRefetchQueries,
  upsertMyCollectionEntry,
} from "../../utils/apolloCollectionCache";
import { getBestPrice } from "../../utils/cards";
import {
  TIMEFRAME_POINTS,
  makePlaceholderSeries,
  seriesStats,
  toBarHeights,
} from "../../utils/priceSeries";

import CardHeader from "../../components/card/CardHeader";
import CardImageBlock from "../../components/card/CardImageBlock";
import InfoCard from "../../components/card/InfoCard";
import PricingHistory from "../../components/card/PricingHistory";

import inferSetEra from "../../utils/setEra.native";

/* ----------------------- helpers ----------------------- */

function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}
function canonicalVariant(v) {
  const s = String(v ?? "normal").toLowerCase().trim();
  if (!s) return "normal";
  if (["reverse", "reverse holo", "reverse-holo", "reverseholo", "reverseholofoil"].includes(s))
    return "reverseHolofoil";
  if (["holo", "holofoil", "holo foil"].includes(s)) return "holofoil";
  if (["first edition", "firstedition", "1st edition", "1stedition"].includes(s)) return "firstEdition";
  return s;
}
function pickMarketishValue(p) {
  if (!p) return undefined;
  return (
    (isNum(p.market) ? p.market : undefined) ??
    (isNum(p.gbp) ? p.gbp : undefined) ??
    (isNum(p.mid) ? p.mid : undefined) ??
    (isNum(p.low) ? p.low : undefined) ??
    (isNum(p.high) ? p.high : undefined)
  );
}
function hasAnyPriceValue(p) {
  return isNum(p?.market) || isNum(p?.gbp) || isNum(p?.mid) || isNum(p?.low) || isNum(p?.high);
}
function localBestPrice(prices = []) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const rows = prices
    .map((r) => (r ? { ...r, _v: canonicalVariant(r.variation ?? r.variant) } : null))
    .filter(Boolean)
    .filter(hasAnyPriceValue);
  if (!rows.length) return null;
  const pref = ["normal", "holofoil", "holo", "reverseHolofoil", "reverse"];
  for (const key of pref) {
    const hit = rows.find((r) => r._v === key && pickMarketishValue(r) != null);
    if (hit) return hit;
  }
  return rows.find((r) => pickMarketishValue(r) != null) || null;
}

/* --- id / set / image helpers --- */

function parseCardId(id) {
  if (typeof id !== "string") return { setCode: null, number: null };
  const parts = id.split("-");
  if (parts.length < 2) return { setCode: null, number: null };
  const setCode = parts[0]?.trim() || null;
  const numberRaw = parts.slice(1).join("-").trim();
  const number = numberRaw || null;
  return { setCode, number };
}

function toTitleCase(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function looksLikeSetCode(s) {
  if (!s) return false;
  const v = String(s).trim();
  // sv05, sv3.5, swsh12, me1, xy10, etc.
  return /^[a-z]{2,5}\d+(?:\.\d+)?$/i.test(v);
}

// CHANGED: normalize codes: lowercased, strip spaces, keep dot (map also includes dotless alias)
function normalizeSetCode(code) {
  if (!code) return "";
  return String(code).trim().toLowerCase().replace(/\s+/g, "");
}

// CHANGED: corrected set-code → human-name hints. Add more as needed.
const SET_CODE_TO_NAME_HINTS = {
  // Scarlet & Violet examples
  sv01: "Scarlet & Violet",
  sv02: "Paldea Evolved",
  sv03: "Obsidian Flames",
  "sv03.5": "151",
  sv04: "Paradox Rift",
  sv05: "Temporal Forces",   // ← FIXED
  sv06: "Twilight Masquerade",
  sv07: "Stellar Crown",
  sv08: "Surging Sparks",    // ← FIXED
  // add any others your backend commonly returns
};

// For codes with a dot (sv03.5) also allow a fallback without the dot (sv035)
function lookupSetNameForCode(codeRaw) {
  const c = normalizeSetCode(codeRaw);
  if (!c) return "";
  // direct hit
  if (SET_CODE_TO_NAME_HINTS[c]) return SET_CODE_TO_NAME_HINTS[c];
  // dotless alias (sv03.5 -> sv035)
  const dotless = c.replace(/\./g, "");
  if (dotless !== c && SET_CODE_TO_NAME_HINTS[dotless]) {
    return SET_CODE_TO_NAME_HINTS[dotless];
  }
  return "";
}

function firstHumanName(...candidates) {
  for (const c of candidates) {
    const s = (c ?? "").toString().trim();
    if (s && s.toLowerCase() !== "set" && !looksLikeSetCode(s)) {
      return toTitleCase(s);
    }
  }
  return "";
}

// CHANGED: derive a displayable set label (checks nested set.name & set.code too)
function deriveSetLabel({ paramSetName, serverSetName, nestedSetName, nestedSetCode, id, setCode }) {
  // 1) Real names (param → server flat → server nested)
  const human = firstHumanName(paramSetName, serverSetName, nestedSetName);
  if (human) return human;

  // 2) Hints via codes: prefer nested code → explicit setCode → parsed from id
  const codeCandidates = [
    nestedSetCode,
    setCode,
    parseCardId(id).setCode,
  ].map(normalizeSetCode);

  for (const code of codeCandidates) {
    const hint = lookupSetNameForCode(code);
    if (hint) return hint;
  }

  // 3) Fallback: uppercase of the best available code
  const fallbackCode = codeCandidates.find(Boolean);
  return fallbackCode ? fallbackCode.toUpperCase() : "";
}

// PokemonTCG URLs
function pokemontcgFromParts(setCode, number, hires = true) {
  if (!setCode || !number) return null;
  const n = String(number).replace(/^0+/, "");
  const suffix = hires ? "_hires" : "";
  return `https://images.pokemontcg.io/${setCode}/${n}${suffix}.png`;
}

// TCGdex URLs
function tcgdexFromParts(setCode, number, era = null, quality = "high") {
  if (!setCode || !number) return null;
  const eraSlug = (era || inferSetEra({ code: setCode }) || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const numPadded = String(number).replace(/^0+/, "").padStart(3, "0");
  if (!eraSlug) return null;
  return `https://assets.tcgdex.net/en/${eraSlug}/${setCode}/${numPadded}/${quality}.webp`;
}

function parseImageCandidatesParam(imageCandidatesParam) {
  if (!imageCandidatesParam) return [];
  if (Array.isArray(imageCandidatesParam)) return imageCandidatesParam.map(String);
  const raw = String(imageCandidatesParam);
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

// Build a pool; we’ll force-pick TCGdex later.
function buildImageCandidates({ image, id, setCode, number, era, imageCandidates }) {
  const out = [];
  const provided = parseImageCandidatesParam(imageCandidates);
  out.push(...provided);
  if (image && /^https?:\/\//i.test(image)) out.push(image.replace(/^http:\/\//i, "https://"));
  const parsed = parseCardId(id || "");
  const code = setCode || parsed.setCode;
  const num = number || parsed.number;
  const eraSafe = era || (code ? inferSetEra({ code }) : null);
  const dHigh = tcgdexFromParts(code, num, eraSafe, "high");
  const dLow = tcgdexFromParts(code, num, eraSafe, "low");
  if (dHigh) out.push(dHigh);
  if (dLow) out.push(dLow);
  const pHires = pokemontcgFromParts(code, num, true);
  const pStd = pokemontcgFromParts(code, num, false);
  if (pHires) out.push(pHires);
  if (pStd) out.push(pStd);

  const seen = new Set();
  return out.filter((u) => {
    const key = String(u || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ----------------------------------------------------------------------------------- */

export default function CardDetailsScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams();

  const routeId = params?.id ? String(params.id) : null;

  const [range, setRange] = useState("30D");
  const hideActions =
    params?.hideActions === "1" ||
    params?.hideActions === 1 ||
    params?.hideActions === true;

  // Fallback from route params (supports prices/pricesJSON)
  const fallback = useMemo(() => {
    let prices = [];
    try {
      const raw =
        typeof params.pricesJSON === "string"
          ? params.pricesJSON
          : typeof params.prices === "string"
          ? params.prices
          : typeof params.pricing === "string"
          ? params.pricing
          : "[]";
      const parsed = JSON.parse(raw);
      prices = Array.isArray(parsed) ? parsed : [];
    } catch {}
    return {
      id: routeId || String(params.cardId || ""),
      name: params.name ?? "",
      number: params.number ?? "",
      setNameParam: params.setName ?? "",
      setCode: params.setCode ? String(params.setCode) : undefined,
      era: params.era ? String(params.era) : undefined,
      image: params.image ?? "",
      imageCandidates: params.imageCandidates ?? undefined,
      prices,
    };
  }, [params, routeId]);

  // Live card
  const { data, loading, error } = useQuery(CARD_BY_ID, {
    variables: { id: routeId ?? "" },
    skip: !routeId,
    fetchPolicy: "cache-first",
  });

  // Normalize card data (include nested set name/code if present)
  const rawCard = data?.card ? data.card : { id: routeId, ...fallback };

  const card = useMemo(() => {
    const fromLatest = Array.isArray(rawCard?.latestPrices) ? rawCard.latestPrices : null;
    const fromPrices = Array.isArray(rawCard?.prices) ? rawCard.prices : null;
    const fromPricing = Array.isArray(rawCard?.pricing) ? rawCard.pricing : null;
    const prices = fromPrices || fromLatest || fromPricing || fallback.prices || [];

    const nestedSetName =
      (rawCard?.set && (rawCard.set.name || rawCard.set.setName)) || undefined;
    const nestedSetCode =
      (rawCard?.set && (rawCard.set.code || rawCard.set.setCode)) || undefined;

    const setName = deriveSetLabel({
      paramSetName: fallback.setNameParam,
      serverSetName: rawCard?.setName,
      nestedSetName,
      nestedSetCode,
      id: rawCard?.id ?? fallback.id,
      setCode: rawCard?.setCode ?? fallback.setCode,
    });

    return {
      ...rawCard,
      prices,
      setName,
      setCode: rawCard?.setCode ?? fallback.setCode,
      era: rawCard?.era ?? fallback.era,
      number: rawCard?.number ?? fallback.number,
      image: rawCard?.image ?? fallback.image,
      imageCandidates: rawCard?.imageCandidates ?? fallback.imageCandidates,
    };
  }, [rawCard, fallback]);

  const resolvedCardId =
    (card && card.id ? String(card.id) : null) ||
    (routeId ? String(routeId) : null) ||
    (params?.cardId ? String(params.cardId) : null);

  // Pool candidates (order agnostic)
  const imageCandidates = useMemo(
    () =>
      buildImageCandidates({
        image: card?.image,
        id: card?.id,
        setCode: card?.setCode,
        number: card?.number,
        era: card?.era,
        imageCandidates: card?.imageCandidates,
      }),
    [card?.image, card?.id, card?.setCode, card?.number, card?.era, card?.imageCandidates]
  );

  // Force TCGdex first
  const primaryImage =
    imageCandidates.find((u) => typeof u === "string" && u.includes("assets.tcgdex.net")) ||
    imageCandidates[0] ||
    null;

  // Best priced variation
  const price = useMemo(() => {
    const utilRow = getBestPrice(card, { strategy: "recent" }) || null;
    const useUtil = utilRow && hasAnyPriceValue(utilRow);
    return useUtil ? utilRow : localBestPrice(card?.prices);
  }, [card]);

  // Unified average price
  const average = useMemo(() => {
    if (!price) return null;
    const m = pickMarketishValue(price);
    return isNum(m) ? m : null;
  }, [price]);

  const activeVariant = canonicalVariant(price?.variation ?? "normal");

  // History
  const { data: historyData } = useQuery(CardPriceHistoryDocument, {
    variables: { cardId: resolvedCardId ?? "", days: 365 },
    skip: !resolvedCardId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const historyByVariant = useMemo(() => {
    const points = Array.isArray(historyData?.cardPriceHistory)
      ? historyData.cardPriceHistory
      : [];
    if (!points.length) return new Map();

    const toFinite = (value) => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    const grouped = new Map();
    for (const point of points) {
      if (!point) continue;
      const key = canonicalVariant(point.variation ?? "normal");
      const normalized = {
        ...point,
        variation: key,
        market: toFinite(point.market),
        mid: toFinite(point.mid),
        low: toFinite(point.low),
        high: toFinite(point.high),
        gbp: toFinite(point.gbp),
        tcgplayer: toFinite(point.tcgplayer),
        cardmarket: toFinite(point.cardmarket),
        updatedAt: point.updatedAt ?? point.date ?? null,
      };

      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(normalized);
    }

    for (const arr of grouped.values()) {
      arr.sort((a, b) => {
        const ta = new Date(a.updatedAt || a.date || 0).getTime();
        const tb = new Date(b.updatedAt || b.date || 0).getTime();
        return ta - tb;
      });
    }

    return grouped;
  }, [historyData]);

  const variantHistory = useMemo(() => {
    if (!historyByVariant.size) return [];
    if (historyByVariant.has(activeVariant)) return historyByVariant.get(activeVariant) ?? [];
    if (historyByVariant.has("normal")) return historyByVariant.get("normal") ?? [];
    const first = historyByVariant.values().next().value;
    return Array.isArray(first) ? first : [];
  }, [historyByVariant, activeVariant]);

  const baseForSeries = isNum(average) ? average : 10;
  const hasHistory = variantHistory.length > 0;

  const placeholder = useMemo(() => {
    if (hasHistory) return null;
    const points = TIMEFRAME_POINTS[range] ?? 30;
    const series = makePlaceholderSeries(baseForSeries, points);
    const stats = seriesStats(series);
    return {
      bars: toBarHeights(series, 80),
      avg: stats.avg,
      min: stats.min,
      max: stats.max,
    };
  }, [hasHistory, range, baseForSeries]);

  /* ------------------ Mutations ------------------ */
  const { data: meData } = useMeQuery({ fetchPolicy: "cache-first" });
  const userId = meData?.me?.id ?? null;

  const [addToCollection, { loading: addingCollection }] = useMutation(
    AddToCollectionDocument,
    {
      update: (cache, { data }) => {
        upsertMyCollectionEntry(cache, data?.addToCollection);
      },
      refetchQueries: () => buildMyCollectionRefetchQueries(userId),
      awaitRefetchQueries: false,
    }
  );
  const [addToWishlist, { loading: addingWishlist }] = useMutation(
    AddToWishlistDocument
  );

  const variation = price?.variation ? String(price.variation) : "normal";

  const handleAddToCollection = async () => {
    if (!resolvedCardId) {
      toast.show("Missing card id", { type: "error" });
      return;
    }
    try {
      await addToCollection({
        variables: { cardId: resolvedCardId, variation, quantity: 1 },
      });
      toast.show("Added to collection", { type: "success" });
    } catch (e) {
      toast.show(
        e?.graphQLErrors?.[0]?.message || e?.message || "Failed to add to collection",
        { type: "error" }
      );
    }
  };

  const handleToggleWishlist = async () => {
    if (!resolvedCardId) {
      toast.show("Missing card id", { type: "error" });
      return;
    }
    try {
      await addToWishlist({ variables: { cardId: resolvedCardId, variation } });
      toast.show("Added to wishlist", { type: "success" });
    } catch (e) {
      toast.show(
        e?.graphQLErrors?.[0]?.message || e?.message || "Failed to update wishlist",
        { type: "error" }
      );
    }
  };

  const actionProps = hideActions
    ? {}
    : {
        onAddToCollection: addingCollection ? undefined : handleAddToCollection,
        onToggleWishlist: addingWishlist ? undefined : handleToggleWishlist,
      };

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[CardDetails]", {
      chosenImage: primaryImage,
      id: card.id,
      setName: card.setName,
    });
  }

  return (
    <View style={styles.container}>
      <CardHeader title={card?.name || "Card Details"} onBack={() => router.back()} />

      {loading && !data?.card ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : error && !data?.card ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.error }}>
            {error.message || "Failed to load details"}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <CardImageBlock imageUri={primaryImage} key={primaryImage || "noimg"} />

          <InfoCard
            name={card.name}
            number={card.number}
            setName={card.setName} // now corrected via normalized-code hints or server
            average={isNum(average) ? average : null}
            variationLabel={price?.variation ? String(price.variation).toUpperCase() : "—"}
            hideActions={hideActions}
            {...actionProps}
          />

          <PricingHistory
            range={range}
            onChangeRange={setRange}
            history={variantHistory.length ? variantHistory : null}
            barHeights={!variantHistory.length ? (toBarHeights(makePlaceholderSeries(isNum(average) ? average : 10, TIMEFRAME_POINTS[range] ?? 30), 80)) : undefined}
            avg={undefined}
            min={undefined}
            max={undefined}
          />

          <View style={{ height: 28 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
