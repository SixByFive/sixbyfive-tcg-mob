// components/profile/tabs/ProfileListingsTab.js
//
// Shows a user's active marketplace listings on their public profile.
// 2-column grid matching the Browse tab layout. Tap → ListingDetailSheet.

import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@apollo/client";
import { COLORS } from "../../../theme/colors";
import { PublicListingsDocument } from "../../../graphql/documents";
import ListingRow from "../../market/ListingRow";
import ListingDetailSheet from "../../market/ListingDetailSheet";

export default function ProfileListingsTab({ userId, username }) {
  const [selected, setSelected] = useState(null);

  const { data, loading, error, refetch } = useQuery(PublicListingsDocument, {
    variables: { sellerId: userId, limit: 60 },
    fetchPolicy: "cache-and-network",
    skip: !userId,
  });

  // listings query returns ListingBase union — filter to CardListing via __typename or id presence
  const listings = (data?.listings ?? []).filter((l) => l?.cardInfo);

  if (loading && !listings.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {username ? `${username}'s Listings` : "Listings"}
        </Text>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="small" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Listings</Text>
        <Text style={styles.emptyText}>Failed to load listings.</Text>
        <Text onPress={() => refetch()} style={styles.retry}>Retry</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>
          {username ? `${username}'s Listings` : "Listings"}
        </Text>
        {listings.length > 0 && (
          <Text style={styles.countPill}>{listings.length}</Text>
        )}
      </View>

      {listings.length === 0 ? (
        <Text style={styles.emptyText}>No active listings.</Text>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(it) => it.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <ListingRow item={item} onPress={() => setSelected(item)} />
          )}
        />
      )}

      <ListingDetailSheet
        listing={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 10,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
  countPill: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: COLORS.alt,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  center: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 16 },
  retry: { color: COLORS.accent, fontWeight: "700", textAlign: "center", paddingBottom: 8 },
  grid: { gap: 0 },
  gridRow: { gap: 10, marginBottom: 10 },
});
