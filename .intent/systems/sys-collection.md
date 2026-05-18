---
id: sys-collection
title: Collection, Binders & Wishlist
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-10T00:00:00.000Z"
plans: [plan-backend-migration, plan-prod-deployment]
decisions: [DEC-0007, DEC-0008, DEC-0011, DEC-0012]
tags: [collection, binders, wishlist, cards]
---

## Overview

The collection system lets users track owned cards, organise them into binders, and maintain a wishlist.

## Key files

| File | Purpose |
|------|---------|
| `app/(tabs)/collection.js` | Main collection tab |
| `app/binder/[id]/index.js` | Binder management screen |
| `app/binder/[id]/view.js` | Binder view / flip-through |
| `app/sets/index.js` | Card set browser |
| `app/card/[id].js` | Card detail screen |
| `hooks/useBinderActions.js` | All binder CRUD mutations |
| `graphql/collectionQueries.js` | `myCollection` query |
| `graphql/localCollectionDocuments.js` | Collection mutation documents |
| `components/binders/CardsAddDrawer.js` | Card search drawer within binder UI |
| `components/binders/BinderGrid.js` | Grid display for binder pages |

## Known stub: MoveBinderSlot / RemoveBinderSlot

`MoveBinderSlotDocument` and `RemoveBinderSlotDocument` do not exist in the new gateway schema. In `useBinderActions.js` they are temporarily stubbed to `SaveBinderPagesAndSlotsDocument`:

```js
const MoveBinderSlotDocument = SaveBinderPagesAndSlotsDocument;
const RemoveBinderSlotDocument = SaveBinderPagesAndSlotsDocument;
```

These call sites need to be migrated to call `saveBinderPagesAndSlots` properly when the binder slot migration feature is tested.

## Known gap: cardSetCompletion

`useSetOwned.js` uses a `cardSetCompletion` query that does not exist in the new gateway schema. It currently uses its own inline documents and may fail silently until the set completion feature is tested and the query is added to the schema.

## CatalogCard fields (new schema)

Collection cards use `CatalogCard` type with:
- `images { small large }` (not `image`)
- `setCode` (not `set` or `setName`)
- `latestPrices`
- `variants { key label default }`
