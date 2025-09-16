import { useMutation } from "@apollo/client"; // NEW
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import PageHeaderBackSimple from "../components/common/PageHeaderBackSimple";
import { COLORS } from "../theme/colors";

// CHANGED: import your existing generated document (adjust path if needed)
import { RequestPasswordResetDocument } from "@sixbyfive/tcg-binder";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState(""); // NEW

  // NEW: light email validation (prevents accidental whitespace)
  const emailValid = useMemo(() => {
    const e = email.trim();
    return e.length > 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }, [email]);

  // NEW: wire up GraphQL mutation using your existing doc
  const [requestReset] = useMutation(RequestPasswordResetDocument);

  const onSubmit = async () => {
    if (!emailValid || submitting) return;
    setSubmitting(true);
    setErrorMsg(""); // NEW
    try {
      // CHANGED: call your resolver
      const { data } = await requestReset({ variables: { email: email.trim() } });

      // Tolerate different API shapes: object w/ ok/message OR bare boolean
      const payload = data?.requestPasswordReset;
      const ok = payload?.ok === true || payload === true;

      if (!ok) {
        setErrorMsg(payload?.message || "We couldn't send a reset email right now. Please try again.");
        setSent(false);
        return;
      }

      setSent(true);
    } catch (err) {
      setErrorMsg(err?.message || "Network error. Please try again.");
      setSent(false);
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
                If an account exists for{" "}
                <Text style={{ fontWeight: "800", color: COLORS.text }}>{email.trim()}</Text>,
                you’ll get a link to reset your password.
              </Text>

              {/* CHANGED: "Send another" now actually re-triggers the mutation */}
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onSubmit} disabled={submitting}>
                <Text style={styles.btnPrimaryText}>{submitting ? "Sending…" : "Send another"}</Text>
              </Pressable>

              {/* NEW: Let user change email without losing the success card */}
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setSent(false)} disabled={submitting}>
                <Text style={styles.btnGhostText}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(t) => setEmail(t)} // CHANGED: keep raw input; trim on send
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={onSubmit}
              />

              {/* NEW: inline error */}
              {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

              <Pressable
                style={[styles.btn, styles.btnPrimary, { opacity: submitting || !emailValid ? 0.6 : 1 }]}
                onPress={onSubmit}
                disabled={submitting || !emailValid}
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
  error: { color: COLORS.error || "#ff6b6b" }, // NEW
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: COLORS.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  // NEW
  btnGhost: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: "transparent" },
  btnGhostText: { color: COLORS.text, fontWeight: "800" },
});
