// app/lib/realtime.js
//
// UPDATED (2026-02-09)
// - DEV_MODE uses local socket base (10.0.2.2) + custom path
// - GraphQL can remain live while socket is local
// - Sends token in handshake.auth.token (matches your backend extractTokenFromSocket)
// - Adds clear logs for connect/connect_error/disconnect

import Constants from "expo-constants";
import { io } from "socket.io-client";
import { getToken } from "./auth";

const extra = Constants.expoConfig?.extra || {};
const DEV_MODE = !!extra.EXPO_PUBLIC_DEV_MODE;

const SOCKET_URL = DEV_MODE
  ? extra.EXPO_PUBLIC_SOCKET_URL_LOCAL
  : extra.EXPO_PUBLIC_SOCKET_URL; // optional for later; can be undefined if you only use dev for now

const SOCKET_PATH = extra.EXPO_PUBLIC_SOCKET_PATH || "/realtime/socket.io";

let socket = null;

export async function connectSocket({ onConnect, onDisconnect, onError } = {}) {
  const token = await getToken();
  if (!token) {
    console.log("[socket] no token -> not connecting");
    return null;
  }

  if (!SOCKET_URL) {
    console.log("[socket] SOCKET_URL missing -> not connecting");
    return null;
  }

  // If already connected, reuse
  if (socket && socket.connected) return socket;

  // If exists but not connected, clean up
  if (socket) {
    try {
      socket.removeAllListeners();
    } catch {}
    try {
      socket.disconnect();
    } catch {}
    socket = null;
  }

  console.log("[socket] connecting", {
    url: SOCKET_URL,
    path: SOCKET_PATH,
    dev: DEV_MODE,
    configuredLocal: extra.EXPO_PUBLIC_SOCKET_URL_LOCAL,
  });

  socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    transports: ["polling", "websocket"], // polling first is more reliable in dev
    auth: { token }, // backend reads socket.handshake.auth.token
    reconnection: true,
    timeout: 15000,
  });

  socket.on("connect", () => {
    console.log("[socket] connected", socket.id);
    onConnect?.(socket);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected", reason);
    onDisconnect?.(reason);
  });

  socket.on("connect_error", (err) => {
    console.log("[socket] connect_error", err?.message || err, {
      url: SOCKET_URL,
      description: err?.description,
      context: err?.context,
      type: err?.type,
    });
    onError?.(err);
  });

  return socket;
}

export function isSocketConnected() {
  return !!socket?.connected;
}

export function getSocketId() {
  return socket?.id ?? null;
}

export function disconnectSocket() {
  if (!socket) return;
  try {
    socket.removeAllListeners();
  } catch {}
  try {
    socket.disconnect();
  } catch {}
  socket = null;
}
