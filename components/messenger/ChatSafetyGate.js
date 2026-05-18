// app/components/ChatSafetyGate.js
//
// UPDATED (2026-02-12)
// CHANGES (this revision):
// - FIX: Stop infinite focus loop (useFocusEffect re-ran because deps changed every render)
//        - Use refs for refetchMe/loadChatRulesText/fetchDobFallback so callback identity stays stable
//        - Add "run once per focus" guard (reset on blur)
// - CHANGE: Do NOT auto-call refreshChats/refreshUnread in the gate (Messages screen should do that)
//          (also avoids spamming when those functions are currently miswired)
// - KEEP: DOB gate + fallback ME_DOB_QUERY
// - KEEP: Agreement gate (rules text, reload rules, robust error display)
// - KEEP: Chat banned gate
//
// USAGE:
// <ChatSafetyGate renderHeader={() => <PageHeader ... />} >
//   ...your chat UI...
// </ChatSafetyGate>

import { gql, useApolloClient } from "@apollo/client";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";
import { useMeQuery } from "../../hooks/useMeQuery";
import { useMessaging } from "../../app/contexts/MessengerContext";
import { COLORS } from "../../theme/colors";

// ✅ Hardcoded rules fallback so UI never shows “blank rules”
const FALLBACK_CHAT_RULES = `
Be respectful.
No harassment, hate speech, or threats.
No sharing personal info.
No scams/spam.
Report abusive behaviour.
`.trim();

/* =========================
   Local fallback GraphQL
========================= */

const ME_DOB_QUERY = gql`
  query MeDobForMessagesGate {
    me {
      id
      dob
    }
  }
`;

