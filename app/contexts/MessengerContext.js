// app/_providers/MessagingContext.js
//
// UPDATED (2026-02-12)
// CHANGES:
// - FIX: Maximum update depth loop caused by unstable function identities.
//        refreshChats/refreshUnread/loadChatRulesText/etc were recreated every render.
//        MessagesTab useFocusEffect depends on them -> callback identity changed -> re-ran on every render.
//        Solution: wrap all exported functions in useCallback + include them in value useMemo deps.
// - ADD: Defensive guards for missing GraphQL documents (prevents Apollo "query option is required" spam).
// - KEEP: Existing logic + socket wiring.
// - NOTE: "query option is required" means QUERY_* is undefined/null from ../../graphql/messages.
//         This update prevents infinite spam and surfaces a clear error in logs/lastError.

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

const MessagingContext = createContext(null);

/* =============================================================================
   Error helpers
============================================================================= */

function pickGqlCode(err) {
  const gqlErr = err?.graphQLErrors?.[0];
  return gqlErr?.extensions?.code || null;
}

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

function normalizeError(err) {
  const code = pickGqlCode(err);
  const statusCode = pickStatusCode(err);

  const firstError = err?.graphQLErrors?.[0] || null;
  const msg = firstError?.message || err?.message || "Something went wrong";

  return { code, statusCode, firstError, message: msg, raw: err };
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

  /* =============================================================================
     Core refreshers (FIXED: useCallback for stable identities)
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

      console.log("[messaging] refreshChats error", ne);
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
      setUnreadCount(Number(data?.unreadCount || 0));
    } catch (e) {
      const ne = normalizeError(e);
      setLastError(ne);

      if (ne.code === "CHAT_AGREEMENT_REQUIRED") setNeedsChatAgreement(true);
      if (ne.code === "CHAT_BANNED") setChatBanned(true);

      console.log("[messaging] refreshUnread error", ne);
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

        console.log("[messaging] fetchThread error", ne);
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

        console.log("[messaging] sendMessage error", ne);
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
        console.log("[messaging] markChatRead error", e?.message || e);
        return false;
      }
    },
    [apollo, refreshChats, refreshUnread],
  );

  /* =============================================================================
     ✅ Chat rules helpers (FIXED: useCallback)
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
      console.log("[messaging] loadChatRulesText error", ne);
      return null; // UI can show fallback rules
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

      console.log("[messaging] agreeToChatRules error", ne);
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

      s.on("newMessage", () => {
        console.log("[socket] newMessage");
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
    };
  }, [refreshChats, refreshUnread, setTyping]);

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

      // ✅ IMPORTANT: include functions so memo value updates correctly if they ever change
      loadChatRulesText,
      agreeToChatRules,
      refreshChats,
      refreshUnread,
      fetchThread,
      sendMessage,
      markChatRead,
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
