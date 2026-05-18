---
id: plan-prod-deployment
title: Production deployment readiness
type: plan
status: draft
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-10T00:00:00.000Z"
system: sys-backend
decisions: [DEC-0006, DEC-0007, DEC-0010, DEC-0011]
constraints: [CON-0001]
tags: [production, deployment, config]
---

## Goal

Complete the remaining work items before the new backend can be used in a production build.

## Reason

The migration to tcg-runtime is functionally complete for local development. Several config values and two functional gaps need to be resolved before shipping a production build.

## Checklist

### Config changes
- [x] **Set prod backend domain** — `app.json` updated: `EXPO_PUBLIC_GRAPHQL_ENDPOINT`, `EXPO_PUBLIC_ASSET_BASE_URL`, `EXPO_PUBLIC_SOCKET_URL` all point at `https://backendtcg.sixbyfive.com`
- [ ] **Flip dev mode** — Set `EXPO_PUBLIC_DEV_MODE: false` in `app.json` before every production build
- [x] **Update JS asset fallbacks** — Three files hardcode `backendtcg.sixbyfive.com` as the asset URL fallback. The new backend uses the same domain — no change needed:
  - `app/(tabs)/messages.js`
  - `app/messages/[userId].js`
  - `components/profile/ProfileTopCard.js`
- [x] **Fix dev socket port** — `EXPO_PUBLIC_SOCKET_URL_LOCAL` corrected from `4020` to `4018` (see DEC-0010)

### Functional gaps
- [x] **MoveBinderSlot / RemoveBinderSlot** — `moveSlot` and `removeSlot` in `useBinderActions.js` now build a full pages payload and call `saveBinderPagesAndSlots` directly. Stubs removed (see DEC-0007).
- [x] **cardSetCompletion** — `cardSetCompletion(setCode: String!): CardSetCompletion!` added to the gateway schema and resolved via `collections-service GET /collection/set-completion`. `useSetOwned.js` will now get real data back instead of hitting a missing-query error (see tcg-runtime gateway, 2026-05-17).
- [x] **addCard on empty binder** — `useBinderActions.js` now auto-creates the first page via `saveBinderPagesAndSlots` when a new binder has no pages (see DEC-0011)

### Pre-build verification
- [ ] Test login / register flow against prod backend
- [ ] Test push token registration on a real device
- [ ] Test card search, collection, and binder flows
- [ ] Test messaging (send/receive, unread count badge)
- [ ] Verify deep link password reset works on both platforms
