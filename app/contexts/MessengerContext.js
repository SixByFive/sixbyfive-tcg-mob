// app/_providers/MessagingContext.js
//
// UPDATED (2026-02-15)
//
// PUSH NOTIFICATIONS (FRONTEND-ONLY FOR NOW)
// - ADD: Register push permissions + Expo push token when the user is logged in (token exists)
// - ADD: Store Expo push token locally in SecureStore so we can use it later when backend resumes
// - ADD: Expose `expoPushToken` + `pushPermissionStatus` in context for debugging/UI if needed
// - ADD: Small retry/backoff so it doesn't spam on transient failures
//
// NOTES:
// - This does NOT send the token to backend yet (backend paused). It only logs + stores locally.
// - It runs when auth token exists (getToken()) which matches your socket boot guard.
// - Requires packages already discussed: expo-notifications/expo-device/expo-constants and expo-secure-store
//   (push.js handles notifications channel + permissions; this file just uses it).
//

import { useApolloClient } from "@apollo/client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MUTATION_AGREE_TO_CHAT_RULES,
  MUTATION_MARK_CHAT_READ,
  MUTATION_SEND_MESSAGE,
  QUERY_CHAT_RULES_TEXT,
  QUERY_CHAT_WITH_USER,
  QUERY_HAS_AGREED_TO_CHAT_RULES,
  QUERY_MY_CHATS,
  QUERY_UNREAD_COUNT,
} from "../../graphql/messages";

import { getToken } from "../../lib/auth";
import { connectSocket, disconnectSocket } from "../../lib/realtime";

// ADD: Push helpers (frontend-only token registration + local storage)
import * as SecureStore from "expo-secure-store";
import {
  ensurePushPermissionsAsync,
  getExpoPushTokenAsync,
} from "../../lib/push";

const MessagingContext = createContext(null);

/* =============================================================================
   Push token local storage helpers (frontend-only)
============================================================================= */

const PUSH_TOKEN_STORE_KEY = "sbf_expo_push_token_v1";

async function saveExpoPushTokenLocal(payload) {
  try {
    // payload shape: { token, savedAt, permissionStatus }
    await SecureStore.setItemAsync(
      PUSH_TOKEN_STORE_KEY,
      JSON.stringify(payload),
    );
    return true;
  } catch (e) {
    console.log("[push] saveExpoPushTokenLocal error", e?.message || e);
    return false;
  }
}

