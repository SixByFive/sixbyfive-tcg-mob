// app/reset-password.js

import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import PageHeaderBackSimple from "../components/common/PageHeaderBackSimple";
import { COLORS } from "../theme/colors";

export default function ResetPassword() {
  const { token } = useLocalSearchParams();
  const hasToken = useMemo(() => typeof token === "string" && token.length > 10, [token]);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const match = pw1.length >= 8 && pw1 === pw2;

  const onSave = async () => {
    if (!match || !hasToken || saving) return;
    setSaving(true);
    try {
      // TODO: await resetPassword({ variables: { token, newPassword: pw1 } });
      router.replace("/auth"); // back to auth (or auto-login)
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple title="Reset password" subtitle={hasToken ? "Create a new password" : "Invalid or missing link"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.label}>New password</Text>
            <TextInput
              value={pw1}
              onChangeText={setPw1}
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              value={pw2}
              onChangeText={setPw2}
              secureTextEntry
              placeholder="Repeat password"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={onSave}
            />
            {!match && (pw1.length > 0 || pw2.length > 0) && (
              <Text style={styles.error}>Passwords must match and be at least 8 characters.</Text>
            )}
            <Pressable
              style={[styles.btn, styles.btnPrimary, { opacity: match && hasToken && !saving ? 1 : 0.6 }]}
              onPress={onSave}
              disabled={!match || !hasToken || saving}
            >
              <Text style={styles.btnPrimaryText}>{saving ? "Saving…" : "Save password"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  card: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 16, padding: 16, gap: 10,
  },
  label: { color: COLORS.text, fontWeight: "800" },
  input: {
    backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: COLORS.text,
  },
  error: { color: COLORS.error || "#ff6b6b" },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: COLORS.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
