// app/messages/[userId].js
//
// UPDATED (2026-02-17)
//
// CHANGES:
// - FIX: UI-only delete now persists across refresh using expo-secure-store (works in Expo Go / Hermes)
// - REMOVE: AsyncStorage usage (NativeModule null in Expo Go / no native build)
// - ADD: SecureStore chunked tombstone storage per thread (size-limit safe)
// - FIX: Keyboard "extra space" issue by removing KeyboardAvoidingView and using Keyboard events + manual offsets
// - CHANGE: FlatList paddingBottom accounts for composer height + safe-area + iOS keyboard height
// - CHANGE: Composer lifts on iOS only (Android should use resize mode; avoids double-compensation)

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { COLORS } from "../../theme/colors";

import { useFocusEffect } from "@react-navigation/native";
import { useMeQuery } from "@sixbyfive/tcg-binder/react";
import { useMessaging } from "../contexts/MessengerContext";

import { gql, useApolloClient } from "@apollo/client";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "../../components/common/Avatar";

const ASSET_BASE_URL =
  process.env.EXPO_PUBLIC_ASSET_BASE_URL || "https://backendtcg.sixbyfive.com";

/* =============================================================================
   GraphQL
============================================================================= */

const REPORT_USER_MUTATION = gql`
  mutation ReportUser($userId: ID!, $reason: String!, $details: String) {
    reportUser(userId: $userId, reason: $reason, details: $details)
  }
`;

const REPORT_MESSAGE_MUTATION = gql`
  mutation ReportMessage($messageId: ID!, $reason: String!, $details: String) {
    reportMessage(messageId: $messageId, reason: $reason, details: $details)
  }
`;

const BLOCK_USER_MUTATION = gql`
  mutation BlockUserFromChat($userId: ID!, $reason: String) {
    blockUserFromChat(userId: $userId, reason: $reason)
  }
`;

/* =============================================================================
   Helpers
============================================================================= */

function safeString(v) {
  return String(v ?? "").trim();
}

function normalizeAvatarInput(v) {
  if (!v) return "";
  if (typeof v === "string") return v.trim();

  if (typeof v === "object") {
    const maybe =
      v.url ||
      v.uri ||
      v.path ||
      v.avatar ||
      v.avatarUrl ||
      v.avatarURL ||
      v.src ||
      v.href ||
      "";
    return typeof maybe === "string" ? maybe.trim() : "";
  }

  return "";
}

function isSameDay(aTs, bTs) {
  const a = new Date(aTs);
  const b = new Date(bTs);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (isSameDay(ts, today)) return "Today";
  if (isSameDay(ts, yday)) return "Yesterday";
  return d.toLocaleDateString();
}

function getRowUserId(row) {
  return row?.user?.id || row?.userId || row?.id || null;
}

function getRowUsername(row) {
  return row?.user?.username || row?.username || "";
}

function getRowAvatar(row) {
  return row?.user?.profile?.avatar || row?.user?.avatar || row?.avatar || null;
}

function getRowLastMessageId(row) {
  return row?.lastMessage?.id || row?.lastMessageId || null;
}

/**
 * Normalize message object based on your backend Message typeDefs.
 */
function normalizeMessage(raw, myUserId) {
  const id =
    raw?.id ||
    raw?.messageId ||
    raw?._id ||
    `${raw?.createdAt || raw?.ts || Date.now()}-${Math.random()}`;

  const created =
    raw?.createdAt || raw?.ts || raw?.sentAt || raw?.created_at || Date.now();

  const ts =
    typeof created === "number" ? created : new Date(created).getTime();

  const text = raw?.content ?? raw?.text ?? raw?.message ?? "";

  const senderId =
    raw?.senderId ||
    raw?.fromUserId ||
    raw?.from?.id ||
    raw?.sender?.id ||
    null;

  const mine =
    myUserId && senderId ? String(senderId) === String(myUserId) : false;

  // Optional image from meta (still supported if backend sends it)
  let image = null;
  const meta = raw?.meta ?? raw?.metadata ?? null;

  let metaObj = meta;
  if (typeof meta === "string") {
    try {
      metaObj = JSON.parse(meta);
    } catch (_) {
      metaObj = null;
    }
  }

  image =
    metaObj?.image ||
    metaObj?.imageUrl ||
    metaObj?.imageURL ||
    raw?.image ||
    raw?.imageUrl ||
    null;

  return {
    id: String(id),
    author: mine ? "me" : "them",
    text: safeString(text),
    ts: Number.isFinite(ts) ? ts : Date.now(),
    status: raw?.status || (mine ? "sent" : "read"),
    image: image ? String(image) : null,
    _raw: raw,
  };
}

