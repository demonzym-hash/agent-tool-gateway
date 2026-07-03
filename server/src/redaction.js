const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g;
const CHINA_ID_PATTERN = /(?<!\d)\d{6}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g;

const EMAIL_KEYS = new Set(["email", "email_address", "mail"]);
const PHONE_KEYS = new Set(["phone", "phone_number", "mobile", "mobile_phone", "tel", "telephone"]);
const ID_KEYS = new Set(["id_card", "id_number", "identity_card", "citizen_id", "ssn", "social_security_number"]);

function normalizeKey(key) {
  return String(key || "").toLowerCase();
}

function normalizeFieldPath(field) {
  return normalizeKey(field)
    .replace(/^\$\.?/u, "")
    .replace(/\[['"]?([^'"\]]+)['"]?\]/gu, ".$1")
    .replace(/^\./u, "");
}

function maskEmail(value) {
  return value.replace(EMAIL_PATTERN, (match) => {
    const [local, domain] = match.split("@");
    const visible = local.slice(0, 1);
    return `${visible}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
  });
}

function maskPhone(value) {
  return value.replace(PHONE_PATTERN, (match) => {
    const digits = match.replace(/\D/g, "");
    const countryPrefix = digits.length > 11 ? "+86 " : "";
    const phone = digits.slice(-11);
    return `${countryPrefix}${phone.slice(0, 3)}****${phone.slice(-4)}`;
  });
}

function maskId(value) {
  return value.replace(CHINA_ID_PATTERN, (match) => `${match.slice(0, 6)}********${match.slice(-4)}`);
}

function maskWholeValue(value) {
  if (typeof value === "string") return "***";
  if (Array.isArray(value)) return value.map((item) => maskWholeValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, maskWholeValue(childValue)]));
  }
  if (value === null || value === undefined) return value;
  return "***";
}

function compilePatternRules(rules = {}) {
  return (Array.isArray(rules.patterns) ? rules.patterns : [])
    .map((rule) => (typeof rule === "string" ? { pattern: rule } : rule))
    .filter((rule) => rule && typeof rule.pattern === "string")
    .flatMap((rule) => {
      try {
        return [
          {
            regex: new RegExp(rule.pattern, rule.flags || "g"),
            replacement: typeof rule.replacement === "string" ? rule.replacement : "***",
          },
        ];
      } catch {
        return [];
      }
    });
}

function normalizeFieldRules(rules = {}) {
  return new Set((Array.isArray(rules.fields) ? rules.fields : []).filter((field) => typeof field === "string").map(normalizeFieldPath));
}

function shouldMaskField({ fields, key, path }) {
  const normalizedKey = normalizeKey(key);
  const normalizedPath = normalizeKey(path);
  return fields.has(normalizedKey) || fields.has(normalizedPath);
}

export function redactString(value, key = "", rules = {}) {
  const normalizedKey = normalizeKey(key);
  let redacted = value;

  if (EMAIL_KEYS.has(normalizedKey)) redacted = maskEmail(redacted);
  else if (PHONE_KEYS.has(normalizedKey)) redacted = maskPhone(redacted);
  else if (ID_KEYS.has(normalizedKey)) redacted = maskId(redacted);
  else redacted = maskId(maskPhone(maskEmail(redacted)));

  for (const rule of compilePatternRules(rules)) {
    redacted = redacted.replace(rule.regex, rule.replacement);
  }
  return redacted;
}

export function redactJson(value, key = "", rules = {}, path = "") {
  const fields = normalizeFieldRules(rules);
  if (key && shouldMaskField({ fields, key, path })) {
    return maskWholeValue(value);
  }
  if (typeof value === "string") {
    return redactString(value, key, rules);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactJson(item, key, rules, `${path}.${index}`));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactJson(childValue, childKey, rules, path ? `${path}.${childKey}` : childKey),
      ]),
    );
  }
  return value;
}
