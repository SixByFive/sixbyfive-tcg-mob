// components/home/UserSearchCard.js

import { Ionicons } from "@expo/vector-icons";
import { useSearchUsersLazyQuery } from "../../hooks/useSearchUsersLazyQuery";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../theme/colors";

export default function UserSearchCard({
  initialQuery = "",
  // If you pass results/loading/error, the card becomes "controlled" and will NOT call GraphQL.
  results,
  loading,
  error = null,
  recent = [],
  onSearch,          // controlled search handler
  onSelectUser,      // if provided, card will NOT navigate itself (prevents double push)
  onToggleFollow,
  onUseRecent,
  onClearRecent,
  onCommitRecent,    // commit chosen/typed term; parent can cap to 5 & dedupe
  style,
}) {
  const insets = useSafeAreaInsets();

  // ── state & mode ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState(initialQuery);
  const trimmed = query.trim();
  const normalized = trimmed.replace(/^@/, "");
  const minLen = 2;

  const controlledMode = results !== undefined || typeof loading === "boolean";

  // Keep latest onSearch ref to avoid effect deps thrash
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // ── GraphQL (uncontrolled/self-fetch mode) ─────────────────────────────────
  const [runSearch, { data, loading: remoteLoading, error: remoteError }] =
    useSearchUsersLazyQuery({ fetchPolicy: "cache-first" });

  const mappedRemoteResults = useMemo(() => {
    const list = data?.searchUsers ?? [];
    return list.map((u) => ({
      id: u.id ?? u.userId ?? String(u.user?.id ?? ""),
      // searchUsers returns a flat PublicUser; keep u.user as a fallback for profile-shaped rows
      username: u.username ?? u.user?.username ?? "",
      displayName: u.username ?? u.user?.username ?? "",
      avatarUrl: u.user?.avatar || u.avatar || undefined,
      isFollowing: false,
    }));
  }, [data]);

  // ── debounce search ─────────────────────────────────────────────────────────
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (controlledMode) {
        onSearchRef.current?.(trimmed);
        return;
      }
      if (normalized.length >= minLen || trimmed.length >= minLen) {
        runSearch({ variables: { q: trimmed, limit: 20 } });
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [trimmed, normalized, controlledMode, runSearch]);

  // ── derived UI state ───────────────────────────────────────────────────────
  const effectiveResults = controlledMode ? results || [] : mappedRemoteResults;
  const effectiveLoading = controlledMode ? !!loading : !!remoteLoading;
  const effectiveError = controlledMode ? error : remoteError?.message || null;

  const showRecents = !trimmed && !effectiveLoading && !effectiveError;

  // We only use exact-exists to show a more specific "No user named @…" banner
  const exactExists = useMemo(() => {
    if (!normalized) return false;
    const q = normalized.toLowerCase();
    return effectiveResults.some((u) => (u.username || "").toLowerCase() === q);
  }, [normalized, effectiveResults]);

  const showNotFound =
    !!normalized &&
    normalized.length >= minLen &&
    !effectiveLoading &&
    !exactExists;

  // ── helpers ────────────────────────────────────────────────────────────────
  const clearQuery = () => {
    setQuery("");
    onSearchRef.current?.("");
  };

  const commitRecent = (term) => {
    const t = (term || "").trim();
    if (t.length >= minLen) onCommitRecent?.(t);
  };

  const goToProfile = (user) => {
    // If parent provides a handler, let it own navigation to prevent a double push.
    if (onSelectUser) {
      onSelectUser(user);
      commitRecent(user.username);
      return;
    }
    // Otherwise, navigate ourselves.
    commitRecent(user.username);
    router.push(`/profile/${encodeURIComponent(user.username)}`);
  };

  const submitSearch = () => {
    // No quick-open: just commit the term to the parent (optional) and run the search handler.
    clearTimeout(debounceRef.current);
    onSearchRef.current?.(trimmed);
    if (trimmed.length >= minLen) commitRecent(trimmed);
    Keyboard.dismiss();
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.card, style, { paddingBottom: 12 + insets.bottom }]}>
      <Text style={styles.title}>Find collectors</Text>

      {/* Search input */}
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submitSearch}
          placeholder="Search users by name or @username"
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          enterKeyHint="search"
        />
        {effectiveLoading ? (
          <ActivityIndicator size="small" />
        ) : query.length > 0 ? (
          <Pressable
            onPress={clearQuery}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Not-found banner (exact username typed but not present in results) */}
      {showNotFound && (
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.error || "#ff6b6b"} />
          <Text style={styles.notFoundText} numberOfLines={2}>
            No user named @{normalized}
          </Text>
        </View>
      )}

      {/* Error / empty */}
      {effectiveError ? (
        <Text style={styles.errorText} numberOfLines={2}>
          {effectiveError}
        </Text>
      ) : (
        !effectiveLoading &&
        effectiveResults.length === 0 &&
        !showRecents && <Text style={styles.hint}>No users found.</Text>
      )}

      {/* Recents */}
      {showRecents && recent.length > 0 && (
        <View style={styles.recentsBlock}>
          <View style={styles.recentsHeader}>
            <Text style={styles.recentsTitle}>Recent</Text>
            {onClearRecent && (
              <Pressable onPress={onClearRecent} hitSlop={8}>
                <Text style={styles.clearAll}>Clear</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.chipsRow}>
            {recent.map((term) => (
              <Pressable
                key={term.toLowerCase()}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  setQuery(term);
                  clearTimeout(debounceRef.current);
                  if (controlledMode) {
                    onSearchRef.current?.(term);
                    onUseRecent?.(term);
                  } else if (term.trim().length >= minLen) {
                    runSearch({ variables: { q: term.trim(), limit: 20 } });
                  }
                }}
              >
                <Ionicons name="time-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {term}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Results (inner ScrollView avoids nested VirtualizedList warning) */}
      {effectiveResults.length > 0 && (
        <View style={styles.resultsWrap}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom }}
          >
            {effectiveResults.map((item) => (
              <View key={String(item.id)}>
                <ResultRow
                  user={item}
                  onOpenProfile={() => goToProfile(item)}
                  onToggleFollow={() => onToggleFollow?.(item)}
                />
                <View style={styles.sep} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* Row */
function ResultRow({ user, onOpenProfile, onToggleFollow }) {
  const name = user.displayName || user.username;
  const avatar =
    user.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2963FF&color=fff`;

  return (
    <Pressable
      onPress={onOpenProfile}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`Open profile ${name}`}
    >
      <Image source={{ uri: avatar }} style={styles.avatar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>@{user.username}</Text>
      </View>
        

      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </Pressable>
  );
}

/* Styles */
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 14.5, letterSpacing: 0.2 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: { flex: 1, color: COLORS.text, paddingVertical: 0, marginRight: 8 },

  // not-found banner
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

  errorText: { color: COLORS.error || "#ff6b6b", fontSize: 12.5 },
  hint: { color: COLORS.textMuted, fontSize: 12.5 },

  recentsBlock: { gap: 8 },
  recentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recentsTitle: { color: COLORS.text, fontWeight: "800" },
  clearAll: { color: COLORS.textMuted, fontWeight: "800" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    maxWidth: "100%",
  },
  chipText: { color: COLORS.text, fontWeight: "800" },

  // Results area (capped height; inner ScrollView can scroll)
  resultsWrap: { maxHeight: 320 },
  sep: { height: 1, backgroundColor: COLORS.border, opacity: 0.6, marginLeft: 52 },

  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.alt },
  rowTitle: { color: COLORS.text, fontWeight: "800" },
  rowSub: { color: COLORS.textMuted, fontSize: 12.5 },

  followBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  follow: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  following: { backgroundColor: COLORS.background, borderColor: COLORS.border },
  followText: { fontWeight: "900", color: "#fff" },
  followingText: { color: COLORS.text },
});
