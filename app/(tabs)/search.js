// app/(tabs)/search.js
import { useLazyQuery } from "@apollo/client";
import { SearchCardsDocument } from "@sixbyfive/tcg-binder";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const COLORS = {
  background: "#16171c",
  surface: "#191a20",
  alt: "#23243c",
  text: "#f7f8fa",
  textSecondary: "#b9bedd",
  textMuted: "#8f98bc",
  border: "#31365e",
  accent: "#2963FF",
  accentLight: "#548dff",
  error: "#ff6b6b",
};

const PER_PAGE = 25;

/** Ensure TCGDex card image ends with /high.webp */
function normalizeImageUrl(url) {
  if (!url) return null;
  if (url.endsWith("/high.webp")) return url;
  return `${url}/high.webp`;
}

// Prefer "normal", fall back to first with any price.
function getBestPrice(prices, prefer = "normal") {
  if (!Array.isArray(prices))
    return { tcgplayer: null, cardmarket: null, variation: null };
  const preferred = prices.find((p) => p.variation === prefer);
  if (preferred) return preferred;
  const any = prices.find(
    (p) =>
      (p.tcgplayer != null && !isNaN(p.tcgplayer)) ||
      (p.cardmarket != null && !isNaN(p.cardmarket))
  );
  return any || { tcgplayer: null, cardmarket: null, variation: null };
}

function calcAverage(a, b) {
  const aOk = typeof a === "number" && !isNaN(a);
  const bOk = typeof b === "number" && !isNaN(b);
  if (aOk && bOk) return (a + b) / 2;
  if (aOk) return a;
  if (bOk) return b;
  return null;
}

/** One pill with the average; tiny source chips below for context */
function AvgPriceBlock({ tcgp, cmkt }) {
  const avg = calcAverage(tcgp, cmkt);
  return (
    <View>
      <View style={styles.avgPill}>
        <Text style={styles.avgLabel}>AVG</Text>
        <Text style={styles.avgValue}>
          {avg != null ? `£${avg.toFixed(2)}` : "—"}
        </Text>
      </View>

      {/* <View style={styles.avgSources}>
        <View style={styles.sourceChip}>
          <Text style={styles.sourceChipLabel}>TCGP</Text>
          <Text style={styles.sourceChipValue}>
            {tcgp != null ? `£${tcgp.toFixed(2)}` : "—"}
          </Text>
        </View>
        <View style={styles.sourceChip}>
          <Text style={styles.sourceChipLabel}>CMKT</Text>
          <Text style={styles.sourceChipValue}>
            {cmkt != null ? `£${cmkt.toFixed(2)}` : "—"}
          </Text>
        </View>
      </View> */}
    </View>
  );
}

function CardTile({ item, onPress }) {
  const price = getBestPrice(item?.prices, "normal");
  const imageUri = normalizeImageUrl(item?.image);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardImageWrap}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.cardImage}
            resizeMode="contain"
          />
        ) : null}
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item?.name || "—"}
        </Text>

        <View style={styles.rowBetween}>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {item?.setName || "—"}
          </Text>
          <Text style={styles.cardMetaStrong}>#{item?.number ?? "—"}</Text>
        </View>

        {/* Average price block */}
        <View style={{ marginTop: 8 }}>
          <AvgPriceBlock tcgp={price.tcgplayer} cmkt={price.cardmarket} />
        </View>
      </View>
    </Pressable>
  );
}

