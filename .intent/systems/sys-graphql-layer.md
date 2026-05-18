---
id: sys-graphql-layer
title: GraphQL Client Layer
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: [plan-backend-migration]
decisions: [DEC-0001, DEC-0002, DEC-0003]
tags: [graphql, apollo, hooks]
---

## Overview

The GraphQL client layer is the app's interface to the tcg-runtime gateway. It consists of three parts:

1. **`graphql/documents.js`** â€” single source of truth for all GQL operation documents. Replaces the generated `@sixbyfive/tcg-binder` client entirely.
2. **`lib/apollo.js`** â€” Apollo Client setup with auth link (JWT from SecureStore), HTTP link, and WebSocket/subscription support. Routes all operations to the single gateway endpoint.
3. **Hook shims** (`hooks/useMeQuery.js`, `hooks/useSearchUsersLazyQuery.js`, `hooks/useUserProfileQuery.js`) â€” thin wrappers around `useQuery`/`useLazyQuery` that accept the same call signature as the old generated hooks.

## Key files

| File | Purpose |
|------|---------|
| `graphql/documents.js` | All GQL documents (queries, mutations, subscriptions) |
| `graphql/messages.js` | Messaging-specific GQL (chat, threads, unread count) |
| `graphql/push.js` | Push token registration/deregistration mutations |
| `graphql/cardQueries.js` | Card detail and search queries |
| `graphql/collectionQueries.js` | Collection-related queries |
| `graphql/userQueries.js` | ME, SEARCH_USERS, profile queries |
| `graphql/app-search-queries.js` | Card search with filters |
| `graphql/localCollectionDocuments.js` | Collection mutation documents |
| `lib/apollo.js` | Apollo Client instance, auth link, routing |
| `hooks/useMeQuery.js` | Shim for `useQuery(MeDocument)` |
| `hooks/useSearchUsersLazyQuery.js` | Shim for `useLazyQuery(SearchUsersDocument)` |
| `hooks/useUserProfileQuery.js` | Shim for `useQuery(UserProfileDocument)` |

## Backend field conventions (new schema)

The tcg-runtime gateway differs from the old WordPress backend in these key ways:

- Card lookup: `cardsearchCard(id: $id)` not `card(id:)`
- Card search: `searchCards(input: CardSearchInput!)` returning `{ total, items }` (not `searchCardsConnection`)
- Card images: `images { small large }` (not `image`)
- Card set: `setCode` (not `set` or `setName`)
- Card prices: `latestPrices` (not `prices` or `pricing`)
- User search: `searchUsers(q: $q)` â€” variable is `q`, not `query`
- Unread messages: `unreadMessageCount` (not `unreadCount`)
