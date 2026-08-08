import {
  buildImageCandidates,
  forceHttps,
  inferEraFromSetCode,
  isAbs,
  normalizeSetCode,
  parseCardId,
  pokemontcgFromParts,
  tcgdexFromParts,
} from "../utils/cardImageHelpers";

// ── forceHttps ────────────────────────────────────────────────────────────────

describe("forceHttps", () => {
  it("upgrades http to https", () => {
    expect(forceHttps("http://example.com/img.png")).toBe("https://example.com/img.png");
  });

  it("leaves https URLs unchanged", () => {
    expect(forceHttps("https://example.com/img.png")).toBe("https://example.com/img.png");
  });

  it("returns null for falsy input", () => {
    expect(forceHttps(null)).toBeNull();
    expect(forceHttps("")).toBeNull();
    expect(forceHttps(undefined)).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(forceHttps(42)).toBeNull();
  });
});

// ── isAbs ─────────────────────────────────────────────────────────────────────

describe("isAbs", () => {
  it("returns true for http URLs", () => {
    expect(isAbs("http://example.com")).toBe(true);
  });

  it("returns true for https URLs", () => {
    expect(isAbs("https://example.com")).toBe(true);
  });

  it("returns false for relative paths", () => {
    expect(isAbs("/img/card.png")).toBe(false);
    expect(isAbs("img/card.png")).toBe(false);
  });

  it("returns false for falsy input", () => {
    expect(isAbs("")).toBe(false);
    expect(isAbs(null)).toBe(false);
  });
});

// ── normalizeSetCode ──────────────────────────────────────────────────────────

describe("normalizeSetCode", () => {
  it("lowercases and trims the code", () => {
    expect(normalizeSetCode("  SV1  ")).toBe("sv1");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeSetCode("sv 1")).toBe("sv1");
  });

  it("returns empty string for falsy input", () => {
    expect(normalizeSetCode(null)).toBe("");
    expect(normalizeSetCode("")).toBe("");
  });
});

// ── inferEraFromSetCode ───────────────────────────────────────────────────────

describe("inferEraFromSetCode", () => {
  it("extracts leading alpha prefix as era", () => {
    expect(inferEraFromSetCode("sv1")).toBe("sv");
    expect(inferEraFromSetCode("swsh1")).toBe("swsh");
    expect(inferEraFromSetCode("xy1")).toBe("xy");
  });

  it("returns null for falsy / numeric-only codes", () => {
    expect(inferEraFromSetCode(null)).toBeNull();
    expect(inferEraFromSetCode("")).toBeNull();
    expect(inferEraFromSetCode("123")).toBeNull();
  });
});

// ── parseCardId ───────────────────────────────────────────────────────────────

describe("parseCardId", () => {
  it("splits setCode and number from a hyphenated id", () => {
    expect(parseCardId("sv1-001")).toEqual({ setCode: "sv1", number: "001" });
  });

  it("handles multi-hyphen ids (keeps rest as number)", () => {
    expect(parseCardId("swsh1-TG-01")).toEqual({ setCode: "swsh1", number: "TG-01" });
  });

  it("returns nulls for a single-segment id", () => {
    expect(parseCardId("sv1")).toEqual({ setCode: null, number: null });
  });

  it("returns nulls for non-string input", () => {
    expect(parseCardId(null)).toEqual({ setCode: null, number: null });
    expect(parseCardId(123)).toEqual({ setCode: null, number: null });
  });
});

// ── tcgdexFromParts ───────────────────────────────────────────────────────────

describe("tcgdexFromParts", () => {
  it("builds a valid TCGdex URL", () => {
    expect(tcgdexFromParts("sv1", "001", "sv")).toBe(
      "https://assets.tcgdex.net/en/sv/sv1/001/high.webp"
    );
  });

  it("pads number to 3 digits", () => {
    expect(tcgdexFromParts("sv1", "1", "sv")).toBe(
      "https://assets.tcgdex.net/en/sv/sv1/001/high.webp"
    );
  });

  it("infers era from setCode when not provided", () => {
    expect(tcgdexFromParts("sv1", "001")).toBe(
      "https://assets.tcgdex.net/en/sv/sv1/001/high.webp"
    );
  });

  it("uses quality param", () => {
    expect(tcgdexFromParts("sv1", "001", "sv", "low")).toBe(
      "https://assets.tcgdex.net/en/sv/sv1/001/low.webp"
    );
  });

  it("returns null when setCode or number missing", () => {
    expect(tcgdexFromParts(null, "001")).toBeNull();
    expect(tcgdexFromParts("sv1", null)).toBeNull();
  });

  it("returns null when era cannot be inferred (numeric-only setCode)", () => {
    expect(tcgdexFromParts("123", "001")).toBeNull();
  });
});

// ── pokemontcgFromParts ───────────────────────────────────────────────────────

describe("pokemontcgFromParts", () => {
  it("builds a hi-res pokemontcg URL", () => {
    expect(pokemontcgFromParts("sv1", "1")).toBe(
      "https://images.pokemontcg.io/sv1/1_hires.png"
    );
  });

  it("builds a standard-res URL", () => {
    expect(pokemontcgFromParts("sv1", "1", false)).toBe(
      "https://images.pokemontcg.io/sv1/1.png"
    );
  });

  it("strips leading zeros from number", () => {
    expect(pokemontcgFromParts("sv1", "001")).toBe(
      "https://images.pokemontcg.io/sv1/1_hires.png"
    );
  });

  it("returns null when setCode or number missing", () => {
    expect(pokemontcgFromParts(null, "1")).toBeNull();
    expect(pokemontcgFromParts("sv1", null)).toBeNull();
  });
});

// ── buildImageCandidates ──────────────────────────────────────────────────────

describe("buildImageCandidates", () => {
  it("returns tcgdex URL first when setCode is inferrable", () => {
    const results = buildImageCandidates({ id: "sv1-001" });
    expect(results[0]).toMatch(/assets\.tcgdex\.net/);
  });

  it("includes pokemontcg URL as fallback", () => {
    const results = buildImageCandidates({ id: "sv1-001" });
    expect(results.some((u) => u.includes("images.pokemontcg.io"))).toBe(true);
  });

  it("prepends a valid absolute image field when present", () => {
    const results = buildImageCandidates({
      id: "sv1-001",
      image: "https://cdn.example.com/card.png",
    });
    expect(results).toContain("https://cdn.example.com/card.png");
  });

  it("upgrades http image field to https", () => {
    const results = buildImageCandidates({
      id: "sv1-001",
      image: "http://cdn.example.com/card.png",
    });
    expect(results).toContain("https://cdn.example.com/card.png");
  });

  it("deduplicates URLs", () => {
    const results = buildImageCandidates({ id: "sv1-001" });
    const unique = new Set(results);
    expect(unique.size).toBe(results.length);
  });

  it("returns an array for a card with no inferrable setCode", () => {
    const results = buildImageCandidates({ id: "123" });
    expect(Array.isArray(results)).toBe(true);
  });
});
