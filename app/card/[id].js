// app/card/[id].js
// UPDATED: simplified to use only unified `average` pricing (removed tcgp/cmkt props)

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
} from "@sixbyfive/tcg-binder/client";

import useToast from "../../hooks/useToast";
import { COLORS } from "../../theme/colors";
import { getBestPrice, normalizeImageUrl } from "../../utils/cards";
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

/* ----------------------- Local helpers (match CardTile) ----------------------- */

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
  return (
    isNum(p?.market) ||
    isNum(p?.gbp) ||
    isNum(p?.mid) ||
    isNum(p?.low) ||
    isNum(p?.high)
  );
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

/* ----------------------------------------------------------------------------------- */

export default function CardDetailsScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams();
  const routeId = params.id ? String(params.id) : null;

  const [range, setRange] = useState("30D");
  const hideActions =
    params?.hideActions === "1" ||
    params?.hideActions === 1 ||
    params?.hideActions === true;

  // --- Fallback from navigation params
  const fallback = useMemo(() => {
    let prices = [];
    try {
      const raw =
        typeof params.prices === "string"
          ? params.prices
          : typeof params.pricing === "string"
          ? params.pricing
          : "[]";
      const parsed = JSON.parse(raw);
      prices = Array.isArray(parsed) ? parsed : [];
    } catch {}
    return {
      name: params.name ?? "",
      number: params.number ?? "",
      setName: params.setName ?? "",
      image: params.image ?? "",
      prices,
    };
  }, [params]);

  // --- Query the live card
  const { data, loading, error } = useQuery(CARD_BY_ID, {
    variables: { id: routeId ?? "" },
    skip: !routeId,
    fetchPolicy: "cache-first",
  });

  const rawCard = data?.card ?? { id: routeId, ...fallback };

  // Normalize -> always expose `prices`
  const card = useMemo(() => {
    const fromLatest = Array.isArray(rawCard?.latestPrices) ? rawCard.latestPrices : null;
    const fromPrices = Array.isArray(rawCard?.prices) ? rawCard.prices : null;
    const fromPricing = Array.isArray(rawCard?.pricing) ? rawCard.pricing : null;
    const prices = fromPrices || fromLatest || fromPricing || [];
    return { ...rawCard, prices };
  }, [rawCard]);

  const img = normalizeImageUrl(card?.image);

  // pick most-recent priced variation
  const price = useMemo(() => {
    const utilRow = getBestPrice(card, { strategy: "recent" }) || null;
    const useUtil = utilRow && hasAnyPriceValue(utilRow);
    return useUtil ? utilRow : localBestPrice(card?.prices);
  }, [card]);

  // unified average price
  const average = useMemo(() => {
    if (!price) return null;
    const m = pickMarketishValue(price);
    return isNum(m) ? m : null;
  }, [price]);

  // --- Placeholder pricing chart values
  const baseForSeries = isNum(average) ? average : 10;

  const series = useMemo(() => {
    const points = TIMEFRAME_POINTS[range] ?? 30;
    return makePlaceholderSeries(baseForSeries, points);
  }, [baseForSeries, range]);

  const { min, max, avg } = useMemo(() => seriesStats(series), [series]);
  const barHeights = useMemo(() => toBarHeights(series, 80), [series]);

  /* ------------------ Mutations ------------------ */
  const [addToCollection, { loading: addingCollection }] = useMutation(
    AddToCollectionDocument
  );
  const [addToWishlist, { loading: addingWishlist }] = useMutation(
    AddToWishlistDocument
  );

  const resolvedCardId =
    (card && card.id ? String(card.id) : null) ||
    (routeId ? String(routeId) : null) ||
    (params?.cardId ? String(params.cardId) : null);

  const variation = price?.variation ? String(price.variation) : "normal";

  const handleAddToCollection = async () => {
    if (!resolvedCardId) {
      toast.show("Missing card id", { type: "error" });
      return;
    }
    try {
      await addToCollection({
        variables: {
          cardId: resolvedCardId,
          variation,
          quantity: 1,
        },
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
      await addToWishlist({
        variables: {
          cardId: resolvedCardId,
          variation,
        },
      });
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

  return (
    <View style={styles.container}>
      <CardHeader
        title={card?.name || "Card Details"}
        onBack={() => router.back()}
      />

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
          <CardImageBlock imageUri={img} />

          <InfoCard
            name={card.name}
            number={card.number}
            setName={card.setName}
            average={isNum(average) ? average : null}
            variationLabel={
              price?.variation ? String(price.variation).toUpperCase() : "—"
            }
            hideActions={hideActions}
            {...actionProps}
          />

          <PricingHistory
            range={range}
            onChangeRange={setRange}
            barHeights={barHeights}
            avg={avg}
            min={min}
            max={max}
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
