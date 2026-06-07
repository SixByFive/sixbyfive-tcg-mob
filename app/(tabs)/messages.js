// app/(tabs)/messages.js
//
// UPDATED (2026-02-13)
//
// CHANGES:
// - REMOVE: Placeholder <View style={styles.avatar} />
// - ADD: Use shared <Avatar /> component so profile images load like ProfileTopCard.
// - ADD: Debug log for row avatar + resolved avatar URL.
// - KEEP: Existing routing + params (avatarUrl still passed as param here; we can rename later).
//
// NOTE:
// - Your backend must return ChatSummary.user.avatar as either:
//   - "/uploads/avatars/....png"   (recommended)
//   - OR full https URL
// - Avatar component will normalize based on EXPO_PUBLIC_ASSET_BASE_URL

import { useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  MyNotificationsDocument,
  MarkNotificationReadDocument,
  MarkAllNotificationsReadDocument,
  DismissNotificationDocument,
} from "../../graphql/documents";
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
import { COLORS } from "../../theme/colors";

import { useFocusEffect } from "@react-navigation/native";
import ChatSafetyGate from "../../components/messenger/ChatSafetyGate";
import NewMessageModal from "../../components/messenger/NewMessageModal";
import { useMessaging } from "../contexts/MessengerContext";

// ✅ NEW: use shared Avatar component (same as profile)
import Avatar from "../../components/common/Avatar";

// ✅ NEW: base URL for resolving "/uploads/..."
const ASSET_BASE_URL =
  process.env.EXPO_PUBLIC_ASSET_BASE_URL || "https://backendtcg.sixbyfive.com";

/* -------------------------
   Notification helpers
------------------------- */

const NOTIF_ICONS = {
  message:     "💬",
  trade:       "↕️",
  order:       "📦",
  offer:       "🏷️",
  price_alert: "🔔",
  system:      "📢",
  broadcast:   "📣",
};
function iconFor(type) {
  return NOTIF_ICONS[type] ?? "🔔";
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

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

// ✅ NEW: basic UUID v4-ish validation (enough to catch obvious wrong ids)
function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || ""),
  );
}

/**
 * ✅ NEW: pick the *users table id* from various possible shapes.
 * We DO NOT navigate unless we can find a valid UUID.
 */
function pickUsersTableId(obj) {
  const candidates = [
    obj?.id, // ideal: User.id
    obj?.user?.id, // if wrapped
    obj?.userId, // some list shapes
    obj?.user_id, // snake case
    obj?.profile?.userId,
    obj?.profile?.user_id,
  ].filter(Boolean);

  const uuid = candidates.find((c) => isUuid(c));
  return uuid ? String(uuid) : null;
}

function getRowUserId(row) {
  // ChatSummary row: { user: User!, ... }
  return row?.user?.id || row?.userId || row?.id || null;
}

function getRowUsername(row) {
  return row?.user?.username || row?.username || "User";
}

/**
 * ✅ IMPORTANT:
 * Your backend returns `user.avatar` (and your profile table stores avatar).
 * So we prefer `row.user.avatar`.
 * We keep older fallbacks for safety.
 */
