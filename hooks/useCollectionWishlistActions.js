// hooks/useCollectionWishlistActions.js
//
// FIX (v9):
// - Prevent Apollo "Missing field '%s' while writing result" warnings by ensuring any
//   optimistic/echo `card` object includes ALL fields selected by queries:
//   { id, name, number, image, setName, __typename: "Card" } — values may be null.
// - Keep server type fixes from v8: all String! variables for ids/variation.
// - Hardened optimistic "move" with rollback if add fails.
// - Refetch by operation names to avoid "Unknown query named" warnings.
// - Extra defensive stringify + normalize on inputs.
//
// If your server later returns richer `card` objects, Apollo will merge them over our
// minimal placeholders transparently.

import { gql, useApolloClient, useMutation } from "@apollo/client";

/* ---------------- Queries ---------------- */

export const MY_WISHLIST = gql`
  query MyWishlist {
    myWishlist {
      __typename
      total
      entries {
        __typename
        id
        cardId
        variation
      }
    }
  }
`;

export const MY_COLLECTION = gql`
  query MyCollection {
    myCollection {
      id
      cardId
      variation
      quantity
      card { id name number setCode images { small large } __typename }
      __typename
    }
  }
`;

export const MY_COLLECTION_APP = gql`
  query MyCollectionApp {
    myCollection {
      id
      cardId
      variation
      quantity
      card { id name number setCode images { small large } __typename }
      __typename
    }
  }
`;

/* ---------------- Mutations ---------------- */

// NOTE: Your backend expects String! not ID! (per earlier 400 validation errors)
const ADD_TO_COLLECTION = gql`
  mutation AddToCollection($cardId: String!, $variation: String!, $quantity: Int = 1) {
    addToCollection(cardId: $cardId, variation: $variation, quantity: $quantity) {
      id
      cardId
      variation
      quantity
      card { id name number setCode images { small large } __typename }
      __typename
    }
  }
`;

const REMOVE_FROM_WISHLIST = gql`
  mutation RemoveFromWishlist($cardId: String!, $variation: String!) {
    removeFromWishlist(cardId: $cardId, variation: $variation)
  }
`;

const REMOVE_FROM_COLLECTION_BOOL = gql`
  mutation RemoveFromCollection($cardId: String!, $variation: String!) {
    removeFromCollection(cardId: $cardId, variation: $variation)
  }
`;

/* ---------------- Small helpers ---------------- */

const asStr = (v, fallback = "") => (v == null ? fallback : String(v));
const asVar = (v, fallback = "normal") => asStr(v || fallback);

/** Build a *minimal but query-compatible* Card for optimistic writes */
function buildMinimalCard(cardId) {
  const id = asStr(cardId);
  return {
    __typename: "CatalogCard",
    id,
    name: null,
    number: null,
    setCode: null,
    images: null,
  };
}

/* Read/write helpers that target both MyCollectionApp and MyCollection so
   any observer watching either will update instantly. */
function readCollectionList(cache) {
  try {
    const a = cache.readQuery({ query: MY_COLLECTION_APP });
    if (a?.myCollection) return a.myCollection;
  } catch {}
  try {
    const b = cache.readQuery({ query: MY_COLLECTION });
    if (b?.myCollection) return b.myCollection;
  } catch {}
  return null;
}
function writeCollectionLists(cache, nextList) {
  try { cache.writeQuery({ query: MY_COLLECTION_APP, data: { myCollection: nextList } }); } catch {}
  try { cache.writeQuery({ query: MY_COLLECTION,     data: { myCollection: nextList } }); } catch {}
}

