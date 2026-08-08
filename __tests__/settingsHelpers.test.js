import {
  checkPasswordStrength,
  computeFrontendRestriction,
  formatDobInputSlashes,
  formatTimeInput,
  getPasswordRules,
  isoToUkSlashes,
  parseUkDobToIso,
  toInputDateValue,
} from "../utils/settingsHelpers";

// ── getPasswordRules ──────────────────────────────────────────────────────────

describe("getPasswordRules", () => {
  it("returns all false for empty string", () => {
    expect(getPasswordRules("")).toEqual({
      length: false,
      upper: false,
      lower: false,
      number: false,
      special: false,
    });
  });

  it("returns all true for a strong password", () => {
    expect(getPasswordRules("Abcd1234!")).toEqual({
      length: true,
      upper: true,
      lower: true,
      number: true,
      special: true,
    });
  });

  it("length passes at exactly 8 characters", () => {
    expect(getPasswordRules("abcdefgh").length).toBe(true);
    expect(getPasswordRules("abcdefg").length).toBe(false);
  });
});

// ── checkPasswordStrength ─────────────────────────────────────────────────────

describe("checkPasswordStrength", () => {
  it("returns null for a valid password", () => {
    expect(checkPasswordStrength("Abcd1234!")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(checkPasswordStrength("Ab1!")).toMatch(/8 characters/);
  });

  it("rejects missing uppercase", () => {
    expect(checkPasswordStrength("abcd1234!")).toMatch(/uppercase/);
  });

  it("rejects missing lowercase", () => {
    expect(checkPasswordStrength("ABCD1234!")).toMatch(/lowercase/);
  });

  it("rejects missing number", () => {
    expect(checkPasswordStrength("Abcdefgh!")).toMatch(/number/);
  });

  it("rejects missing special character", () => {
    expect(checkPasswordStrength("Abcd1234")).toMatch(/special/);
  });
});

// ── toInputDateValue ──────────────────────────────────────────────────────────

describe("toInputDateValue", () => {
  it("passes through ISO date strings unchanged", () => {
    expect(toInputDateValue("2000-01-15")).toBe("2000-01-15");
  });

  it("strips time from ISO datetime strings", () => {
    expect(toInputDateValue("2000-01-15T12:30:00Z")).toBe("2000-01-15");
    expect(toInputDateValue("2000-01-15 12:30:00")).toBe("2000-01-15");
  });

  it("returns empty string for falsy input", () => {
    expect(toInputDateValue(null)).toBe("");
    expect(toInputDateValue("")).toBe("");
    expect(toInputDateValue(undefined)).toBe("");
  });

  it("returns empty string for unparseable dates", () => {
    expect(toInputDateValue("not-a-date")).toBe("");
  });
});

// ── isoToUkSlashes ────────────────────────────────────────────────────────────

describe("isoToUkSlashes", () => {
  it("converts ISO to DD/MM/YYYY", () => {
    expect(isoToUkSlashes("2000-01-15")).toBe("15/01/2000");
  });

  it("returns empty string for falsy input", () => {
    expect(isoToUkSlashes("")).toBe("");
    expect(isoToUkSlashes(null)).toBe("");
  });

  it("returns input unchanged if not ISO format", () => {
    expect(isoToUkSlashes("not-a-date")).toBe("not-a-date");
  });
});

// ── formatDobInputSlashes ─────────────────────────────────────────────────────

describe("formatDobInputSlashes", () => {
  it("returns just the day digits while typing first two digits", () => {
    expect(formatDobInputSlashes("1")).toBe("1");
    expect(formatDobInputSlashes("15")).toBe("15");
  });

  it("adds slash after day digits", () => {
    expect(formatDobInputSlashes("150")).toBe("15/0");
    expect(formatDobInputSlashes("1501")).toBe("15/01");
  });

  it("adds second slash after month digits", () => {
    expect(formatDobInputSlashes("15012")).toBe("15/01/2");
    expect(formatDobInputSlashes("15012000")).toBe("15/01/2000");
  });

  it("strips non-digit characters before formatting", () => {
    expect(formatDobInputSlashes("15/01/2000")).toBe("15/01/2000");
  });

  it("clamps to 8 digits (DD/MM/YYYY)", () => {
    expect(formatDobInputSlashes("150120009999")).toBe("15/01/2000");
  });
});

// ── formatTimeInput ───────────────────────────────────────────────────────────

describe("formatTimeInput", () => {
  it("returns raw digits for up to 2 digits", () => {
    expect(formatTimeInput("2")).toBe("2");
    expect(formatTimeInput("22")).toBe("22");
  });

  it("inserts colon after 2 hour digits", () => {
    expect(formatTimeInput("223")).toBe("22:3");
    expect(formatTimeInput("2230")).toBe("22:30");
  });

  it("strips non-digit characters", () => {
    expect(formatTimeInput("22:30")).toBe("22:30");
  });
});

// ── parseUkDobToIso ───────────────────────────────────────────────────────────

describe("parseUkDobToIso", () => {
  it("converts DD/MM/YYYY to ISO", () => {
    expect(parseUkDobToIso("15/01/2000")).toBe("2000-01-15");
  });

  it("accepts DD-MM-YYYY separator variant", () => {
    expect(parseUkDobToIso("15-01-2000")).toBe("2000-01-15");
  });

  it("passes through already-ISO strings", () => {
    expect(parseUkDobToIso("2000-01-15")).toBe("2000-01-15");
  });

  it("returns empty string for invalid input", () => {
    expect(parseUkDobToIso("")).toBe("");
    expect(parseUkDobToIso("32/01/2000")).toBe("");
    expect(parseUkDobToIso("15/13/2000")).toBe("");
    expect(parseUkDobToIso("not-a-date")).toBe("");
  });

  it("rejects years outside 1900–2100", () => {
    expect(parseUkDobToIso("01/01/1800")).toBe("");
    expect(parseUkDobToIso("01/01/2200")).toBe("");
  });
});

// ── computeFrontendRestriction ────────────────────────────────────────────────

describe("computeFrontendRestriction", () => {
  it("returns backendLevel when provided", () => {
    expect(computeFrontendRestriction({ dob: null, backendLevel: "teen" })).toBe("teen");
  });

  it("returns full when no dob", () => {
    expect(computeFrontendRestriction({ dob: null, backendLevel: null })).toBe("full");
    expect(computeFrontendRestriction({ dob: "", backendLevel: null })).toBe("full");
  });

  it("returns full for unparseable dob", () => {
    expect(computeFrontendRestriction({ dob: "not-a-date", backendLevel: null })).toBe("full");
  });

  it("returns child for age < 13", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 10);
    const iso = dob.toISOString().slice(0, 10);
    expect(computeFrontendRestriction({ dob: iso, backendLevel: null })).toBe("child");
  });

  it("returns teen for age 13–15", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 14);
    const iso = dob.toISOString().slice(0, 10);
    expect(computeFrontendRestriction({ dob: iso, backendLevel: null })).toBe("teen");
  });

  it("returns none for age >= 16", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 20);
    const iso = dob.toISOString().slice(0, 10);
    expect(computeFrontendRestriction({ dob: iso, backendLevel: null })).toBe("none");
  });
});
