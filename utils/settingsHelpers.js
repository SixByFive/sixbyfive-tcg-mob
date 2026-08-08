export function getPasswordRules(pw) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[\W_]/.test(pw),
  };
}

export function checkPasswordStrength(pw) {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw)) return "Password must have at least one uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must have at least one lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must have at least one number";
  if (!/[\W_]/.test(pw)) return "Password must have at least one special character";
  return null;
}

export function toInputDateValue(dateLike) {
  if (!dateLike) return "";
  const s = String(dateLike).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}\s/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateTime(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export function computeFrontendRestriction({ dob, backendLevel }) {
  if (backendLevel) return backendLevel;
  if (!dob) return "full";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "full";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 13) return "child";
  if (age < 16) return "teen";
  return "none";
}

export function isoToUkSlashes(iso) {
  if (!iso) return "";
  const s = String(iso).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDobInputSlashes(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

export function formatTimeInput(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  const hh = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  if (digits.length <= 2) return hh;
  return `${hh}:${mm}`;
}

export function parseUkDobToIso(input) {
  if (!input) return "";
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (!m) return "";
  const [, ddStr, mmStr, yyyyStr] = m;
  const dd = Number(ddStr);
  const mm = Number(mmStr);
  const yyyy = Number(yyyyStr);
  if (yyyy < 1900 || yyyy > 2100) return "";
  if (mm < 1 || mm > 12) return "";
  if (dd < 1 || dd > 31) return "";
  const iso = `${yyyyStr}-${mmStr}-${ddStr}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (toInputDateValue(d) !== iso) return "";
  return iso;
}
