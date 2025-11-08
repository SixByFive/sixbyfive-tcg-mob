// hooks/useSetOwned.js
// Purpose: given a set (with .code and .cards[]), return which cardIds are owned and a completion count.
//
// Key points
// - ALWAYS query MyCollection on this screen (no skip), with `network-only` first hit → `cache-first` thereafter.
// - Build a set "universe" from set.cards ids (already compiled by the screen incl. id-only preloads).
// - Intersect the user's collection ids with the universe (fallback to `${set.code}-` prefix).
// - Prefer cardSetCompletion only if it returns usable ids; otherwise use the intersection.
// - Robust totalCards fallback chain.

import { useQuery } from "@apollo/client";
import { parse } from "graphql";
import { useMemo } from "react";
import * as Gen from "../graphql/tcg-queries";

/* ---------------- Documents ---------------- */

const LocalCardSetCompletionDocument = parse(`
  query CardSetCompletion($setCode: String!) {
    cardSetCompletion(setCode: $setCode) {
      ownedCardIds
      total
      cardIds
      items { cardId }
    }
  }
`);

const LocalMyCollectionDocument = parse(`
  query MyCollectionMin {
    myCollection {
      id
      cardId
      quantity
      variation
      card { cardId id }
      # if your server returns a wrapper, we won't assume it here,
      # but the parser below also checks entries/items/nodes/edges.
    }
  }
`);

function pickDoc(maybeDoc, fallbackDoc) {
  if (maybeDoc && typeof maybeDoc === "object" && maybeDoc.kind === "Document") return maybeDoc;
  return fallbackDoc;
}

const CardSetCompletionDocument = pickDoc(Gen.CardSetCompletionDocument, LocalCardSetCompletionDocument);
const MyCollectionDocument       = pickDoc(Gen.MyCollectionDocument, LocalMyCollectionDocument);

/* ---------------- Utils ---------------- */

const toLower = (v) => String(v ?? "").toLowerCase();
const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

function pluckIdsLoose(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const it of arr) {
    if (!it) continue;
    const id =
      it.id ??
      it.cardId ??
      it?.node?.id ??
      it?.node?.cardId ??
      it?.card?.id ??
      it?.card?.cardId ??
      null;
    if (isNonEmptyString(id)) out.push(String(id));
  }
  return out;
}

function buildSetUniverseIds(set) {
  const src = Array.isArray(set?.cards) ? set.cards : [];
  const ids = pluckIdsLoose(src).map((x) => toLower(x));
  return ids.length > 0 ? new Set(ids) : null;
}

function normalizeCompletion(raw, set) {
  if (!raw) return { ids: [], total: undefined };
  let ids = Array.isArray(raw.ownedCardIds) ? raw.ownedCardIds : null;
  if (!ids && Array.isArray(raw.cardIds)) ids = raw.cardIds;
  if (!ids && Array.isArray(raw.items)) ids = raw.items.map((x) => x?.cardId).filter(Boolean);
  if (!Array.isArray(ids)) ids = [];
  const total =
    typeof raw.total === "number"
      ? raw.total
      : typeof set?.totalCards === "number"
      ? set.totalCards
      : (Array.isArray(set?.cards) ? set.cards.length : undefined);
  return { ids: ids.map(String), total };
}

function collectUserCollectionIds(collectionData) {
  // Accept many possible shapes
  const root =
    collectionData?.myCollection ??
    collectionData?.collection ??
    collectionData ??
    [];

  const arr =
    Array.isArray(root) ? root :
    Array.isArray(root.entries) ? root.entries :
    Array.isArray(root.items) ? root.items :
    Array.isArray(root.nodes) ? root.nodes :
    Array.isArray(root.edges) ? root.edges.map((e) => e?.node).filter(Boolean) :
    [];

  const ownedIds = [];
  for (const e of arr) {
    if (e?.wishlist === true && !e?.quantity && !e?.owned) continue; // ignore wishlist-only rows
    const id =
      e?.cardId ||
      e?.card?.cardId ||
      e?.id ||
      null;
    if (isNonEmptyString(id)) ownedIds.push(toLower(id));
  }
  return ownedIds;
}

function intersectWithSet(ownedIds, setUniverse, setCode) {
  if (setUniverse && setUniverse.size > 0) {
    const result = [];
    for (const id of ownedIds) if (setUniverse.has(id)) result.push(id);
    return result;
  }
  // Prefix fallback (e.g., sv08-)
  const pref = `${toLower(setCode)}-`;
  return ownedIds.filter((id) => id.startsWith(pref));
}

/* ---------------- Hook ---------------- */

export default function useSetOwned(set) {
  const setCode = toLower(set?.code);
  const hasSet = !!setCode;

  // 1) Try dedicated completion (ok to skip if no set yet)
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

  // 2) ALWAYS fetch myCollection here to avoid cache partition / cold cache issues on this screen.
  //    First hit: force network; next hits: read from cache.
  const {
    data: collectionData,
    loading: collectionLoading,
    error: collectionError,
  } = useQuery(MyCollectionDocument, {
    // DO NOT skip this based on set; your collection exists independently of the current set.
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    returnPartialData: true,
    notifyOnNetworkStatusChange: true,
    errorPolicy: "all",
  });

  const { ownedSet, completedCount } = useMemo(() => {
    const setUniverse = buildSetUniverseIds(set);

    const normalized = normalizeCompletion(completionData?.cardSetCompletion, set);
    const completionIds = (normalized.ids ?? []).map(toLower);

    const collectionIds = collectUserCollectionIds(collectionData);
    const ownedFromCollectionInThisSet = intersectWithSet(collectionIds, setUniverse, setCode);

    const finalOwnedIds = completionIds.length > 0 ? completionIds : ownedFromCollectionInThisSet;

    const totalCards =
      (typeof normalized.total === "number" ? normalized.total : null) ??
      (typeof set?.totalCards === "number" ? set.totalCards : null) ??
      (Array.isArray(set?.cards) ? set.cards.length : null) ??
      (setUniverse ? setUniverse.size : null) ??
      finalOwnedIds.length;

    if (__DEV__) {
      console.log("[useSetOwned] setCode", setCode);
      console.log("[useSetOwned] universe.size", setUniverse?.size);
      console.log("[useSetOwned] collectionIds.len", collectionIds.length);
      console.log("[useSetOwned] completionIds.len", completionIds.length);
      console.log("[useSetOwned] finalOwnedIds.len", finalOwnedIds.length);
    }

    return {
      ownedSet: new Set(finalOwnedIds),
      completedCount: finalOwnedIds.length,
      totalCards,
    };
  }, [completionData, collectionData, set, setCode]);

  return {
    ownedSet,
    completedCount,
    loading: completionLoading || collectionLoading,
    error: completionError || collectionError || null,
  };
}
