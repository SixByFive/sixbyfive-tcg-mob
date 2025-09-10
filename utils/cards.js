// utils/cards.js

// unchanged
export function normalizeImageUrl(url) {
  if (!url) return null;
  return url.endsWith("/high.webp") ? url : `${url}/high.webp`;
}

// unchanged
function canonVar(v) {
  const k = String(v || "").toLowerCase().replace(/[\s_-]/g, "");
  if (k === "holo" || k === "holofoil" || k === "foil") return "holo";
  if (k === "reverse" || k === "reverseholo" || k === "reverseholofoil" || k === "rev")
    return "reverse";
  if (k === "normal" || k === "nonholo" || k === "nonfoil") return "normal";
  return k || "normal";
}

/* ================================
   PRICE NORMALIZATION HELPERS
   - NEW: treat 0/negative as missing
   - NEW: accept string numbers
   - NEW: handle casing differences
   ================================ */

// NEW: pick the first finite, positive numeric value from candidates (numbers or numeric strings)
function pickNumeric(...vals) {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

// NEW: read a price field with lower/camel variants (e.g., tcgplayer/tcgPlayer)
function priceFrom(row, lowerKey, camelKey) {
  if (!row) return null;
  return pickNumeric(row[lowerKey], row[camelKey]);
}

// CHANGED: consider there to be a price only if at least one source is a positive number
function hasAnyPrice(row) {
  if (!row) return false;
  const tp = priceFrom(row, "tcgplayer", "tcgPlayer");
  const cm = priceFrom(row, "cardmarket", "cardMarket");
  return tp != null || cm != null;
}

// CHANGED: enforce positive numeric or null (allows numeric strings too)
function toNumberOrNull(x) {
  return pickNumeric(x);
}

// unchanged
function parseUpdatedAt(d) {
  if (!d) return 0;
  if (typeof d === "number" && Number.isFinite(d)) return d;
  const s = String(d);
  // Handle "YYYY/MM/DD" or "YYYY-MM-DD"
  const m = s.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
  if (m) {
    const [, yy, mm, dd] = m;
    return Date.UTC(+yy, +mm - 1, +dd);
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Pick the best available price row.
 * - `source` can be a full card object OR an array of price rows.
 * - `preference` can be:
 *    * { strategy: "recent" }  -> pick the most recently-updated priced row
 *    * a string ("normal")     -> try that variation first, then fallbacks
 *    * an array                -> ordered preference, then fallbacks
 *    * omitted                 -> default to ["holo","normal","reverse"]
 */
export function getBestPrice(source, preference) {
  // normalize rows
  const rows = Array.isArray(source)
    ? source
    : Array.isArray(source?.prices)
    ? source.prices
    : Array.isArray(source?.pricing)
    ? source.pricing
    : [];

  // normalize advertised variations
  const advertised = Array.isArray(source?.variations)
    ? source.variations.map(canonVar)
    : [];

  // ---- Strategy: most recent updatedAt among rows that actually have a price
  if (preference && typeof preference === "object" && preference.strategy === "recent") {
    const priced = rows.filter(hasAnyPrice);
    if (priced.length) {
      // sort by updatedAt desc, then small tie-breaker pref to common variants
      const prefOrder = ["holo", "normal", "reverse"];
      const score = (v) => {
        const i = prefOrder.indexOf(canonVar(v));
        return i === -1 ? 99 : i;
      };
      priced.sort((a, b) => {
        const tb = parseUpdatedAt(b.updatedAt) - parseUpdatedAt(a.updatedAt);
        if (tb !== 0) return tb;
        return score(canonVar(a.variation)) - score(canonVar(b.variation));
      });
      const hit = priced[0];
      return {
        variation: canonVar(hit.variation),
        // CHANGED: read prices with casing-normalization and >0 enforcement
        tcgplayer: priceFrom(hit, "tcgplayer", "tcgPlayer"),
        cardmarket: priceFrom(hit, "cardmarket", "cardMarket"),
        updatedAt: hit.updatedAt ?? null,
      };
    }
    // fall through to preference order if nothing is priced
  }

  // ---- Preference list path
  const prefArr = Array.isArray(preference)
    ? preference
    : typeof preference === "string"
    ? [preference]
    : ["holo", "normal", "reverse"];

  // build final order without duplicates
  const order = Array.from(new Set([...prefArr.map(canonVar), ...advertised]));

  // try preferred variations first
  for (const v of order) {
    const hit = rows.find((r) => canonVar(r.variation) === v);
    if (hasAnyPrice(hit)) {
      return {
        variation: v,
        // CHANGED: read prices with casing-normalization and >0 enforcement
        tcgplayer: priceFrom(hit, "tcgplayer", "tcgPlayer"),
        cardmarket: priceFrom(hit, "cardmarket", "cardMarket"),
        updatedAt: hit?.updatedAt ?? null,
      };
    }
  }

  // fallback: first row with any price
  const any = rows.find(hasAnyPrice);
  if (any) {
    return {
      variation: canonVar(any.variation),
      // CHANGED: read prices with casing-normalization and >0 enforcement
      tcgplayer: priceFrom(any, "tcgplayer", "tcgPlayer"),
      cardmarket: priceFrom(any, "cardmarket", "cardMarket"),
      updatedAt: any?.updatedAt ?? null,
    };
  }

  // last resort: empty
  return { variation: "normal", tcgplayer: null, cardmarket: null, updatedAt: null };
}

/**
 * Average across available positive numbers only.
 * - If both sources are valid (>0), return their mean
 * - If only one source is valid, return that one
 * - If neither is valid, return null
 */
export function calcAverage(a, b) {
  const vals = [pickNumeric(a), pickNumeric(b)].filter((n) => n != null);
  if (vals.length === 2) return (vals[0] + vals[1]) / 2;
  if (vals.length === 1) return vals[0];
  return null;
}
