// utils/setNames.js
// Purpose: centralise set-code → display-name mapping + helpers used across the app.

//
// Public API
// - SET_CODE_TO_NAME           (exported map; extend as new sets release)
// - getSetNameFromCode(code)   → "Temporal Forces" | "SV05" (fallback)
// - resolveSetNameForCardlike(cardish)  → prefers server setName, else code→name
//

/** Never show a literal "set" placeholder coming from some APIs */
export function sanitizeSetName(val) {
  const s = (val ?? "").toString().trim();
  return s.toLowerCase() === "set" ? "" : s;
}

/** Minimal parser for ids like "sv05-028" (keeps dashed numbers intact) */
export function parseCardId(id) {
  if (typeof id !== "string") return { setCode: null, number: null };
  const [setCode, ...rest] = id.split("-");
  const number = rest.join("-") || null;
  return { setCode: setCode || null, number };
}

/** Canonical set-code → set-name mapping (extend as needed) */
export const SET_CODE_TO_NAME = {
  svp:  "Scarlet & Violet Promos",
  sv01: "Scarlet & Violet",
  sv02: "Paldea Evolved",
  sv03: "Obsidian Flames",
  sv04: "Paradox Rift",
  sv05: "Temporal Forces",
  sv06: "Twilight Masquerade",
  sv07: "Stellar Crown",
  sv08: "Surging Sparks",
};

/** Case-insensitive lookup with safe fallback to the UPPER code */
export function getSetNameFromCode(code) {
  if (!code) return "";
  const key = String(code).toLowerCase();
  return SET_CODE_TO_NAME[key] ?? String(code).toUpperCase();
}

/**
 * Resolve a user-facing set name for anything “card-like”.
 * Prefers a real server name (after sanitising), otherwise maps code from id.
 */
export function resolveSetNameForCardlike(cardish) {
  const server = sanitizeSetName(
    cardish?.setName ??
      // some shapes embed as card.set.name
      (cardish?.set && typeof cardish.set === "object" ? cardish.set.name : undefined)
  );
  if (server) return server;

  const id =
    cardish?.id ??
    cardish?.cardId ??
    (cardish?.card && (cardish.card.id ?? cardish.card.cardId)) ??
    null;

  const { setCode } = parseCardId(id);
  return getSetNameFromCode(setCode);
}

export default {
  SET_CODE_TO_NAME,
  sanitizeSetName,
  parseCardId,
  getSetNameFromCode,
  resolveSetNameForCardlike,
};
