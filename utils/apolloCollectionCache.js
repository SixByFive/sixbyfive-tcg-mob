// utils/apolloCollectionCache.js
// Safe, single-fragment cache helpers for collection entries.

import { gql } from "@apollo/client";
import { MyCollectionAppDocument } from "../graphql/localCollectionDocuments";

const ENTRY_TYPENAME = "CollectionEntry";
const CARD_TYPENAME = "CardsearchCard";

/** Single fragment only — prevents 'Found N fragments' invariant error */
const COLLECTION_ENTRY_FRAGMENT = gql`
  fragment CollectionEntryFields on CollectionEntry {
    id
    cardId
    variation
    quantity
    condition
    wishlist
    card {
      __typename
      id
      name
      number
      image
      setName
    }
  }
`;

function toVariationKey(value) {
  if (!value && value !== 0) return "normal";
  return String(value).trim().toLowerCase() || "normal";
}

/** Build a safe, normalized entry payload for the cache */
function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const cardId = String(entry.cardId ?? entry.card?.id ?? entry.id ?? "").trim();
  if (!cardId) return null;

  const variation = toVariationKey(entry.variation ?? "normal");

  const safeCard = entry.card
    ? {
        __typename: CARD_TYPENAME,
        id: String(entry.card.id ?? cardId),
        name: entry.card.name ?? "Card",
        number: entry.card.number ?? null,
        image: entry.card.image ?? null,
        setName: entry.card.setName ?? null,
      }
    : {
        __typename: CARD_TYPENAME,
        id: cardId,
        name: entry.name ?? "Card",
        number: entry.number ?? null,
        image: entry.image ?? null,
        setName: entry.setName ?? null,
      };

  return {
    __typename: ENTRY_TYPENAME,
    id: entry.id ?? `${cardId}:${variation}`,
    cardId,
    variation,
    quantity:
      typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
        ? entry.quantity
        : 1,
    condition: entry.condition ?? "near_mint",
    wishlist: !!entry.wishlist,
    card: safeCard,
  };
}

/**
 * Write/overwrite a CollectionEntry fragment by explicit cache id.
 * Returns the cache id string (e.g., "CollectionEntry:123") or null.
 */
function writeCollectionFragment(cache, entry) {
  const data = normalizeEntry(entry);
  if (!data) return null;

  const cacheId = cache.identify({ __typename: ENTRY_TYPENAME, id: data.id });
  try {
    cache.writeFragment({
      id: cacheId,
      fragment: COLLECTION_ENTRY_FRAGMENT,
      data,
    });
    return cacheId; // reference id string
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[collection-cache] writeFragment failed", err);
    }
    return null;
  }
}

/**
 * Upsert the entry into Query.myCollection, deduping by (cardId, variation).
 */
export function upsertMyCollectionEntry(cache, entry) {
  if (!cache || !entry) return;

  const refId = writeCollectionFragment(cache, entry);
  if (!refId) return;

  cache.modify({
    id: "ROOT_QUERY",
    fields: {
      myCollection(existingRefs = [], { readField }) {
        // Deduplicate by (cardId, variation)
        const newCardId = String(readField("cardId", refId) ?? "");
        const newVariation = toVariationKey(readField("variation", refId));

        const filtered = existingRefs.filter((existing) => {
          const existingCardId = readField("cardId", existing);
          const existingVariation = toVariationKey(readField("variation", existing));
          return !(
            String(existingCardId) === newCardId && existingVariation === newVariation
          );
        });

        // Prepend the new/updated ref
        return [refId, ...filtered];
      },
    },
  });
}

/**
 * Remove an entry from Query.myCollection and evict the entity.
 */
export function removeMyCollectionEntry(cache, entryOrId) {
  if (!cache || entryOrId == null) return;

  let idValue = null;
  if (typeof entryOrId === "object" && entryOrId.id != null) {
    idValue = entryOrId.id;
  } else {
    idValue = entryOrId;
  }

  const cacheId = cache.identify({ __typename: ENTRY_TYPENAME, id: String(idValue) });

  cache.modify({
    id: "ROOT_QUERY",
    fields: {
      myCollection(existingRefs = [], { readField }) {
        return existingRefs.filter((existing) => {
          const existingId = readField("id", existing);
          return String(existingId) !== String(idValue);
        });
      },
    },
  });

  if (cacheId) {
    cache.evict({ id: cacheId });
    cache.gc();
  }
}

/** Keep your existing refetch hook-up */
export function buildMyCollectionRefetchQueries(userId) {
  return [{ query: MyCollectionAppDocument }];
}
