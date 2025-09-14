// app/auth.js
import { useMutation } from "@apollo/client";
import { LoginDocument, RegisterDocument } from "@sixbyfive/tcg-binder";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { setToken } from "../lib/auth";

const COLORS = {
  background: "#16171c",
  surface: "#191a20",
  alt: "#23243c",
  text: "#f7f8fa",
  textSecondary: "#b9bedd",
  textMuted: "#8f98bc",
  border: "#31365e",
  accent: "#2963FF",
  accentLight: "#548dff",
  error: "#ff6b6b",
};

export default function Auth() {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const idRef = useRef(null);
  const emailRef = useRef(null);
  const pwRef = useRef(null);

  // focus first field when screen mounts / mode changes
  useEffect(() => {
    const t = setTimeout(() => idRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [mode]);

  const [login, { loading: loggingIn, error: loginErr }] = useMutation(LoginDocument);
  const [register, { loading: registering, error: regErr }] = useMutation(RegisterDocument);

  const busy = loggingIn || registering;
  const errMsg = loginErr?.message || regErr?.message;

  const canSubmit = useMemo(() => {
    if (mode === "login") return identifier.trim().length > 0 && pw.length > 0;
    return identifier.trim().length > 0 && email.trim().length > 0 && pw.length >= 8;
  }, [mode, identifier, email, pw]);

  const onSubmit = async () => {
    if (!canSubmit || busy) return;
    try {
      if (mode === "login") {
        const variables = identifier.includes("@")
          ? { email: identifier.trim(), password: pw }
          : { username: identifier.trim(), password: pw };

        const { data } = await login({ variables });
        const token = data?.login?.token;
        if (token) {
          await setToken(token);
          router.replace("/home");
        }
      } else {
        const { data } = await register({
          variables: { username: identifier.trim(), email: email.trim(), password: pw },
        });
        if (data?.register?.user) setMode("login");
      }
    } catch (e) {
      // errors are already surfaced via Apollo error -> errMsg
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        enableOnAndroid
        extraScrollHeight={24}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={require("../assets/images/tcg-logo-white.png")} style={styles.logo} resizeMode="fill" />
          <Text style={styles.title}>{mode === "login" ? "Welcome back" : "Create your account"}</Text>
          <Text style={styles.subtitle}>Track your collection, build binders, and share your profile.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Username / Email */}
          <View style={styles.field}>
            <Text style={styles.label}>{mode === "login" ? "Username or Email" : "Username"}</Text>
            <TextInput
              ref={idRef}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={mode === "login" ? "username or email" : "username"}
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => (mode === "register" ? emailRef.current?.focus() : pwRef.current?.focus())}
              textContentType={mode === "login" ? "username" : "username"}
            />
          </View>

          {/* Email (register only) */}
          {mode === "register" && (
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                style={styles.input}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => pwRef.current?.focus()}
                textContentType="emailAddress"
              />
            </View>
          )}

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={{ position: "relative" }}>
              <TextInput
                ref={pwRef}
                value={pw}
                onChangeText={setPw}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPw}
                style={[styles.input, { paddingRight: 48 }]}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                textContentType={mode === "login" ? "password" : "newPassword"}
              />
              <Pressable onPress={() => setShowPw((s) => !s)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPw ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>
            {mode === "register" ? (
              <Text style={styles.hint}>Use at least 8 characters</Text>
            ) : (
              <Pressable onPress={() => router.push("/forgot-password")}>
                <Text style={styles.linkRight}>Forgot password?</Text>
              </Pressable>
            )}
          </View>

          {errMsg ? <Text style={styles.error}>{errMsg}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit || busy}
            style={({ pressed }) => [
              styles.cta,
              (!canSubmit || busy) && { opacity: 0.7 },
              pressed && { transform: [{ translateY: 1 }] },
            ]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.ctaText}>{mode === "login" ? "Login" : "Create account"}</Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === "login" ? "No account?" : "Already have an account?"}
            </Text>
            <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
              <Text style={styles.switchLink}>{mode === "login" ? "Register" : "Login"}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>By continuing, you agree to the Terms and Privacy Policy.</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24, flexGrow: 1, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 16 },
  logo: { width: 250, height: 90, marginBottom: 10 },
  title: { color: COLORS.text, fontSize: 24, letterSpacing: 0.3, fontFamily: "Raleway_800ExtraBold" },
  subtitle: { marginTop: 6, color: COLORS.textSecondary, fontSize: 13.5, textAlign: "center", fontFamily: "Inter_400Regular" },
  card: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 12 },
  field: { gap: 8 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: {
    backgroundColor: COLORS.alt, color: COLORS.text, borderColor: COLORS.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, fontFamily: "Inter_400Regular",
  },
  eyeBtn: { position: "absolute", right: 8, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 8 },
  eyeText: { color: COLORS.textMuted, fontFamily: "Inter_700Bold" },
  hint: { color: COLORS.textMuted, fontSize: 12, marginTop: 6, fontFamily: "Inter_400Regular" },
  linkRight: { color: COLORS.accentLight, fontSize: 12, fontFamily: "Inter_600SemiBold", alignSelf: "flex-end", marginTop: 6 },
  error: { color: COLORS.error, fontSize: 13, marginTop: -4, fontFamily: "Inter_600SemiBold" },
  cta: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 2 },
  ctaText: { color: "#fff", letterSpacing: 0.3, fontFamily: "Raleway_700Bold" },
  switchRow: { marginTop: 8, flexDirection: "row", justifyContent: "center", gap: 6 },
  switchText: { color: COLORS.textMuted, fontFamily: "Inter_400Regular" },
  switchLink: { color: COLORS.accentLight, fontFamily: "Inter_700Bold" },
  footer: { textAlign: "center", color: COLORS.textMuted, fontSize: 12, marginTop: 14, fontFamily: "Inter_400Regular" },
});
