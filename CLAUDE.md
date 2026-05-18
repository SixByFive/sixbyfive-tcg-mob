# Project Context

<!-- intent-context:start -->

## Intent Context

### Agent Instructions

This project uses [Intent](https://github.com/SixByFive/intent) to track the *why* behind code.
When `.intent/` is present, follow these rules:

1. **Before starting a task** — call `intent agent prepare "<task>"` or the `intent_agent_prepare` MCP tool to load relevant plans and decisions.
2. **After making changes** — call `intent agent review` or `intent_agent_review` to verify alignment and catch broken references.
3. **If you made an architectural decision** not covered by an existing record, create one: `intent decision add` or let `intent agent review` scaffold it interactively.
4. **If a plan's work is complete**, update its `status` to `archived` in the frontmatter.
5. **Commit `.intent/` files** alongside the code changes they describe.

### Active Plans

**plan-backend-migration** — Migrate mobile app to tcg-runtime gateway `[active]`
System: sys-backend

> ## Goal
> Replace all connections from the old WordPress TCG backend (`@sixbyfive/tcg-binder` generated client) with local GQL documents targeting the new `tcg-runtime` gateway (port 4010 / realtime port 4020).
> ## Reason

**plan-prod-deployment** — Production deployment readiness `[draft]`
System: sys-backend

> ## Goal
> Complete the remaining work items before the new backend can be used in a production build.
> ## Reason

### Architectural Decisions

**DEC-0001** — Replace @sixbyfive/tcg-binder with local GQL documents `[active]`
System: sys-graphql-layer

> ## Context
> The mobile app was built against the old WordPress-based TCG backend using `@sixbyfive/tcg-binder`, a generated GraphQL client (Apollo codegen output). This package contained all GQL documents and React hook wrappers (`useLoginMutation`, `useMeQuery`, `useSearchCardsLazyQuery`, etc.) for the old schema.

**DEC-0002** — Single Apollo gateway link â€” remove messaging split `[active]`
System: sys-graphql-layer

> ## Context
> The old app used Apollo's `split` link to route messaging operations to a separate GraphQL endpoint (the old WordPress messaging API). This required a custom `isMessagingOperation` predicate that inspected each operation and forwarded it to a different HTTP link.

**DEC-0003** — Hook shims for generated React hooks `[active]`
System: sys-graphql-layer

> ## Context
> The old `@sixbyfive/tcg-binder` package exported React hooks like `useMeQuery`, `useSearchUsersLazyQuery`, and `useUserProfileQuery` that were used throughout many components. Replacing every import site with raw `useQuery(MeDocument, ...)` calls would require changes to 15+ files.

**DEC-0004** — Push token mutations return Boolean! not { ok, error } `[active]`
System: sys-auth

> ## Context
> The old backend's `registerExpoPushToken` and `unregisterExpoPushToken` mutations returned an object `{ ok: Boolean!, error: String }`. The mobile app checked `data?.registerExpoPushToken?.ok`.

**DEC-0005** — searchUsers uses q variable not query `[active]`
System: sys-graphql-layer

> ## Context
> The old backend's `searchUsers` resolver accepted a `query` variable. Two components (`NewMessageModal.js` and `UserSearchCard.js`) passed `variables: { query: searchText }`. The new tcg-runtime gateway renames this argument to `q`.

**DEC-0006** — EXPO_PUBLIC_DEV_MODE controls local vs prod endpoint `[active]`
System: sys-backend

> ## Context
> The app needs to point at different endpoints for local development (gateway on `10.0.2.2:4010`) vs production. Expo doesn't support per-environment `.env` files natively at build time in the same way web frameworks do. We need a reliable runtime switch.

**DEC-0007** — MoveBinderSlot and RemoveBinderSlot stubbed to SaveBinderPagesAndSlots `[active]`
System: sys-collection

> ## Context
> `hooks/useBinderActions.js` imported `MoveBinderSlotDocument` and `RemoveBinderSlotDocument` from `@sixbyfive/tcg-binder`. These operations do not exist in the new tcg-runtime gateway schema. The equivalent operation is `saveBinderPagesAndSlots` (bulk save of page/slot state).

**DEC-0008** — New schema field names for card and collection types `[active]`
System: sys-graphql-layer

> ## Context
> The old WordPress backend and the new tcg-runtime gateway have different field naming conventions for card and collection-related types. All GQL documents needed updating to match the new schema.

### Systems

**sys-auth** — Authentication & Push Notifications

> ## Overview
> Authentication uses JWT stored in `expo-secure-store`. The Apollo auth link reads the token and attaches it as `Authorization: Bearer <token>` on every request.

**sys-backend** — Backend Integration (tcg-runtime gateway)

> ## Overview
> The mobile app connects to the **tcg-runtime** monorepo backend, which exposes:

**sys-collection** — Collection, Binders & Wishlist

> ## Overview
> The collection system lets users track owned cards, organise them into binders, and maintain a wishlist.

**sys-graphql-layer** — GraphQL Client Layer

> ## Overview
> The GraphQL client layer is the app's interface to the tcg-runtime gateway. It consists of three parts:

**sys-messaging** — Real-time Messaging

> ## Overview
> The messaging system combines:

<!-- intent-context:end -->
