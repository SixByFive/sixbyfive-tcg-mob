// app/card/[id].js
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

export default function CardDetailsScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams();
  const routeId = params.id ? String(params.id) : null;

  const [range, setRange] = useState("30D"); // "7D" | "30D" | "90D" | "1Y"
  const hideActions =
    params?.hideActions === "1" ||
    params?.hideActions === 1 ||
    params?.hideActions === true;

  // Immediate UI from params (fallback)
  const fallback = useMemo(() => {
    // accept either `prices` or `pricing` from params
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
      prices, // ensures downstream code always sees `prices`
    };
  }, [params]);

  // Query the live card
  const { data, loading, error } = useQuery(CARD_BY_ID, {
    variables: { id: routeId ?? "" },
    skip: !routeId,
    fetchPolicy: "cache-first",
  });

  // Prefer live; fall back to nav params
  const rawCard = data?.card ?? { id: routeId, ...fallback };

  // Normalize prices/pricing -> prices so downstream code is stable
  const card = useMemo(() => {
    const prices = Array.isArray(rawCard?.prices)
      ? rawCard.prices
      : Array.isArray(rawCard?.pricing)
      ? rawCard.pricing
      : [];
    return { ...rawCard, prices };
  }, [rawCard]);

  const img = normalizeImageUrl(card?.image);

  // pick most-recent priced variation
  const price = useMemo(() => getBestPrice(card, { strategy: "recent" }), [card]);

  // Average across TCGP + CMKT
  const average = useMemo(() => {
    const vals = [price.tcgplayer, price.cardmarket].filter(
      (n) => typeof n === "number" && !Number.isNaN(n)
    );
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Number.isFinite(avg) ? avg : null;
  }, [price]);

  // ----- Placeholder pricing series -----
  const baseForSeries =
    (typeof average === "number" && average) ||
    (typeof price.tcgplayer === "number" && price.tcgplayer) ||
    (typeof price.cardmarket === "number" && price.cardmarket) ||
    10;

  const series = useMemo(() => {
    const points = TIMEFRAME_POINTS[range] ?? 30;
    return makePlaceholderSeries(baseForSeries, points);
  }, [baseForSeries, range]);

  const { min, max, avg } = useMemo(() => seriesStats(series), [series]);
  const barHeights = useMemo(() => toBarHeights(series, 80), [series]); // 80px chart area

  /* ------------------ Mutations (add to collection / wishlist) ------------------ */
  const [addToCollection, { loading: addingCollection }] = useMutation(
    AddToCollectionDocument
  );
  const [addToWishlist, { loading: addingWishlist }] = useMutation(
    AddToWishlistDocument
  );

  // Resolve a valid cardId from multiple sources
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

  // Only include action handlers when actions are visible
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
            tcgp={price.tcgplayer}
            cmkt={price.cardmarket}
            average={average}
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
