---
id: sys-messaging
title: Real-time Messaging
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: [plan-backend-migration]
decisions: [DEC-0002]
tags: [messaging, socket-io, realtime]
---

## Overview

The messaging system combines:

1. **Apollo GraphQL** â€” for fetching chat threads, message history, and unread counts
2. **Socket.IO** â€” for real-time message delivery (`EXPO_PUBLIC_SOCKET_URL`)
3. **`MessengerContext`** â€” React context wrapping Socket.IO connection, subscriptions, and unread badge count

## Key files

| File | Purpose |
|------|---------|
| `app/contexts/MessengerContext.js` | Socket.IO provider, unread count state |
| `app/(tabs)/messages.js` | Message thread list (tab screen) |
| `app/messages/[userId].js` | Individual chat screen |
| `graphql/messages.js` | GQL documents: `QUERY_MY_CHATS`, `QUERY_CHAT_WITH_USER`, `QUERY_UNREAD_COUNT`, `MUTATION_SEND_MESSAGE` |
| `components/messenger/ChatSafetyGate.js` | Safety/moderation gate before chat |
| `components/messenger/NewMessageModal.js` | User search + start new chat |

## Schema differences from old backend

The `chatWithUser` query in the new schema does **not** include:
- `sender` / `receiver` â€” removed
- `isFlagged` / `flagReason` / `flaggedById` â€” removed
- `expiresAt` / `updatedAt` â€” removed

Unread count field: `unreadMessageCount` (was `unreadCount`).

`QUERY_CHAT_RULES` does not exist in the new schema and has been removed.

## Routing to message screen

From `ProfileTopCard`, the "Message" button routes to `/messages/[userId]` using the target user's UUID (never username â€” the route expects a real user ID).