const REPORT_REASONS = [
  { key: "HARASSMENT", label: "Harassment / bullying" },
  { key: "HATE", label: "Hate speech" },
  { key: "SCAM", label: "Scam / fraud" },
  { key: "SEXUAL", label: "Sexual content" },
  { key: "SPAM", label: "Spam" },
  { key: "OTHER", label: "Other" },
];

/* =============================================================================
   ✅ NEW: UI-only deletion persistence (SecureStore, chunked)
============================================================================= */

function threadKey(otherUserId) {
  return `wf_hidden_${String(otherUserId || "")}`;
}

function idxKey(otherUserId) {
  return `wf_hidden_idx_${String(otherUserId || "")}`;
}

const MAX_IDS_TOTAL = 500; // keep bounded
const IDS_PER_CHUNK = 150; // safe chunk size for SecureStore

async function readJson(key) {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    if (__DEV__) console.log("[thread] readJson error", key, e?.message || e);
    return null;
  }
}

async function writeJson(key, value) {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch (e) {
    if (__DEV__) console.log("[thread] writeJson error", key, e?.message || e);
  }
}

async function deleteKey(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (_) {}
}

async function loadHiddenSet(otherUserId) {
  const idx = await readJson(idxKey(otherUserId));
  const chunks = Math.max(0, Number(idx?.chunks || 0));

  const all = [];
  for (let i = 0; i < chunks; i++) {
    const arr = await readJson(`${threadKey(otherUserId)}_${i}`);
    if (Array.isArray(arr)) all.push(...arr);
  }

  return new Set(all.map(String));
}

async function saveHiddenSet(otherUserId, set) {
  const ids = Array.from(set).map(String).slice(-MAX_IDS_TOTAL);

  const chunks = [];
  for (let i = 0; i < ids.length; i += IDS_PER_CHUNK) {
    chunks.push(ids.slice(i, i + IDS_PER_CHUNK));
  }

  // Delete old chunks if new set is smaller
  const prevIdx = await readJson(idxKey(otherUserId));
  const prevChunks = Math.max(0, Number(prevIdx?.chunks || 0));
  for (let i = chunks.length; i < prevChunks; i++) {
    await deleteKey(`${threadKey(otherUserId)}_${i}`);
  }

  for (let i = 0; i < chunks.length; i++) {
    await writeJson(`${threadKey(otherUserId)}_${i}`, chunks[i]);
  }

  await writeJson(idxKey(otherUserId), {
    chunks: chunks.length,
    updatedAt: Date.now(),
  });
}

/* =============================================================================
   Header
============================================================================= */

