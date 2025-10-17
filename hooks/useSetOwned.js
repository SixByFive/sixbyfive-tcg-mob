// hooks/useSetOwned.js
// Purpose: given a set (with .code and .cards[]), return which cardIds are owned and a completion count.
// Tries CardSetCompletion first (cheaper & precise). Falls back to MyCollection (broader).
//
// HARDENED:
// - If codegen docs are undefined (Metro/Hermes/gql mismatch), we build safe DocumentNodes via `parse` from "graphql".
// - Never passes <undefined> to useQuery.
// - Keeps your original return shape.

import { useQuery } from "@apollo/client";
import { parse } from "graphql";
import { useMemo } from "react";

// Try to import codegen outputs; they may be undefined at runtime depending on bundling.
import * as Gen from "../graphql/tcg-queries";

/* ---------------- Safe DocumentNode helpers ---------------- */

const LocalCardSetCompletionDocument = parse(`
  query CardSetCompletion($setCode: String!) {
    cardSetCompletion(setCode: $setCode) {
      # Support multiple possible shapes your API might return; we normalize later.
      ownedCardIds
      total
      # optional alternates
      cardIds
      items { cardId }
    }
  }
`);

const LocalMyCollectionDocument = parse(`
  query MyCollection {
    myCollection {
      # support common shapes
      cardId
      id
      card { cardId }
    }
  }
`);

function pickDoc(maybeDoc, fallbackDoc) {
  // Some codegen libs export a function (older apollo-codegen), others a DocumentNode.
  // We only accept an object with kind === "Document".
  if (maybeDoc && typeof maybeDoc === "object" && maybeDoc.kind === "Document") {
    return maybeDoc;
  }
  return fallbackDoc;
}

// Prefer generated, else local parsed DocumentNode
const CardSetCompletionDocument = pickDoc(
  Gen.CardSetCompletionDocument,
  LocalCardSetCompletionDocument
);
const MyCollectionDocument = pickDoc(
  Gen.MyCollectionDocument,
  LocalMyCollectionDocument
);

/* ---------------- Hook ---------------- */

export default function useSetOwned(set) {
  const setCode = String(set?.code || "").toLowerCase();
  const hasSet = !!setCode;

  // 1) Try dedicated completion query (expected to return ids & counts for the set)
  const {
    data: completionData,
    loading: completionLoading,
    error: completionError,
  } = useQuery(CardSetCompletionDocument, {
    variables: { setCode },
    skip: !hasSet,
    fetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  // 2) Fallback: fetch my collection and filter by set prefix in cardId (e.g., "sv01-123")
  const {
    data: collectionData,
    loading: collectionLoading,
    error: collectionError,
  } = useQuery(MyCollectionDocument, {
    skip: !hasSet || !!completionData, // only if completion isn't usable
    fetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const { ownedSet, completedCount } = useMemo(() => {
    // Path A: use completion API shape if present
    const c = completionData?.cardSetCompletion;
    if (c) {
      // normalize possible shapes
      let ids = Array.isArray(c.ownedCardIds) ? c.ownedCardIds : null;
      if (!ids && Array.isArray(c.cardIds)) ids = c.cardIds;
      if (
        !ids &&
        c.items &&
        Array.isArray(c.items)
      ) {
        ids = c.items.map((x) => x?.cardId).filter(Boolean);
      }
      ids = Array.isArray(ids) ? ids : [];

      const total =
        (typeof c.total === "number" ? c.total : null) ??
        (typeof set?.totalCards === "number" ? set.totalCards : null) ??
        (Array.isArray(set?.cards) ? set.cards.length : 0);

      return {
        ownedSet: new Set(ids),
        completedCount: ids.length,
        totalCards: total,
      };
    }

    // Path B: fallback — derive from full collection
    const entries =
      collectionData?.myCollection ??
      collectionData?.collection ??
      [];

    const ownedIds = [];
    const prefix = `${setCode}-`;

    for (const e of entries) {
      const id =
        e?.cardId ||
        e?.card?.cardId ||
        e?.id ||
        null;
      if (!id) continue;
      const idStr = String(id).toLowerCase();
      if (idStr.startsWith(prefix)) {
        ownedIds.push(String(id));
      }
    }

    return {
      ownedSet: new Set(ownedIds),
      completedCount: ownedIds.length,
      totalCards:
        (typeof set?.totalCards === "number" ? set.totalCards : null) ??
        (Array.isArray(set?.cards) ? set.cards.length : 0),
    };
  }, [completionData, collectionData, set, setCode]);

  return {
    ownedSet,
    completedCount,
    loading: completionLoading || collectionLoading,
    error: completionError || collectionError || null,
  };
}
