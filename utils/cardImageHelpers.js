export function forceHttps(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/^http:\/\//i, "https://");
}

export function isAbs(url) {
  return /^https?:\/\//i.test(url || "");
}

export function normalizeSetCode(code) {
  if (!code) return "";
  return String(code).trim().toLowerCase().replace(/\s+/g, "");
}

export function inferEraFromSetCode(code) {
  const c = normalizeSetCode(code);
  if (!c) return null;
  const m = c.match(/^[a-z]+/);
  return m ? m[0] : null;
}

export function parseCardId(id) {
  if (typeof id !== "string") return { setCode: null, number: null };
  const parts = id.split("-");
  if (parts.length < 2) return { setCode: null, number: null };
  const setCode = parts[0]?.trim() || null;
  const numberRaw = parts.slice(1).join("-").trim();
  const number = numberRaw || null;
  return { setCode, number };
}

export function tcgdexFromParts(setCode, number, era = null, quality = "high") {
  if (!setCode || !number) return null;
  const eraSlug = (era || inferEraFromSetCode(setCode) || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const numPadded = String(number).replace(/^0+/, "").padStart(3, "0");
  if (!eraSlug) return null;
  return `https://assets.tcgdex.net/en/${eraSlug}/${setCode}/${numPadded}/${quality}.webp`;
}

export function pokemontcgFromParts(setCode, number, hires = true) {
  if (!setCode || !number) return null;
  const n = String(number).replace(/^0+/, "");
  const suffix = hires ? "_hires" : "";
  return `https://images.pokemontcg.io/${setCode}/${n}${suffix}.png`;
}

export function buildImageCandidates(cardish) {
  const out = [];
  const raw = cardish?.image;
  if (raw && isAbs(raw)) out.push(forceHttps(raw));
  const parsed = parseCardId(
    cardish?.id || cardish?.cardId || cardish?._collection?.cardId || "",
  );
  if (parsed.setCode && parsed.number) {
    const era = inferEraFromSetCode(parsed.setCode);
    const dHigh = tcgdexFromParts(parsed.setCode, parsed.number, era, "high");
    const dLow = tcgdexFromParts(parsed.setCode, parsed.number, era, "low");
    if (dHigh) out.push(dHigh);
    if (dLow) out.push(dLow);
    const pHires = pokemontcgFromParts(parsed.setCode, parsed.number, true);
    const pStd = pokemontcgFromParts(parsed.setCode, parsed.number, false);
    if (pHires) out.push(pHires);
    if (pStd) out.push(pStd);
  }
  const seen = new Set();
  const list = out.filter((u) => {
    const k = String(u || "");
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const tcgdexFirst =
    list.find((u) => u.includes("assets.tcgdex.net")) || list[0] || "";
  return [tcgdexFirst, ...list.filter((u) => u !== tcgdexFirst)];
}
