// app/auth/forgot.js

import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import PageHeaderBackSimple from "../components/common/PageHeaderBackSimple";
import { COLORS } from "../theme/colors";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    try {
      // TODO: await requestPasswordReset({ variables: { email } });
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple title="Forgot password" subtitle="We'll email you a reset link" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.content}>
          {sent ? (
            <View style={styles.card}>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.body}>
                If an account exists for <Text style={{ fontWeight: "800", color: COLORS.text }}>{email}</Text>,
                you’ll get a link to reset your password.
              </Text>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => setSent(false)}>
                <Text style={styles.btnPrimaryText}>Send another</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(t) => setEmail(t.trim())}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={onSubmit}
              />
              <Pressable
                style={[styles.btn, styles.btnPrimary, { opacity: submitting || !email ? 0.6 : 1 }]}
                onPress={onSubmit}
                disabled={submitting || !email}
              >
                <Text style={styles.btnPrimaryText}>{submitting ? "Sending…" : "Send reset link"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  card: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 16, padding: 16, gap: 12,
  },
  label: { color: COLORS.text, fontWeight: "800" },
  input: {
    backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: COLORS.text,
  },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  body: { color: COLORS.textSecondary },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: COLORS.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
