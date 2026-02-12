// components/messages/NewMessageModal.js
//
// UPDATED (2026-02-12)
//
// CHANGES:
// - ADD real profile image rendering
// - KEEP avatar fallback (initial if no image)
// - MATCH search logic from UserSearchCard
//

import { Ionicons } from "@expo/vector-icons";
import { useSearchUsersLazyQuery } from "@sixbyfive/tcg-binder/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { COLORS } from "../../theme/colors";

function safeString(v) {
  return String(v ?? "").trim();
}

export default function NewMessageModal({
  visible,
  onClose,
  onSelectUser,
  recentUsers = [],
  title = "New message",
  placeholder = "Search by username…",
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const normalized = trimmed.replace(/^@/, "");
  const minLen = 2;

  const [runSearch, { data, loading, error }] = useSearchUsersLazyQuery({
    fetchPolicy: "cache-first",
  });

  // ✅ Map search results (include avatarUrl)
  const results = useMemo(() => {
    const list = data?.searchUsers ?? [];
    return list.map((u) => ({
      id: u.id ?? u.userId ?? String(u.user?.id ?? ""),
      username: u.user?.username ?? "",
      avatarUrl: u.user?.avatar || u.avatar || undefined,
    }));
  }, [data]);

  // Debounce search
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (normalized.length >= minLen) {
        runSearch({ variables: { query: normalized, limit: 20 } });
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [normalized, runSearch]);

  const showRecents = !trimmed && !loading;

  const exactExists = useMemo(() => {
    if (!normalized) return false;
    const q = normalized.toLowerCase();
    return results.some((u) => (u.username || "").toLowerCase() === q);
  }, [normalized, results]);

  const showNotFound =
    normalized.length >= minLen &&
    !loading &&
    !exactExists &&
    results.length === 0;

  const close = () => {
    setQuery("");
    onClose?.();
  };

  const pick = (u) => {
    if (!u?.id) return;
    onSelectUser?.(u);
    setQuery("");
  };

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <View />
      </Pressable>

      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={close} hitSlop={10}>
            <Ionicons name="close" size={22} color={COLORS.textMuted} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {loading ? (
            <ActivityIndicator size="small" />
          ) : query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons
                name="close-circle"
                size={18}
                color={COLORS.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        {showNotFound && (
          <View style={styles.notFound}>
            <Ionicons name="alert-circle-outline" size={16} color="#ff6b6b" />
            <Text style={styles.notFoundText}>No user named @{normalized}</Text>
          </View>
        )}

        {!!error && (
          <Text style={styles.errorText}>
            {error.message || "Search failed"}
          </Text>
        )}

        {/* Recents */}
        {showRecents && recentUsers.length > 0 && (
          <FlatList
            data={recentUsers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingTop: 10 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item)}
                style={({ pressed }) => [
                  styles.row,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Avatar username={item.username} avatarUrl={item.avatarUrl} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.username}</Text>
                  <Text style={styles.preview}>
                    {item.preview || "Recent conversation"}
                  </Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Recent</Text>
                </View>
              </Pressable>
            )}
          />
        )}

        {/* Results */}
        {!showRecents && (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingTop: 10 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item)}
                style={({ pressed }) => [
                  styles.row,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Avatar username={item.username} avatarUrl={item.avatarUrl} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.username}</Text>
                  <Text style={styles.preview}>Tap to start chatting</Text>
                </View>
              </Pressable>
            )}
          />
        )}

        <Pressable
          onPress={close}
          style={({ pressed }) => [
            styles.cancel,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/* Avatar with image fallback */
function Avatar({ username, avatarUrl }) {
  const initial = safeString(username).slice(0, 1).toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={styles.avatarImage}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#00000088" },

  card: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 90,
    bottom: 90,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderColor: COLORS.border,
    borderWidth: 1,
    padding: 12,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 16 },

  searchRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.alt,
    borderRadius: 12,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: COLORS.text },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.alt,
    borderRadius: 12,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },

  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.alt,
  },

  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: { color: COLORS.text, fontWeight: "900" },

  name: { color: COLORS.text, fontWeight: "900" },
  preview: { color: COLORS.textMuted, marginTop: 2 },

  pill: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: { color: COLORS.textMuted, fontWeight: "800", fontSize: 12 },

  notFound: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#2a1212",
    borderWidth: 1,
    borderColor: "#4d1a1a",
  },
  notFoundText: { color: "#ffb3b3", fontWeight: "800" },

  errorText: { color: "#ff6b6b", marginTop: 6 },

  cancel: {
    marginTop: 10,
    backgroundColor: COLORS.alt,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelText: { color: COLORS.text, fontWeight: "900" },
});