/** Insert or increment a Collection row (client-only optimistic path) */
function optimisticAddOrIncrement(list, { cardId, variation, quantity = 1, echo }) {
  const v = asVar(variation);
  const existing = Array.isArray(list) ? list : [];
  const idx = existing.findIndex(
    x => asStr(x.cardId) === asStr(cardId) && asVar(x.variation) === v
  );

  if (idx >= 0) {
    const next = existing.slice();
    const row = { ...next[idx] };
    row.quantity = Math.max(1, Number(row.quantity || 0)) + (Number(quantity) || 1);
    // Ensure card subfield exists with all selected fields
    row.card = row.card ?? buildMinimalCard(row.cardId);
    next[idx] = row;
    return next;
  }

  // If server echoed a row, use it; else build a minimal but query-compatible one
  const base =
    echo ?? {
      __typename: "Collection",
      id: `optimistic:${asStr(cardId)}:${v}`,
      cardId: asStr(cardId),
      variation: v,
      quantity: Number(quantity) || 1,
      card: buildMinimalCard(cardId),
    };

  // Guarantee the echoed card also has full field set (in case server sent only id)
  base.card = base.card ?? buildMinimalCard(base.cardId);

  return [base, ...existing];
}

/** Optimistically trim wishlist wrapper while keeping its shape */
function optimisticRemoveFromWishlistWrapper(wrapper, { cardId, variation }) {
  if (!wrapper || !Array.isArray(wrapper.entries)) return wrapper;
  const v = asVar(variation);
  const filtered = wrapper.entries.filter(
    e => !(asStr(e.cardId) === asStr(cardId) && asVar(e.variation) === v)
  );
  const removedCount = wrapper.entries.length - filtered.length;
  const nextTotal =
    typeof wrapper.total === "number" ? Math.max(0, wrapper.total - removedCount) : filtered.length;
  return {
    __typename: wrapper.__typename || "WishlistPage",
    total: nextTotal,
    entries: filtered,
  };
}

function logApolloError(tag, err) {
  if (!__DEV__) return;
  const gq = err?.graphQLErrors?.map(e => e?.message) ?? [];
  const ne = err?.networkError;
  const neMsg = ne?.message ?? ne;
  const neRes = ne?.result ? JSON.stringify(ne.result) : undefined;
  console.warn(`[${tag}]`, {
    message: err?.message,
    graphQLErrors: gq,
    networkError: neMsg,
    networkResult: neRes,
    statusCode: ne?.statusCode,
  });
}

/* ---------------- Hook ---------------- */

