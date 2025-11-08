// app/settings.js

import Constants from "expo-constants";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PageHeaderBackSimple from "../components/common/PageHeaderBackSimple";
import { COLORS } from "../theme/colors";

// Optional Auth context (swap for your real provider if present)
const AuthContext = React.createContext(null);

// Resolve GraphQL endpoint (extra or EXPO_PUBLIC_*)
const GRAPHQL_ENDPOINT =
  Constants.expoConfig?.extra?.GRAPHQL_ENDPOINT ||
  process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT ||
  "";

/* ------------------------- Small inline banner ------------------------- */
function StatusBanner({ type = "info", message = "", onClose }) {
  if (!message) return null;
  const palette =
    type === "success"
      ? { bg: "#0f5132", fg: "#d1e7dd", border: "#badbcc" }
      : type === "error"
      ? { bg: "#842029", fg: "#f8d7da", border: "#f5c2c7" }
      : type === "warning"
      ? { bg: "#664d03", fg: "#fff3cd", border: "#ffecb5" }
      : { bg: "#055160", fg: "#cff4fc", border: "#b6effb" }; // info

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.bannerText, { color: palette.fg }]}>{message}</Text>
      {onClose ? (
        <Pressable onPress={onClose} style={styles.bannerClose}>
          <Text style={[styles.bannerText, { color: palette.fg }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* --------------------- Password rules (same as web) -------------------- */
function getPasswordRules(pw) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[\W_]/.test(pw),
  };
}
function checkPasswordStrength(pw) {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw)) return "Password must have at least one uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must have at least one lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must have at least one number";
  if (!/[\W_]/.test(pw)) return "Password must have at least one special character";
  return null;
}

/* ----------------------- Collapsible --------------------- */
function Collapsible({ open, children, duration = 220 }) {
  const [measured, setMeasured] = useState(false);
  const [contentH, setContentH] = useState(0);
  const hAnim = useRef(new Animated.Value(0)).current;  
  const oAnim = useRef(new Animated.Value(0)).current;  

  useEffect(() => {
    if (!measured) return;

    // Height animation 
    Animated.timing(hAnim, {
      toValue: open ? contentH : 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, 
    }).start();

    // Opacity
    Animated.timing(oAnim, {
      toValue: open ? 1 : 0,
      duration: Math.max(120, duration - 40),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, 
    }).start();
  }, [open, measured, contentH, duration, hAnim, oAnim]);

  return (
    <>
      {/* Hidden measuring pass (renders once) */}
      {!measured && (
        <View
          style={{ position: "absolute", opacity: 0, left: -10000, right: 0 }}
          pointerEvents="none"
          onLayout={(e) => {
            setContentH(e.nativeEvent.layout.height);
            setMeasured(true);
          }}
        >
          <View style={styles.dropdownCard}>{children}</View>
        </View>
      )}

      {/* Animated container */}
      {measured ? (
        <Animated.View style={{ height: hAnim, opacity: oAnim, overflow: "hidden" }}>
          <View style={styles.dropdownCard}>{children}</View>
        </Animated.View>
      ) : null}
    </>
  );
}

