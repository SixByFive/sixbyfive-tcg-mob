// components/card/usePriceHistory.js
// PURPOSE: Query rollups with minimal, schema-safe selections. If the backend has
// no rollups yet, use an optional `fallbackLatest` point so UI can still show a value.
//
// Exported API: usePriceHistory(cardId, appVariation="normal", fallbackLatest?)

import { gql, useApolloClient } from "@apollo/client";
import { useCallback, useEffect, useMemo, useState } from "react";

function mapAppVariantToBackend(v) {
  const raw = String(v || "").toLowerCase().trim();
  if (!raw || raw === "normal" || raw === "base") return null;
  if (raw === "holo" || raw === "foil") return "holofoil";
  if (raw === "reverse" || raw === "rev") return "reverse_holo";
  if (raw === "reverse_holofoil") return "reverse_holo";
  if (["holofoil","reverse_holo","full_art","alt_art","illustration","gold","trainer_gallery"].includes(raw)) return raw;
  return raw;
}

function isNum(x){ return typeof x === "number" && Number.isFinite(x); }
function toTs(x){
  if (!x) return null;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const n = new Date(x).getTime();
  return Number.isFinite(n) ? n : null;
}
function extractGraphQLError(err){
  const net = err?.networkError;
  const gerrs = err?.graphQLErrors?.length ? err.graphQLErrors
              : net?.result?.errors?.length ? net.result.errors
              : [];
  const msg = [err?.message, ...gerrs.map(e => e?.message).filter(Boolean)].filter(Boolean).join(" | ");
  return msg || err?.toString?.() || "Unknown GraphQL error";
}
function daysForRange(r){
  const key = String(r || "").toUpperCase().trim();
  if (key === "7D") return 7;
  if (key === "30D") return 30;
  if (key === "90D") return 90;
  if (key === "1Y") return 365;
  const n = Number(key.replace(/\D+/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/* ---- Minimal rollups: only latest { date market mid } to avoid 400s ---- */
const Q_ROLLUPS_LATEST_LEAN = gql`
  query CS_Rollups_Latest_Lean($id: ID!, $windows: [Int!], $variant: String) {
    cardsearchPriceRollups(cardId: $id, windows: $windows, variant: $variant) {
      __typename
      variant
      latest {
        date
        market
        mid
      }
    }
  }
`;

function normPoint(rollVariant, p){
  if (!p) return null;
  const updatedAt = p.date ?? null;
  const market = isNum(p.market) ? p.market : null;
  const mid    = isNum(p.mid)    ? p.mid    : null;
  const primary = market ?? mid ?? null;
  return {
    provider: "rollup",
    variant: rollVariant ? String(rollVariant).toLowerCase() : null,
    currency: null,
    gbp: null,
    market,
    mid,
    low: null,
    high: null,
    updatedAt,
    _t: toTs(updatedAt),
    _primary: primary,
  };
}
function mapLatestArray(arr){
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const r of arr) {
    const p = r?.latest;
    const v = r?.variant ?? null;
    const n = normPoint(v, p);
    if (n && n._t != null && (isNum(n.market) || isNum(n.mid) || isNum(n._primary))) {
      out.push(n);
    }
  }
  return out;
}

/**
 * New: `fallbackLatest` – optional object { value:number, date?:string|number, currency?:string }
 * used to synthesize a single history point when no rollups exist yet.
 */
export function usePriceHistory(cardId, appVariation = "normal", fallbackLatest = null) {
  const apollo = useApolloClient();
  const [range, setRange] = useState("30D");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState(null);

  const variant = useMemo(() => mapAppVariantToBackend(appVariation), [appVariation]);

  const refetch = useCallback(async (_range = range) => {
    if (!cardId) return;
    setLoading(true);
    setErr(null);

    const selectedDays = daysForRange(_range);
    const windows = [selectedDays, 30, 90, 365, 7].filter((v, i, a) => a.indexOf(v) === i);
    const vars = variant == null
      ? { id: String(cardId), windows }
      : { id: String(cardId), windows, variant: String(variant) };

    const tryLean = async () => {
      try {
        const { data } = await apollo.query({
          query: Q_ROLLUPS_LATEST_LEAN,
          variables: vars,
          fetchPolicy: "network-only",
          errorPolicy: "all",
        });
        return mapLatestArray(Array.isArray(data?.cardsearchPriceRollups) ? data.cardsearchPriceRollups : []);
      } catch (e) {
        if (__DEV__) console.log("[usePriceHistory] rollups ERR:", {
          error: extractGraphQLError(e), vars
        });
        return [];
      }
    };

    try {
      let rows = await tryLean();

      // ---------- NEW: synthesize one point if nothing is returned ----------
      if ((!rows || rows.length === 0) && fallbackLatest && isNum(fallbackLatest.value)) {
        const ts = toTs(fallbackLatest.date) ?? Date.now();
        rows = [{
          provider: "fallback",
          variant: variant ?? null,
          currency: fallbackLatest.currency ?? null,
          gbp: null,
          market: Number(fallbackLatest.value),
          mid: null,
          low: null,
          high: null,
          updatedAt: ts,
          _t: ts,
          _primary: Number(fallbackLatest.value),
        }];
      }

      // unique + sort
      const seen = new Set();
      const unique = [];
      for (const r of rows) {
        const k = r._t;
        if (k != null && !seen.has(k)) { seen.add(k); unique.push(r); }
      }
      unique.sort((a,b) => a._t - b._t);

      if (!unique.length) setErr("No rollup points available yet.");
      setHistory(unique);
    } catch (err) {
      setErr(extractGraphQLError(err));
    } finally {
      setLoading(false);
    }
  }, [apollo, cardId, range, variant, fallbackLatest]);

  useEffect(() => { refetch(range); }, [refetch, range]);

  return { history, range, setRange, loading, error, refetch };
}

export default usePriceHistory;
