// utils/setEra.native.js
// Purpose: infer a set "era" (e.g., 'sv', 'swsh', 'wotc') from a set's metadata.

// ---------------- Era lookup tables ----------------

const SERIES_TO_ERA = {
  "mega evolutions": "me",
  "scarlet & violet": "sv",
  "sword & shield": "swsh",
  "sun & moon": "sm",
  "xy": "xy",
  "black & white": "bw",
  "heartgold & soulsilver": "hgss",
  "diamond & pearl": "dp",
  "ex": "ex",
  "e-card": "ecard",
  "neo": "wotc",
  "gym": "wotc",
  "base": "wotc",
  "wizards": "wotc",
};

const SERIES_ID_TO_ERA = {
  me: "me",
  sv: "sv",
  swsh: "swsh",
  sm: "sm",
  xy: "xy",
  bw: "bw",
  hgss: "hgss",
  dp: "dp",
  ex: "ex",
  ecard: "ecard",
  base: "wotc",
  neo: "wotc",
  gym: "wotc",
};

const WOTC_ABBRS = new Set([
  "BS", "JU", "FO", "B2", "TR", "G1", "G2", "LC", "N1", "N2", "N3", "N4",
]);

// ---------------- Helpers ----------------

function normalizeString(value, mode = "lower") {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return mode === "upper" ? trimmed.toUpperCase() : trimmed.toLowerCase();
}

function eraFromSeries(series) {
  const key = normalizeString(series);
  if (!key) return null;
  for (const [match, era] of Object.entries(SERIES_TO_ERA)) {
    if (key.includes(match)) return era;
  }
  return null;
}

function eraFromSeriesId(seriesId) {
  const key = normalizeString(seriesId);
  if (!key) return null;
  if (SERIES_ID_TO_ERA[key]) return SERIES_ID_TO_ERA[key];

  // Fallbacks by prefix
  if (key.startsWith("me")) return "me";
  if (key.startsWith("sv")) return "sv";
  if (key.startsWith("swsh")) return "swsh";
  if (key.startsWith("sm")) return "sm";
  if (key.startsWith("xy")) return "xy";
  if (key.startsWith("bw")) return "bw";
  if (key.startsWith("hgss")) return "hgss";
  if (key.startsWith("dp")) return "dp";
  if (key.startsWith("pl")) return "dp";
  if (key.startsWith("ex")) return "ex";
  if (key.startsWith("ecard")) return "ecard";
  if (key.startsWith("base") || key.startsWith("neo") || key.startsWith("gym")) return "wotc";

  return null;
}

function eraFromAbbr(abbr) {
  const key = normalizeString(abbr, "upper");
  if (!key) return null;

  if (key.startsWith("ME")) return "me";
  if (key.startsWith("SV")) return "sv";
  if (key.startsWith("SW") || key.startsWith("SS")) return "swsh";
  if (key.startsWith("SM")) return "sm";
  if (key.startsWith("XY")) return "xy";
  if (key.startsWith("BW")) return "bw";
  if (key.startsWith("HG") || key.startsWith("HS")) return "hgss";
  if (key.startsWith("DP") || key.startsWith("PL")) return "dp";
  if (key.startsWith("EX")) return "ex";
  if (key.startsWith("EC")) return "ecard";
  if (WOTC_ABBRS.has(key)) return "wotc";
  return null;
}

function eraFromCode(code) {
  const raw = normalizeString(code).replace(/\s+/g, "");
  if (!raw) return null;

  const cleaned = raw.replace(/\./g, ""); // handles sv03.5 → sv035
  if (cleaned.startsWith("me")) return "me";
  if (cleaned.startsWith("sv")) return "sv";

  if (cleaned.startsWith("swsh") || cleaned === "pgo" || cleaned === "cel25" || cleaned === "fut2020")
    return "swsh";

  if (cleaned.startsWith("sm") || ["smp", "sm115", "det1", "sma"].includes(cleaned))
    return "sm";

  if (cleaned.startsWith("xy") || ["xyp", "xy0", "kss"].includes(cleaned))
    return "xy";

  if (cleaned.startsWith("bw") || cleaned === "bwp")
    return "bw";

  if (cleaned.startsWith("hgss") || cleaned === "hsp")
    return "hgss";

  if (cleaned.startsWith("dp") || cleaned.startsWith("pl"))
    return "dp";

  if (cleaned.startsWith("ex"))
    return "ex";

  if (cleaned.startsWith("ecard"))
    return "ecard";

  if (
    ["lc"].includes(cleaned) ||
    cleaned.startsWith("base") ||
    cleaned.startsWith("neo") ||
    cleaned.startsWith("gym")
  ) {
    return "wotc";
  }

  return null;
}

// ---------------- Public API ----------------

// CHANGED: precedence so code outranks abbr (fixes 151 / sv03.5 with abbr MEW)
export function inferSetEra(input) {
  if (!input) return "misc";

  // Some backends use series_id/seriesId; be permissive.
  const seriesId =
    input.seriesId ??
    input.series_id ??
    input.seriesID ??
    null;

  const fromSeriesId = eraFromSeriesId(seriesId);
  if (fromSeriesId) return fromSeriesId;

  const fromSeries = eraFromSeries(input.series);
  if (fromSeries) return fromSeries;

  // Prefer code over abbr to avoid mis-bucket when abbr collides (e.g., MEW).
  const fromCode = eraFromCode(input.code);
  if (fromCode) return fromCode;

  const fromAbbr = eraFromAbbr(input.abbr);
  if (fromAbbr) return fromAbbr;

  return "misc";
}

export default inferSetEra;