async function loadExpoPushTokenLocal() {
  try {
    const raw = await SecureStore.getItemAsync(PUSH_TOKEN_STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/* =============================================================================
   Error helpers
============================================================================= */

// (unchanged) Pulls a GraphQL extensions code if present (only works when graphQLErrors is populated)
function pickGqlCode(err) {
  const gqlErr = err?.graphQLErrors?.[0];
  return gqlErr?.extensions?.code || null;
}

// (unchanged) Best-effort status code extractor for network errors
function pickStatusCode(err) {
  const ne = err?.networkError;
  if (!ne || typeof ne !== "object") return null;
  return (
    ne.statusCode ??
    ne.status ??
    ne.response?.status ??
    ne.result?.statusCode ??
    null
  );
}

/**
 * Apollo sometimes returns HTTP 400 for GraphQL validation errors.
 * In those cases, err.graphQLErrors is often empty, but the error payload is in:
 *   err.networkError.result.errors[0]
 */
function pickNetworkGraphQLError(err) {
  const ne = err?.networkError;
  if (!ne || typeof ne !== "object") return null;

  // Apollo ServerError often has `result` containing { errors: [...] }
  const first = ne?.result?.errors?.[0] || null;
  return first;
}

/**
 * As a last resort, capture network body text (sometimes contains JSON string).
 * This is intentionally conservative (we don't parse unless it's clearly JSON).
 */
function pickNetworkBodyText(err) {
  const ne = err?.networkError;
  if (!ne || typeof ne !== "object") return null;

  const bodyText = ne?.bodyText;
  if (typeof bodyText !== "string" || !bodyText.trim()) return null;

  // Try to parse JSON-looking bodyText
  const trimmed = bodyText.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;

  try {
    const parsed = JSON.parse(trimmed);
    // common shape: { errors: [{ message }], data: null }
    const msg = parsed?.errors?.[0]?.message;
    return msg || trimmed;
  } catch (_) {
    return trimmed;
  }
}

/**
 * CHANGED: normalizeError now correctly handles 400 validation errors by
 * pulling first error from networkError.result.errors[0] when graphQLErrors is empty.
 */
function normalizeError(err) {
  const code = pickGqlCode(err);
  const statusCode = pickStatusCode(err);

  // Prefer normal graphQLErrors (HTTP 200 with errors)
  const graphFirst = err?.graphQLErrors?.[0] || null;

  // For HTTP 400 validation errors, use networkError.result.errors[0]
  const networkFirst = pickNetworkGraphQLError(err);

  // Try to derive a human message from bodyText if needed
  const bodyMsg = pickNetworkBodyText(err);

  const firstError = graphFirst || networkFirst || null;

  const msg =
    firstError?.message || bodyMsg || err?.message || "Something went wrong";

  // If no code from graphQLErrors, sometimes code exists under networkFirst.extensions
  const networkCode =
    networkFirst?.extensions?.code ||
    networkFirst?.extensions?.exception?.code ||
    null;

  return {
    code: code || networkCode || null,
    statusCode,
    firstError,
    message: msg,
    raw: err,
  };
}

function missingDocError(name) {
  return {
    code: "CLIENT_MISSING_GQL_DOCUMENT",
    statusCode: null,
    firstError: null,
    message: `${name} is undefined. Check ../../graphql/messages exports (Apollo requires a gql document).`,
    raw: null,
  };
}

/* =============================================================================
   Provider
============================================================================= */

export function MessagingProvider({ children }) {
  const apollo = useApolloClient();

  const [chats, setChats] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [typingByUser, setTypingByUser] = useState({});
  const typingTimeoutsRef = useRef(new Map());

  const [needsChatAgreement, setNeedsChatAgreement] = useState(false);
  const [chatBanned, setChatBanned] = useState(false);
  const [lastError, setLastError] = useState(null);

  // ✅ chat rules state
  const [chatRulesText, setChatRulesText] = useState("");
  const [hasAgreedToChatRules, setHasAgreedToChatRules] = useState(false);

  const socketRef = useRef(null);

  // ADD: Push debug state (frontend-only)
  const [expoPushToken, setExpoPushToken] = useState("");
  const [pushPermissionStatus, setPushPermissionStatus] = useState("unknown");

  /* =============================================================================
     NEW: "newMessage" subscribers (for open thread live updates)
  ============================================================================= */

  // Each subscriber receives the raw socket payload: e.g. { from: "<uuid>" }
  // (or null/undefined if backend emits no payload)
  const newMessageSubscribersRef = useRef(new Set());

  /**
   * Subscribe to socket "newMessage" events.
   * Returns an unsubscribe function.
   */
  const subscribeToNewMessages = useCallback((cb) => {
    if (typeof cb !== "function") return () => {};
    newMessageSubscribersRef.current.add(cb);
    return () => {
      newMessageSubscribersRef.current.delete(cb);
    };
  }, []);

  const emitNewMessageToSubscribers = useCallback((payload) => {
    for (const cb of newMessageSubscribersRef.current) {
      try {
        cb(payload);
      } catch (e) {
        console.log("[messaging] newMessage subscriber error", e?.message || e);
      }
    }
  }, []);

  /* =============================================================================
     Core refreshers (stable identities via useCallback)
  ============================================================================= */

  const refreshChats = useCallback(async () => {
    // ✅ Guard: prevent Apollo invariant spam if query doc is missing
    if (!QUERY_MY_CHATS) {
      const ne = missingDocError("QUERY_MY_CHATS");
      setLastError(ne);
      console.log("[messaging] refreshChats error", ne);
      return;
    }

    try {
      const { data } = await apollo.query({
        query: QUERY_MY_CHATS,
        variables: { page: 1, pageSize: 50 },
        fetchPolicy: "network-only",
      });

      setChats(data?.myChats || []);
      setNeedsChatAgreement(false);
      setChatBanned(false);
      setLastError(null);
    } catch (e) {
      const ne = normalizeError(e);
      setLastError(ne);

      if (ne.code === "CHAT_AGREEMENT_REQUIRED") setNeedsChatAgreement(true);
      if (ne.code === "CHAT_BANNED") setChatBanned(true);

      console.log("[messaging] refreshChats error", ne, ne?.firstError);
    }
  }, [apollo]);

  const refreshUnread = useCallback(async () => {
    if (!QUERY_UNREAD_COUNT) {
      const ne = missingDocError("QUERY_UNREAD_COUNT");
      setLastError(ne);
      console.log("[messaging] refreshUnread error", ne);
      return;
    }

    try {
      const { data } = await apollo.query({
        query: QUERY_UNREAD_COUNT,
        fetchPolicy: "network-only",
      });
      setUnreadCount(Number(data?.unreadMessageCount ?? data?.unreadCount ?? 0));
    } catch (e) {
      const ne = normalizeError(e);
      setLastError(ne);

      if (ne.code === "CHAT_AGREEMENT_REQUIRED") setNeedsChatAgreement(true);
      if (ne.code === "CHAT_BANNED") setChatBanned(true);

      console.log("[messaging] refreshUnread error", ne, ne?.firstError);
    }
  }, [apollo]);

  const fetchThread = useCallback(
    async (userId, { page = 1, pageSize = 50 } = {}) => {
      if (!QUERY_CHAT_WITH_USER) {
        const ne = missingDocError("QUERY_CHAT_WITH_USER");
        setLastError(ne);
        console.log("[messaging] fetchThread error", ne);
        throw ne;
      }

      try {
        const { data } = await apollo.query({
          query: QUERY_CHAT_WITH_USER,
          variables: { userId, page, pageSize },
          fetchPolicy: "network-only",
        });

        setNeedsChatAgreement(false);
        setChatBanned(false);
        setLastError(null);

        return data?.chatWithUser || [];
      } catch (e) {
        const ne = normalizeError(e);
        setLastError(ne);

        if (ne.code === "CHAT_AGREEMENT_REQUIRED") setNeedsChatAgreement(true);
        if (ne.code === "CHAT_BANNED") setChatBanned(true);

        console.log("[messaging] fetchThread error", ne, ne?.firstError);
        throw ne;
      }
    },
    [apollo],
  );

  const sendMessage = useCallback(
    async (receiverId, content, meta = null) => {
      if (!MUTATION_SEND_MESSAGE) {
        const ne = missingDocError("MUTATION_SEND_MESSAGE");
        setLastError(ne);
        console.log("[messaging] sendMessage error", ne);
        throw ne;
      }

      try {
        const { data } = await apollo.mutate({
          mutation: MUTATION_SEND_MESSAGE,
          variables: { receiverId, content, meta },
        });

        // ✅ use the stable callbacks
        refreshChats();
        refreshUnread();

        return data?.sendMessage || null;
      } catch (e) {
        const ne = normalizeError(e);
        setLastError(ne);

        console.log("[messaging] sendMessage error", ne, ne?.firstError);
        throw ne;
      }
    },
    [apollo, refreshChats, refreshUnread],
  );

  const markChatRead = useCallback(
    async (userId) => {
      if (!MUTATION_MARK_CHAT_READ) {
        const ne = missingDocError("MUTATION_MARK_CHAT_READ");
        setLastError(ne);
        console.log("[messaging] markChatRead error", ne);
        return false;
      }

      try {
        await apollo.mutate({
          mutation: MUTATION_MARK_CHAT_READ,
          variables: { userId },
        });

        refreshUnread();
        refreshChats();
        return true;
      } catch (e) {
        const ne = normalizeError(e);
        setLastError(ne);
        console.log("[messaging] markChatRead error", ne, ne?.firstError);
        return false;
      }
    },
    [apollo, refreshChats, refreshUnread],
  );

  /* =============================================================================
     Chat rules helpers (stable identities)
  ============================================================================= */

  const loadChatRulesText = useCallback(async () => {
    if (!QUERY_CHAT_RULES_TEXT) {
      const ne = missingDocError("QUERY_CHAT_RULES_TEXT");
      setLastError(ne);
      console.log("[messaging] loadChatRulesText error", ne);
      return null;
    }

    try {
      const { data } = await apollo.query({
        query: QUERY_CHAT_RULES_TEXT,
        fetchPolicy: "network-only",
      });

      const txt = String(data?.chatRulesText || "").trim();
      setChatRulesText(txt);
      setLastError(null);

      // Optional: refresh boolean
      if (QUERY_HAS_AGREED_TO_CHAT_RULES) {
        try {
          const status = await apollo.query({
            query: QUERY_HAS_AGREED_TO_CHAT_RULES,
            fetchPolicy: "network-only",
          });
          setHasAgreedToChatRules(!!status?.data?.hasAgreedToChatRules);
        } catch (_) {
          // non-fatal
        }
      }

      return txt;
    } catch (e) {
      const ne = normalizeError(e);
      setLastError(ne);
      console.log("[messaging] loadChatRulesText error", ne, ne?.firstError);
      return null;
    }
  }, [apollo]);

  const agreeToChatRules = useCallback(async () => {
    if (!MUTATION_AGREE_TO_CHAT_RULES) {
      const ne = missingDocError("MUTATION_AGREE_TO_CHAT_RULES");
      setLastError(ne);
      console.log("[messaging] agreeToChatRules error", ne);
      throw ne;
    }

    try {
      const { data } = await apollo.mutate({
        mutation: MUTATION_AGREE_TO_CHAT_RULES,
      });

      const ok = !!data?.agreeToChatRules;
      console.log("[messaging] agreeToChatRules result =>", ok);

      if (ok) {
        setHasAgreedToChatRules(true);
        setNeedsChatAgreement(false);
        setChatBanned(false);
        setLastError(null);

        await Promise.allSettled([refreshChats(), refreshUnread()]);
      }

      return ok;
    } catch (e) {
      const ne = normalizeError(e);
      setLastError(ne);

      console.log("[messaging] agreeToChatRules error", ne, ne?.firstError);
      throw ne;
    }
  }, [apollo, refreshChats, refreshUnread]);

  /* =============================================================================
     Typing helpers (unchanged)
  ============================================================================= */

  const clearTyping = useCallback((userId) => {
    setTypingByUser((prev) => {
      const next = { ...prev };
      delete next[String(userId)];
      return next;
    });

    const t = typingTimeoutsRef.current.get(String(userId));
    if (t) clearTimeout(t);
    typingTimeoutsRef.current.delete(String(userId));
  }, []);

  const setTyping = useCallback(
    (userId, isTyping) => {
      const id = String(userId);

      setTypingByUser((prev) => ({ ...prev, [id]: !!isTyping }));

      const existing = typingTimeoutsRef.current.get(id);
      if (existing) clearTimeout(existing);

      if (isTyping) {
        const t = setTimeout(() => clearTyping(id), 2500);
        typingTimeoutsRef.current.set(id, t);
      } else {
        typingTimeoutsRef.current.delete(id);
      }
    },
    [clearTyping],
  );

  /* =============================================================================
     NEW: Push boot (frontend-only)
  ============================================================================= */

  useEffect(() => {
    let alive = true;
    let retryTimer = null;
    let attempt = 0;

    async function bootPush() {
      try {
        const token = await getToken();
        if (!alive) return;

        // Only register push when user is "logged in" (same rule as socket boot)
        if (!token) return;

        // Load previously saved token to avoid re-registering every launch
        const cached = await loadExpoPushTokenLocal();
        if (!alive) return;

        if (cached?.token) {
          setExpoPushToken(String(cached.token));
          setPushPermissionStatus(String(cached.permissionStatus || "unknown"));
          if (__DEV__) console.log("[push] using cached expo token");
          return;
        }

        const perm = await ensurePushPermissionsAsync();
        if (!alive) return;

        setPushPermissionStatus(String(perm?.status || "unknown"));

        if (!perm?.granted) {
          console.log("[push] permission not granted:", perm?.status);
          return;
        }

        const expoToken = await getExpoPushTokenAsync();
        if (!alive) return;

        if (!expoToken) {
          throw new Error("Could not obtain Expo push token");
        }

        setExpoPushToken(String(expoToken));

        await saveExpoPushTokenLocal({
          token: String(expoToken),
          savedAt: Date.now(),
          permissionStatus: String(perm?.status || "unknown"),
        });

        console.log("[push] expo token ready:", expoToken);

        // Backend paused:
        // Later: send this token to backend via mutation (upsertPushToken)
      } catch (e) {
        console.log("[push] bootPush error", e?.message || e);

        // Very small retry/backoff (helps with transient native readiness)
        attempt += 1;
        if (attempt <= 2 && alive) {
          const delay = attempt === 1 ? 800 : 1800;
          retryTimer = setTimeout(bootPush, delay);
        }
      }
    }

    bootPush();

    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  /* =============================================================================
     Socket boot (uses stable refreshers)
  ============================================================================= */

  useEffect(() => {
    let alive = true;

    async function boot() {
      const token = await getToken();
      if (!alive) return;

      if (!token) {
        disconnectSocket();
        socketRef.current = null;
        return;
      }

      const s = await connectSocket({
        onConnect: () => console.log("[socket] connected"),
        onDisconnect: (r) => console.log("[socket] disconnected", r),
        onError: (e) => console.log("[socket] connect_error", e?.message || e),
      });

      if (!alive) return;

      socketRef.current = s;

      // Backend may emit either:
      //   newMessage()                         (no payload)
      //   newMessage({ from: "<uuid>", ... })  (payload)
      s.on("newMessage", (payload) => {
        console.log("[socket] newMessage", payload);

        // notify open screens (thread) first
        emitNewMessageToSubscribers(payload || null);

        // keep existing behavior
        refreshChats();
        refreshUnread();
      });

      s.on("typing", (payload) => {
        console.log("[socket] typing", payload);
        const from = payload?.from;
        if (!from) return;
        setTyping(from, !!payload?.isTyping);
      });
    }

    boot();

    return () => {
      alive = false;
      disconnectSocket();
      socketRef.current = null;

      for (const t of typingTimeoutsRef.current.values()) clearTimeout(t);
      typingTimeoutsRef.current.clear();

      // NOTE: Do not clear newMessageSubscribersRef here.
      // Screens unsubscribe on unmount; keeping it avoids edge-case races.
    };
  }, [emitNewMessageToSubscribers, refreshChats, refreshUnread, setTyping]);

  // Initial data load (stable callbacks)
  useEffect(() => {
    refreshChats();
    refreshUnread();
    loadChatRulesText();
  }, [refreshChats, refreshUnread, loadChatRulesText]);

  const value = useMemo(
    () => ({
      chats,
      unreadCount,
      typingByUser,

      needsChatAgreement,
      chatBanned,
      lastError,

      chatRulesText,
      hasAgreedToChatRules,
      loadChatRulesText,
      agreeToChatRules,

      refreshChats,
      refreshUnread,

      fetchThread,
      sendMessage,
      markChatRead,
      subscribeToNewMessages,

      // ADD: push debug values (useful for testing while backend paused)
      expoPushToken,
      pushPermissionStatus,
    }),
    [
      chats,
      unreadCount,
      typingByUser,
      needsChatAgreement,
      chatBanned,
      lastError,
      chatRulesText,
      hasAgreedToChatRules,

      loadChatRulesText,
      agreeToChatRules,
      refreshChats,
      refreshUnread,
      fetchThread,
      sendMessage,
      markChatRead,

      subscribeToNewMessages,

      expoPushToken,
      pushPermissionStatus,
    ],
  );

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx)
    throw new Error("useMessaging must be used inside MessagingProvider");
  return ctx;
}

// Keep this to avoid Expo Router treating the provider file as a route
export default function _IgnoreRoute() {
  return null;
}