export default function Settings() {
  const [pushEnabled] = useState(true);
  const openURL = (url) => Linking.openURL(url).catch(() => {});
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  // Auth
  const auth = useContext(AuthContext);
  const token = auth?.token ?? null;
  const user = auth?.user ?? null;
  const isOAuth = user?.authProvider && user.authProvider !== "local";

  /* ---------------- Change Password (animated inline) ---------------- */
  const [showPw, setShowPw] = useState(false);
  const [pwFields, setPwFields] = useState({ current: "", next: "", confirm: "" });
  const rules = useMemo(() => getPasswordRules(pwFields.next), [pwFields.next]);
  const [pwStatus, setPwStatus] = useState(null); // {type,message}
  const [pwSubmitting, setPwSubmitting] = useState(false);

  async function handleSubmitPassword() {
    setPwStatus(null);

    if (isOAuth) {
      setPwStatus({ type: "error", message: "Password is managed by your sign-in provider." });
      return;
    }
    if (!pwFields.current) return setPwStatus({ type: "error", message: "Please enter your current password." });
    if (!pwFields.next || pwFields.next !== pwFields.confirm)
      return setPwStatus({ type: "error", message: "New passwords do not match." });

    const pwError = checkPasswordStrength(pwFields.next);
    if (pwError) return setPwStatus({ type: "error", message: pwError });

    if (!GRAPHQL_ENDPOINT) {
      setPwStatus({
        type: "error",
        message: "GraphQL endpoint not configured. Set EXPO_PUBLIC_GRAPHQL_ENDPOINT.",
      });
      return;
    }

    setPwSubmitting(true);
    setPwStatus({ type: "info", message: "Updating..." });

    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: `
            mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
              changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
            }
          `,
          variables: {
            currentPassword: pwFields.current,
            newPassword: pwFields.next,
          },
        }),
      });

      const json = await res.json();
      if (json?.data?.changePassword) {
        setPwStatus({ type: "success", message: "Password updated!" });
        setPwFields({ current: "", next: "", confirm: "" });
      } else {
        throw new Error(json?.errors?.[0]?.message || "Unknown error");
      }
    } catch (err) {
      setPwStatus({ type: "error", message: err.message });
    } finally {
      setPwSubmitting(false);
    }
  }

  /* ---------------- Change Email (animated inline) ---------------- */
  const [showEmail, setShowEmail] = useState(false);
  const [emailFields, setEmailFields] = useState({
    email: user?.email || "",
    currentPassword: "",
  });
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  async function handleSubmitEmail() {
    setEmailStatus(null);

    if (isOAuth) {
      setEmailStatus({ type: "error", message: "Email is managed by your sign-in provider." });
      return;
    }
    if (!emailFields.email) return setEmailStatus({ type: "error", message: "Please enter your new email." });
    if (!emailFields.currentPassword) return setEmailStatus({ type: "error", message: "Enter your current password." });
    if (emailFields.email === user?.email)
      return setEmailStatus({ type: "error", message: "New email cannot be the same as your current email." });
    if (!GRAPHQL_ENDPOINT) {
      setEmailStatus({
        type: "error",
        message: "GraphQL endpoint not configured. Set EXPO_PUBLIC_GRAPHQL_ENDPOINT.",
      });
      return;
    }

    setEmailSubmitting(true);
    setEmailStatus({ type: "info", message: "Updating email..." });

    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: `
            mutation ChangeEmail($newEmail: String!, $currentPassword: String!) {
              changeEmail(newEmail: $newEmail, currentPassword: $currentPassword)
            }
          `,
          variables: {
            newEmail: emailFields.email,
            currentPassword: emailFields.currentPassword,
          },
        }),
      });

      const json = await res.json();
      if (json?.data?.changeEmail) {
        setEmailStatus({
          type: "success",
          message: "Email changed! Please verify your new email address before using it for login.",
        });
        setEmailFields((f) => ({ ...f, currentPassword: "" }));
      } else {
        throw new Error(json?.errors?.[0]?.message || "Unknown error");
      }
    } catch (err) {
      setEmailStatus({ type: "error", message: err.message });
    } finally {
      setEmailSubmitting(false);
    }
  }

  /* ---------------- 2FA (animated inline) ---------------- */
  const [show2FA, setShow2FA] = useState(false);
  const [twoFA, setTwoFA] = useState({
    enabled: !!user?.twoFactorEnabled,
    showSetup: false,
    setupUrl: "",
    qrCode: "",
    verifyCode: "",
    loading: false,
    verifyStatus: null,
    generalStatus: null,
  });

  useEffect(() => {
    setTwoFA((s) => ({ ...s, enabled: !!user?.twoFactorEnabled }));
  }, [user?.twoFactorEnabled]);

  async function start2FA() {
    setTwoFA((s) => ({ ...s, loading: true, generalStatus: null }));
    if (!GRAPHQL_ENDPOINT) {
      setTwoFA((s) => ({
        ...s,
        loading: false,
        generalStatus: { type: "error", message: "GraphQL endpoint not configured." },
      }));
      return;
    }
    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query: "mutation { enableTwoFactor { otpauthUrl qrCodeDataURL } }" }),
      });
      const json = await res.json();
      if (json.data?.enableTwoFactor) {
        setTwoFA((s) => ({
          ...s,
          loading: false,
          showSetup: true,
          setupUrl: json.data.enableTwoFactor.otpauthUrl,
          qrCode: json.data.enableTwoFactor.qrCodeDataURL,
        }));
      } else {
        throw new Error(json.errors?.[0]?.message || "Failed to begin 2FA setup");
      }
    } catch (err) {
      setTwoFA((s) => ({ ...s, loading: false, generalStatus: { type: "error", message: err.message } }));
    }
  }

  async function verify2FA() {
    setTwoFA((s) => ({ ...s, loading: true, verifyStatus: null }));
    if (!GRAPHQL_ENDPOINT) {
      setTwoFA((s) => ({
        ...s,
        loading: false,
        verifyStatus: { type: "error", message: "GraphQL endpoint not configured." },
      }));
      return;
    }
    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          query: "mutation VerifyTwoFactor($code: String!) { verifyTwoFactor(code: $code) }",
          variables: { code: twoFA.verifyCode },
        }),
      });
      const json = await res.json();
      if (json.data?.verifyTwoFactor) {
        setTwoFA((s) => ({
          ...s,
          loading: false,
          enabled: true,
          showSetup: false,
          setupUrl: "",
          qrCode: "",
          verifyCode: "",
          verifyStatus: { type: "success", message: "2FA enabled!" },
        }));
      } else {
        throw new Error(json.errors?.[0]?.message || "Invalid 2FA code");
      }
    } catch (err) {
      setTwoFA((s) => ({ ...s, loading: false, verifyStatus: { type: "error", message: err.message } }));
    }
  }

  async function disable2FA() {
    setTwoFA((s) => ({ ...s, loading: true, generalStatus: null }));
    if (!GRAPHQL_ENDPOINT) {
      setTwoFA((s) => ({
        ...s,
        loading: false,
        generalStatus: { type: "error", message: "GraphQL endpoint not configured." },
      }));
      return;
    }
    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query: "mutation { disableTwoFactor }" }),
      });
      const json = await res.json();
      if (json.data?.disableTwoFactor) {
        setTwoFA({
          enabled: false,
          showSetup: false,
          setupUrl: "",
          qrCode: "",
          verifyCode: "",
          loading: false,
          verifyStatus: null,
          generalStatus: { type: "success", message: "2FA disabled." },
        });
      } else {
        throw new Error(json.errors?.[0]?.message || "Failed to disable 2FA");
      }
    } catch (err) {
      setTwoFA((s) => ({ ...s, loading: false, generalStatus: { type: "error", message: err.message } }));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple title="Settings" subtitle="Account, Notifications & Preferences" />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>

        {/* Change Password row */}
        <Pressable style={styles.rowBtn} onPress={() => setShowPw((s) => !s)}>
          <Text style={styles.label}>Change Password</Text>
          <Text style={styles.value}>{showPw ? "Close" : "Open"}</Text>
        </Pressable>

        {/* Animated dropdown: Password */}
        <Collapsible open={showPw}>
          <Text style={styles.inputLabel}>Current password</Text>
          <TextInput
            secureTextEntry
            editable={!isOAuth}
            value={pwFields.current}
            onChangeText={(t) => setPwFields((f) => ({ ...f, current: t }))}
            style={styles.input}
            autoComplete="password"
          />

          <Text style={styles.inputLabel}>New password</Text>
          <TextInput
            secureTextEntry
            editable={!isOAuth}
            value={pwFields.next}
            onChangeText={(t) => setPwFields((f) => ({ ...f, next: t }))}
            style={styles.input}
            autoComplete="password-new"
          />

          {/* Rules list */}
          <View style={styles.ruleList}>
            <Text style={[styles.rule, rules.length ? styles.ruleOk : styles.ruleMuted]}>
              {rules.length ? "✅" : "❌"} At least 8 characters
            </Text>
            <Text style={[styles.rule, rules.upper ? styles.ruleOk : styles.ruleMuted]}>
              {rules.upper ? "✅" : "❌"} At least one uppercase letter
            </Text>
            <Text style={[styles.rule, rules.lower ? styles.ruleOk : styles.ruleMuted]}>
              {rules.lower ? "✅" : "❌"} At least one lowercase letter
            </Text>
            <Text style={[styles.rule, rules.number ? styles.ruleOk : styles.ruleMuted]}>
              {rules.number ? "✅" : "❌"} At least one number
            </Text>
            <Text style={[styles.rule, rules.special ? styles.ruleOk : styles.ruleMuted]}>
              {rules.special ? "✅" : "❌"} At least one special character
            </Text>
          </View>

          <Text style={styles.inputLabel}>Confirm new password</Text>
          <TextInput
            secureTextEntry
            editable={!isOAuth}
            value={pwFields.confirm}
            onChangeText={(t) => setPwFields((f) => ({ ...f, confirm: t }))}
            style={styles.input}
            autoComplete="password-new"
          />

          <Pressable
            onPress={handleSubmitPassword}
            disabled={pwSubmitting || isOAuth}
            style={[styles.btn, styles.btnPrimary, (pwSubmitting || isOAuth) && styles.btnDisabled]}
          >
            <Text style={styles.btnPrimaryText}>{pwSubmitting ? "Updating…" : "Change Password"}</Text>
          </Pressable>

          {pwStatus ? (
            <View style={{ marginTop: 12 }}>
              <StatusBanner type={pwStatus.type} message={pwStatus.message} onClose={() => setPwStatus(null)} />
            </View>
          ) : null}
        </Collapsible>

        {/* Change Email row */}
        <Pressable style={styles.rowBtn} onPress={() => setShowEmail((s) => !s)}>
          <Text style={styles.label}>Change Email</Text>
          <Text style={styles.value}>{showEmail ? "Close" : "Open"}</Text>
        </Pressable>

        {/* Animated dropdown: Email */}
        <Collapsible open={showEmail}>
          <Text style={styles.inputLabel}>New email</Text>
          <TextInput
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isOAuth}
            value={emailFields.email}
            onChangeText={(t) => setEmailFields((f) => ({ ...f, email: t }))}
            style={styles.input}
            autoComplete="email"
          />

          <Text style={styles.inputLabel}>Current password</Text>
          <TextInput
            secureTextEntry
            editable={!isOAuth}
            value={emailFields.currentPassword}
            onChangeText={(t) => setEmailFields((f) => ({ ...f, currentPassword: t }))}
            style={styles.input}
            autoComplete="password"
          />

          <Pressable
            onPress={handleSubmitEmail}
            disabled={emailSubmitting || isOAuth}
            style={[styles.btn, styles.btnPrimary, (emailSubmitting || isOAuth) && styles.btnDisabled]}
          >
            <Text style={styles.btnPrimaryText}>{emailSubmitting ? "Updating…" : "Change Email"}</Text>
          </Pressable>

          {emailStatus ? (
            <View style={{ marginTop: 12 }}>
              <StatusBanner
                type={emailStatus.type}
                message={emailStatus.message}
                onClose={() => setEmailStatus(null)}
              />
            </View>
          ) : null}
        </Collapsible>

        {/* 2FA row */}
        <Pressable style={styles.rowBtn} onPress={() => setShow2FA((s) => !s)}>
          <Text style={styles.label}>Two-Factor Authentication</Text>
          <Text style={styles.value}>{show2FA ? "Close" : "Open"}</Text>
        </Pressable>

        {/* Animated dropdown: 2FA */}
        <Collapsible open={show2FA}>
          {twoFA.enabled ? (
            <View>
              <Text style={[styles.inputLabel, { color: "#16a34a" }]}>
                2FA is currently ENABLED on your account.
              </Text>
              <Pressable
                onPress={disable2FA}
                disabled={twoFA.loading}
                style={[styles.btn, styles.btnWarning, twoFA.loading && styles.btnDisabled]}
              >
                <Text style={styles.btnWarningText}>{twoFA.loading ? "Disabling…" : "Disable 2FA"}</Text>
              </Pressable>

              {twoFA.generalStatus ? (
                <View style={{ marginTop: 12 }}>
                  <StatusBanner
                    type={twoFA.generalStatus.type}
                    message={twoFA.generalStatus.message}
                    onClose={() => setTwoFA((s) => ({ ...s, generalStatus: null }))}
                  />
                </View>
              ) : null}
            </View>
          ) : twoFA.showSetup ? (
            <View>
              <Text style={styles.inputLabel}>Scan this QR code with your authenticator app</Text>
              {twoFA.qrCode ? (
                <Image
                  source={{ uri: twoFA.qrCode }}
                  style={{ width: 160, height: 160, alignSelf: "flex-start", marginBottom: 8 }}
                />
              ) : null}

              <Text style={styles.inputLabel}>Or manually add this code</Text>
              <Text style={styles.monoSmall}>{twoFA.setupUrl}</Text>

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Enter 6-digit code</Text>
              <TextInput
                value={twoFA.verifyCode}
                onChangeText={(t) => setTwoFA((s) => ({ ...s, verifyCode: t }))}
                style={styles.input}
                maxLength={6}
                inputMode="numeric"
                keyboardType="number-pad"
              />

              <Pressable
                onPress={verify2FA}
                disabled={twoFA.loading || !twoFA.verifyCode}
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  (twoFA.loading || !twoFA.verifyCode) && styles.btnDisabled,
                ]}
              >
                <Text style={styles.btnPrimaryText}>{twoFA.loading ? "Verifying…" : "Verify & Enable 2FA"}</Text>
              </Pressable>

              {twoFA.verifyStatus ? (
                <View style={{ marginTop: 12 }}>
                  <StatusBanner
                    type={twoFA.verifyStatus.type}
                    message={twoFA.verifyStatus.message}
                    onClose={() => setTwoFA((s) => ({ ...s, verifyStatus: null }))}
                  />
                </View>
              ) : null}
            </View>
          ) : (
            <View>
              <Text style={[styles.inputLabel, { color: "#dc2626" }]}>
                2FA is currently DISABLED on your account.
              </Text>
              <Pressable
                onPress={start2FA}
                disabled={twoFA.loading}
                style={[styles.btn, styles.btnPrimary, twoFA.loading && styles.btnDisabled]}
              >
                <Text style={styles.btnPrimaryText}>{twoFA.loading ? "Starting…" : "Enable 2FA"}</Text>
              </Pressable>

              {twoFA.generalStatus ? (
                <View style={{ marginTop: 12 }}>
                  <StatusBanner
                    type={twoFA.generalStatus.type}
                    message={twoFA.generalStatus.message}
                    onClose={() => setTwoFA((s) => ({ ...s, generalStatus: null }))}
                  />
                </View>
              ) : null}
            </View>
          )}
        </Collapsible>
      </View>

      {/* Help & Legal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Legal</Text>

        <Pressable style={styles.rowBtn} onPress={() => openURL("https://tcg.sixbyfive.com/privacy")}>
          <Text style={styles.label}>Privacy Policy</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable style={styles.rowBtn} onPress={() => openURL("https://tcg.sixbyfive.com/terms")}>
          <Text style={styles.label}>Terms of Service</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable style={styles.rowBtn} onPress={() => openURL("mailto:support@sixbyfive.com")}>
          <Text style={styles.label}>Contact support</Text>
          <Text style={styles.value}>Email</Text>
        </Pressable>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{appVersion}</Text>
        </View>
      </View>
    </View>
  );
}

/* --------------------------------- Styles -------------------------------- */
const styles = StyleSheet.create({
  section: { padding: 16 },
  sectionTitle: { color: COLORS.textMuted, fontWeight: "800", marginBottom: 6 },

  row: {
    paddingVertical: 14,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  rowBtn: {
    paddingVertical: 14,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  label: { color: COLORS.textSecondary, fontWeight: "700" },
  value: { color: COLORS.textMuted },

  dropdownCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },

  inputLabel: {
    color: COLORS.textSecondary,
    fontWeight: "800",
    marginTop: 6,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.alt,
    color: COLORS.textPrimary,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 11, android: 10, default: 10 }),
  },

  ruleList: { marginTop: 6, marginBottom: 6 },
  rule: { fontSize: 12, marginVertical: 2 },
  ruleOk: { color: "#16a34a" },
  ruleMuted: { color: COLORS.textMuted },

  btn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: COLORS.accent },
  btnPrimaryText: { color: "#ffffff", fontWeight: "800" },
  btnWarning: { backgroundColor: "#fde047" }, // amber-300
  btnWarningText: { color: COLORS.textPrimary, fontWeight: "800" },
  btnDisabled: { opacity: 0.5 },

  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerText: { fontSize: 12, fontWeight: "700" },
  bannerClose: { marginLeft: 12 },

  monoSmall: {
    color: COLORS.textMuted,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 12,
    marginBottom: 6,
  },
});
