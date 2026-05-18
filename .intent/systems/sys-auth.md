---
id: sys-auth
title: Authentication & Push Notifications
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: [plan-backend-migration]
decisions: [DEC-0004]
tags: [auth, jwt, push-notifications]
---

## Overview

Authentication uses JWT stored in `expo-secure-store`. The Apollo auth link reads the token and attaches it as `Authorization: Bearer <token>` on every request.

Push notification tokens are registered with the backend via GraphQL mutations.

## Key files

| File | Purpose |
|------|---------|
| `app/auth.js` | Login / register screens |
| `app/forgot-password.js` | Password reset request |
| `app/reset-password.js` | Password reset with token from deep link |
| `app/_layout.js` | Root layout â€” handles push token registration on mount |
| `lib/apollo.js` | Auth link attaches JWT to requests |
| `graphql/push.js` | Push token mutation documents |

## Push token mutation (new schema)

Both `registerExpoPushToken` and `unregisterExpoPushToken` return `Boolean!` in the new schema (not `{ ok, error }` like the old schema).

Handler in `_layout.js`:
```js
const ok = data?.registerExpoPushToken;
if (!ok) { /* handle failure */ }
```

## Deep link for password reset

`app.json` has an Android intent filter for `https://tcg.sixbyfive.com/reset-password` and an iOS associated domain for `tcg.sixbyfive.com`. The reset-password screen reads the token from the URL params.