export default function SearchTab() {
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(false);

  const isExactCardSearch = useMemo(
    () => Boolean(setCode && number),
    [setCode, number]
  );
  const canSearch = useMemo(
    () =>
      name.trim().length > 0 ||
      setCode.trim().length > 0 ||
      number.trim().length > 0,
    [name, setCode, number]
  );

  const [runSearch, { data, loading, error, fetchMore, called }] =
    useLazyQuery(SearchCardsDocument, { notifyOnNetworkStatusChange: true });

  const results = data?.searchCards?.cards ?? [];

  const onSearch = () => {
    if (!canSearch) return;
    Keyboard.dismiss();
    pageRef.current = 1;
    setHasMore(false);
    runSearch({
      variables: {
        input: {
          name: name.trim() || null,
          set: setCode.trim() || null,
          number: number.trim() || null,
          page: 1,
          pageSize: PER_PAGE,
        },
      },
      onCompleted: (res) => {
        const count = res?.searchCards?.cards?.length ?? 0;
        setHasMore(count === PER_PAGE && !isExactCardSearch);
      },
    });
  };

  const loadMore = async () => {
    if (!hasMore || loading || !called) return;
    const nextPage = pageRef.current + 1;
    await fetchMore({
      variables: {
        input: {
          name: name.trim() || null,
          set: setCode.trim() || null,
          number: number.trim() || null,
          page: nextPage,
          pageSize: PER_PAGE,
        },
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        const nextCards = fetchMoreResult?.searchCards?.cards ?? [];
        const merged = [...(prev?.searchCards?.cards ?? []), ...nextCards];
        const nextHasMore =
          nextCards.length === PER_PAGE && !isExactCardSearch;
        setHasMore(nextHasMore);
        pageRef.current = nextPage;
        return {
          searchCards: { ...fetchMoreResult.searchCards, cards: merged },
        };
      },
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Pokémon Card Search</Text>
        <Text style={styles.pageSubtitle}>
          Search for any Pokémon card and add it to your collection
        </Text>
      </View>

      {/* Search Card */}
      <View style={styles.searchCard}>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Text style={styles.label}>Card Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pikachu"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={onSearch}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.label}>Set</Text>
            <TextInput
              value={setCode}
              onChangeText={setSetCode}
              placeholder="e.g. SSP"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
              style={styles.input}
              returnKeyType="next"
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.label}>Number</Text>
            <TextInput
              value={number}
              onChangeText={setNumber}
              placeholder="e.g. 201"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={onSearch}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Pressable
          onPress={onSearch}
          disabled={!canSearch || loading}
          style={({ pressed }) => [
            styles.searchBtn,
            (!canSearch || loading) && { opacity: 0.7 },
            pressed && { transform: [{ translateY: 1 }] },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Search</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
      </View>

      {/* Results */}
      <FlatList
        contentContainerStyle={styles.listContent}
        data={results}
        keyExtractor={(item, idx) => item?.id ?? `${idx}`}
        numColumns={2}
        columnWrapperStyle={styles.column}
        renderItem={({ item }) => <CardTile item={item} onPress={() => {}} />}
        ListEmptyComponent={
          !loading && called ? (
            <Text style={styles.emptyText}>
              No results found. Try different filters.
            </Text>
          ) : null
        }
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={styles.footerLoadingText}>Loading more…</Text>
            </View>
          ) : null
        }
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  pageHeader: { paddingHorizontal: 16, paddingTop: 25, paddingBottom: 6 },
  pageTitle: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  pageSubtitle: { color: COLORS.textMuted, marginTop: 4, fontSize: 13.5 },

  searchCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 8,
    padding: 12,
    paddingBottom: 10,
    borderRadius: 16,
  },
  formRow: { flexDirection: "row", gap: 8 },
  formField: { flex: 1 },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  searchBtn: {
    marginTop: 10,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
  },
  searchBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  errorText: { marginTop: 10, color: COLORS.error },

  listContent: { paddingHorizontal: 6, paddingBottom: 20 },
  column: { gap: 4 },

  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    margin: 6,
    overflow: "hidden",
  },
  cardImageWrap: {
    backgroundColor: COLORS.alt,
    aspectRatio: 245 / 337,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardImage: { ...StyleSheet.absoluteFillObject },

  cardInfo: { padding: 8 },
  cardName: { color: COLORS.text, fontSize: 14.5, fontWeight: "700" },
  rowBetween: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMeta: { color: COLORS.textMuted, fontSize: 12, flexShrink: 1, marginRight: 8 },
  cardMetaStrong: { color: COLORS.text, fontSize: 12, fontWeight: "700" },

  /** Average pill + sources **/
  avgPill: {
    width: "100%",
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avgLabel: {
    color: COLORS.accentLight,
    fontSize: 12,
    fontWeight: "800",
  },
  avgValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  avgSources: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
  },
  sourceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sourceChipLabel: {
    color: COLORS.accentLight,
    fontSize: 11,
    fontWeight: "800",
  },
  sourceChipValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  emptyText: { color: COLORS.textMuted, textAlign: "center", marginTop: 24 },
  footerLoading: { paddingVertical: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  footerLoadingText: { color: COLORS.textMuted, fontSize: 12 },
});
