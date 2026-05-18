---
id: plan-backend-migration
title: Migrate mobile app to tcg-runtime gateway
type: plan
status: active
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
system: sys-backend
decisions: [DEC-0001, DEC-0002, DEC-0003, DEC-0004, DEC-0005, DEC-0008]
constraints: [CON-0001]
tags: [migration, backend, graphql]
---

## Goal

Replace all connections from the old WordPress TCG backend (`@sixbyfive/tcg-binder` generated client) with local GQL documents targeting the new `tcg-runtime` gateway (port 4010 / realtime port 4020).

## Reason

The old backend is being retired. The new `tcg-runtime` gateway is a purpose-built Node.js GraphQL server that serves as the single source of truth for all app operations including cards, collections, binders, wishlist, messaging, and auth.

## Scope

All 30+ screen and component files that previously imported from `@sixbyfive/tcg-binder` have been updated.

## Completed work (as of 2026-05-08)

### Infrastructure
- [x] `graphql/documents.js` â€” local GQL document library created
- [x] `hooks/useMeQuery.js` â€” hook shim created
- [x] `hooks/useSearchUsersLazyQuery.js` â€” hook shim created
- [x] `hooks/useUserProfileQuery.js` â€” hook shim created
- [x] `lib/apollo.js` â€” simplified to single gateway link (removed split routing)
- [x] `app.json` â€” updated with dev/prod endpoint config

### GQL documents rewritten
- [x] `graphql/messages.js` â€” new schema fields, removed deleted fields
- [x] `graphql/push.js` â€” Boolean! return type
- [x] `graphql/cardQueries.js` â€” new card fields (images, setCode, latestPrices, variants)
- [x] `graphql/collectionQueries.js` â€” new CatalogCard fields
- [x] `graphql/userQueries.js` â€” ME stripped, SEARCH_USERS uses `q` variable
- [x] `graphql/localCollectionDocuments.js` â€” new card fields
- [x] `graphql/app-search-queries.js` â€” searchCards with flat response

### Screens and components migrated
- [x] `app/auth.js`
- [x] `app/(tabs)/home.js`
- [x] `app/(tabs)/_layout.js`
- [x] `app/(tabs)/profile.js`
- [x] `app/(tabs)/collection.js`
- [x] `app/(tabs)/search.js`
- [x] `app/(tabs)/messages.js`
- [x] `app/card/[id].js`
- [x] `app/forgot-password.js`
- [x] `app/reset-password.js`
- [x] `app/messages/[userId].js`
- [x] `app/sets/index.js`
- [x] `app/profile/[username].js`
- [x] `app/binder/[id]/view.js`
- [x] `app/binder/[id]/index.js`
- [x] `app/_layout.js` (push token handler)
- [x] `components/binders/BinderGrid.js`
- [x] `components/binders/CardsAddDrawer.js`
- [x] `components/messenger/ChatSafetyGate.js`
- [x] `components/messenger/NewMessageModal.js`
- [x] `components/home/UserSearchCard.js`
- [x] `components/profile/ProfileTopCard.js`
- [x] `components/profile/tabs/BindersTab.js`
- [x] `components/profile/tabs/WishlistTab.js`
- [x] `hooks/useBinderActions.js`
- [x] `app/contexts/MessengerContext.js`

## Remaining items

See `plan-prod-deployment` for follow-up tasks required before a production build.