function getRowAvatarUrl(row) {
  return (
    row?.user?.profile?.avatar ||
    row?.user?.avatar ||
    row?.user?.avatarUrl ||
    row?.avatar ||
    row?.avatarUrl ||
    null
  );
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

  const {
    data: notifData,
    loading: notifLoading,
    refetch: refetchNotifs,
  } = useQuery(MyNotificationsDocument, {
    variables: { page: 1, pageSize: 50 },
    fetchPolicy: "cache-and-network",
  });
  const [markRead]    = useMutation(MarkNotificationReadDocument);
  const [markAllRead] = useMutation(MarkAllNotificationsReadDocument);
  const [dismiss]     = useMutation(DismissNotificationDocument);

  const notifications = useMemo(() => {
    const all = notifData?.myNotifications?.notifications ?? [];
    return all.filter((n) => !n.isDismissed);
  }, [notifData]);

  const [refreshing, setRefreshing] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);

  const { chats, unreadCount, refreshChats, refreshUnread } = useMessaging();

  const renderHeader = useCallback(
    () => (
      <PageHeader title="Messages" subtitle="Direct chats & system updates" />
    ),
    [],
  );

  const unreadNotifs = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

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
      refetchNotifs();
    }, [refreshChats, refreshUnread, refetchNotifs]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.allSettled([refreshChats?.(), refreshUnread?.(), refetchNotifs()]).finally(() => {
      setTimeout(() => setRefreshing(false), 250);
    });
  }, [refreshChats, refreshUnread, refetchNotifs]);

  const markAllSystemRead = useCallback(async () => {
    await markAllRead();
    refetchNotifs();
  }, [markAllRead, refetchNotifs]);

  const handleMarkRead = useCallback(async (id) => {
    if (!id) return;
    await markRead({ variables: { id } });
    refetchNotifs();
  }, [markRead, refetchNotifs]);

  const clearNotif = useCallback(async (id) => {
    if (!id) return;
    await dismiss({ variables: { id } });
    refetchNotifs();
  }, [dismiss, refetchNotifs]);

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

  const data = segment === "dms" ? filteredChats : notifications;

  const isSystemEmpty =
    segment === "system" && !notifLoading && notifications.length === 0;

  // Recent users for modal (deduped)
  const recentUsers = useMemo(() => {
    const list = Array.isArray(chats) ? chats : [];

    const mapped = list
      .map((row) => {
        const id = pickUsersTableId(row?.user || row);
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

  /**
   * ✅ single place to navigate to a thread (always passes params)
   */
  const goToThread = useCallback(
    ({ receiverId, username, avatarUrl }) => {
      const id =
        pickUsersTableId({ id: receiverId }) ||
        (isUuid(receiverId) ? String(receiverId) : null);

      console.log("[messages] goToThread input =>", {
        receiverId,
        username,
        avatarUrl,
      });
      console.log("[messages] goToThread resolved id =>", id);

      if (!id) {
        console.log(
          "[messages] goToThread aborted: receiverId is missing/invalid (must be users.id UUID)",
        );
        return;
      }

      router.push({
        pathname: `/messages/${id}`,
        params: {
          username: safeString(username),
          avatarUrl: safeString(avatarUrl), // keep for now (thread file can accept both)
        },
      });
    },
    [router],
  );

  const handleSelectUser = useCallback(
    (user) => {
      const id = pickUsersTableId(user);

      console.log("[messages] start chat raw user =>", user);
      console.log("[messages] start chat picked receiverId =>", id);

      if (!id) {
        console.log(
          "[messages] start chat aborted: could not determine users.id for selected user",
        );
        return;
      }

      setNewModalOpen(false);

      goToThread({
        receiverId: id,
        username: user?.username || user?.user?.username || "",
        avatarUrl:
          user?.avatar || user?.user?.avatar || user?.user?.avatarUrl || "",
      });
    },
    [goToThread],
  );

  const onPressChatRow = useCallback(
    (row) => {
      const receiverId = pickUsersTableId(row?.user || row);
      if (!receiverId) {
        console.log("[messages] onPressChatRow aborted: missing users.id", row);
        return;
      }

      const username = getRowUsername(row);
      const avatarUrl = getRowAvatarUrl(row) || "";

      // ✅ NEW: debug log (this is what you asked for)
      console.log("========== CHAT ROW DEBUG ==========");
      console.log("Full row:", row);
      console.log("row.user:", row?.user);
      console.log("Raw avatar value:", row?.user?.avatar);
      console.log("Normalized avatar:", avatarUrl);
      console.log("Resolved receiverId:", receiverId);
      console.log("====================================");

      goToThread({
        receiverId,
        username,
        avatarUrl,
      });
    },
    [goToThread],
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
                ? String(pickUsersTableId(i?.user || i) ?? idx)
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
                <Pressable
                  style={styles.dmRow}
                  onPress={() => onPressChatRow(item)}
                >
                  {/* ✅ CHANGED: real avatar */}
                  <Avatar
                    name={getRowUsername(item)}
                    src={getRowAvatarUrl(item)}
                    baseUrl={ASSET_BASE_URL}
                    size={44}
                  />

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
              ) : (
                <Pressable
                  onPress={() => handleMarkRead(item.id)}
                  style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
                >
                  <View style={styles.notifIconWrap}>
                    <Text style={{ fontSize: 18 }}>{iconFor(item.type)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {item.title ? (
                      <Text style={styles.notifTitle}>{item.title}</Text>
                    ) : null}
                    {item.body ? (
                      <Text style={styles.notifBody}>{item.body}</Text>
                    ) : null}
                    <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  {!item.isRead && <View style={styles.unreadDot} />}
                  <Pressable
                    onPress={() => clearNotif(item.id)}
                    hitSlop={10}
                    style={styles.dismissBtn}
                  >
                    <Text style={styles.dismissText}>✕</Text>
                  </Pressable>
                </Pressable>
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
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notifCardUnread: {
    borderColor: COLORS.accent + "44",
    backgroundColor: COLORS.accent + "0A",
  },
  notifIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.alt,
    alignItems: "center",
    justifyContent: "center",
  },
  notifTitle: { color: COLORS.text, fontWeight: "800", fontSize: 14, marginBottom: 2 },
  notifBody: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  notifTime: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginTop: 6,
    flexShrink: 0,
  },
  dismissBtn: { padding: 4 },
  dismissText: { color: COLORS.textMuted, fontSize: 13 },

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
