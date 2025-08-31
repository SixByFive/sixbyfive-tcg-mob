// components/home/UserSearchCard.js

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { getUserByUsernameLocal, searchUsersLocal } from "../../lib/fakeUsers";
import { COLORS } from "../../theme/colors";

/**
 * Props
 * - initialQuery?: string
 * - results?: Array<...>                     // optional controlled mode
 * - loading?: boolean                        // optional controlled mode
 * - error?: string | null
 * - recent?: string[]
 * - onSearch?: (query: string) => void       // optional controlled mode
 * - onSelectUser?: (user) => boolean|void
 * - onToggleFollow?: (user) => void
 * - onUseRecent?: (term: string) => void
 * - onClearRecent?: () => void
 * - onCommitRecent?: (term: string) => void  // only on submit/quick-open/result tap
 * - style?: object
 */
export default function UserSearchCard({
  initialQuery = "",
  results,
  loading,
  error = null,
  recent = [],
  onSearch,
  onSelectUser,
  onToggleFollow,
  onUseRecent,
  onClearRecent,
  onCommitRecent,
  style,
}) {
  const [query, setQuery] = useState(initialQuery);

  // local fallback search
  const [localResults, setLocalResults] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [notFound, setNotFound] = useState("");

  const usingLocal = !onSearch && results === undefined && loading === undefined;
  const debounceRef = useRef(null);

  useEffect(() => {
    const trimmed = query.trim();
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (usingLocal) {
        setNotFound("");
        if (!trimmed) { setLocalResults([]); return; }
        setLocalLoading(true);
        const res = await searchUsersLocal(trimmed);
        setLocalResults(res);
        setLocalLoading(false);
      } else {
        onSearch?.(trimmed);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, usingLocal, onSearch]);

  const trimmed = query.trim();
  const normalizedQuery = trimmed.replace(/^@/, "");
  const existsLocally = normalizedQuery.length
    ? !!getUserByUsernameLocal(normalizedQuery)
    : false;

  const showRecents = !trimmed && !(usingLocal ? localLoading : loading) && !error;
  const showQuickOpen = !!normalizedQuery && existsLocally;

  const effectiveResults = usingLocal ? localResults : results || [];
  const effectiveLoading = usingLocal ? localLoading : !!loading;

  const clearQuery = () => {
    setQuery("");
    setLocalResults([]);
    setNotFound("");
    onSearch?.("");
  };

  // helper: commit a recent term (min 2 chars)
  const commitRecent = (term) => {
    const t = (term || "").trim();
    if (t.length >= 2) onCommitRecent?.(t);
  };

  const tryOpenUsername = (name) => {
    const u = getUserByUsernameLocal(name);
    if (!u) {
      setNotFound(name);
      return false;
    }
    setNotFound("");
    commitRecent(u.username);            
    router.push({ pathname: "/profile/[username]", params: { username: u.username } });
    return true;
  };

  const submitSearch = () => {
    clearTimeout(debounceRef.current);
    if (!normalizedQuery.length) {
      onSearch?.(trimmed);
      // Optional: commit plain text searches only 
      // commitRecent(trimmed);
      Keyboard.dismiss();
      return;
    }
    // Only navigate if user exists; otherwise show not-found.
    if (!tryOpenUsername(normalizedQuery)) {
      commitRecent(normalizedQuery);       // Save full attempt (optional)
    }
    Keyboard.dismiss();
  };

  const goToProfile = (user) => {
    const ret = onSelectUser?.(user);
    if (ret === false) return;
    commitRecent(user.username);           
    router.push({ pathname: "/profile/[username]", params: { username: user.username } });
  };

  const openTypedProfile = () => {
    if (!normalizedQuery.length) return;
    tryOpenUsername(normalizedQuery);      // commits if it exists
  };

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>Find collectors</Text>

      <View style={styles.inputWrap}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            const name = t.trim().replace(/^@/, "");
            setNotFound(name && !getUserByUsernameLocal(name) ? name : "");
          }}
          onSubmitEditing={submitSearch}
          placeholder="Search users by name or @username"
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          enterKeyHint="go"
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

      {!!normalizedQuery && !showQuickOpen && (
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.error || "#ff6b6b"} />
          <Text style={styles.notFoundText} numberOfLines={2}>
            No user named @{normalizedQuery}
          </Text>
        </View>
      )}

      {showQuickOpen && (
        <Pressable
          onPress={openTypedProfile}
          style={({ pressed }) => [styles.quickOpen, pressed && { opacity: 0.85 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Open profile @${normalizedQuery}`}
        >
          <Ionicons name="person-circle-outline" size={18} color={COLORS.text} />
          <Text style={styles.quickOpenText} numberOfLines={1}>
            Open @{normalizedQuery}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>
      )}

      {error ? (
        <Text style={styles.errorText} numberOfLines={2}>
          {error}
        </Text>
      ) : (
        !effectiveLoading &&
        effectiveResults.length === 0 &&
        !showRecents &&
        !showQuickOpen && (
          <Text style={styles.hint}>No users found.</Text>
        )
      )}

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
                  const name = term.trim().replace(/^@/, "");
                  setNotFound(name && !getUserByUsernameLocal(name) ? name : "");
                  if (usingLocal) {
                    setLocalLoading(true);
                    searchUsersLocal(term).then((res) => {
                      setLocalResults(res);
                      setLocalLoading(false);
                    });
                  } else {
                    onUseRecent?.(term);
                    onSearch?.(term);
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

      {effectiveResults.length > 0 && (
        <View style={styles.resultsWrap}>
          <FlatList
            data={effectiveResults}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ResultRow
                user={item}
                onOpenProfile={() => goToProfile(item)}
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

  quickOpen: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quickOpenText: { color: COLORS.text, fontWeight: "800", flex: 1 },

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
