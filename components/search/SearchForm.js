// components/search/SearchForm.js

import { COLORS } from "../../theme/colors";

import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function SearchForm({
  name,
  setName,
  setCode,
  setSetCode,
  number,
  setNumber,
  canSearch,
  loading,
  onSearch,
  errorMessage,
}) {
  return (
    <View style={styles.searchCard}>
      <View style={styles.formRow}>
        <View style={styles.formField}>
          <Text style={styles.label}>Card Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Pikachu"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={onSearch}
          />
        </View>

        <View style={styles.formField}>
          <Text style={styles.label}>Set</Text>
          <TextInput
            value={setCode}
            onChangeText={setSetCode}
            placeholder="e.g. SSP"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            style={styles.input}
            returnKeyType="next"
          />
        </View>

        <View style={styles.formField}>
          <Text style={styles.label}>Number</Text>
          <TextInput
            value={number}
            onChangeText={setNumber}
            placeholder="e.g. 201"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={onSearch}
            keyboardType="numeric"
          />
        </View>
      </View>

      <Pressable
        onPress={onSearch}
        disabled={!canSearch || loading}
        style={({ pressed }) => [
          styles.searchBtn,
          (!canSearch || loading) && { opacity: 0.7 },
          pressed && { transform: [{ translateY: 1 }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.searchBtnText}>Search</Text>
        )}
      </Pressable>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 8,
    padding: 12,
    paddingBottom: 10,
    borderRadius: 16,
  },
  formRow: { flexDirection: "row", gap: 8 },
  formField: { flex: 1 },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  searchBtn: {
    marginTop: 10,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
  },
  searchBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  errorText: { marginTop: 10, color: COLORS.error },
});
