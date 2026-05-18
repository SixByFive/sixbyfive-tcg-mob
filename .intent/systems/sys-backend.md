---
id: sys-backend
title: Backend Integration (tcg-runtime gateway)
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-10T00:00:00.000Z"
plans: [plan-backend-migration, plan-prod-deployment]
decisions: [DEC-0005, DEC-0006, DEC-0010]
tags: [backend, gateway, endpoints]
---

## Overview

The mobile app connects to the **tcg-runtime** monorepo backend, which exposes:

- **GraphQL gateway** on port `4010` â€” single endpoint for all operations (`/graphql`)
- **Realtime server** on port `4018` — Socket.IO for live messaging

The old backend was a WordPress-based API at `backendtcg.sixbyfive.com`. That backend is still live and used as the prod fallback until the new backend gets a production domain.

## Endpoint configuration

Endpoints are controlled by two environment variables in `app.json`:

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_DEV_MODE` | `true` â†’ use local dev URLs; `false` â†’ use prod URLs |
| `EXPO_PUBLIC_GRAPHQL_ENDPOINT` | Prod GraphQL endpoint (placeholder until prod backend deployed) |
| `EXPO_PUBLIC_ASSET_BASE_URL` | Prod asset base URL |
| `EXPO_PUBLIC_SOCKET_URL` | Prod Socket.IO URL |
| `EXPO_PUBLIC_GRAPHQL_ENDPOINT_LOCAL` | Dev GraphQL: `http://10.0.2.2:4010/graphql` |
| `EXPO_PUBLIC_SOCKET_URL_LOCAL` | Dev Socket.IO: `http://10.0.2.2:4018` |

## Android emulator note

Android emulator does not resolve `localhost`. Use `10.0.2.2` to reach the host machine. iOS simulator uses `localhost` normally.

## Current state (2026-05-10)

- `EXPO_PUBLIC_DEV_MODE = true` â€” pointing at local gateway
- Prod URLs contain `REPLACE_WITH_PROD_API_URL` placeholder â€” must be updated before production build
- `EXPO_PUBLIC_DEV_MODE` must be flipped to `false` before production build
- Asset URLs in JS fallback strings still reference `backendtcg.sixbyfive.com` (old, still-live backend) as a safe fallback
