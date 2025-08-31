// app/(tabs)/messages.js

import { Link, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import PageHeader from "../../components/common/PageHeader";
import SwipeRow from "../../components/lists/SwipeRow";
import { COLORS } from "../../theme/colors";

const MOCK_DMS_INITIAL = [
  { id: "u1", username: "FalconChipp", last: "Got your trade offer!", unread: 2 },
  { id: "u2", username: "UnicornCards", last: "We can do £12 each.", unread: 0 },
];

const MOCK_NOTIFS_INITIAL = [
  { id: "n1", title: "Trade offer received", body: "FalconChipp offered a trade.", createdAt: "2m", unread: true },
  { id: "n2", title: "Price change", body: "Charizard (SV8 202) +12%", createdAt: "1h", unread: true },
  { id: "n3", title: "Listing sold", body: "You sold 2× Pikachu", createdAt: "3h", unread: false },
];

export default function MessagesTab() {
  const navigation = useNavigation();

  const [segment, setSegment] = useState("dms");
  const [dms, setDms] = useState(MOCK_DMS_INITIAL);
  const [notifs, setNotifs] = useState(MOCK_NOTIFS_INITIAL);
  const [refreshing, setRefreshing] = useState(false);

  const unreadDms = useMemo(() => dms.reduce((a, c) => a + (c.unread || 0), 0), [dms]);
  const unreadNotifs = useMemo(() => notifs.reduce((a, c) => a + (c.unread ? 1 : 0), 0), [notifs]);
  const unreadTotal = unreadDms + unreadNotifs;

  useEffect(() => {
    navigation.setOptions({
      tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined,
      tabBarBadgeStyle: { backgroundColor: COLORS.accent, color: "#fff" },
    });
  }, [navigation, unreadTotal]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setNotifs((prev) => {
        const idx = prev.findIndex((n) => n.unread);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], unread: false };
        return copy;
      });
      setRefreshing(false);
    }, 650);
  }, []);

  const markAllSystemRead = () => setNotifs((prev) => prev.map((n) => ({ ...n, unread: false })));
  const toggleRead = (id) => setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n)));
  const clearNotif = (id) => setNotifs((prev) => prev.filter((n) => n.id !== id));

  const data = segment === "dms" ? dms : notifs;

  return (
    <View style={styles.container}>
      <PageHeader title="Messages" subtitle="Direct chats & system updates" />

      {/* Segments */}
      <View style={styles.segments}>
        <Pressable style={[styles.segBtn, segment === "dms" && styles.active]} onPress={() => setSegment("dms")}>
          <Text style={[styles.segText, segment === "dms" && styles.activeText]}>Messages{unreadDms ? ` (${unreadDms})` : ""}</Text>
        </Pressable>
        <Pressable style={[styles.segBtn, segment === "system" && styles.active]} onPress={() => setSegment("system")}>
          <Text style={[styles.segText, segment === "system" && styles.activeText]}>System{unreadNotifs ? ` (${unreadNotifs})` : ""}</Text>
        </Pressable>
      </View>

      {/* Toolbar when System is active */}
      {segment === "system" && (
        <View style={styles.toolbar}>
          <Pressable onPress={markAllSystemRead} style={({ pressed }) => [styles.toolbarBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={styles.toolbarText}>Mark all read</Text>
          </Pressable>
        </View>
      )}

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.textMuted}
            colors={[COLORS.accent]}
            progressBackgroundColor={COLORS.surface}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{segment === "dms" ? "No conversations yet" : "No notifications"}</Text>
            <Text style={styles.emptyBody}>
              {segment === "dms"
                ? "Start a trade or message a seller to begin a conversation."
                : "You’ll see system updates here: trades, sales, price changes."}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          segment === "dms" ? (
            <Link href={`/messages/${item.id}`} asChild>
              <Pressable style={styles.row}>
                <View style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.username}</Text>
                  <Text style={styles.last} numberOfLines={1}>{item.last}</Text>
                </View>
                {item.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread}</Text>
                  </View>
                )}
              </Pressable>
            </Link>
          ) : (
            // custom swipe row 
            <SwipeRow
              rightActions={[
                {
                  label: item.unread ? "Mark read" : "Mark unread",
                  type: "primary",
                  onPress: () => toggleRead(item.id),
                },
                {
                  label: "Clear",
                  type: "danger",
                  onPress: () => clearNotif(item.id),
                },
              ]}
            >
              <View style={[styles.notifCard, item.unread && styles.unreadCard]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>{item.createdAt}</Text>
                </View>
                <Text style={styles.cardBody}>{item.body}</Text>
              </View>
            </SwipeRow>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  segments: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  segBtn: { flex: 1, padding: 12, alignItems: "center" },
  segText: { color: COLORS.textMuted, fontWeight: "700" },
  active: { backgroundColor: COLORS.accent },
  activeText: { color: "#fff" },

  toolbar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 0, alignItems: "flex-end" },
  toolbarBtn: { backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderColor: COLORS.border, borderWidth: 1 },
  toolbarText: { color: COLORS.text, fontWeight: "800" },

  // DMs
  row: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.alt, marginRight: 12 },
  name: { color: COLORS.text, fontWeight: "800" },
  last: { color: COLORS.textMuted, marginTop: 2 },
  badge: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  badgeText: { color: "#fff", fontWeight: "800" },

  // System
  notifCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  unreadCard: { borderColor: COLORS.accent, borderWidth: 1.5 },
  cardTitle: { color: COLORS.text, fontWeight: "800" },
  cardBody: { color: COLORS.textSecondary, marginTop: 6 },
  cardMeta: { color: COLORS.textMuted, fontSize: 12, marginLeft: 12 },

  // Empty
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  emptyBody: { color: COLORS.textMuted, textAlign: "center", paddingHorizontal: 24 },
});