function ThreadHeader({
  title,
  subtitle,
  avatar,
  onBack,
  onOpenMenu,
  onPressTitle,
  insetsTop = 0,
}) {
  return (
    <View style={[styles.headerWrap, { paddingTop: Math.max(insetsTop, 10) }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerIconBtn,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>

        <Pressable
          onPress={onPressTitle}
          disabled={!onPressTitle}
          style={({ pressed }) => [
            styles.headerCenter,
            pressed && onPressTitle ? { opacity: 0.85 } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="View profile"
        >
          <View style={styles.headerAvatarRing}>
            <Avatar
              name={title}
              src={avatar}
              baseUrl={ASSET_BASE_URL}
              size={36}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[
                styles.headerTitle,
                onPressTitle ? styles.headerTitleLink : null,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          {onPressTitle ? (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.textMuted}
              style={{ marginLeft: 2 }}
            />
          ) : null}
        </Pressable>

        <Pressable
          onPress={onOpenMenu}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerIconBtn,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Conversation actions"
        >
          <Ionicons
            name="ellipsis-vertical"
            size={18}
            color={COLORS.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

/* =============================================================================
   Report / Block Modals
============================================================================= */

function ReportModal({
  visible,
  title = "Report",
  subtitle = "",
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]?.key || "OTHER");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!visible) return;
    setReason(REPORT_REASONS[0]?.key || "OTHER");
    setDetails("");
  }, [visible]);

  const close = () => onClose?.();
  const submit = () =>
    onSubmit?.({ reason, details: safeString(details) || null });

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.sheetBackdrop} onPress={close}>
        <View />
      </Pressable>

      <View style={styles.reportCard}>
        <View style={styles.sheetHandle} />
        <Text style={styles.reportTitle}>{title}</Text>
        {!!subtitle && (
          <Text style={styles.reportSub} numberOfLines={2}>
            {subtitle}
          </Text>
        )}

        <Text style={styles.reportSection}>Reason</Text>
        <View style={styles.reasonGrid}>
          {REPORT_REASONS.map((r) => {
            const active = r.key === reason;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={({ pressed }) => [
                  styles.reasonChip,
                  active && styles.reasonChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[
                    styles.reasonChipText,
                    active && styles.reasonChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.reportSection}>Details (optional)</Text>
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="Add a short note to help moderation…"
          placeholderTextColor={COLORS.textMuted}
          style={styles.detailsInput}
          multiline
          textAlignVertical="top"
          maxLength={600}
        />

        <View style={styles.reportBtns}>
          <Pressable
            onPress={close}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { flex: 1, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>

          <Pressable
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [
              styles.primaryBtn,
              { flex: 1, opacity: pressed || submitting ? 0.85 : 1 },
            ]}
          >
            {submitting ? (
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.primaryText}>Submitting…</Text>
              </View>
            ) : (
              <Text style={styles.primaryText}>Submit report</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const BLOCK_REASONS = [
  { key: "HARASSMENT", label: "Harassment / bullying" },
  { key: "SCAM", label: "Scam / fraud" },
  { key: "SPAM", label: "Spam" },
  { key: "UNWANTED", label: "Unwanted contact" },
  { key: "OTHER", label: "Other" },
];

function BlockModal({
  visible,
  title = "Block user",
  subtitle = "",
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [reason, setReason] = useState(BLOCK_REASONS[0]?.key || "OTHER");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!visible) return;
    setReason(BLOCK_REASONS[0]?.key || "OTHER");
    setDetails("");
  }, [visible]);

  const close = () => onClose?.();
  const submit = () => {
    const d = safeString(details);
    const combined = d ? `${reason}: ${d}` : reason;
    onSubmit?.({ reason: combined });
  };

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.sheetBackdrop} onPress={close}>
        <View />
      </Pressable>

      <View style={styles.reportCard}>
        <View style={styles.sheetHandle} />
        <Text style={styles.reportTitle}>{title}</Text>

        {!!subtitle && (
          <Text style={styles.reportSub} numberOfLines={2}>
            {subtitle}
          </Text>
        )}

        <Text style={styles.reportSection}>Reason</Text>
        <View style={styles.reasonGrid}>
          {BLOCK_REASONS.map((r) => {
            const active = r.key === reason;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={({ pressed }) => [
                  styles.reasonChip,
                  active && styles.reasonChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={[
                    styles.reasonChipText,
                    active && styles.reasonChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.reportSection}>Details (optional)</Text>
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="Optional note…"
          placeholderTextColor={COLORS.textMuted}
          style={styles.detailsInput}
          multiline
          textAlignVertical="top"
          maxLength={600}
        />

        <View style={styles.reportBtns}>
          <Pressable
            onPress={close}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { flex: 1, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>

          <Pressable
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [
              styles.primaryBtn,
              { flex: 1, opacity: pressed || submitting ? 0.85 : 1 },
            ]}
          >
            {submitting ? (
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.primaryText}>Blocking…</Text>
              </View>
            ) : (
              <Text style={styles.primaryText}>Block user</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* =============================================================================
   Screen
============================================================================= */

export default function Thread() {
  const router = useRouter();
  const client = useApolloClient();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams();

  const otherUserId = useMemo(() => {
    const id = params?.userId ? String(params.userId) : "";
    return id;
  }, [params?.userId]);

  const usernameParam = useMemo(
    () => safeString(params?.username),
    [params?.username],
  );

  // ✅ support BOTH param names (Messages list uses avatarUrl)
  const avatarParam = useMemo(() => {
    const v = params?.avatar ?? params?.avatarUrl ?? "";
    return normalizeAvatarInput(v);
  }, [params?.avatar, params?.avatarUrl]);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msgs, setMsgs] = useState([]);

  const flatRef = useRef(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);

  const [threadMenuOpen, setThreadMenuOpen] = useState(false);

  const [reportTarget, setReportTarget] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportToast, setReportToast] = useState("");

  const [blockOpen, setBlockOpen] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  // ✅ keyboard tracking (prevents phantom padding bugs)
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);

  useEffect(() => {
    const onShow = (e) => {
      const h = e?.endCoordinates?.height || 0;
      keyboardHeightRef.current = h;
      setKeyboardHeight(h);
    };

    const onHide = () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
    };

    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);

    return () => {
      subShow?.remove?.();
      subHide?.remove?.();
    };
  }, []);

  // ✅ hidden/tombstoned messages state
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const hiddenIdsRef = useRef(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!otherUserId) return;
      const set = await loadHiddenSet(otherUserId);
      if (!alive) return;
      hiddenIdsRef.current = set;
      setHiddenIds(set);
      if (__DEV__) {
        console.log("[thread] loaded hidden ids", {
          otherUserId,
          count: set.size,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [otherUserId]);

  const hideMessageId = useCallback(
    async (messageId) => {
      const id = String(messageId || "");
      if (!id || !otherUserId) return;

      // Don’t persist local optimistic ids
      if (id.startsWith("local-")) return;

      const next = new Set(hiddenIdsRef.current);
      if (next.has(id)) return;

      next.add(id);
      hiddenIdsRef.current = next;
      setHiddenIds(next);

      await saveHiddenSet(otherUserId, next);
    },
    [otherUserId],
  );

  const { data: meData } = useMeQuery({ fetchPolicy: "cache-first" });
  const me = meData?.me || null;

  const { chats, fetchThread, sendMessage, markChatRead, typingByUser } =
    useMessaging();

  useEffect(() => {
    const isTyping = !!typingByUser?.[String(otherUserId)];
    setTyping(isTyping);
  }, [typingByUser, otherUserId]);

  const testLocalNotification = useCallback(async () => {
    if (!otherUserId) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test DM",
        body: "Tap me to open the DM thread",
        data: { type: "dm", userId: String(otherUserId) }, // matches your _layout routing
        sound: "default",
      },
      trigger: null,
    });
  }, [otherUserId]);

  const partnerRow = useMemo(() => {
    const list = Array.isArray(chats) ? chats : [];
    return (
      list.find((row) => String(getRowUserId(row)) === String(otherUserId)) ||
      null
    );
  }, [chats, otherUserId]);

  const username = useMemo(() => {
    const fromChats = partnerRow ? safeString(getRowUsername(partnerRow)) : "";
    if (fromChats) return fromChats;
    if (usernameParam) return usernameParam;
    return "";
  }, [partnerRow, usernameParam]);

  const title = useMemo(() => {
    if (username) return username;
    return otherUserId ? `User ${otherUserId.slice(0, 6)}` : "Direct Message";
  }, [username, otherUserId]);

  const subtitle = typing ? "Typing…" : "Direct message";

  const avatar = useMemo(() => {
    const fromChats = partnerRow
      ? normalizeAvatarInput(getRowAvatar(partnerRow))
      : "";
    if (fromChats) return fromChats;
    if (avatarParam) return avatarParam;
    return "";
  }, [partnerRow, avatarParam]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      flatRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const fetchThreadRef = useRef(fetchThread);
  const markChatReadRef = useRef(markChatRead);

  useEffect(() => {
    fetchThreadRef.current = fetchThread;
  }, [fetchThread]);

  useEffect(() => {
    markChatReadRef.current = markChatRead;
  }, [markChatRead]);

  const loadThread = useCallback(
    async (source = "unknown") => {
      if (!otherUserId) return;

      try {
        if (__DEV__) {
          console.log("[thread] loadThread()", {
            source,
            otherUserId,
            meId: me?.id || null,
          });
        }

        const list = await fetchThreadRef.current?.(otherUserId, {
          page: 1,
          pageSize: 80,
        });

        const hidden = hiddenIdsRef.current || new Set();

        const arr = Array.isArray(list) ? list : [];
        const mapped = arr
          .map((m) => normalizeMessage(m, me?.id))
          .filter((m) => m && m.id)
          .filter((m) => !hidden.has(String(m.id))) // ✅ filter tombstoned
          .sort((a, b) => a.ts - b.ts);

        setMsgs(mapped);

        try {
          markChatReadRef.current?.(otherUserId);
        } catch (_) {}

        setTimeout(scrollToEnd, 50);
      } catch (e) {
        console.log("[thread] loadThread error", e?.message || e);
      }
    },
    [otherUserId, me?.id, scrollToEnd],
  );

  useEffect(() => {
    loadThread("mount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  useFocusEffect(
    useCallback(() => {
      loadThread("focus");
      return () => {};
    }, [loadThread]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.resolve(loadThread("pull_to_refresh")).finally(() => {
      setTimeout(() => setRefreshing(false), 250);
    });
  }, [loadThread]);

  /**
   * Live update when the chat list reports a new lastMessage.
   */
  const lastSeenPartnerMsgIdRef = useRef(null);
  const liveReloadTimerRef = useRef(null);

  const partnerLastMessageId = useMemo(
    () => (partnerRow ? String(getRowLastMessageId(partnerRow) || "") : ""),
    [partnerRow],
  );

  useEffect(() => {
    if (!otherUserId) return;

    const next = partnerLastMessageId;
    if (!next) return;

    const prev = lastSeenPartnerMsgIdRef.current;

    // First time we see it, just store it
    if (!prev) {
      lastSeenPartnerMsgIdRef.current = next;
      if (__DEV__) console.log("[thread] init lastSeenPartnerMsgId", { next });
      return;
    }

    if (prev === next) return;

    lastSeenPartnerMsgIdRef.current = next;

    if (liveReloadTimerRef.current) clearTimeout(liveReloadTimerRef.current);

    liveReloadTimerRef.current = setTimeout(() => {
      if (__DEV__) {
        console.log("[thread] live update triggered", {
          otherUserId,
          prevLastMessageId: prev,
          nextLastMessageId: next,
        });
      }
      loadThread("partnerRow_lastMessage_changed");
    }, 120);

    return () => {
      if (liveReloadTimerRef.current) clearTimeout(liveReloadTimerRef.current);
    };
  }, [otherUserId, partnerLastMessageId, loadThread]);

  const onSend = useCallback(async () => {
    const content = safeString(input);
    if (!content || !otherUserId) return;

    const optimistic = {
      id: `local-${Date.now()}`,
      author: "me",
      text: content,
      ts: Date.now(),
      status: "sending",
      image: null,
      _optimistic: true,
    };

    setMsgs((prev) => [...prev, optimistic]);
    setInput("");
    setTimeout(scrollToEnd, 20);

    try {
      const sent = await sendMessage?.(otherUserId, content, null);
      await loadThread("after_send");
      return sent || null;
    } catch (e) {
      console.log("[thread] sendMessage error", e?.message || e);
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, status: "failed" } : m,
        ),
      );
      return null;
    }
  }, [input, otherUserId, sendMessage, loadThread, scrollToEnd]);

  const withSeparators = useMemo(() => {
    const out = [];
    let lastTs = null;

    (Array.isArray(msgs) ? msgs : []).forEach((m) => {
      if (!lastTs || !isSameDay(lastTs, m.ts)) {
        out.push({ _sep: true, id: `sep-${m.ts}`, label: dayLabel(m.ts) });
      }
      out.push(m);
      lastTs = m.ts;
    });

    return out;
  }, [msgs]);

  const handleLongPress = (msg) => {
    setSelectedMsg(msg);
    setSheetOpen(true);
  };

  const onCopy = () => {
    setSheetOpen(false);
    // TODO: expo-clipboard
  };

  // ✅ UI-only delete that persists across refresh
  const onDelete = useCallback(async () => {
    setSheetOpen(false);
    if (!selectedMsg?.id) return;

    const id = String(selectedMsg.id);

    // Remove immediately from UI
    setMsgs((prev) => prev.filter((m) => String(m.id) !== id));

    // Persist the hide
    await hideMessageId(id);

    setReportToast("Message removed on this device.");
    setTimeout(() => setReportToast(""), 1600);
  }, [selectedMsg, hideMessageId]);

  const openReportUser = useCallback(() => {
    setThreadMenuOpen(false);
    if (!otherUserId) return;

    setReportTarget({
      type: "user",
      id: otherUserId,
      subtitle: username
        ? `Reporting @${username}`
        : `Reporting user ${otherUserId.slice(0, 6)}`,
    });
    setReportOpen(true);
  }, [otherUserId, username]);

  const openReportMessage = useCallback(() => {
    setSheetOpen(false);

    const mid = selectedMsg?.id ? String(selectedMsg.id) : "";
    if (!mid) return;

    setReportTarget({
      type: "message",
      id: mid,
      subtitle: "Reporting this message to moderation",
    });
    setReportOpen(true);
  }, [selectedMsg]);

  const submitReport = useCallback(
    async ({ reason, details }) => {
      if (!reportTarget?.type || !reportTarget?.id) return;

      setReportSubmitting(true);
      setReportToast("");

      try {
        if (reportTarget.type === "user") {
          await client.mutate({
            mutation: REPORT_USER_MUTATION,
            variables: {
              userId: String(reportTarget.id),
              reason: String(reason),
              details: details ? String(details) : null,
            },
          });
        } else {
          await client.mutate({
            mutation: REPORT_MESSAGE_MUTATION,
            variables: {
              messageId: String(reportTarget.id),
              reason: String(reason),
              details: details ? String(details) : null,
            },
          });
        }

        setReportOpen(false);
        setReportTarget(null);

        setReportToast("Report submitted. Thanks for helping keep chat safe.");
        setTimeout(() => setReportToast(""), 2500);
      } catch (e) {
        console.log("[thread] report error", e?.message || e);
        setReportToast(
          e?.message || "Could not submit report. Please try again.",
        );
        setTimeout(() => setReportToast(""), 3500);
      } finally {
        setReportSubmitting(false);
      }
    },
    [client, reportTarget],
  );

  const openBlockUser = useCallback(() => {
    setThreadMenuOpen(false);
    if (!otherUserId) return;
    setBlockOpen(true);
  }, [otherUserId]);

  const submitBlock = useCallback(
    async ({ reason }) => {
      if (!otherUserId) return;

      setBlockSubmitting(true);
      setReportToast("");

      try {
        await client.mutate({
          mutation: BLOCK_USER_MUTATION,
          variables: {
            userId: String(otherUserId),
            reason: safeString(reason) || "OTHER",
          },
        });

        setBlockOpen(false);

        setReportToast(
          username
            ? `Blocked @${username}. You won’t receive messages from them.`
            : "User blocked. You won’t receive messages from them.",
        );

        setTimeout(() => {
          setReportToast("");
          router.back();
        }, 1200);
      } catch (e) {
        console.log("[thread] block error", e?.message || e);
        setReportToast(e?.message || "Could not block user. Please try again.");
        setTimeout(() => setReportToast(""), 3500);
      } finally {
        setBlockSubmitting(false);
      }
    },
    [client, otherUserId, username, router],
  );

  const goToProfileFromHeader = useCallback(() => {
    if (!username) {
      setReportToast("Profile unavailable until username is loaded.");
      setTimeout(() => setReportToast(""), 2000);
      return;
    }
    router.push(`/profile/${encodeURIComponent(username)}`);
  }, [router, username]);

  const renderItem = ({ item }) => {
    if (item._sep) {
      return (
        <View style={styles.sepWrap}>
          <Text style={styles.sepText}>{item.label}</Text>
        </View>
      );
    }

    const mine = item.author === "me";
    const bubbleStyle = [styles.bubble, mine ? styles.right : styles.left];
    const textStyle = [styles.msg, mine ? styles.msgMine : styles.msgTheirs];
    const metaStyle = [styles.meta, mine ? styles.metaMine : styles.metaTheirs];

    return (
      <Pressable onLongPress={() => handleLongPress(item)} delayLongPress={250}>
        <View style={bubbleStyle}>
          {!!item.image && (
            <Image
              source={{ uri: item.image }}
              style={styles.image}
              resizeMode="cover"
            />
          )}

          {!!item.text && <Text style={textStyle}>{item.text}</Text>}

          <View style={styles.metaRow}>
            <Text style={metaStyle}>
              {new Date(item.ts).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  // ✅ composer sizing + keyboard offset (iOS only)
  const COMPOSER_HEIGHT = 44;
  const COMPOSER_VERTICAL_PADDING = 12; // top and bottom padding in inputRow container
  const composerTotalHeight = COMPOSER_HEIGHT + COMPOSER_VERTICAL_PADDING * 2;
  const safeBottom = Math.max(insets.bottom, 0);

  // IMPORTANT:
  // - iOS: lift composer by keyboard height
  // - Android: rely on `softwareKeyboardLayoutMode: "resize"` (avoid double spacing)
  const composerKeyboardOffset = Platform.OS === "ios" ? keyboardHeight : 0;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ThreadHeader
        title={title}
        subtitle={subtitle}
        avatar={avatar}
        insetsTop={insets.top}
        onBack={() => router.back()}
        onOpenMenu={() => setThreadMenuOpen(true)}
        onPressTitle={goToProfileFromHeader}
      />

      <Pressable style={styles.sheetBtn} onPress={testLocalNotification}>
        <Ionicons name="notifications-outline" size={18} color={COLORS.text} />
        <Text style={styles.sheetBtnText}>Test notification</Text>
      </Pressable>

      {!!reportToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText} numberOfLines={2}>
            {reportToast}
          </Text>
        </View>
      )}

      {typing && (
        <View style={styles.typingWrap}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <Text style={styles.typingText}> {title} is typing…</Text>
        </View>
      )}

      <FlatList
        ref={flatRef}
        style={{ flex: 1, paddingHorizontal: 16 }}
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom:
            12 + composerTotalHeight + safeBottom + composerKeyboardOffset,
        }}
        data={withSeparators}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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
          <View style={{ paddingTop: 30, alignItems: "center" }}>
            <Text style={{ color: COLORS.textMuted, fontWeight: "800" }}>
              No messages yet
            </Text>
            <Text style={{ color: COLORS.textMuted, marginTop: 6 }}>
              Say hello to start the conversation.
            </Text>
          </View>
        }
        onContentSizeChange={() => scrollToEnd()}
        onLayout={() => scrollToEnd()}
        keyboardShouldPersistTaps="handled"
      />

      {/* Composer pinned to bottom, lifted by iOS keyboard via marginBottom */}
      <View
        style={[
          styles.inputRow,
          {
            paddingBottom: 12 + safeBottom,
            marginBottom: composerKeyboardOffset,
          },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message"
          placeholderTextColor={COLORS.textMuted}
          style={[styles.input, { height: COMPOSER_HEIGHT }]}
          returnKeyType="send"
          onSubmitEditing={onSend}
        />

        <Pressable style={styles.send} onPress={onSend}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>Send</Text>
        </Pressable>
      </View>

      {/* Message ActionSheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSheetOpen(false)}
        >
          <View />
        </Pressable>

        <View style={styles.sheetCard}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Message actions</Text>

          <Pressable style={styles.sheetBtn} onPress={onCopy}>
            <Ionicons name="copy-outline" size={18} color={COLORS.text} />
            <Text style={styles.sheetBtnText}>Copy</Text>
          </Pressable>

          <Pressable style={styles.sheetBtn} onPress={openReportMessage}>
            <Ionicons
              name="flag-outline"
              size={18}
              color={COLORS.error || "#ff6b6b"}
            />
            <Text
              style={[
                styles.sheetBtnText,
                { color: COLORS.error || "#ff6b6b" },
              ]}
            >
              Report message
            </Text>
          </Pressable>

          <Pressable
            style={[styles.sheetBtn, { borderTopWidth: 0 }]}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
            <Text style={[styles.sheetBtnText, { color: COLORS.textMuted }]}>
              Delete (UI-only)
            </Text>
          </Pressable>

          <Pressable
            style={styles.sheetCancel}
            onPress={() => setSheetOpen(false)}
          >
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Thread Menu */}
      <Modal
        visible={threadMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setThreadMenuOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setThreadMenuOpen(false)}
        >
          <View />
        </Pressable>

        <View style={styles.sheetCard}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Conversation</Text>

          <Pressable style={styles.sheetBtn} onPress={openReportUser}>
            <Ionicons
              name="flag-outline"
              size={18}
              color={COLORS.error || "#ff6b6b"}
            />
            <Text
              style={[
                styles.sheetBtnText,
                { color: COLORS.error || "#ff6b6b" },
              ]}
            >
              Report user
            </Text>
          </Pressable>

          <Pressable style={styles.sheetBtn} onPress={openBlockUser}>
            <Ionicons
              name="ban-outline"
              size={18}
              color={COLORS.error || "#ff6b6b"}
            />
            <Text
              style={[
                styles.sheetBtnText,
                { color: COLORS.error || "#ff6b6b" },
              ]}
            >
              Block user
            </Text>
          </Pressable>

          <Pressable
            style={styles.sheetCancel}
            onPress={() => setThreadMenuOpen(false)}
          >
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={reportOpen}
        title={
          reportTarget?.type === "message" ? "Report message" : "Report user"
        }
        subtitle={reportTarget?.subtitle || ""}
        submitting={reportSubmitting}
        onClose={() => {
          if (reportSubmitting) return;
          setReportOpen(false);
          setReportTarget(null);
        }}
        onSubmit={submitReport}
      />

      {/* Block Modal */}
      <BlockModal
        visible={blockOpen}
        title="Block user"
        subtitle={username ? `Blocking @${username}` : "Blocking this user"}
        submitting={blockSubmitting}
        onClose={() => {
          if (blockSubmitting) return;
          setBlockOpen(false);
        }}
        onSubmit={submitBlock}
      />
    </View>
  );
}

/* =============================================================================
   Styles
============================================================================= */

const styles = StyleSheet.create({
  headerWrap: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  headerRow: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 2,
    minWidth: 0,
    paddingVertical: 4,
    borderRadius: 12,
  },

  headerAvatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    backgroundColor: "rgba(41,99,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(41,99,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  headerTitleLink: {
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
  },
  headerSubtitle: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 12.5,
    marginTop: 1,
  },

  toast: {
    position: "absolute",
    top: 92,
    left: 12,
    right: 12,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    zIndex: 20,
  },
  toastText: { color: COLORS.text, fontWeight: "800", textAlign: "center" },

  bubble: { maxWidth: "78%", padding: 10, borderRadius: 12 },
  left: { backgroundColor: COLORS.surface, alignSelf: "flex-start" },
  right: { backgroundColor: COLORS.accent, alignSelf: "flex-end" },

  msg: { fontWeight: "700" },
  msgMine: { color: "#fff" },
  msgTheirs: { color: COLORS.text },

  image: {
    width: 230,
    height: 150,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#00000022",
  },

  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  meta: { fontSize: 10, fontWeight: "800" },
  metaMine: { color: "#e0e0e0aa" },
  metaTheirs: { color: COLORS.textMuted },

  sepWrap: { alignItems: "center", marginVertical: 6 },
  sepText: {
    color: COLORS.textMuted,
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },

  typingWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 2,
    marginHorizontal: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textMuted,
    marginRight: 4,
  },
  typingText: { color: COLORS.textMuted, fontSize: 12 },

  inputRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopColor: COLORS.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  send: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    height: 44,
  },

  sheetBackdrop: { flex: 1, backgroundColor: "#00000088" },
  sheetCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderColor: COLORS.border,
    borderWidth: 1,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 8,
  },
  sheetTitle: { color: COLORS.text, fontWeight: "800", marginBottom: 8 },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderTopColor: COLORS.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetBtnText: { color: COLORS.text, fontWeight: "700" },
  sheetCancel: {
    marginTop: 8,
    backgroundColor: COLORS.alt,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 10,
  },
  sheetCancelText: { color: COLORS.text, fontWeight: "800" },

  reportCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderColor: COLORS.border,
    borderWidth: 1,
    padding: 12,
  },
  reportTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  reportSub: { color: COLORS.textMuted, marginTop: 6, lineHeight: 18 },
  reportSection: { color: COLORS.text, fontWeight: "900", marginTop: 12 },

  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.alt,
    maxWidth: "100%",
  },
  reasonChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(41,99,255,0.12)",
  },
  reasonChipText: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 12.5,
  },
  reasonChipTextActive: { color: COLORS.text, fontWeight: "900" },

  detailsInput: {
    marginTop: 10,
    height: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  reportBtns: { flexDirection: "row", gap: 10, marginTop: 12 },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: COLORS.text, fontWeight: "900" },
});
