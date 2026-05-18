import { useMutation } from "@apollo/client"; // NEW
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import PageHeaderBackSimple from "../components/common/PageHeaderBackSimple";
import { COLORS } from "../theme/colors";

// CHANGED: import your existing generated document (adjust path if needed)
import { ResetPasswordDocument } from "../graphql/documents";


export default function ResetPassword() {
  const { token } = useLocalSearchParams();
  const hasToken = useMemo(() => typeof token === "string" && token.length > 10, [token]);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(""); // NEW

  const match = pw1.length >= 8 && pw1 === pw2;

  // NEW: wire up GraphQL mutation using your existing doc
  const [resetPasswordMutation] = useMutation(ResetPasswordDocument);

  const onSave = async () => {
    if (!match || !hasToken || saving) return;
    setSaving(true);
    setErrorMsg(""); // NEW

    try {
      // CHANGED: call your resolver
      const { data } = await resetPasswordMutation({
        variables: { token, newPassword: pw1 },
      });

      // Tolerate different API shapes: object w/ ok/message OR bare boolean
      const payload = data?.resetPassword;
      const ok = payload?.ok === true || payload === true;

      if (!ok) {
        setErrorMsg(payload?.message || "Could not reset your password. The link may be invalid or expired.");
        return;
      }

      // OPTIONAL: if your API returns auth tokens, auto-login here.
      // if (payload?.auth?.accessToken) {
      //   await authStore.loginWithTokens(payload.auth);
      //   router.replace("/");
      //   return;
      // }

      router.replace("/auth"); // back to auth on success
    } catch (err) {
      setErrorMsg(err?.message || "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple
        title="Reset password"
        subtitle={hasToken ? "Create a new password" : "Invalid or missing link"}
      />
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

            {/* NEW: inline validation + server errors */}
            {!match && (pw1.length > 0 || pw2.length > 0) && (
              <Text style={styles.error}>Passwords must match and be at least 8 characters.</Text>
            )}
            {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

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
  error: { color: COLORS.error || "#ff6b6b" }, // NEW
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: COLORS.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
