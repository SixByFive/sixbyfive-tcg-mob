// components/profile/ProfileEditForm.js
// NEW: Reusable profile edit form (UI-only).
// - Username is read-only (no editing).
// - Includes avatar picker (expo-image-picker), displayName, bio, favouritePokemon.
// - Validates displayName (2–40) and bio (<=160).
// - Exposes onSave(values) and onCancel() via props.

import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { COLORS } from "../../theme/colors";
import PageHeaderBack from "../common/PageHeaderBack";
import FormField from "./FormField";

const avatarPlaceholder = (nameOrUsername) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(nameOrUsername || "User")}&background=2963FF&color=fff`;

export default function ProfileEditForm({
  initial,          // { displayName, bio, favouritePokemon, avatarUrl, username }
  onSave,           // (values) => void
  onCancel,         // () => void
  saving = false,   // parent controls saving state
}) {
  // ----- Seed from props -----
  const seed = useMemo(() => {
    const displayName = initial?.displayName ?? "";
    const username = initial?.username ?? "";
    const bio = initial?.bio ?? "";
    const favouritePokemon = initial?.favouritePokemon ?? "";
    const avatarUrl = initial?.avatarUrl ?? avatarPlaceholder(displayName || username);
    return { displayName, username, bio, favouritePokemon, avatarUrl };
  }, [initial]);

  // ----- Local state (editable) -----
  const [displayName, setDisplayName] = useState(seed.displayName);
  const [bio, setBio] = useState(seed.bio);
  const [favouritePokemon, setFavouritePokemon] = useState(seed.favouritePokemon);
  const [avatarUrl, setAvatarUrl] = useState(seed.avatarUrl);

  // Keep in sync if parent changes (e.g., refetch)
  useEffect(() => {
    setDisplayName(seed.displayName);
    setBio(seed.bio);
    setFavouritePokemon(seed.favouritePokemon);
    setAvatarUrl(seed.avatarUrl);
  }, [seed.displayName, seed.bio, seed.favouritePokemon, seed.avatarUrl]);

  // ----- Dirty + validation -----
  const isDirty =
    displayName !== seed.displayName ||
    bio !== seed.bio ||
    favouritePokemon !== seed.favouritePokemon ||
    avatarUrl !== seed.avatarUrl;

  const displayNameValid =
    displayName.trim().length >= 2 && displayName.trim().length <= 40;
  const bioValid = bio.length <= 160;
  const formValid = displayNameValid && bioValid;

  // ----- Avatar picker (UI-only) -----
  const pickAvatar = async () => {
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
      // TODO: upload res.assets[0].uri -> remote URL -> setAvatarUrl(remoteUrl)
      setAvatarUrl(res.assets[0].uri); // show immediately
    }
  };

  const handleSave = () => {
    if (!isDirty || !formValid || saving) return;
    onSave?.({
      displayName: displayName.trim(),
      bio,
      favouritePokemon,
      avatarUrl,
      username: seed.username, // read-only; pass back unchanged
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Back header shows avatar + title; username is read-only */}
      <PageHeaderBack
        title="Edit Profile"
        subtitle={`@${seed.username}`}
        avatar={avatarUrl}
        onBack={onCancel}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        {/* Avatar row */}
        <View style={styles.avatarRow}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={pickAvatar}
          >
            <Text style={styles.secondaryBtnText}>Change avatar</Text>
          </Pressable>
        </View>

        {/* Display name */}
        <FormField label="Display name">
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={COLORS.textMuted}
            style={[styles.input, !displayNameValid && styles.inputError]}
          />
          {!displayNameValid && (
            <Text style={styles.errorText}>2–40 characters required.</Text>
          )}
        </FormField>

        {/* Username (read-only) */}
        <FormField label="Username" hint="Usernames cannot be changed">
          <View style={[styles.input, styles.readonly]}>
            <Text style={{ color: COLORS.textMuted }}>@{seed.username}</Text>
          </View>
        </FormField>

        {/* Bio */}
        <FormField label="Bio" hint="Max 160 characters">
          <TextInput
            value={bio}
            onChangeText={setBio}
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

        {/* Favourite Pokémon */}
        <FormField label="Favourite Pokémon">
          <TextInput
            value={favouritePokemon}
            onChangeText={setFavouritePokemon}
            placeholder="e.g., Lugia"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
        </FormField>

        {/* Actions */}
        <View style={styles.actions}>
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