/* =========================
   Helpers
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

function safeString(v) {
  return String(v ?? "").trim();
}

export default function ChatSafetyGate({ children, renderHeader }) {
  const router = useRouter();
  const client = useApolloClient();

  const [agreeing, setAgreeing] = useState(false);
  const [agreeError, setAgreeError] = useState("");

  // fallback DOB snapshot (guaranteed to include dob)
  const [dobFallbackIso, setDobFallbackIso] = useState("");
  const [dobFallbackLoading, setDobFallbackLoading] = useState(false);
  const [dobFallbackError, setDobFallbackError] = useState(null);

  // DB user snapshot (from binder hook)
  const {
    data: meData,
    loading: meLoading,
    error: meError,
    refetch: refetchMe,
  } = useMeQuery({ fetchPolicy: "cache-first" });
  const me = meData?.me || null;

  const {
    needsChatAgreement,
    chatBanned,
    chatRulesText,
    loadChatRulesText,
    agreeToChatRules,
  } = useMessaging();

  // Choose displayed rules text (provider -> fallback)
  const rulesToShow = (
    String(chatRulesText || "").trim() || FALLBACK_CHAT_RULES
  ).trim();

  // DOB from hook (may be missing if not selected)
  const dobHookIso = toInputDateValue(me?.dob);

  // Effective DOB = hook if present, else fallback
  const dobEffectiveIso = dobHookIso || dobFallbackIso || "";
  const hasDob = !!safeString(dobEffectiveIso);

  // Fetch DOB via fallback query (network-only)
  const fetchDobFallback = useCallback(async () => {
    setDobFallbackLoading(true);
    setDobFallbackError(null);

    try {
      const { data } = await client.query({
        query: ME_DOB_QUERY,
        fetchPolicy: "network-only",
      });

      const iso = toInputDateValue(data?.me?.dob);
      setDobFallbackIso(iso);

      console.log("[ChatSafetyGate] ME_DOB_QUERY ok:", {
        id: data?.me?.id,
        dob_raw: data?.me?.dob,
        dob_iso: iso,
      });

      return iso;
    } catch (err) {
      const msg =
        err?.graphQLErrors?.[0]?.message ||
        err?.networkError?.message ||
        err?.message ||
        "ME_DOB_QUERY failed";

      setDobFallbackError(msg);

      console.log("[ChatSafetyGate] ME_DOB_QUERY FAILED:", {
        message: msg,
        raw: err,
      });

      return "";
    } finally {
      setDobFallbackLoading(false);
    }
  }, [client]);

  /* =========================================================
     FIX: Stabilise focus effect to avoid infinite reruns
     - useFocusEffect reruns if the callback identity changes
     - context hooks often return new function identities
     So we store latest functions in refs and keep the focus
     callback dependency array EMPTY.
  ========================================================= */

  const refetchMeRef = useRef(refetchMe);
  const loadRulesRef = useRef(loadChatRulesText);
  const fetchDobRef = useRef(fetchDobFallback);

  useEffect(() => {
    refetchMeRef.current = refetchMe;
  }, [refetchMe]);

  useEffect(() => {
    loadRulesRef.current = loadChatRulesText;
  }, [loadChatRulesText]);

  useEffect(() => {
    fetchDobRef.current = fetchDobFallback;
  }, [fetchDobFallback]);

  // Initial load (runs once)
  useEffect(() => {
    console.log("[ChatSafetyGate] mount: load rules + dob fallback fetch");
    loadRulesRef.current?.();
    fetchDobRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run once per focus (and reset on blur)
  const ranOnFocusRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (ranOnFocusRef.current) return;

      ranOnFocusRef.current = true;

      console.log("[ChatSafetyGate] focus: refetch me + dob fallback + rules");

      // IMPORTANT: these are called via refs so this callback stays stable
      refetchMeRef.current?.().catch(() => {});
      loadRulesRef.current?.();
      fetchDobRef.current?.();

      return () => {
        // reset for next focus
        ranOnFocusRef.current = false;
      };
    }, []),
  );

  async function onAgree() {
    console.log("[ChatSafetyGate] onAgree pressed");
    setAgreeError("");

    // Fail-closed (matches previous behaviour)
    if (meLoading || meError) {
      const msg =
        "Account details could not be loaded. Please try again once the server responds.";
      console.log("[ChatSafetyGate] onAgree blocked (me not available):", msg);
      setAgreeError(msg);
      return;
    }

    if (!hasDob) {
      const msg = "Please add your date of birth in Settings first.";
      console.log("[ChatSafetyGate] onAgree blocked (DOB missing):", msg);
      setAgreeError(msg);
      return;
    }

    if (agreeing) return;

    if (typeof agreeToChatRules !== "function") {
      const msg =
        "agreeToChatRules() is not wired in the provider (undefined). Check MessengerContext exports.";
      console.log("[ChatSafetyGate] " + msg);
      setAgreeError(msg);
      return;
    }

    try {
      setAgreeing(true);

      console.log("[ChatSafetyGate] calling agreeToChatRules()...");
      const result = await agreeToChatRules();
      console.log("[ChatSafetyGate] agreeToChatRules() result =>", result);

      // Keep this gate-only: revalidate user + DOB + rules after agreement
      await Promise.allSettled([
        refetchMeRef.current?.(),
        fetchDobRef.current?.(),
      ]);

      setTimeout(() => {
        console.log("[ChatSafetyGate] post-agree delayed refetch");
        refetchMeRef.current?.().catch(() => {});
        fetchDobRef.current?.();
      }, 350);
    } catch (e) {
      const rawMessage =
        e?.message ||
        e?.raw?.message ||
        e?.graphQLErrors?.[0]?.message ||
        "Failed to agree to chat rules";

      const code =
        e?.code ||
        e?.graphQLErrors?.[0]?.extensions?.code ||
        e?.raw?.graphQLErrors?.[0]?.extensions?.code ||
        null;

      const statusCode =
        e?.statusCode ||
        e?.networkError?.statusCode ||
        e?.networkError?.status ||
        e?.networkError?.response?.status ||
        null;

      const msg = `${rawMessage}${code ? ` (code: ${code})` : ""}${
        statusCode ? ` (status: ${statusCode})` : ""
      }`;

      console.log("[ChatSafetyGate] agreeToChatRules() ERROR =>", e);
      setAgreeError(msg);
    } finally {
      setAgreeing(false);
    }
  }

  /* =========================
     Gates (same order/behaviour)
  ========================= */

  if (chatBanned) {
    return (
      <View style={styles.container}>
        {renderHeader?.()}
        <View style={styles.gateWrap}>
          <Text style={styles.gateTitle}>Chat access disabled</Text>
          <Text style={styles.gateBody}>
            Your account is currently restricted from using messaging.
          </Text>
        </View>
      </View>
    );
  }

  // Gate: if fallback DOB is still loading and hook doesn't have DOB, show loading gate
  if (!dobHookIso && dobFallbackLoading) {
    return (
      <View style={styles.container}>
        {renderHeader?.()}
        <View style={styles.gateWrap}>
          <Text style={styles.gateTitle}>Checking your account…</Text>
          <Text style={styles.gateBody}>
            Loading your safety profile from the server.
          </Text>
          <View style={{ marginTop: 10 }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        </View>
      </View>
    );
  }

  // Gate: DOB missing
  if (!hasDob) {
    return (
      <View style={styles.container}>
        {renderHeader?.()}

        <View style={styles.gateWrap}>
          <Text style={styles.gateTitle}>Add your date of birth</Text>
          <Text style={styles.gateBody}>
            To keep messaging safe, you must add your date of birth before using
            chat.
          </Text>

          {!!dobFallbackError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>DOB check error</Text>
              <Text style={styles.errorText}>{String(dobFallbackError)}</Text>
            </View>
          )}

          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={10}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.primaryText}>Open Settings</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              console.log("[ChatSafetyGate] refresh pressed (DOB gate)");
              fetchDobRef.current?.();
              refetchMeRef.current?.().catch(() => {});
              // NOTE: Do NOT call refreshChats/refreshUnread here (Messages screen handles inbox refresh)
            }}
            hitSlop={10}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.secondaryText}>Refresh</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Gate: agreement required
  if (needsChatAgreement) {
    return (
      <View style={styles.container}>
        {renderHeader?.()}

        <View style={styles.gateWrap}>
          <Text style={styles.gateTitle}>Agree to chat rules</Text>
          <Text style={styles.gateBody}>
            You need to accept the chat rules before you can use messaging.
          </Text>

          <View style={styles.rulesBox}>
            <Text style={styles.rulesText}>{rulesToShow}</Text>
          </View>

          {!!agreeError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>
                Couldn’t save your agreement
              </Text>
              <Text style={styles.errorText}>{agreeError}</Text>
            </View>
          )}

          <Pressable
            onPress={onAgree}
            disabled={agreeing}
            hitSlop={10}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: pressed || agreeing ? 0.75 : 1 },
            ]}
          >
            {agreeing ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <ActivityIndicator color="#fff" />
                <Text style={styles.primaryText}>Agreeing…</Text>
              </View>
            ) : (
              <Text style={styles.primaryText}>I agree</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => loadRulesRef.current?.()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.secondaryText}>Reload rules</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  gateWrap: { padding: 16, paddingTop: 24, gap: 12 },
  gateTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  gateBody: { color: COLORS.textMuted, lineHeight: 20 },

  rulesBox: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  rulesText: { color: COLORS.textSecondary, lineHeight: 20 },

  primaryBtn: {
    marginTop: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { color: COLORS.text, fontWeight: "800" },

  errorBox: {
    backgroundColor: COLORS.surface,
    borderColor: "#ff5a5f",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  errorTitle: { color: "#ff5a5f", fontWeight: "900" },
  errorText: { color: COLORS.textSecondary, lineHeight: 18 },
});
