// app/settings.js
//
// UPDATED (2026-02-16)
// CHANGES (this revision):
// - CHANGE: Cleaner Notifications UX
//   - Single compact summary row (master toggle + status pill)
//   - Tap summary row to expand advanced options (Sound / Vibrate / System settings)
//   - Do NOT request permission on load (only when enabling master)
//   - Hide Expo token + noisy debug info unless __DEV__
// - KEEP: Existing Safety, Account, 2FA, Help, App Info sections unchanged
//
// NOTE:
// - Still uses ../lib/push helpers for local persistence + Android channel config.
// - Uses expo-notifications ONLY for permission status reads (no prompts unless enabling).

import { gql, useApolloClient } from "@apollo/client";
import Constants from "expo-constants";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

// ADD: permission status reads (no prompt unless you call requestPermissionsAsync)
import * as Notifications from "expo-notifications";

import PageHeaderBackSimple from "../components/common/PageHeaderBackSimple";
import { COLORS } from "../theme/colors";

// Notification prefs + permissions helpers
import {
  ensurePushPermissionsAsync,
  getExpoPushTokenAsync,
  getPushPrefsAsync,
  setPushPrefsAsync,
} from "../lib/push";

/* ------------------------- Dev logging helpers ------------------------- */
function devLog(...args) {
  if (__DEV__) console.log("[Settings]", ...args);
}

function devLogGqlError(err, label = "GraphQL error") {
  if (!__DEV__) return;

  const graphQLErrors = Array.isArray(err?.graphQLErrors)
    ? err.graphQLErrors.map((e) => ({
        message: e?.message,
        path: e?.path,
        code: e?.extensions?.code,
        extensions: e?.extensions,
      }))
    : [];

  const ne = err?.networkError;
  const networkError = ne
    ? {
        name: ne?.name,
        message: ne?.message,
        statusCode: ne?.statusCode,
        bodyText: ne?.bodyText,
        result: ne?.result,
      }
    : null;

  devLog(label, {
    message: err?.message,
    graphQLErrors,
    networkError,
  });
}

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
    <View
      style={[
        styles.banner,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
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
  if (!/[A-Z]/.test(pw))
    return "Password must have at least one uppercase letter";
  if (!/[a-z]/.test(pw))
    return "Password must have at least one lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must have at least one number";
  if (!/[\W_]/.test(pw))
    return "Password must have at least one special character";
  return null;
}

/* ----------------------- Collapsible --------------------- */
function Collapsible({ open, children, duration = 220 }) {
  const [measured, setMeasured] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [fullyOpen, setFullyOpen] = useState(false);
  const hAnim = useRef(new Animated.Value(0)).current;
  const oAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!measured) return;

    if (!open) setFullyOpen(false);

    Animated.timing(hAnim, {
      toValue: open ? contentH : 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && open) setFullyOpen(true);
    });

    Animated.timing(oAnim, {
      toValue: open ? 1 : 0,
      duration: Math.max(120, duration - 40),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [open, measured, contentH, duration, hAnim, oAnim]);

  return (
    <>
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

      {measured ? (
        <Animated.View
          style={
            fullyOpen
              ? { opacity: oAnim, overflow: "visible" }
              : { height: hAnim, opacity: oAnim, overflow: "hidden" }
          }
        >
          <View style={styles.dropdownCard}>{children}</View>
        </Animated.View>
      ) : null}
    </>
  );
}

/* =========================
   Helpers (match web logic, UK input UX)
========================= */

function toInputDateValue(dateLike) {
  if (!dateLike) return "";

  const s = String(dateLike).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}\s/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function computeFrontendRestriction({ dob, backendLevel }) {
  if (backendLevel) return backendLevel;

  if (!dob) return "full";

  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "full";

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;

  if (age < 13) return "child";
  if (age < 16) return "teen";
  return "none";
}

