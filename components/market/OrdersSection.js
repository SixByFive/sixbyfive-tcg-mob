// components/market/OrdersSection.js
import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import EmptyState from "../common/EmptyState";
import OrderRow from "./OrderRow";
import OrderDetailSheet from "./OrderDetailSheet";
import { MyOrdersDocument } from "../../graphql/documents";

const TABS = [
  { key: "buyer",  label: "Buying" },
  { key: "seller", label: "Selling" },
];

export default function OrdersSection({ myUserId }) {
  const [tab, setTab] = useState("buyer");
  const [selectedOrder, setSelectedOrder] = useState(null);

  const { data, loading, refetch } = useQuery(MyOrdersDocument, {
    variables: { role: tab, limit: 50 },
    fetchPolicy: "cache-and-network",
  });

  const orders = data?.myOrders ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabRow}>
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading && orders.length === 0}
            onRefresh={refetch}
            tintColor={COLORS.accent}
          />
        }
        renderItem={({ item }) => (
          <OrderRow order={item} myUserId={myUserId} onPress={() => setSelectedOrder(item)} />
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              message={
                tab === "buyer"
                  ? "You haven't bought anything yet."
                  : "You haven't sold anything yet."
              }
            />
          )
        }
      />

      <OrderDetailSheet
        order={selectedOrder}
        myUserId={myUserId}
        visible={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onRefresh={refetch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  tabActive: { backgroundColor: COLORS.alt },
  tabText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: COLORS.text },
  list: { paddingBottom: 40 },
});
