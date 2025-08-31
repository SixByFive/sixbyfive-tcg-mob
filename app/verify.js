// app/verify.js

import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import PageHeaderBack from "../components/common/PageHeaderBack";
import { COLORS } from "../theme/colors";

export default function VerifyAccount() {
  const { token } = useLocalSearchParams();
  const hasToken = useMemo(() => typeof token === "string" && token.length > 10, [token]);
  const [status, setStatus] = useState(hasToken ? "verifying" : "invalid"); // verifying | success | error | invalid

  useEffect(() => {
    if (!hasToken) return;
    (async () => {
      try {
        // TODO: await verifyAccount({ variables: { token } });
        setStatus("success");
      } catch (e) {
        setStatus("error");
      }
    })();
  }, [hasToken, token]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBack title="Verify account" subtitle="Email verification" />
      <View style={styles.content}>
        {status === "verifying" && (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.muted}>Verifying your account…</Text>
          </View>
        )}

        {status === "success" && (
          <View style={styles.card}>
            <Text style={styles.title}>All set 🎉</Text>
            <Text style={styles.body}>Your email has been verified.</Text>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => router.replace("/(tabs)/profile")}>
              <Text style={styles.btnPrimaryText}>Continue</Text>
            </Pressable>
          </View>
        )}

        {status === "error" && (
          <View style={styles.card}>
            <Text style={styles.title}>Hmm, that didn’t work</Text>
            <Text style={styles.body}>The link may have expired or was already used.</Text>
            <Pressable style={[styles.btn, styles.btnAlt]} onPress={() => router.replace("/auth")}>
              <Text style={styles.btnAltText}>Back to sign in</Text>
            </Pressable>
          </View>
        )}

        {status === "invalid" && (
          <View style={styles.card}>
            <Text style={styles.title}>Invalid link</Text>
            <Text style={styles.body}>Missing or malformed token.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  center: { alignItems: "center", gap: 8, paddingTop: 20 },
  muted: { color: COLORS.textMuted },
  card: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 16, padding: 16, gap: 10,
  },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  body: { color: COLORS.textSecondary },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: COLORS.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  btnAlt: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  btnAltText: { color: COLORS.text, fontWeight: "800" },
});