function isoToUkSlashes(iso) {
  if (!iso) return "";
  const s = String(iso).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function formatDobInputSlashes(raw) {
  const digits = String(raw || "")
    .replace(/\D/g, "")
    .slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);

  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

function parseUkDobToIso(input) {
  if (!input) return "";
  const s = String(input).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (!m) return "";

  const [, ddStr, mmStr, yyyyStr] = m;
  const dd = Number(ddStr);
  const mm = Number(mmStr);
  const yyyy = Number(yyyyStr);

  if (yyyy < 1900 || yyyy > 2100) return "";
  if (mm < 1 || mm > 12) return "";
  if (dd < 1 || dd > 31) return "";

  const iso = `${yyyyStr}-${mmStr}-${ddStr}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  if (toInputDateValue(d) !== iso) return "";

  return iso;
}

/* =========================
   GraphQL documents (Apollo)
========================= */

const ME_QUERY = gql`
  query MeForSettings {
    me {
      id
      username
      email
      emailVerified
      twoFactorEnabled

      dob
      parentEmail
      parentVerifiedAt

      capabilities {
        restrictionLevel
        isMinor
        requiresParentApproval
        canUseCollection
        canMessage
        canTrade
        canPost
        canConnectDiscord
        canShareToDiscord
      }
    }
  }
`;

const UPDATE_SAFETY_PROFILE = gql`
  mutation UpdateSafetyProfile($dob: String, $parentEmail: String) {
    updateSafetyProfile(dob: $dob, parentEmail: $parentEmail) {
      ok
      error
      user {
        id
        dob
        parentEmail
        parentVerifiedAt
        capabilities {
          restrictionLevel
          isMinor
          requiresParentApproval
          canMessage
          canTrade
          canPost
          canConnectDiscord
          canShareToDiscord
        }
      }
    }
  }
`;

const REQUEST_PARENT_VERIFICATION = gql`
  mutation RequestParentVerification {
    requestParentVerification {
      ok
      error
      user {
        id
        parentEmail
        parentVerifiedAt
        capabilities {
          restrictionLevel
          requiresParentApproval
          canConnectDiscord
          canMessage
        }
      }
    }
  }
`;

const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

const CHANGE_EMAIL = gql`
  mutation ChangeEmail($newEmail: String!, $currentPassword: String!) {
    changeEmail(newEmail: $newEmail, currentPassword: $currentPassword)
  }
`;

const ENABLE_2FA = gql`
  mutation EnableTwoFactor {
    enableTwoFactor {
      otpauthUrl
      qrCodeDataURL
    }
  }
`;

const VERIFY_2FA = gql`
  mutation VerifyTwoFactor($code: String!) {
    verifyTwoFactor(code: $code)
  }
`;

const DISABLE_2FA = gql`
  mutation DisableTwoFactor {
    disableTwoFactor
  }
`;

export default function Settings() {
  const client = useApolloClient();

  const openURL = (url) => Linking.openURL(url).catch(() => {});
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  // Local user snapshot
  const [user, setUser] = useState(null);

  // Track whether "me" is loaded; if not, fail-closed safety section
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState(null);

  // Safety summary row open/close state
  const [safetyExpanded, setSafetyExpanded] = useState(false);

  // =============================================================================
  // Notifications (cleaner UX)
  // =============================================================================

  // CHANGED: compact row + expandable advanced options
  const [notifExpanded, setNotifExpanded] = useState(false);

  const [notifLoading, setNotifLoading] = useState(true);
  const [notifStatus, setNotifStatus] = useState(null);

  const [notifPrefs, setNotifPrefs] = useState({
    enabled: true,
    sound: true,
    vibration: true,
  });

  const [notifPermission, setNotifPermission] = useState("unknown"); // granted | denied | undetermined | provisional | ...
  const [expoTokenMask, setExpoTokenMask] = useState("");

  const maskToken = (t) => {
    const s = String(t || "");
    if (!s) return "";
    if (s.length <= 12) return s;
    return `${s.slice(0, 6)}…${s.slice(-6)}`;
  };

  // CHANGED: read-only permission check (no prompt)
  const refreshNotifStatus = useCallback(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      setNotifPermission(String(perm?.status || "unknown"));
    } catch (_) {
      setNotifPermission("unknown");
    }
  }, []);

  // CHANGED: load prefs + permission status without prompting
  const loadNotifPrefs = useCallback(async () => {
    setNotifLoading(true);
    setNotifStatus(null);

    try {
      const prefs = await getPushPrefsAsync();
      setNotifPrefs(prefs);

      await refreshNotifStatus();

      // DEV ONLY: keep token visibility out of user-facing UI
      if (__DEV__) {
        const token = await getExpoPushTokenAsync();
        setExpoTokenMask(maskToken(token));
      } else {
        setExpoTokenMask("");
      }

      setNotifLoading(false);
    } catch (e) {
      setNotifLoading(false);
      setNotifStatus({
        type: "error",
        message: e?.message || "Could not load notification settings.",
      });
    }
  }, [refreshNotifStatus]);

  useEffect(() => {
    loadNotifPrefs();
  }, [loadNotifPrefs]);

  // CHANGED: open OS notification settings when blocked/denied
  const openSystemNotificationSettings = useCallback(() => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:").catch(() => {});
      return;
    }
    Linking.openSettings?.();
  }, []);

  // CHANGED: update prefs with cleaner logic
  const updateNotifPref = useCallback(
    async (patch) => {
      setNotifStatus(null);

      // Optimistic UI
      setNotifPrefs((p) => ({ ...p, ...patch }));

      try {
        const next = await setPushPrefsAsync(patch);
        setNotifPrefs(next);

        // If they enabled notifications: request permissions NOW (only time we prompt)
        if (patch?.enabled === true) {
          const perm = await ensurePushPermissionsAsync();
          const status = String(perm?.status || "unknown");
          setNotifPermission(status);

          if (perm?.granted) {
            if (__DEV__) {
              const token = await getExpoPushTokenAsync();
              setExpoTokenMask(maskToken(token));
            }
          } else {
            setNotifStatus({
              type: "warning",
              message:
                "Notifications are enabled in-app, but permission is not granted. Enable notifications in your phone settings.",
            });
          }
        }

        // If they disabled master, collapse advanced to keep it tidy
        if (patch?.enabled === false) {
          setNotifExpanded(false);
        }

        // If vibration toggled, re-ensure channel config (Android)
        if (typeof patch?.vibration === "boolean") {
          // This helper may configure Android channels; keep as best-effort.
          await ensurePushPermissionsAsync();
        }

        // Refresh read-only status after changes
        await refreshNotifStatus();
      } catch (e) {
        // Revert by reloading from storage
        await loadNotifPrefs();
        setNotifStatus({
          type: "error",
          message: e?.message || "Could not update notification settings.",
        });
      }
    },
    [loadNotifPrefs, refreshNotifStatus],
  );

  // Derived UI: status pill + copy
  const notifStatusMeta = useMemo(() => {
    // If master is off, keep it simple
    if (!notifPrefs.enabled) {
      return { pill: "Off", type: "off", sub: "All alerts disabled in-app." };
    }

    const s = String(notifPermission || "unknown").toLowerCase();

    if (s === "granted") {
      return {
        pill: "Allowed",
        type: "ok",
        sub: "System permission granted.",
      };
    }

    if (s === "denied") {
      return {
        pill: "Blocked",
        type: "bad",
        sub: "Enable in system settings to receive notifications.",
      };
    }

    if (s === "undetermined") {
      return {
        pill: "Not set",
        type: "warn",
        sub: "You’ll be asked when you enable notifications.",
      };
    }

    return {
      pill: "Unknown",
      type: "warn",
      sub: "Permission status could not be determined.",
    };
  }, [notifPrefs.enabled, notifPermission]);

  // =============================================================================
  // Me query / user
  // =============================================================================

  const refetchMe = useCallback(async () => {
    setMeLoading(true);
    setMeError(null);

    try {
      const { data } = await client.query({
        query: ME_QUERY,
        fetchPolicy: "network-only",
      });

      const fresh = data?.me ?? null;

      devLog("ME_QUERY ok:", {
        id: fresh?.id,
        dob_raw: fresh?.dob,
        dob_iso: toInputDateValue(fresh?.dob),
      });

      setUser(fresh);
      setMeLoading(false);
      return fresh;
    } catch (err) {
      devLogGqlError(err, "ME_QUERY failed");

      setUser(null);
      setMeLoading(false);

      const msg =
        err?.graphQLErrors?.[0]?.message ||
        err?.networkError?.result?.errors?.[0]?.message ||
        err?.networkError?.bodyText ||
        err?.message ||
        "Failed to load account details.";

      setMeError(msg);
      return null;
    }
  }, [client]);

  useEffect(() => {
    refetchMe();
  }, [refetchMe]);

  const isOAuth = user?.authProvider && user.authProvider !== "local";

  /* =============================================================================
     SAFETY / PARENT APPROVAL
  ============================================================================= */

  const capabilities = user?.capabilities || null;

  const [safetyFields, setSafetyFields] = useState({
    dobIso: "",
    parentEmail: "",
  });

  const [safetyStatus, setSafetyStatus] = useState(null);
  const [safetyLoading, setSafetyLoading] = useState(false);

  const [dobInputUi, setDobInputUi] = useState(""); // UI value (DD/MM/YYYY)

  // Sync safety inputs from backend user state (when loaded)
  useEffect(() => {
    if (!user?.id) return;

    const backendIso = toInputDateValue(user?.dob);

    setSafetyFields((prev) => ({
      ...prev,
      dobIso: backendIso || "",
      parentEmail: user?.parentEmail || "",
    }));

    setDobInputUi(backendIso ? isoToUkSlashes(backendIso) : "");
  }, [user?.id, user?.dob, user?.parentEmail]);

  // Backend-only DOB truth
  const backendDobIso = toInputDateValue(user?.dob);
  const backendHasDob = !!backendDobIso;

  // Fail-closed: if we can't load "me", safety becomes read-only.
  const dobIsLocked = meLoading || !!meError || backendHasDob;

  const dobEffectiveIso = backendDobIso || safetyFields.dobIso || "";
  const hasDob = !!String(dobEffectiveIso || "").trim();

  const restrictionLevel =
    meLoading || meError
      ? "restricted"
      : computeFrontendRestriction({
          dob: dobEffectiveIso,
          backendLevel: user?.capabilities?.restrictionLevel,
        });

  const parentVerifiedAt = user?.parentVerifiedAt || null;
  const requiresParentApproval =
    restrictionLevel === "teen" && !parentVerifiedAt;

  const showParentEmail =
    !meLoading && !meError && hasDob && requiresParentApproval;

  // Informational-only means: DOB locked, and NO parent approval action is needed.
  const safetyIsInformationalOnly =
    dobIsLocked && !showParentEmail && !requiresParentApproval;

  // Auto-collapse when safety becomes informational-only (e.g. after DOB saved / refetch)
  useEffect(() => {
    if (safetyIsInformationalOnly) setSafetyExpanded(false);
  }, [safetyIsInformationalOnly]);

  async function handleSaveSafetyProfile() {
    setSafetyStatus(null);

    if (meLoading || meError) {
      setSafetyStatus({
        type: "error",
        message:
          "Account details could not be loaded. Safety settings are read-only until the server responds.",
      });
      return;
    }

    const backendHasDobNow = !!toInputDateValue(user?.dob);
    if (backendHasDobNow) {
      setSafetyStatus({
        type: "warning",
        message:
          "Your date of birth is already set and locked. Contact support if it’s incorrect.",
      });
      return;
    }

    let dobIsoToSend = null;

    if (!dobIsLocked) {
      const ui = String(dobInputUi || "").trim();

      if (!ui) {
        dobIsoToSend = null;
      } else {
        const iso = parseUkDobToIso(ui);
        if (!iso) {
          setSafetyStatus({
            type: "error",
            message: "Date of birth must be DD/MM/YYYY (or DD-MM-YYYY).",
          });
          return;
        }
        dobIsoToSend = iso;
      }
    }

    setSafetyLoading(true);

    try {
      const variables = {
        dob: !dobIsLocked ? dobIsoToSend : null,
        parentEmail:
          showParentEmail && safetyFields.parentEmail
            ? safetyFields.parentEmail.trim()
            : null,
      };

      devLog("updateSafetyProfile() vars:", variables);

      const { data } = await client.mutate({
        mutation: UPDATE_SAFETY_PROFILE,
        variables,
        fetchPolicy: "no-cache",
      });

      const payload = data?.updateSafetyProfile;
      if (!payload?.ok) throw new Error(payload?.error || "Failed to save");

      if (payload?.user) {
        setUser((prev) => ({ ...(prev || {}), ...payload.user }));
      }

      setSafetyStatus({ type: "success", message: "Saved." });
      await refetchMe();
    } catch (err) {
      devLogGqlError(err, "updateSafetyProfile failed");
      setSafetyStatus({
        type: "error",
        message: err?.message || "Failed to save",
      });
    } finally {
      setSafetyLoading(false);
    }
  }

  async function handleRequestParentVerification() {
    setSafetyStatus(null);

    if (meLoading || meError) {
      setSafetyStatus({
        type: "error",
        message:
          "Account details could not be loaded. Please try again once the server responds.",
      });
      return;
    }

    setSafetyLoading(true);

    try {
      const { data } = await client.mutate({
        mutation: REQUEST_PARENT_VERIFICATION,
        fetchPolicy: "no-cache",
      });

      const payload = data?.requestParentVerification;
      if (!payload?.ok)
        throw new Error(payload?.error || "Failed to send email");

      if (payload?.user) {
        setUser((prev) => ({ ...(prev || {}), ...payload.user }));
      }

      setSafetyStatus({
        type: "success",
        message:
          "Verification email sent to your parent/guardian. Ask them to click the approval link.",
      });

      await refetchMe();
    } catch (err) {
      devLogGqlError(err, "requestParentVerification failed");
      setSafetyStatus({
        type: "error",
        message: err?.message || "Failed to send email",
      });
    } finally {
      setSafetyLoading(false);
    }
  }

  /* =============================================================================
     PASSWORD / EMAIL / 2FA
  ============================================================================= */

  const [showPw, setShowPw] = useState(false);
  const [pwFields, setPwFields] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const rules = useMemo(() => getPasswordRules(pwFields.next), [pwFields.next]);
  const [pwStatus, setPwStatus] = useState(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  async function handleSubmitPassword() {
    setPwStatus(null);

    if (isOAuth) {
      setPwStatus({
        type: "error",
        message: "Password is managed by your sign-in provider.",
      });
      return;
    }
    if (!pwFields.current)
      return setPwStatus({
        type: "error",
        message: "Please enter your current password.",
      });
    if (!pwFields.next || pwFields.next !== pwFields.confirm)
      return setPwStatus({
        type: "error",
        message: "New passwords do not match.",
      });

    const pwError = checkPasswordStrength(pwFields.next);
    if (pwError) return setPwStatus({ type: "error", message: pwError });

    setPwSubmitting(true);
    setPwStatus({ type: "info", message: "Updating..." });

    try {
      const { data } = await client.mutate({
        mutation: CHANGE_PASSWORD,
        variables: {
          currentPassword: pwFields.current,
          newPassword: pwFields.next,
        },
        fetchPolicy: "no-cache",
      });

      if (data?.changePassword) {
        setPwStatus({ type: "success", message: "Password updated!" });
        setPwFields({ current: "", next: "", confirm: "" });
      } else {
        throw new Error("Unknown error");
      }
    } catch (err) {
      devLogGqlError(err, "changePassword failed");
      setPwStatus({
        type: "error",
        message: err?.message || "Failed to update password",
      });
    } finally {
      setPwSubmitting(false);
    }
  }

  const [showEmail, setShowEmail] = useState(false);
  const [emailFields, setEmailFields] = useState({
    email: user?.email || "",
    currentPassword: "",
  });
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  useEffect(() => {
    setEmailFields((prev) => ({ ...prev, email: user?.email || "" }));
  }, [user?.email]);

  async function handleSubmitEmail() {
    setEmailStatus(null);

    if (isOAuth) {
      setEmailStatus({
        type: "error",
        message: "Email is managed by your sign-in provider.",
      });
      return;
    }
    if (!emailFields.email)
      return setEmailStatus({
        type: "error",
        message: "Please enter your new email.",
      });
    if (!emailFields.currentPassword)
      return setEmailStatus({
        type: "error",
        message: "Enter your current password.",
      });
    if (emailFields.email === (user?.email || ""))
      return setEmailStatus({
        type: "error",
        message: "New email cannot be the same as your current email.",
      });

    setEmailSubmitting(true);
    setEmailStatus({ type: "info", message: "Updating email..." });

    try {
      const { data } = await client.mutate({
        mutation: CHANGE_EMAIL,
        variables: {
          newEmail: emailFields.email,
          currentPassword: emailFields.currentPassword,
        },
        fetchPolicy: "no-cache",
      });

      if (data?.changeEmail) {
        setEmailStatus({
          type: "success",
          message:
            "Email changed! Please verify your new email address before using it for login.",
        });
        setEmailFields((f) => ({ ...f, currentPassword: "" }));
        await refetchMe();
      } else {
        throw new Error("Unknown error");
      }
    } catch (err) {
      devLogGqlError(err, "changeEmail failed");
      setEmailStatus({
        type: "error",
        message: err?.message || "Failed to update email",
      });
    } finally {
      setEmailSubmitting(false);
    }
  }

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
    try {
      const { data } = await client.mutate({
        mutation: ENABLE_2FA,
        fetchPolicy: "no-cache",
      });
      if (data?.enableTwoFactor) {
        setTwoFA((s) => ({
          ...s,
          loading: false,
          showSetup: true,
          setupUrl: data.enableTwoFactor.otpauthUrl,
          qrCode: data.enableTwoFactor.qrCodeDataURL,
        }));
      } else {
        throw new Error("Failed to begin 2FA setup");
      }
    } catch (err) {
      devLogGqlError(err, "enableTwoFactor failed");
      setTwoFA((s) => ({
        ...s,
        loading: false,
        generalStatus: {
          type: "error",
          message: err?.message || "Failed to start 2FA",
        },
      }));
    }
  }

  async function verify2FA() {
    setTwoFA((s) => ({ ...s, loading: true, verifyStatus: null }));
    try {
      const { data } = await client.mutate({
        mutation: VERIFY_2FA,
        variables: { code: twoFA.verifyCode },
        fetchPolicy: "no-cache",
      });

      if (data?.verifyTwoFactor) {
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
        await refetchMe();
      } else {
        throw new Error("Invalid 2FA code");
      }
    } catch (err) {
      devLogGqlError(err, "verifyTwoFactor failed");
      setTwoFA((s) => ({
        ...s,
        loading: false,
        verifyStatus: {
          type: "error",
          message: err?.message || "Invalid 2FA code",
        },
      }));
    }
  }

  async function disable2FA() {
    setTwoFA((s) => ({ ...s, loading: true, generalStatus: null }));
    try {
      const { data } = await client.mutate({
        mutation: DISABLE_2FA,
        fetchPolicy: "no-cache",
      });

      if (data?.disableTwoFactor) {
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
        await refetchMe();
      } else {
        throw new Error("Failed to disable 2FA");
      }
    } catch (err) {
      devLogGqlError(err, "disableTwoFactor failed");
      setTwoFA((s) => ({
        ...s,
        loading: false,
        generalStatus: {
          type: "error",
          message: err?.message || "Failed to disable 2FA",
        },
      }));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple
        title="Settings"
        subtitle="Account, Notifications & Preferences"
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

      {/* =========================
          Notifications (clean)
      ========================= */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Push notifications</Text>
          <Text style={styles.cardBody}>
            Control alerts for messages and other updates.
          </Text>

          {/* CHANGED: single summary row (master + status) */}
          <Pressable
            onPress={() => setNotifExpanded((s) => !s)}
            style={({ pressed }) => [
              styles.notifSummaryRow,
              pressed && { opacity: 0.92 },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.notifSummaryTop}>
                <Text style={styles.notifSummaryTitle}>
                  Enable notifications
                </Text>

                <View
                  style={[
                    styles.pill,
                    notifStatusMeta.type === "ok"
                      ? styles.pillOk
                      : notifStatusMeta.type === "bad"
                        ? styles.pillBad
                        : notifStatusMeta.type === "off"
                          ? styles.pillOff
                          : styles.pillWarn,
                  ]}
                >
                  <Text style={styles.pillText}>{notifStatusMeta.pill}</Text>
                </View>
              </View>

              <Text style={styles.notifSummarySub}>{notifStatusMeta.sub}</Text>
            </View>

            <Switch
              value={!!notifPrefs.enabled}
              onValueChange={(v) => updateNotifPref({ enabled: !!v })}
            />

            <Text style={styles.notifSummaryChevron}>
              {notifExpanded ? "▲" : "▼"}
            </Text>
          </Pressable>

          {/* Advanced options */}
          <Collapsible open={notifExpanded}>
            <View style={{ gap: 10 }}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Play sound</Text>
                  <Text style={styles.toggleSub}>
                    Sound for supported notifications.
                  </Text>
                </View>
                <Switch
                  value={!!notifPrefs.sound}
                  onValueChange={(v) => updateNotifPref({ sound: !!v })}
                  disabled={!notifPrefs.enabled}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Vibrate</Text>
                  <Text style={styles.toggleSub}>
                    Android vibration channel for message notifications.
                  </Text>
                </View>
                <Switch
                  value={!!notifPrefs.vibration}
                  onValueChange={(v) => updateNotifPref({ vibration: !!v })}
                  disabled={!notifPrefs.enabled}
                />
              </View>

              {/* If blocked/denied, show a clean "Open settings" action */}
              {notifPrefs.enabled &&
              String(notifPermission).toLowerCase() === "denied" ? (
                <Pressable
                  onPress={openSystemNotificationSettings}
                  style={({ pressed }) => [
                    styles.settingsLinkBtn,
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <Text style={styles.settingsLinkText}>
                    Open system notification settings
                  </Text>
                </Pressable>
              ) : null}

              {/* DEV ONLY debug */}
              {__DEV__ ? (
                <View style={styles.infoBox}>
                  <Text style={styles.helpText}>
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      Permission:
                    </Text>{" "}
                    {String(notifPermission || "unknown")}
                  </Text>
                  <Text style={styles.helpText}>
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      Expo token:
                    </Text>{" "}
                    {expoTokenMask ? expoTokenMask : "—"}
                  </Text>
                </View>
              ) : null}

              {notifStatus ? (
                <View style={{ marginTop: 2 }}>
                  <StatusBanner
                    type={notifStatus.type}
                    message={notifStatus.message}
                    onClose={() => setNotifStatus(null)}
                  />
                </View>
              ) : null}

              {notifLoading ? (
                <View style={{ marginTop: 2, flexDirection: "row", gap: 10 }}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={{ color: COLORS.textMuted, fontWeight: "800" }}>
                    Loading notification settings…
                  </Text>
                </View>
              ) : null}

              {Platform.OS === "ios" ? (
                <Text style={styles.helpText}>
                  iOS vibration is controlled by the system. Sound/vibrate
                  behaviour may depend on Focus / Silent mode.
                </Text>
              ) : null}
            </View>
          </Collapsible>
        </View>
      </View>

      {/* =========================
          Safety & Parent Approval
      ========================= */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Safety & Parent Approval</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Community feature access</Text>

          {safetyIsInformationalOnly ? (
            <>
              <Pressable
                onPress={() => setSafetyExpanded((s) => !s)}
                style={({ pressed }) => [
                  styles.safetySummaryRow,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.safetySummaryTitle}>Safety profile</Text>
                  <Text style={styles.safetySummarySub}>
                    DOB locked • Restriction: {restrictionLevel} • Parent
                    approval not required
                  </Text>
                </View>

                <Text style={styles.safetySummaryChevron}>
                  {safetyExpanded ? "▲" : "▼"}
                </Text>
              </Pressable>

              <Collapsible open={safetyExpanded}>
                <View style={{ gap: 8 }}>
                  <View>
                    <Text style={styles.inputLabel}>
                      Date of birth (locked)
                    </Text>
                    <View style={styles.lockedRow}>
                      <Text style={styles.lockedRowText}>
                        {backendHasDob ? isoToUkSlashes(dobEffectiveIso) : "—"}
                      </Text>
                    </View>
                    <Text style={[styles.helpText, { marginTop: 6 }]}>
                      Your date of birth is locked once set. If this is
                      incorrect, contact support.
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.smallLine}>
                      <Text style={styles.smallMuted}>Parent verified: </Text>
                      <Text style={styles.smallStrong}>
                        {parentVerifiedAt
                          ? `Yes (${formatDateTime(parentVerifiedAt)})`
                          : "No"}
                      </Text>
                    </Text>
                    <Text style={[styles.helpText, { marginTop: 6 }]}>
                      Parent/guardian approval is not required for this account.
                    </Text>
                  </View>

                  {capabilities ? (
                    <View style={{ marginTop: 4 }}>
                      <Text
                        style={[
                          styles.helpText,
                          { marginBottom: 6, fontWeight: "800" },
                        ]}
                      >
                        Feature access:
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 14,
                        }}
                      >
                        <Text style={styles.helpText}>
                          Messaging: {capabilities.canMessage ? "✅" : "❌"}
                        </Text>
                        <Text style={styles.helpText}>
                          Trading: {capabilities.canTrade ? "✅" : "❌"}
                        </Text>
                        <Text style={styles.helpText}>
                          Discord linking:{" "}
                          {capabilities.canConnectDiscord ? "✅" : "❌"}
                        </Text>
                        <Text style={styles.helpText}>
                          Discord sharing:{" "}
                          {capabilities.canShareToDiscord ? "✅" : "❌"}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </Collapsible>
            </>
          ) : (
            <>
              <Text style={styles.cardBody}>
                Some community features (messaging, trading, Discord
                linking/sharing) require parent/guardian approval for under-16
                accounts.
              </Text>

              {meError ? (
                <View style={{ marginTop: 10 }}>
                  <StatusBanner
                    type="error"
                    message={`Could not load account data (me). Safety settings are read-only. ${meError}`}
                    onClose={() => setMeError(null)}
                  />
                </View>
              ) : null}

              <View style={{ marginTop: 10, gap: 6 }}>
                <Text style={styles.smallLine}>
                  <Text style={styles.smallMuted}>Restriction level: </Text>
                  <Text style={styles.smallStrong}>{restrictionLevel}</Text>
                </Text>

                <Text style={styles.smallLine}>
                  <Text style={styles.smallMuted}>Parent verified: </Text>
                  <Text style={styles.smallStrong}>
                    {parentVerifiedAt
                      ? `Yes (${formatDateTime(parentVerifiedAt)})`
                      : "No"}
                  </Text>
                </Text>

                {requiresParentApproval && !parentVerifiedAt ? (
                  <Text style={[styles.smallStrong, { color: "#f59e0b" }]}>
                    Parent approval required to unlock community features.
                  </Text>
                ) : null}
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={styles.inputLabel}>
                  Date of birth {dobIsLocked ? "(locked)" : "(optional)"}
                </Text>

                {dobIsLocked ? (
                  <View style={styles.lockedRow}>
                    <Text style={styles.lockedRowIcon}>🔒</Text>
                    <Text style={styles.lockedRowText}>
                      {backendHasDob
                        ? isoToUkSlashes(dobEffectiveIso)
                        : "Unavailable"}
                    </Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      value={dobInputUi}
                      editable={!dobIsLocked}
                      onChangeText={(raw) => {
                        const formatted = formatDobInputSlashes(raw);
                        setDobInputUi(formatted);

                        const iso = parseUkDobToIso(formatted);
                        setSafetyFields((f) => ({ ...f, dobIso: iso || "" }));
                      }}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={COLORS.textMuted}
                      style={styles.input}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={10}
                    />

                    <Text style={styles.helpText}>
                      If you leave this blank, your account will be treated as
                      restricted by default.
                    </Text>
                  </>
                )}

                {dobIsLocked ? (
                  <Text style={[styles.helpText, { marginTop: 6 }]}>
                    {meError || meLoading
                      ? "We couldn't confirm your DOB from the server, so editing is disabled until your account data loads."
                      : "Your date of birth is locked once set. If this is incorrect, contact support."}
                  </Text>
                ) : null}
              </View>

              {showParentEmail ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputLabel}>
                    Parent/guardian email (only required if under 16)
                  </Text>
                  <TextInput
                    value={safetyFields.parentEmail}
                    onChangeText={(t) =>
                      setSafetyFields((f) => ({ ...f, parentEmail: t }))
                    }
                    placeholder="parent@example.com"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
              ) : (
                <Text style={[styles.helpText, { marginTop: 10 }]}>
                  {meLoading || meError
                    ? "Account details are not available yet."
                    : !hasDob
                      ? "Add your date of birth first to determine if parent/guardian approval is required."
                      : requiresParentApproval
                        ? "Parent/guardian approval is required for this account."
                        : "Parent/guardian approval is not required for this account."}
                </Text>
              )}

              <View style={{ marginTop: 14, gap: 10 }}>
                <Pressable
                  onPress={handleSaveSafetyProfile}
                  disabled={safetyLoading || meLoading || !!meError}
                  style={[
                    styles.btn,
                    styles.btnPrimary,
                    (safetyLoading || meLoading || !!meError) &&
                      styles.btnDisabled,
                  ]}
                >
                  {safetyLoading ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.btnPrimaryText}>Saving…</Text>
                    </View>
                  ) : (
                    <Text style={styles.btnPrimaryText}>
                      {meLoading
                        ? "Loading…"
                        : meError
                          ? "Unavailable"
                          : "Save"}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleRequestParentVerification}
                  disabled={
                    safetyLoading ||
                    meLoading ||
                    !!meError ||
                    !showParentEmail ||
                    !safetyFields.parentEmail ||
                    !!parentVerifiedAt
                  }
                  style={[
                    styles.btn,
                    styles.btnSecondary,
                    (safetyLoading ||
                      meLoading ||
                      !!meError ||
                      !showParentEmail ||
                      !safetyFields.parentEmail ||
                      !!parentVerifiedAt) &&
                      styles.btnDisabled,
                  ]}
                >
                  <Text style={styles.btnSecondaryText}>
                    {parentVerifiedAt
                      ? "Already verified"
                      : safetyLoading
                        ? "Sending…"
                        : meLoading
                          ? "Loading…"
                          : meError
                            ? "Unavailable"
                            : "Send approval email"}
                  </Text>
                </Pressable>

                {safetyStatus ? (
                  <View style={{ marginTop: 4 }}>
                    <StatusBanner
                      type={safetyStatus.type}
                      message={safetyStatus.message}
                      onClose={() => setSafetyStatus(null)}
                    />
                  </View>
                ) : null}

                {capabilities ? (
                  <View style={{ marginTop: 6 }}>
                    <Text
                      style={[
                        styles.helpText,
                        { marginBottom: 6, fontWeight: "800" },
                      ]}
                    >
                      Feature access:
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 14,
                      }}
                    >
                      <Text style={styles.helpText}>
                        Messaging: {capabilities.canMessage ? "✅" : "❌"}
                      </Text>
                      <Text style={styles.helpText}>
                        Trading: {capabilities.canTrade ? "✅" : "❌"}
                      </Text>
                      <Text style={styles.helpText}>
                        Discord linking:{" "}
                        {capabilities.canConnectDiscord ? "✅" : "❌"}
                      </Text>
                      <Text style={styles.helpText}>
                        Discord sharing:{" "}
                        {capabilities.canShareToDiscord ? "✅" : "❌"}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      </View>

      {/* =========================
          Existing Account Settings
      ========================= */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>

        <Pressable style={styles.rowBtn} onPress={() => setShowPw((s) => !s)}>
          <Text style={styles.label}>Change Password</Text>
          <Text style={styles.value}>{showPw ? "Close" : "Open"}</Text>
        </Pressable>

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

          <View style={styles.ruleList}>
            <Text
              style={[
                styles.rule,
                rules.length ? styles.ruleOk : styles.ruleMuted,
              ]}
            >
              {rules.length ? "✅" : "❌"} At least 8 characters
            </Text>
            <Text
              style={[
                styles.rule,
                rules.upper ? styles.ruleOk : styles.ruleMuted,
              ]}
            >
              {rules.upper ? "✅" : "❌"} At least one uppercase letter
            </Text>
            <Text
              style={[
                styles.rule,
                rules.lower ? styles.ruleOk : styles.ruleMuted,
              ]}
            >
              {rules.lower ? "✅" : "❌"} At least one lowercase letter
            </Text>
            <Text
              style={[
                styles.rule,
                rules.number ? styles.ruleOk : styles.ruleMuted,
              ]}
            >
              {rules.number ? "✅" : "❌"} At least one number
            </Text>
            <Text
              style={[
                styles.rule,
                rules.special ? styles.ruleOk : styles.ruleMuted,
              ]}
            >
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
            style={[
              styles.btn,
              styles.btnPrimary,
              (pwSubmitting || isOAuth) && styles.btnDisabled,
            ]}
          >
            <Text style={styles.btnPrimaryText}>
              {pwSubmitting ? "Updating…" : "Change Password"}
            </Text>
          </Pressable>

          {pwStatus ? (
            <View style={{ marginTop: 12 }}>
              <StatusBanner
                type={pwStatus.type}
                message={pwStatus.message}
                onClose={() => setPwStatus(null)}
              />
            </View>
          ) : null}
        </Collapsible>

        <Pressable
          style={styles.rowBtn}
          onPress={() => setShowEmail((s) => !s)}
        >
          <Text style={styles.label}>Change Email</Text>
          <Text style={styles.value}>{showEmail ? "Close" : "Open"}</Text>
        </Pressable>

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
            onChangeText={(t) =>
              setEmailFields((f) => ({ ...f, currentPassword: t }))
            }
            style={styles.input}
            autoComplete="password"
          />

          <Pressable
            onPress={handleSubmitEmail}
            disabled={emailSubmitting || isOAuth}
            style={[
              styles.btn,
              styles.btnPrimary,
              (emailSubmitting || isOAuth) && styles.btnDisabled,
            ]}
          >
            <Text style={styles.btnPrimaryText}>
              {emailSubmitting ? "Updating…" : "Change Email"}
            </Text>
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

        <Pressable style={styles.rowBtn} onPress={() => setShow2FA((s) => !s)}>
          <Text style={styles.label}>Two-Factor Authentication</Text>
          <Text style={styles.value}>{show2FA ? "Close" : "Open"}</Text>
        </Pressable>

        <Collapsible open={show2FA}>
          {twoFA.enabled ? (
            <View>
              <Text style={[styles.inputLabel, { color: "#16a34a" }]}>
                2FA is currently ENABLED on your account.
              </Text>
              <Pressable
                onPress={disable2FA}
                disabled={twoFA.loading}
                style={[
                  styles.btn,
                  styles.btnWarning,
                  twoFA.loading && styles.btnDisabled,
                ]}
              >
                <Text style={styles.btnWarningText}>
                  {twoFA.loading ? "Disabling…" : "Disable 2FA"}
                </Text>
              </Pressable>

              {twoFA.generalStatus ? (
                <View style={{ marginTop: 12 }}>
                  <StatusBanner
                    type={twoFA.generalStatus.type}
                    message={twoFA.generalStatus.message}
                    onClose={() =>
                      setTwoFA((s) => ({ ...s, generalStatus: null }))
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : twoFA.showSetup ? (
            <View>
              <Text style={styles.inputLabel}>
                Scan this QR code with your authenticator app
              </Text>
              {twoFA.qrCode ? (
                <Image
                  source={{ uri: twoFA.qrCode }}
                  style={{
                    width: 160,
                    height: 160,
                    alignSelf: "flex-start",
                    marginBottom: 8,
                  }}
                />
              ) : null}

              <Text style={styles.inputLabel}>Or manually add this code</Text>
              <Text style={styles.monoSmall}>{twoFA.setupUrl}</Text>

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                Enter 6-digit code
              </Text>
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
                <Text style={styles.btnPrimaryText}>
                  {twoFA.loading ? "Verifying…" : "Verify & Enable 2FA"}
                </Text>
              </Pressable>

              {twoFA.verifyStatus ? (
                <View style={{ marginTop: 12 }}>
                  <StatusBanner
                    type={twoFA.verifyStatus.type}
                    message={twoFA.verifyStatus.message}
                    onClose={() =>
                      setTwoFA((s) => ({ ...s, verifyStatus: null }))
                    }
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
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  twoFA.loading && styles.btnDisabled,
                ]}
              >
                <Text style={styles.btnPrimaryText}>
                  {twoFA.loading ? "Starting…" : "Enable 2FA"}
                </Text>
              </Pressable>

              {twoFA.generalStatus ? (
                <View style={{ marginTop: 12 }}>
                  <StatusBanner
                    type={twoFA.generalStatus.type}
                    message={twoFA.generalStatus.message}
                    onClose={() =>
                      setTwoFA((s) => ({ ...s, generalStatus: null }))
                    }
                  />
                </View>
              ) : null}
            </View>
          )}
        </Collapsible>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Legal</Text>

        <Pressable
          style={styles.rowBtn}
          onPress={() => openURL("https://tcg.sixbyfive.com/privacy")}
        >
          <Text style={styles.label}>Privacy Policy</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable
          style={styles.rowBtn}
          onPress={() => openURL("https://tcg.sixbyfive.com/terms")}
        >
          <Text style={styles.label}>Terms of Service</Text>
          <Text style={styles.value}>Open</Text>
        </Pressable>

        <Pressable
          style={styles.rowBtn}
          onPress={() => openURL("mailto:support@sixbyfive.com")}
        >
          <Text style={styles.label}>Contact support</Text>
          <Text style={styles.value}>Email</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{appVersion}</Text>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

/* --------------------------------- Styles -------------------------------- */
const styles = StyleSheet.create({
  section: { padding: 16 },
  sectionTitle: { color: COLORS.textMuted, fontWeight: "800", marginBottom: 6 },

  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  cardBody: { color: COLORS.textMuted, marginTop: 6, lineHeight: 18 },

  // CHANGED: Notifications summary row (compact)
  notifSummaryRow: {
    marginTop: 12,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  notifSummaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  notifSummaryTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14,
  },
  notifSummarySub: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  notifSummaryChevron: {
    color: COLORS.textMuted,
    fontWeight: "900",
    fontSize: 12,
    paddingLeft: 4,
  },

  // NEW: Status pill
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: { fontSize: 11, fontWeight: "900", color: "white" },
  pillOk: { backgroundColor: "#0f5132", borderColor: "#badbcc" },
  pillBad: { backgroundColor: "#842029", borderColor: "#f5c2c7" },
  pillWarn: { backgroundColor: "#664d03", borderColor: "#ffecb5" },
  pillOff: { backgroundColor: COLORS.surface, borderColor: COLORS.border },

  // Advanced toggle rows
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  toggleTitle: { color: COLORS.text, fontWeight: "900" },
  toggleSub: { color: COLORS.textMuted, marginTop: 3, fontSize: 12 },

  settingsLinkBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  settingsLinkText: { color: COLORS.accent, fontWeight: "900" },

  infoBox: {
    marginTop: 2,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },

  smallLine: { color: COLORS.textSecondary, fontSize: 12 },
  smallMuted: { color: COLORS.textMuted },
  smallStrong: { color: COLORS.text, fontWeight: "800" },

  safetySummaryRow: {
    marginTop: 12,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  safetySummaryTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14,
  },
  safetySummarySub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  safetySummaryChevron: {
    color: COLORS.textMuted,
    fontWeight: "900",
    fontSize: 12,
    paddingLeft: 8,
  },

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
  helpText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },

  input: {
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 11, android: 10, default: 10 }),
  },

  lockedRow: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lockedRowIcon: {
    fontSize: 14,
    opacity: 0.9,
  },
  lockedRowText: {
    color: COLORS.text,
    fontWeight: "800",
  },

  ruleList: { marginTop: 6, marginBottom: 6 },
  rule: { fontSize: 12, marginVertical: 2 },
  ruleOk: { color: "#16a34a" },
  ruleMuted: { color: COLORS.textMuted },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: COLORS.accent },
  btnPrimaryText: { color: "#ffffff", fontWeight: "800" },

  btnSecondary: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnSecondaryText: { color: COLORS.text, fontWeight: "800" },

  btnWarning: { backgroundColor: "#fde047" },
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
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 12,
    marginBottom: 6,
  },
});
