// components/home/UserSearchCard.js
// NEW: Home user search card (UI-only)
// - Debounced search input, shows recent chips when empty
// - Renders results with avatar, display name, username, and trailing action
// - Buttons are wired via props (onSelectUser, onToggleFollow, onSearch)
// - Handles loading + error states gracefully
// - Compact card visuals to match SubscriptionCard style (no new deps)

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { COLORS } from "../../theme/colors";

/**
 * Props
 * - initialQuery?: string
 * - results?: Array<{ id: string, username: string, displayName?: string, avatarUrl?: string, isFollowing?: boolean }>
 * - loading?: boolean
 * - error?: string | null
 * - recent?: string[]        // recent search terms
 * - onSearch?: (query: string) => void   // called (debounced) when query changes
 * - onSelectUser?: (user) => void        // when a result row is pressed
 * - onToggleFollow?: (user) => void      // when the trailing Follow/Following is pressed
 * - onUseRecent?: (term: string) => void // when a recent chip is tapped
 * - onClearRecent?: () => void           // clear all recents (optional)
 * - style?: object
 */
export default function UserSearchCard({
  initialQuery = "",
  results = [],
  loading = false,
  error = null,
  recent = [],
  onSearch,
  onSelectUser,
  onToggleFollow,
  onUseRecent,
  onClearRecent,
  style,
}) {
  // ----- query state + debounce ------------------------------------------------
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef(null);

  useEffect(() => {
    // Debounce to avoid spamming parent on every keystroke
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch?.(query.trim());
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, onSearch]);

  const showRecents = !query.trim() && !loading && !error;

  // ----- header actions --------------------------------------------------------
  const clearQuery = () => {
    setQuery("");
    onSearch?.("");
  };

  const submitSearch = () => {
    clearTimeout(debounceRef.current);
    onSearch?.(query.trim());
    Keyboard.dismiss();
  };

  // ----- UI -------------------------------------------------------------------
  return (
    <View style={[styles.card, style]}>
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
        />
        {loading ? (
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

      {/* Feedback row (error or hint) */}
      {error ? (
        <Text style={styles.errorText} numberOfLines={2}>
          {error}
        </Text>
      ) : (
        !loading &&
        !results.length &&
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
                key={term}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  setQuery(term);
                  onUseRecent?.(term);
                  // fire search immediately when tapping a chip
                  clearTimeout(debounceRef.current);
                  onSearch?.(term);
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

      {/* Results */}
      {results.length > 0 && (
        <View style={styles.resultsWrap}>
          <FlatList
            data={results}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ResultRow
                user={item}
                onPress={() => onSelectUser?.(item)}
                onToggleFollow={() => onToggleFollow?.(item)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        </View>
      )}
    </View>
  );
}

/* ----------------------------------------------------------------------------
 * Result row
 * ------------------------------------------------------------------------- */
function ResultRow({ user, onPress, onToggleFollow }) {
  const name = user.displayName || user.username;
  const avatar = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2963FF&color=fff`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`Open profile ${name}`}
    >
      <Image source={{ uri: avatar }} style={styles.avatar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>@{user.username}</Text>
      </View>

      {typeof user.isFollowing === "boolean" ? (
        <Pressable
          onPress={onToggleFollow}
          style={({ pressed }) => [
            styles.followBtn,
            user.isFollowing ? styles.following : styles.follow,
            pressed && { opacity: 0.9 },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={user.isFollowing ? "Unfollow" : "Follow"}
        >
          <Text style={[styles.followText, user.isFollowing ? styles.followingText : styles.followText]}>
            {user.isFollowing ? "Following" : "Follow"}
          </Text>
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      )}
    </Pressable>
  );
}

/* ----------------------------------------------------------------------------
 * Styles
 * ------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  title: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
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
  input: {
    flex: 1,
    color: COLORS.text,
    paddingVertical: 0,
    marginRight: 8,
  },

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

  resultsWrap: {
    maxHeight: 320, // keeps the card compact on Home; scrolls internally
  },
  sep: {
    height: 1,
    backgroundColor: COLORS.border,
    opacity: 0.6,
    marginLeft: 52, // indent under avatar
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.alt },
  rowTitle: { color: COLORS.text, fontWeight: "800" },
  rowSub: { color: COLORS.textMuted, fontSize: 12.5 },

  followBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  follow: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  following: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  followText: { fontWeight: "900", color: "#fff" },
  followingText: { color: COLORS.text },
});