export function useCollectionWishlistActions() {
  const client = useApolloClient();

  const [addToCollectionMut] = useMutation(ADD_TO_COLLECTION, {
    // When server responds, merge/normalize in cache
    update(cache, { data }) {
      const added = data?.addToCollection;
      if (!added) return;
      try {
        const existing = readCollectionList(cache) ?? [];
        const next = optimisticAddOrIncrement(existing, {
          cardId: added.cardId,
          variation: added.variation,
          quantity: added.quantity ?? 1,
          echo: {
            ...added,
            card: {
              __typename: "CatalogCard",
              id: asStr(added.card?.id ?? added.cardId),
              name: added.card?.name ?? null,
              number: added.card?.number ?? null,
              setCode: added.card?.setCode ?? null,
              images: added.card?.images ?? null,
            },
          },
        });
        writeCollectionLists(cache, next);
      } catch {}
    },
    refetchQueries: [{ query: MY_COLLECTION_APP }],
    awaitRefetchQueries: true,
    // If your server occasionally throws (e.g., "Card is not defined"), the caller handles rollback.
    errorPolicy: "all",
  });

  const [removeFromWishlistMut] = useMutation(REMOVE_FROM_WISHLIST, {
    update() {},
    refetchQueries: [{ query: MY_WISHLIST }],
    awaitRefetchQueries: true,
  });

  const [removeFromCollectionBoolMut] = useMutation(REMOVE_FROM_COLLECTION_BOOL, {
    update(cache, { data, variables }) {
      const ok = data?.removeFromCollection;
      if (ok === false) return;
      try {
        const list = readCollectionList(cache) ?? [];
        const next = list.filter(
          x => !(asStr(x.cardId) === asStr(variables.cardId) && asVar(x.variation) === asVar(variables.variation))
        );
        writeCollectionLists(cache, next);
      } catch {}
    },
    refetchQueries: [{ query: MY_COLLECTION_APP }],
  });

  /* --------------- Public API --------------- */

  async function addToCollection({ cardId, variation, quantity = 1 }) {
    const v = asVar(variation);
    return addToCollectionMut({
      variables: { cardId: asStr(cardId), variation: v, quantity },
    });
  }

  async function removeFromWishlist({ cardId, variation }) {
    const v = asVar(variation);
    // optimistic trim
    try {
      const snap = client.readQuery({ query: MY_WISHLIST });
      const wrapper = snap?.myWishlist;
      if (wrapper) {
        const next = optimisticRemoveFromWishlistWrapper(wrapper, { cardId, variation: v });
        client.writeQuery({ query: MY_WISHLIST, data: { myWishlist: next } });
      }
    } catch {}
    return removeFromWishlistMut({ variables: { cardId: asStr(cardId), variation: v } });
  }

  // Strong optimistic move with rollback if add fails
  async function moveWishlistToCollection({ cardId, variation, quantity = 1 }) {
    const v = asVar(variation);

    // Take snapshots for rollback
    let collSnap = null;
    let wishSnap = null;
    try { collSnap = client.readQuery({ query: MY_COLLECTION_APP }); } catch {}
    if (!collSnap) { try { collSnap = client.readQuery({ query: MY_COLLECTION }); } catch {} }
    try { wishSnap = client.readQuery({ query: MY_WISHLIST }); } catch {}

    // Optimistic add/increment
    try {
      const existing = readCollectionList(client.cache) ?? [];
      const next = optimisticAddOrIncrement(existing, { cardId, variation: v, quantity });
      writeCollectionLists(client.cache, next);
    } catch {}

    // Optimistic wishlist trim
    try {
      if (wishSnap?.myWishlist) {
        const nextWish = optimisticRemoveFromWishlistWrapper(wishSnap.myWishlist, { cardId, variation: v });
        client.writeQuery({ query: MY_WISHLIST, data: { myWishlist: nextWish } });
      }
    } catch {}

    // Real add → rollback on failure
    try {
      await addToCollection({ cardId, variation: v, quantity });
    } catch (err) {
      logApolloError("moveWishlistToCollection/addToCollection", err);
      try { if (collSnap?.myCollection) writeCollectionLists(client.cache, collSnap.myCollection); } catch {}
      try { if (wishSnap?.myWishlist) client.writeQuery({ query: MY_WISHLIST, data: { myWishlist: wishSnap.myWishlist } }); } catch {}
      throw err;
    }

    // Best-effort server removal of wishlist entry (ignore failure; refetch reconciles)
    try {
      await removeFromWishlist({ cardId, variation: v });
    } catch (err) {
      logApolloError("moveWishlistToCollection/removeFromWishlist", err);
    }

    // Final reconcile so observers update
    await client.refetchQueries({ include: ["MyCollectionApp", "MyWishlist"] });
  }

  async function removeFromCollection({ cardId, variation }) {
    const v = asVar(variation);
    // optimistic trim
    try {
      const list = readCollectionList(client.cache) ?? [];
      const next = list.filter(
        x => !(asStr(x.cardId) === asStr(cardId) && asVar(x.variation) === v)
      );
      writeCollectionLists(client.cache, next);
    } catch {}

    try {
      await removeFromCollectionBoolMut({ variables: { cardId: asStr(cardId), variation: v } });
    } catch (err) {
      logApolloError("removeFromCollection", err);
      await client.refetchQueries({ include: ["MyCollectionApp"] });
      throw err;
    }
  }

  return {
    addToCollection,
    removeFromWishlist,
    moveWishlistToCollection,
    removeFromCollection,
  };
}
