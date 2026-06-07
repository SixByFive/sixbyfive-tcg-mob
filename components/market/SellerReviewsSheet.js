// components/market/SellerReviewsSheet.js
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApolloClient } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import SellerTierBadge from "./SellerTierBadge";
import { SellerReviewsDocument } from "../../graphql/documents";

const PAGE_SIZE = 15;

function Stars({ rating }) {
  return (
    <Text style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={{ color: n <= rating ? "#f59e0b" : COLORS.border }}>★</Text>
      ))}
    </Text>
  );
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function SellerReviewsSheet({ sellerId, sellerUsername, visible, onClose }) {
  const insets = useSafeAreaInsets();
  const client = useApolloClient();

  const [reputation, setReputation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (off, reset = false) => {
    if (!sellerId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.query({
        query: SellerReviewsDocument,
        variables: { userId: sellerId, limit: PAGE_SIZE, offset: off },
        fetchPolicy: "cache-and-network",
      });
      if (reset) {
        setReputation(data?.sellerReputation ?? null);
        setReviews(data?.sellerReviews ?? []);
      } else {
        setReviews((prev) => [...prev, ...(data?.sellerReviews ?? [])]);
      }
      setHasMore((data?.sellerReviews ?? []).length === PAGE_SIZE);
      setOffset(off + PAGE_SIZE);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sellerId, client]);

  useEffect(() => {
    if (visible && sellerId) {
      setOffset(0);
      setReviews([]);
      setHasMore(true);
      load(0, true);
    }
  }, [visible, sellerId]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadMore() {
    if (!loading && hasMore) load(offset);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {sellerUsername ? `${sellerUsername}'s reviews` : "Seller reviews"}
            </Text>
            {reputation && (
              <Text style={styles.subtitle}>
                {reputation.completedMarketplace ?? 0} sales completed
              </Text>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        {/* Tier card */}
        {reputation && (
          <View style={styles.tierWrap}>
            <SellerTierBadge reputation={reputation} size="lg" />
          </View>
        )}

        {error && (
          <Text style={styles.errText}>{error}</Text>
        )}

        <FlatList
          data={reviews}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.emptyText}>No reviews yet.</Text>
            ) : null
          }
          ListFooterComponent={
            loading ? <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 16 }} /> :
            hasMore ? (
              <Pressable onPress={loadMore} style={styles.loadMoreBtn}>
                <Text style={styles.loadMoreText}>Load more</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Stars rating={item.rating} />
                <Text style={styles.reviewDate}>{fmtDate(item.createdAt)}</Text>
              </View>
              {item.review ? (
                <Text style={styles.reviewText}>{item.review}</Text>
              ) : null}
              {item.cardId && (
                <Text style={styles.reviewCard2}>Card: {item.cardId}</Text>
              )}
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
  subtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  doneText: { color: COLORS.accent, fontWeight: "600", fontSize: 15 },

  tierWrap: { padding: 14, paddingBottom: 0 },

  listContent: { padding: 14, gap: 10 },
  emptyText: { color: COLORS.textMuted, textAlign: "center", marginTop: 24 },
  errText: { color: COLORS.error, padding: 16, textAlign: "center" },

  reviewCard: {
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stars: { fontSize: 16, letterSpacing: 1 },
  reviewDate: { color: COLORS.textMuted, fontSize: 11 },
  reviewText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  reviewCard2: { color: COLORS.textMuted, fontSize: 11 },

  loadMoreBtn: { alignItems: "center", paddingVertical: 12 },
  loadMoreText: { color: COLORS.accent, fontWeight: "600" },
});
