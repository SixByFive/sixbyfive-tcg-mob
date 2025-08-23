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

// Prefer "normal", fall back to first with any price.
function getBestPrice(prices, prefer = "normal") {
  if (!Array.isArray(prices)) return { tcgplayer: null, cardmarket: null, variation: null };
  const preferred = prices.find((p) => p.variation === prefer);
  if (preferred) return preferred;
  const any = prices.find(
    (p) =>
      (p.tcgplayer != null && !isNaN(p.tcgplayer)) ||
      (p.cardmarket != null && !isNaN(p.cardmarket))
  );
  return any || { tcgplayer: null, cardmarket: null, variation: null };
}

function CardTile({ item, onPress }) {
  const price = getBestPrice(item?.prices, "normal");
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardImageWrap}>
        {!!item?.image && (
          <Image
            source={{ uri: item.image }}
            style={styles.cardImage}          // <- fills the box
            resizeMode="contain"              // <- fit like web object-contain
          />
        )}
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

        <View style={styles.priceRow}> 
          <View style={styles.pricePill}>
            <Text style={styles.priceLabel}>TCGP</Text>
            <Text style={styles.priceValue}>
              {price.tcgplayer != null ? `£${price.tcgplayer.toFixed(2)}` : "—"}
            </Text>
          </View>
          <View style={styles.pricePill}>
            <Text style={styles.priceLabel}>CMKT</Text>
            <Text style={styles.priceValue}>
              {price.cardmarket != null ? `£${price.cardmarket.toFixed(2)}` : "—"}
            </Text>
          </View>
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

  const isExactCardSearch = useMemo(() => Boolean(setCode && number), [setCode, number]);
  const canSearch = useMemo(
    () => name.trim().length > 0 || setCode.trim().length > 0 || number.trim().length > 0,
    [name, setCode, number]
  );

  const [runSearch, { data, loading, error, fetchMore, called }] = useLazyQuery(
    SearchCardsDocument,
    { notifyOnNetworkStatusChange: true }
  );

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
        const merged = [
          ...(prev?.searchCards?.cards ?? []),
          ...nextCards,
        ];
        const nextHasMore = nextCards.length === PER_PAGE && !isExactCardSearch;
        setHasMore(nextHasMore);
        pageRef.current = nextPage;
        return {
          searchCards: {
            ...fetchMoreResult.searchCards,
            cards: merged,
          },
        };
      },
    });
  };

  return (
    <View style={styles.container}>
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
        renderItem={({ item }) => (
          <CardTile item={item} onPress={() => { /* navigate to details later */ }} />
        )}
        ListEmptyComponent={
          !loading && called ? (
            <Text style={styles.emptyText}>No results found. Try different filters.</Text>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /** Search card **/
  searchCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    margin: 12,
    marginBottom: 8,
    padding: 12,
    paddingBottom: 10,
    borderRadius: 16,
  },
  formRow: {
    flexDirection: "row",
    gap: 8,
  },
  formField: {
    flex: 1,
  },
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
  searchBtnText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  errorText: {
    marginTop: 10,
    color: COLORS.error,
  },

  /** List **/
  listContent: {
    paddingHorizontal: 6,
    paddingBottom: 20,
  },
  column: {
    gap: 4,
  },

  /** Card tile **/
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
    position: "relative", // required for absolute-fill image
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject, // fill the aspect box
  },
  cardInfo: {
    padding: 8,
  },
  cardName: {
    color: COLORS.text,
    fontSize: 14.5,
    fontWeight: "700",
  },
  rowBetween: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    flexShrink: 1,
    marginRight: 8,
  },
  cardMetaStrong: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },

  /** Prices **/
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",   // allow wrapping
    gap: 8,
    marginTop: 6,
  },
  pricePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexShrink: 1,      // shrink when tight
  },
  priceLabel: {
    color: COLORS.accentLight,
    fontSize: 10.5,
    fontWeight: "800",
  },
  priceValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },

  /** Empty / footer **/
  emptyText: {
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 24,
  },
  footerLoading: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerLoadingText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
