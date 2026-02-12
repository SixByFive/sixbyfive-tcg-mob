// app/(tabs)/messages.js
//
// UPDATED (2026-02-12)
//
// CHANGES:
// - REMOVED: Hard-coded MOCK_NOTIFS_INITIAL defaults (no fake system notifications)
// - CHANGED: System notifications state now starts as an empty array []
// - ADDED: Safe empty state UI for System tab when there are no notifications
// - CHANGED: "Mark all read" is disabled when System tab is empty
// - GUARDED: toggleRead/clearNotif so they safely no-op if an id is missing
// - KEPT: System tab segment, SwipeRow, and the UI structure (ready for real backend data later)

import { Link, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import PageHeader from "../../components/common/PageHeader";
import SwipeRow from "../../components/lists/SwipeRow";
import { COLORS } from "../../theme/colors";

import { useFocusEffect } from "@react-navigation/native";
import ChatSafetyGate from "../../components/messenger/ChatSafetyGate";
import NewMessageModal from "../../components/messenger/NewMessageModal";
import { useMessaging } from "../contexts/MessengerContext";

/* -------------------------
   Helpers
------------------------- */

function safeString(v) {
  return String(v ?? "").trim();
}

function shortPreview(text) {
  const t = safeString(text);
  if (!t) return "No messages yet";
  return t.replace(/\s+/g, " ");
}

function getRowUserId(row) {
  return row?.user?.id || row?.userId || row?.id || null;
}

function getRowUsername(row) {
  return row?.user?.username || row?.username || "User";
}

function getRowAvatarUrl(row) {
  return row?.user?.avatar || row?.avatar || row?.user?.avatarUrl || null;
}

function getRowPreview(row) {
  return row?.lastMessage?.content || row?.lastMessage || row?.preview || "";
}

function getRowUnread(row) {
  const n = Number(row?.unreadCount || 0);
  return Number.isFinite(n) ? n : 0;
}

export default function MessagesTab() {
  const navigation = useNavigation();
  const router = useRouter();

  const [segment, setSegment] = useState("dms");
  const [query, setQuery] = useState("");

  // ✅ Start empty — no hard-coded defaults
  const [notifs, setNotifs] = useState([]);

  const [refreshing, setRefreshing] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);

  const { chats, unreadCount, refreshChats, refreshUnread } = useMessaging();

  const renderHeader = useCallback(
    () => (
      <PageHeader title="Messages" subtitle="Direct chats & system updates" />
    ),
    [],
  );

  const unreadNotifs = useMemo(() => {
    const list = Array.isArray(notifs) ? notifs : [];
    return list.reduce((a, c) => a + (c?.unread ? 1 : 0), 0);
  }, [notifs]);

  const unreadTotal = Number(unreadCount || 0) + unreadNotifs;

  useEffect(() => {
    navigation.setOptions({
      tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined,
      tabBarBadgeStyle: { backgroundColor: COLORS.accent, color: "#fff" },
    });
  }, [navigation, unreadTotal]);

  useEffect(() => {
    refreshChats?.();
    refreshUnread?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshChats?.();
      refreshUnread?.();
    }, [refreshChats, refreshUnread]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.allSettled([refreshChats?.(), refreshUnread?.()]).finally(() => {
      setTimeout(() => setRefreshing(false), 250);
    });
  }, [refreshChats, refreshUnread]);

  const markAllSystemRead = useCallback(() => {
    setNotifs((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      if (!list.length) return list; // ✅ safe no-op when empty
      return list.map((n) => ({ ...n, unread: false }));
    });
  }, []);

  const toggleRead = useCallback((id) => {
    if (!id) return; // ✅ safe guard
    setNotifs((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((n) => (n?.id === id ? { ...n, unread: !n.unread } : n));
    });
  }, []);

  const clearNotif = useCallback((id) => {
    if (!id) return; // ✅ safe guard
    setNotifs((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.filter((n) => n?.id !== id);
    });
  }, []);

  const filteredChats = useMemo(() => {
    const q = safeString(query).toLowerCase();
    const list = Array.isArray(chats) ? chats : [];
    if (!q) return list;

    return list.filter((row) => {
      const name = safeString(getRowUsername(row)).toLowerCase();
      const preview = safeString(getRowPreview(row)).toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [chats, query]);

  const data = segment === "dms" ? filteredChats : notifs;

  const isSystemEmpty =
    segment === "system" && (!Array.isArray(notifs) || notifs.length === 0);

  // Recent users for modal (deduped)
  const recentUsers = useMemo(() => {
    const list = Array.isArray(chats) ? chats : [];

    const mapped = list
      .map((row) => {
        const id = getRowUserId(row);
        if (!id) return null;
        return {
          id: String(id),
          username: getRowUsername(row),
          avatarUrl: getRowAvatarUrl(row) || undefined,
          preview: getRowPreview(row),
          _source: "recent",
        };
      })
      .filter(Boolean);

    const seen = new Set();
    const out = [];
    for (const u of mapped) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      out.push(u);
    }
    return out.slice(0, 12);
  }, [chats]);

  const openNewMessageModal = useCallback(() => {
    console.log("[messages] open new message modal");
    setNewModalOpen(true);
  }, []);

  const closeNewMessageModal = useCallback(() => {
    console.log("[messages] close new message modal");
    setNewModalOpen(false);
  }, []);

  const handleSelectUser = useCallback(
    (user) => {
      const id = user?.id ? String(user.id) : null;
      if (!id) return;

      console.log("[messages] start chat with:", {
        id,
        username: user?.username,
      });

      setNewModalOpen(false);

      router.push({
        pathname: `/messages/${id}`,
        params: {
          username: user?.username || "",
          avatarUrl: user?.avatarUrl || "",
        },
      });
    },
    [router],
  );

  return (
    <ChatSafetyGate renderHeader={renderHeader}>
      <View style={styles.container}>
        <PageHeader title="Messages" subtitle="Direct chats & system updates" />

        {/* Search */}
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search conversations…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Segments */}
        <View style={styles.segments}>
          <Pressable
            style={[styles.segBtn, segment === "dms" && styles.active]}
            onPress={() => setSegment("dms")}
          >
            <Text
              style={[styles.segText, segment === "dms" && styles.activeText]}
            >
              Messages{unreadCount ? ` (${unreadCount})` : ""}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segBtn, segment === "system" && styles.active]}
            onPress={() => setSegment("system")}
          >
            <Text
              style={[
                styles.segText,
                segment === "system" && styles.activeText,
              ]}
            >
              System{unreadNotifs ? ` (${unreadNotifs})` : ""}
            </Text>
          </Pressable>
        </View>

        {/* System toolbar */}
        {segment === "system" && (
          <View style={styles.toolbar}>
            <Pressable
              onPress={markAllSystemRead}
              style={({ pressed }) => [
                styles.toolbarBtn,
                isSystemEmpty && styles.toolbarBtnDisabled,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              disabled={isSystemEmpty}
            >
              <Text
                style={[
                  styles.toolbarText,
                  isSystemEmpty && styles.toolbarTextDisabled,
                ]}
              >
                Mark all read
              </Text>
            </Pressable>
          </View>
        )}

        {/* Empty state for System */}
        {isSystemEmpty ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No system updates yet</Text>
            <Text style={styles.emptyBody}>
              When something important happens (trades, marketplace, account
              alerts), you’ll see it here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(i, idx) =>
              segment === "dms"
                ? String(getRowUserId(i) ?? idx)
                : String(i?.id ?? idx)
            }
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 120,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.textMuted}
                colors={[COLORS.accent]}
                progressBackgroundColor={COLORS.surface}
              />
            }
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) =>
              segment === "dms" ? (
                <Link href={`/messages/${getRowUserId(item)}`} asChild>
                  <Pressable style={styles.dmRow}>
                    <View style={styles.avatar} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.dmName} numberOfLines={1}>
                        {getRowUsername(item)}
                      </Text>
                      <Text style={styles.dmPreview} numberOfLines={1}>
                        {shortPreview(getRowPreview(item))}
                      </Text>
                    </View>
                    {getRowUnread(item) > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {getRowUnread(item) > 99
                            ? "99+"
                            : String(getRowUnread(item))}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                </Link>
              ) : (
                <SwipeRow
                  rightActions={[
                    {
                      label: item?.unread ? "Mark read" : "Mark unread",
                      type: "primary",
                      onPress: () => toggleRead(item?.id),
                    },
                    {
                      label: "Clear",
                      type: "danger",
                      onPress: () => clearNotif(item?.id),
                    },
                  ]}
                >
                  <View style={styles.notifCard}>
                    <Text style={styles.cardTitle}>{item?.title}</Text>
                    <Text style={styles.cardBody}>{item?.body}</Text>
                  </View>
                </SwipeRow>
              )
            }
          />
        )}

        {/* FAB */}
        <Pressable
          onPress={openNewMessageModal}
          style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.fabText}>＋ New</Text>
        </Pressable>

        {/* Modal */}
        <NewMessageModal
          visible={newModalOpen}
          onClose={closeNewMessageModal}
          onSelectUser={handleSelectUser}
          recentUsers={recentUsers}
        />
      </View>
    </ChatSafetyGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  searchWrap: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: "center",
  },
  searchInput: {
    color: COLORS.text,
    fontWeight: "700",
  },

  segments: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segText: { color: COLORS.textMuted, fontWeight: "800" },
  active: { backgroundColor: COLORS.accent },
  activeText: { color: "#fff" },

  toolbar: { alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 10 },
  toolbarBtn: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  toolbarBtnDisabled: {
    opacity: 0.6,
  },
  toolbarText: { color: COLORS.text, fontWeight: "800" },
  toolbarTextDisabled: { color: COLORS.textMuted },

  dmRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.alt,
  },
  dmName: { color: COLORS.text, fontWeight: "900" },
  dmPreview: { color: COLORS.textSecondary, marginTop: 3 },

  badge: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  notifCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontWeight: "900" },
  cardBody: { color: COLORS.textSecondary, marginTop: 6 },

  emptyWrap: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  emptyBody: { color: COLORS.textSecondary, marginTop: 8, lineHeight: 20 },

  fab: {
    position: "absolute",
    right: 16,
    bottom: 18,
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  fabText: { color: "#fff", fontWeight: "900" },
});
