// components/notifications/NotificationInboxSheet.js
// Full notification inbox sheet — lists notifications, marks read, dismisses.

import React, { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import {
  MyNotificationsDocument,
  MarkNotificationReadDocument,
  MarkAllNotificationsReadDocument,
  DismissNotificationDocument,
} from "../../graphql/documents";

const PAGE_SIZE = 30;

// Icon by notification type
const TYPE_ICONS = {
  message:     "💬",
  trade:       "↕️",
  order:       "📦",
  offer:       "🏷️",
  price_alert: "🔔",
  system:      "📢",
  broadcast:   "📣",
};
function iconFor(type) {
  return TYPE_ICONS[type] ?? "🔔";
}

// Relative time
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export default function NotificationInboxSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();

  const { data, loading, refetch } = useQuery(MyNotificationsDocument, {
    variables: { page: 1, pageSize: PAGE_SIZE },
    fetchPolicy: "cache-and-network",
    skip: !visible,
  });

  const [markRead] = useMutation(MarkNotificationReadDocument);
  const [markAllRead] = useMutation(MarkAllNotificationsReadDocument);
  const [dismiss] = useMutation(DismissNotificationDocument);

  // Refetch when opened
  useEffect(() => {
    if (visible) refetch();
  }, [visible, refetch]);

  const all = data?.myNotifications?.notifications ?? [];
  // Hide dismissed notifications client-side immediately
  const notifications = all.filter((n) => !n.isDismissed);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function handleTap(n) {
    if (!n.isRead) {
      await markRead({ variables: { id: n.id } });
      refetch();
    }
  }

  async function handleMarkAllRead() {
    await markAllRead();
    refetch();
  }

  async function handleDismiss(id) {
    await dismiss({ variables: { id } });
    refetch();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 72 }} />

          <Text style={styles.headerTitle}>
            {unreadCount > 0
              ? `Notifications (${unreadCount})`
              : "Notifications"}
          </Text>

          <View style={styles.headerRight}>
            {unreadCount > 0 && (
              <Pressable onPress={handleMarkAllRead} hitSlop={8}>
                <Text style={styles.allReadText}>All read</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.navText}>Done</Text>
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {loading && notifications.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyBody}>No notifications yet.</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refetch}
                tintColor={COLORS.accent}
              />
            }
            renderItem={({ item: n }) => (
              <Pressable
                onPress={() => handleTap(n)}
                style={[
                  styles.notifCard,
                  !n.isRead && styles.notifCardUnread,
                ]}
              >
                {/* Icon */}
                <View style={styles.notifIconWrap}>
                  <Text style={{ fontSize: 20 }}>{iconFor(n.type)}</Text>
                </View>

                {/* Body */}
                <View style={{ flex: 1 }}>
                  {n.title ? (
                    <Text style={styles.notifTitle}>{n.title}</Text>
                  ) : null}
                  {n.body ? (
                    <Text style={styles.notifBody}>{n.body}</Text>
                  ) : null}
                  <Text style={styles.notifTime}>{timeAgo(n.createdAt)}</Text>
                </View>

                {/* Unread dot */}
                {!n.isRead && <View style={styles.unreadDot} />}

                {/* Dismiss */}
                <Pressable
                  onPress={() => handleDismiss(n.id)}
                  hitSlop={10}
                  style={styles.dismissBtn}
                >
                  <Text style={styles.dismissText}>✕</Text>
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 72,
    justifyContent: "flex-end",
  },
  navText: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },
  allReadText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 18 },
  emptyBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
  },

  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 14,
  },
  notifCardUnread: {
    borderColor: COLORS.accent + "44",
    backgroundColor: COLORS.accent + "0A",
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.alt,
    alignItems: "center",
    justifyContent: "center",
  },
  notifTitle: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 2,
  },
  notifBody: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  notifTime: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginTop: 6,
    flexShrink: 0,
  },

  dismissBtn: { padding: 4, marginLeft: 2 },
  dismissText: { color: COLORS.textMuted, fontSize: 12 },
});
