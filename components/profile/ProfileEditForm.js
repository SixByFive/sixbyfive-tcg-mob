import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../theme/colors";

import PageHeaderBack from "../common/PageHeaderBack";
import FormField from "./FormField";

const avatarPlaceholder = (nameOrUsername) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(nameOrUsername || "User")}&background=2963FF&color=fff`;

// Normalize an avatar value JUST for display in RN <Image/>
// - keeps relative paths as absolute using env base
// - leaves local file/content URIs alone
// - upgrades protocol-relative to https
const toDisplayUri = (u) => {
  if (!u) return null;
  if (/^file:|^content:/i.test(u)) return u; // picked locally
  if (u.startsWith("//")) return `https:${u}`;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) {
    const base =
      process.env.EXPO_PUBLIC_ASSET_BASE_URL ||
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      "";
    if (!base) return null;
    return `${base.replace(/\/+$/, "")}${u}`;
  }
  return u; // best effort
};

export default function ProfileEditForm({
  initial,          // { displayName, bio, favouritePokemon, avatarUrl, username }
  onSave,           // (values) => void
  onCancel,         // () => void
  saving = false,   // parent controls saving state
}) {
  const insets = useSafeAreaInsets();

  // ----- Seed from props -----
  const seed = useMemo(() => {
    const displayName = initial?.displayName ?? "";
    const username = initial?.username ?? "";
    const bio = initial?.bio ?? "";
    const favouritePokemon = initial?.favouritePokemon ?? "";
    // IMPORTANT: keep the raw avatar value (may be relative); only normalize for display
    const rawAvatar = initial?.avatarUrl ?? "";
    const avatarUrl = rawAvatar || avatarPlaceholder(displayName || username);
    return { displayName, username, bio, favouritePokemon, avatarUrl, rawAvatar };
  }, [initial]);

  // ----- Local state (editable) -----
  const [displayName, setDisplayName] = useState(seed.displayName);
  const [bio, setBio] = useState(seed.bio);
  const [favouritePokemon, setFavouritePokemon] = useState(seed.favouritePokemon);
  const [avatarUrl, setAvatarUrl] = useState(seed.avatarUrl); // keep raw; may be relative or placeholder

  // Keep in sync if parent changes (e.g., refetch)
  useEffect(() => {
    setDisplayName(seed.displayName);
    setBio(seed.bio);
    setFavouritePokemon(seed.favouritePokemon);
    setAvatarUrl(seed.avatarUrl);
  }, [seed.displayName, seed.bio, seed.favouritePokemon, seed.avatarUrl]);

  // ----- Dirty + validation -----
  const isDirty =
    bio !== seed.bio ||
    favouritePokemon !== seed.favouritePokemon ||
    avatarUrl !== seed.avatarUrl;

  const displayNameValid =
    displayName.trim().length >= 2 && displayName.trim().length <= 40;
  const bioValid = bio.length <= 160;
  const formValid = displayNameValid && bioValid;

  // ----- Avatar picker (Expo-safe) -----
  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo library access to change avatar.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!res.canceled && res.assets?.length) {
        // we store the local file:// URI; parent will upload/translate on save
        setAvatarUrl(res.assets[0].uri);
      }
    } catch (e) {
      console.warn("ImagePicker error:", e);
      Alert.alert("Image picker error", "Something went wrong opening your photo library.");
    }
  };

  const handleSave = () => {
    if (!isDirty || !formValid || saving) return;
    onSave?.({
      bio,
      favouritePokemon,
      avatarUrl,       // raw value (file://, relative, or absolute)
      username: seed.username,
    });
  };

  // ----- Keyboard-safe scrolling -----
  const scrollRef = useRef(null);
  const fieldYRef = useRef({}); // { bio: number, favourite: number, displayName: number }

  const rememberY = (key) => (e) => {
    fieldYRef.current[key] = e.nativeEvent.layout.y;
  };

  const scrollToField = (key) => {
    const y = fieldYRef.current[key] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  // Header height + status bar offset for iOS keyboard avoidance
  const KEYBOARD_VERTICAL_OFFSET = (insets?.top ?? 0) + 60;

  // Normalized URI for display only; keeps placeholder visual if needed
  const displayAvatar = toDisplayUri(
    typeof avatarUrl === "string" && avatarUrl ? avatarUrl : avatarPlaceholder(seed.displayName || seed.username)
  ) || avatarPlaceholder(seed.displayName || seed.username);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBack
        title="Edit Profile"
        subtitle={`@${seed.username}`}
        avatar={displayAvatar}   // pass a normalized, displayable URI
        onBack={onCancel}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: (insets?.bottom ?? 0) + 160,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar row */}
          <View style={styles.avatarRow} onLayout={rememberY("avatar")}>
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={pickAvatar}
            >
              <Text style={styles.secondaryBtnText}>Change avatar</Text>
            </Pressable>
          </View>

          {/* Username (read-only) */}
          <View onLayout={rememberY("username")}>
            <FormField label="Username" hint="Usernames cannot be changed">
              <View style={[styles.input, styles.readonly]}>
                <Text style={{ color: COLORS.textMuted }}>@{seed.username}</Text>
              </View>
            </FormField>
          </View>

          {/* Bio */}
          <View onLayout={rememberY("bio")}>
            <FormField label="Bio" hint="Max 160 characters">
              <TextInput
                value={bio}
                onChangeText={setBio}
                onFocus={() => scrollToField("bio")}
                placeholder="Tell people about your collection"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { height: 88, textAlignVertical: "top" }, !bioValid && styles.inputError]}
                multiline
                maxLength={200}
              />
              {!bioValid && (
                <Text style={styles.errorText}>Keep it under 160 characters.</Text>
              )}
            </FormField>
          </View>

          {/* Favourite Pokémon */}
          <View onLayout={rememberY("favourite")}>
            <FormField label="Favourite Pokémon">
              <TextInput
                value={favouritePokemon}
                onChangeText={setFavouritePokemon}
                onFocus={() => scrollToField("favourite")}
                placeholder="e.g., Lugia"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                returnKeyType="done"
              />
            </FormField>
          </View>

          {/* Actions */}
          <View style={styles.actions} onLayout={rememberY("actions")}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving || !isDirty || !formValid}
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed || saving || !isDirty || !formValid ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.alt },

  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
  },
  readonly: { opacity: 0.6 },
  inputError: { borderColor: COLORS.error || "#ff6b6b" },
  errorText: { color: COLORS.error || "#ff6b6b", marginTop: 6, fontSize: 12 },

  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  primaryBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  primaryBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 0.2 },
  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: "800" },
});
