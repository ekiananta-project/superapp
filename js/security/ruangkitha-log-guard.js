(function (root) {
  "use strict";
  const REDACTED = "[REDACTED]";
  const SECRET_KEY_RE = /(authorization|cookie|password|passwd|pin|access[_-]?token|refresh[_-]?token|token|secret|recovery|master[_-]?key|master[_-]?proof|private[_-]?key|device[_-]?key|envelope)/i;
  const JWT_RE = /\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g;
  const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
  const RECOVERY_RE = /\bRK1(?:-[A-Z0-9]{4,}){3,}\b/gi;
  const SB_SECRET_RE = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}\b/gi;
  const QUERY_SECRET_RE = /([?&](?:access_token|refresh_token|token|code|password|pin|recovery_code|recovery_secret)=)[^&#\s]*/gi;

  function sanitizeString(value) {
    return String(value)
      .replace(BEARER_RE, `Bearer ${REDACTED}`)
      .replace(JWT_RE, REDACTED)
      .replace(RECOVERY_RE, "RK1-[REDACTED]")
      .replace(SB_SECRET_RE, REDACTED)
      .replace(QUERY_SECRET_RE, `$1${REDACTED}`);
  }
  function isPlainObject(value) {
    if (!value || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  function sanitize(value, depth = 0, seen = new WeakSet()) {
    if (typeof value === "string") return sanitizeString(value);
    if (value == null || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value;
    if (typeof value === "function" || typeof value === "symbol") return value;
    if (depth > 4) return "[TRUNCATED]";
    if (typeof Error !== "undefined" && value instanceof Error) {
      return {
        name: sanitizeString(value.name || "Error"),
        message: sanitizeString(value.message || ""),
        code: value.code == null ? undefined : sanitizeString(value.code),
        status: value.status == null ? undefined : value.status
      };
    }
    if (typeof value !== "object") return sanitizeString(value);
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 40).map(item => sanitize(item, depth + 1, seen));
    if (!isPlainObject(value)) return value;
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 80)) {
      output[key] = SECRET_KEY_RE.test(key) ? REDACTED : sanitize(item, depth + 1, seen);
    }
    return output;
  }
  function sanitizeArgs(args) { return Array.from(args || []).map(item => sanitize(item)); }
  function installConsoleGuard(consoleObject) {
    if (!consoleObject || consoleObject.__ruangkithaGuarded) return false;
    for (const name of ["log", "debug", "info", "warn", "error"]) {
      const original = typeof consoleObject[name] === "function" ? consoleObject[name].bind(consoleObject) : null;
      if (original) consoleObject[name] = (...args) => original(...sanitizeArgs(args));
    }
    try { Object.defineProperty(consoleObject, "__ruangkithaGuarded", { value: true, configurable: false }); } catch {}
    return true;
  }
  const api = Object.freeze({
    sanitize,
    sanitizeString,
    log: (...args) => root.console?.log?.(...sanitizeArgs(args)),
    info: (...args) => root.console?.info?.(...sanitizeArgs(args)),
    warn: (...args) => root.console?.warn?.(...sanitizeArgs(args)),
    error: (...args) => root.console?.error?.(...sanitizeArgs(args))
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document && root.console) {
    installConsoleGuard(root.console);
    root.RuangKithaSecurityLog = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
