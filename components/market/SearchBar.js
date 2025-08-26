// components/market/SearchBar.js

import React from "react";
import { StyleSheet, TextInput } from "react-native";
import { COLORS } from "../../theme/colors";

export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      returnKeyType="search"
      style={styles.search}
    />
  );
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
