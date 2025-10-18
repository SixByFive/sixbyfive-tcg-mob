import { CollectionEntryFragmentDoc, MyCollectionDocument } from "@sixbyfive/tcg-binder/client";

const DEFAULT_TYPENAME = "Collection";

function toVariationKey(value) {
  if (!value && value !== 0) return "normal";
  return String(value).trim().toLowerCase() || "normal";
}

function withTypename(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (entry.__typename) return entry;
  return { ...entry, __typename: DEFAULT_TYPENAME };
}

function writeCollectionFragment(cache, entry) {
  const data = withTypename(entry);
  if (!data) return null;
  const id = cache.identify(data);
  try {
    return cache.writeFragment({
      fragment: CollectionEntryFragmentDoc,
      data,
      ...(id ? { id } : {}),
    });
  } catch (err) {
    console.warn("[collection-cache] writeFragment failed", err);
    return null;
  }
}

export function upsertMyCollectionEntry(cache, entry) {
  if (!cache || !entry) return;
  const ref = writeCollectionFragment(cache, entry);
  if (!ref) return;

  cache.modify({
    fields: {
      myCollection(existingRefs = [], { readField }) {
        const newId = readField("id", ref);
        const newCardId = readField("cardId", ref);
        const newVariation = toVariationKey(readField("variation", ref));

        const filtered = existingRefs.filter((existing) => {
          const existingId = readField("id", existing);
          if (newId && existingId && String(existingId) === String(newId)) {
            return false;
          }

          if (!newId && newCardId) {
            const cardId = readField("cardId", existing);
            const variation = toVariationKey(readField("variation", existing));
            if (cardId && String(cardId) === String(newCardId) && variation === newVariation) {
              return false;
            }
          }

          const existingRef = typeof existing === "string" ? existing : existing?.__ref;
          const newRef = typeof ref === "string" ? ref : ref?.__ref;
          return existingRef !== newRef;
        });

        return [ref, ...filtered];
      },
    },
  });
}

export function removeMyCollectionEntry(cache, entryOrId) {
  if (!cache || entryOrId == null) return;

  let cacheId = null;
  let idValue = null;

  if (typeof entryOrId === "string" || typeof entryOrId === "number") {
    idValue = entryOrId;
    cacheId = cache.identify({ __typename: DEFAULT_TYPENAME, id: entryOrId });
  } else if (typeof entryOrId === "object") {
    idValue = entryOrId.id ?? null;
    cacheId = cache.identify(withTypename(entryOrId));
    if (!cacheId && idValue != null) {
      cacheId = cache.identify({ __typename: DEFAULT_TYPENAME, id: idValue });
    }
  }

  cache.modify({
    fields: {
      myCollection(existingRefs = [], { readField }) {
        return existingRefs.filter((existing) => {
          if (cacheId) {
            const refKey = typeof existing === "string" ? existing : existing?.__ref;
            if (refKey === cacheId) return false;
          }
          if (idValue != null) {
            const existingId = readField("id", existing);
            if (existingId != null && String(existingId) === String(idValue)) {
              return false;
            }
          }
          return true;
        });
      },
    },
  });

  if (cacheId) {
    cache.evict({ id: cacheId });
    cache.gc();
  }
}

export function buildMyCollectionRefetchQueries(userId) {
  const queries = [{ query: MyCollectionDocument }];
  if (userId) {
    queries.push({ query: MyCollectionDocument, variables: { userId } });
  }
  return queries;
}
