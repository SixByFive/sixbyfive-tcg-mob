// app/card/[id].js

import { useQuery } from "@apollo/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { CARD_BY_ID_ALT, CARD_BY_ID_ID, CARD_BY_ID_STRING } from "../../graphql/cardQueries";
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
  const params = useLocalSearchParams();
  const id = params.id ? String(params.id) : null;

  // CHANGED: Stage-driven “try multiple queries” approach kept.
  const [stage, setStage] = useState(0); // 0:String, 1:ID, 2:Alt
  const [range, setRange] = useState("30D"); // "7D" | "30D" | "90D" | "1Y"

  // Immediate UI from params (fallback)
  const fallback = useMemo(() => {
    let prices = [];
    try {
      prices = params.prices ? JSON.parse(params.prices) : [];
    } catch {}
    return {
      name: params.name ?? "",
      number: params.number ?? "",
      setName: params.setName ?? "",
      image: params.image ?? "",
      prices,
    };
  }, [params]);

  // Queries (in sequence)
  const q1 = useQuery(CARD_BY_ID_STRING, {
    variables: { id: id ?? "" },
    skip: !id || stage !== 0,
    onError: () => setStage(1),
  });

  const q2 = useQuery(CARD_BY_ID_ID, {
    variables: { id: id ?? "" },
    skip: !id || stage !== 1,
    onError: () => setStage(2),
  });

  const q3 = useQuery(CARD_BY_ID_ALT, {
    variables: { id: id ?? "" },
    skip: !id || stage !== 2,
  });

  const liveCard = q1.data?.card ?? q2.data?.card ?? q3.data?.cardById ?? null;
  const loading = q1.loading || q2.loading || q3.loading;
  const queryError = q1.error || q2.error || q3.error;

  // Prefer live data; fall back to params
  const card = liveCard ?? { id, ...fallback };

  const img = normalizeImageUrl(card?.image);
  const price = getBestPrice(card?.prices, "normal");

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

  return (
    <View style={styles.container}>
      <CardHeader
        title={card?.name || "Card Details"}
        onBack={() => router.back()}
      />

      {loading && !liveCard ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : queryError && !liveCard ? (
        <View style={styles.center}>
          <Text style={{ color: COLORS.error }}>
            {queryError.message || "Failed to load details"}
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
            // Example CTAs (wire up to your mutations/screens later)
            onAddToCollection={() => {}}
            onToggleWishlist={() => {}}
          />

          <PricingHistory
            range={range}
            onChangeRange={setRange}
            barHeights={barHeights}
            avg={avg}
            min={min}
            max={max}
          />

          {/* Spacer */}
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
