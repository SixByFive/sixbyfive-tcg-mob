// app/messages/[userId].js
// CHANGED: Adds long-press actions (Copy/Delete) and image attachment placeholders.
// Includes a lightweight cross-platform ActionSheet modal (UI-only).
// Keeps PageHeaderBack + avatar placeholder and the enhanced UX from before.

import { Ionicons } from "@expo/vector-icons"; // NEW: paperclip icon
import { useLocalSearchParams } from "expo-router";
import React, {
    useCallback,
    useMemo,
    useRef,
    useState
} from "react";
import {
    FlatList,
    Image,
    KeyboardAvoidingView, // NEW: render image messages
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import PageHeaderBack from "../../components/common/PageHeaderBack";
import { COLORS } from "../../theme/colors";

const nameFromId = (id) => {
  if (!id) return "Direct Message";
  if (id === "u1") return "FalconChipp";
  if (id === "u2") return "UnicornCards";
  return `User ${String(id).slice(0, 6)}`;
};

const isSameDay = (aTs, bTs) => {
  const a = new Date(aTs),
    b = new Date(bTs);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};
const dayLabel = (ts) => {
  const d = new Date(ts);
  const today = new Date();
  const yday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (isSameDay(ts, today)) return "Today";
  if (isSameDay(ts, yday)) return "Yesterday";
  return d.toLocaleDateString();
};

// Seed data, now with an example image message from "them"
const SEED = [
  {
    id: "m0",
    author: "them",
    text: "Here’s a pic of the card condition.",
    ts: Date.now() - 1000 * 60 * 6,
    status: "read",
    image:
      "https://images.unsplash.com/photo-1611606063065-4c7d3b34f0d6?w=1200&q=70&auto=format&fit=crop",
  },
  {
    id: "m1",
    author: "them",
    text: "Hey! Interested in trading?",
    ts: Date.now() - 1000 * 60 * 4,
    status: "read",
  },
  {
    id: "m2",
    author: "me",
    text: "Yep! I can offer 2x Lugia.",
    ts: Date.now() - 1000 * 60 * 3,
    status: "read",
  },
];

export default function Thread() {
  const { userId } = useLocalSearchParams();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msgs, setMsgs] = useState(SEED);
  const flatRef = useRef(null);

  // NEW: state for ActionSheet and selected message
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);

  // NEW: attachment sheet (simple for now, one action)
  const [attachOpen, setAttachOpen] = useState(false);

  const title = useMemo(() => nameFromId(userId), [userId]);
  const subtitle = typing ? "Typing…" : "Direct message";
  const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    title
  )}&background=2963FF&color=fff`;

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      flatRef.current?.scrollToEnd({ animated: true });
    });
  };

  const onSend = () => {
    if (!input.trim()) return;
    const optimistic = {
      id: `local-${Date.now()}`,
      author: "me",
      text: input.trim(),
      ts: Date.now(),
      status: "sending", // sending → sent → delivered → read
    };
    setMsgs((prev) => [...prev, optimistic]);
    setInput("");
    scrollToEnd();

    // Fake network progression of states + reply
    setTimeout(() => {
      setMsgs((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, status: "sent" } : m))
      );
    }, 400);
    setTimeout(() => {
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, status: "delivered" } : m
        )
      );
    }, 900);
    setTimeout(() => setTyping(true), 500);
    setTimeout(() => {
      setTyping(false);
      const reply = {
        id: `reply-${Date.now()}`,
        author: "them",
        text: "Sounds good—send your offer over.",
        ts: Date.now(),
        status: "read",
      };
      setMsgs((prev) => [...prev, reply]);
      setMsgs((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, status: "read" } : m))
      );
      scrollToEnd();
    }, 1500);
  };

  // NEW: attach placeholder — adds an image message from "me"
  const onAttachImage = () => {
    setAttachOpen(false);
    const imgMsg = {
      id: `img-${Date.now()}`,
      author: "me",
      text: "", // optional caption later
      image:
        "https://images.unsplash.com/photo-1542736667-069246bdbc74?w=1400&q=70&auto=format&fit=crop",
      ts: Date.now(),
      status: "sending",
    };
    setMsgs((prev) => [...prev, imgMsg]);
    scrollToEnd();
    // fake send state progression
    setTimeout(() => {
      setMsgs((prev) =>
        prev.map((m) => (m.id === imgMsg.id ? { ...m, status: "sent" } : m))
      );
    }, 400);
    setTimeout(() => {
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === imgMsg.id ? { ...m, status: "delivered" } : m
        )
      );
    }, 900);
    setTimeout(() => {
      setMsgs((prev) =>
        prev.map((m) => (m.id === imgMsg.id ? { ...m, status: "read" } : m))
      );
    }, 1500);
  };

  // Pull to refresh → prepend older mock messages
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      const older = {
        id: `old-${Date.now()}`,
        author: "them",
        text: "Hi! I have spares from SV8 if you’re collecting.",
        ts: Date.now() - 1000 * 60 * 60 * 6, // 6h earlier
        status: "read",
      };
      setMsgs((prev) => [older, ...prev]);
      setRefreshing(false);
    }, 800);
  }, []);

  // Build a renderable array with day separators
  const withSeparators = useMemo(() => {
    const out = [];
    let lastTs = null;
    msgs.forEach((m) => {
      if (!lastTs || !isSameDay(lastTs, m.ts)) {
        out.push({ _sep: true, id: `sep-${m.ts}`, label: dayLabel(m.ts) });
      }
      out.push(m);
      lastTs = m.ts;
    });
    return out;
  }, [msgs]);

  // NEW: open sheet on long-press
  const handleLongPress = (msg) => {
    setSelectedMsg(msg);
    setSheetOpen(true);
  };

  const onCopy = () => {
    setSheetOpen(false);
    // UI-only: if it's an image-only message with no text, show a small toast substitute:
    // In a real app you'd copy to clipboard via 'expo-clipboard'
    // Clipboard.setStringAsync(selectedMsg?.text || selectedMsg?.image || "");
    // For now, just close the sheet.
  };

  const onDelete = () => {
    setSheetOpen(false);
    if (!selectedMsg) return;
    setMsgs((prev) => prev.filter((m) => m.id !== selectedMsg.id && m.id !== `sep-${selectedMsg.ts}`));
  };

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

    return (
      <Pressable onLongPress={() => handleLongPress(item)} delayLongPress={250}>
        <View style={bubbleStyle}>
          {/* Image bubble (optional text below) */}
          {!!item.image && (
            <Image
              source={{ uri: item.image }}
              style={styles.image}
              resizeMode="cover"
            />
          )}
          {!!item.text && <Text style={styles.msg}>{item.text}</Text>}

          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {new Date(item.ts).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {mine && <StatusTicks status={item.status} />}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBack title={title} subtitle={subtitle} avatar={avatar} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Typing pill */}
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
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 12 }}
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
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
        />

        {/* Composer */}
        <View style={styles.inputRow}>
          {/* NEW: Attach button (UI-only) */}
          <Pressable
            onPress={() => setAttachOpen(true)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, paddingHorizontal: 6 }]}
            accessibilityLabel="Attach image"
          >
            <Ionicons name="attach-outline" size={22} color={COLORS.textMuted} />
          </Pressable>

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
          <Pressable style={styles.send} onPress={onSend}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* NEW: ActionSheet for message options */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <View />
        </Pressable>
        <View style={styles.sheetCard}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Message actions</Text>
          <Pressable style={styles.sheetBtn} onPress={onCopy}>
            <Ionicons name="copy-outline" size={18} color={COLORS.text} />
            <Text style={styles.sheetBtnText}>Copy</Text>
          </Pressable>
          <Pressable style={[styles.sheetBtn, { borderTopWidth: 0 }]} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            <Text style={[styles.sheetBtnText, { color: COLORS.error }]}>Delete</Text>
          </Pressable>
          <Pressable style={styles.sheetCancel} onPress={() => setSheetOpen(false)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* NEW: Attachment sheet (simple) */}
      <Modal
        visible={attachOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setAttachOpen(false)}>
          <View />
        </Pressable>
        <View style={styles.sheetCard}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add attachment</Text>
          <Pressable style={styles.sheetBtn} onPress={onAttachImage}>
            <Ionicons name="image-outline" size={18} color={COLORS.text} />
            <Text style={styles.sheetBtnText}>Attach image (placeholder)</Text>
          </Pressable>
          <Pressable style={styles.sheetCancel} onPress={() => setAttachOpen(false)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// Status ticks for your messages
function StatusTicks({ status }) {
  const s = status || "sent";
  const isDelivered = s === "delivered" || s === "read";
  const isRead = s === "read";
  return (
    <View style={styles.ticks}>
      <View
        style={[
          styles.tick,
          styles.tickOn,
          isRead ? { backgroundColor: "transparent", borderColor: COLORS.accent } : null,
        ]}
      />
      <View
        style={[
          styles.tick,
          isDelivered ? styles.tickOn : styles.tickOff,
          isRead ? { backgroundColor: "transparent", borderColor: COLORS.accent } : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // bubbles
  bubble: { maxWidth: "78%", padding: 10, borderRadius: 12 },
  left: { backgroundColor: COLORS.surface, alignSelf: "flex-start" },
  right: { backgroundColor: COLORS.accent, alignSelf: "flex-end" },
  msg: { color: "#fff" },

  // image message
  image: {
    width: 230,
    height: 150,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#00000022",
  },

  // time + ticks
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 },
  meta: { color: "#e0e0e0aa", fontSize: 10 },
  ticks: { flexDirection: "row", gap: 3 },
  tick: {
    width: 8,
    height: 8,
    borderRadius: 1,
    transform: [{ rotate: "45deg" }],
    borderWidth: 1,
    borderColor: "#ffffff88",
  },
  tickOn: { backgroundColor: "#ffffffdd" },
  tickOff: { backgroundColor: "transparent" },

  // day separator
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

  // typing
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

  // composer
  inputRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
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
    height: 44,
  },
  send: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },

  // action sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "#00000088",
  },
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
  sheetTitle: {
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 8,
  },
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
});
