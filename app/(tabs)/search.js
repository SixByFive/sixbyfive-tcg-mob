// app/(tabs)/search.js

import { useLazyQuery } from "@apollo/client";
import { SearchCardsDocument } from "@sixbyfive/tcg-binder";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import EmptyState from "../../components/common/EmptyState";
import CardTile from "../../components/search/CardTile";
import SearchForm from "../../components/search/SearchForm";
import SearchHeader from "../../components/search/SearchHeader";
import { PER_PAGE } from "../../constants/pagination";
import { COLORS } from "../../theme/colors";

export default function SearchTab() {
  const router = useRouter();

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
        const nextHasMore = nextCards.length === PER_PAGE && !isExactCardSearch;
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
      <SearchHeader
        title="Pokémon Card Search"
        subtitle="Search for any Pokémon card and add it to your collection"
      />

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

      <FlatList
        contentContainerStyle={styles.listContent}
        data={results}
        keyExtractor={(item, idx) => (item?.id ? String(item.id) : `${idx}`)}
        numColumns={2}
        columnWrapperStyle={styles.column}
        renderItem={({ item }) => (
          <CardTile
            item={item}
            onPress={() =>
              router.push({
                pathname: `/card/${item.id}`,
                params: {
                  id: String(item.id),
                  name: item.name ?? "",
                  number: String(item.number ?? ""),
                  setName: item.setName ?? "",
                  image: item.image ?? "",
                  prices: JSON.stringify(item.prices ?? []),
                },
              })
            }
          />
        )}
        ListEmptyComponent={
          !loading && called ? (
            <EmptyState message="No results found. Try different filters." />
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
  listContent: { paddingHorizontal: 6, paddingBottom: 20 },
  column: { gap: 4 },
  footerLoading: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerLoadingText: { color: COLORS.textMuted, fontSize: 12 },
});
