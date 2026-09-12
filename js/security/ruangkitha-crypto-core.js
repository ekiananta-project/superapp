/*
 * RuangKitha Security Foundation v1 — Crypto Core
 * Build: v2.0.0a49
 *
 * SECURITY CONTRACT
 * - Client-side cryptographic primitives only. No Supabase/network calls here.
 * - AES-256-GCM for authenticated encryption.
 * - HKDF-SHA-256 for deriving KEKs from high-entropy recovery secrets.
 * - 96-bit random IV per AES-GCM operation; IV reuse with the same key is forbidden.
 * - 128-bit authentication tag.
 * - PIN/passphrase handling is intentionally NOT implemented in this file.
 *   A short PIN must never become the root encryption key.
 * - Never persist plaintext master/document/recovery keys in localStorage/sessionStorage.
 *
 * This module exposes window/globalThis.RuangKithaCrypto and CommonJS module.exports
 * for local self-tests. It intentionally has no UI and no automatic side effects.
 */
(function initRuangKithaCrypto(root) {
  "use strict";

  const webcrypto = root.crypto;
  const subtle = webcrypto && webcrypto.subtle;

  const VERSION = 1;
  const SUITE = "RK-SF1-A256GCM-HKDF-SHA256";
  const AES_NAME = "AES-GCM";
  const AES_BITS = 256;
  const GCM_IV_BYTES = 12;
  const GCM_TAG_BITS = 128;
  const HKDF_HASH = "SHA-256";
  const RECOVERY_SECRET_BYTES = 32;
  const HKDF_SALT_BYTES = 32;
  const MAX_PLAINTEXT_BYTES = 64 * 1024 * 1024; // guardrail for one-shot browser crypto
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  function assertAvailable() {
    if (!webcrypto || !subtle || typeof webcrypto.getRandomValues !== "function") {
      throw new Error("RuangKitha Crypto membutuhkan Web Crypto API pada secure context (HTTPS). ");
    }
  }

  function assertBytes(value, label) {
    if (!(value instanceof Uint8Array)) {
      throw new TypeError(`${label || "value"} harus Uint8Array.`);
    }
  }

  function copyBytes(value) {
    assertBytes(value, "bytes");
    return new Uint8Array(value);
  }

  function utf8(value) {
    return textEncoder.encode(String(value ?? ""));
  }

  function utf8Decode(value) {
    assertBytes(value, "bytes");
    return textDecoder.decode(value);
  }

  function randomBytes(length) {
    assertAvailable();
    if (!Number.isInteger(length) || length < 1 || length > 65536) {
      throw new RangeError("Panjang random bytes tidak valid.");
    }
    const out = new Uint8Array(length);
    webcrypto.getRandomValues(out);
    return out;
  }

  function zeroize(value) {
    if (value instanceof Uint8Array) value.fill(0);
  }

  function bytesToBase64Url(bytes) {
    assertBytes(bytes, "bytes");
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    if (typeof value !== "string" || !value.length) throw new TypeError("Base64url tidak valid.");
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }

  async function sha256(bytes) {
    assertAvailable();
    assertBytes(bytes, "bytes");
    return new Uint8Array(await subtle.digest("SHA-256", bytes));
  }

  async function generateAesKey({ extractable = false, usages = ["encrypt", "decrypt"] } = {}) {
    assertAvailable();
    return subtle.generateKey(
      { name: AES_NAME, length: AES_BITS },
      Boolean(extractable),
      usages
    );
  }

  async function importAesKey(rawBytes, { extractable = false, usages = ["encrypt", "decrypt"] } = {}) {
    assertAvailable();
    assertBytes(rawBytes, "rawBytes");
    if (rawBytes.byteLength !== 32) throw new Error("AES-256 key harus tepat 32 byte.");
    return subtle.importKey("raw", rawBytes, { name: AES_NAME }, Boolean(extractable), usages);
  }

  async function exportRawKey(key) {
    assertAvailable();
    if (!key || key.type !== "secret") throw new TypeError("CryptoKey secret diperlukan.");
    if (!key.extractable) throw new Error("Key tidak extractable. Ini diharapkan untuk key runtime yang sudah diamankan.");
    return new Uint8Array(await subtle.exportKey("raw", key));
  }

  function normalizeAad(aad) {
    if (aad == null) return null;
    if (aad instanceof Uint8Array) return aad;
    return utf8(String(aad));
  }

  async function encryptBytes(key, plaintext, { aad = null } = {}) {
    assertAvailable();
    assertBytes(plaintext, "plaintext");
    if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
      throw new RangeError("Payload melewati guardrail one-shot 64 MiB. Gunakan chunked file encryption layer.");
    }
    const iv = randomBytes(GCM_IV_BYTES);
    const additionalData = normalizeAad(aad);
    const algorithm = { name: AES_NAME, iv, tagLength: GCM_TAG_BITS };
    if (additionalData) algorithm.additionalData = additionalData;
    const ciphertext = new Uint8Array(await subtle.encrypt(algorithm, key, plaintext));
    return {
      v: VERSION,
      alg: "A256GCM",
      iv: bytesToBase64Url(iv),
      tag_bits: GCM_TAG_BITS,
      ciphertext: bytesToBase64Url(ciphertext)
    };
  }

  async function decryptBytes(key, envelope, { aad = null } = {}) {
    assertAvailable();
    if (!envelope || envelope.v !== VERSION || envelope.alg !== "A256GCM") {
      throw new Error("Envelope crypto tidak didukung.");
    }
    const iv = base64UrlToBytes(envelope.iv);
    if (iv.byteLength !== GCM_IV_BYTES) throw new Error("IV AES-GCM tidak valid.");
    const ciphertext = base64UrlToBytes(envelope.ciphertext);
    const additionalData = normalizeAad(aad);
    const algorithm = {
      name: AES_NAME,
      iv,
      tagLength: Number(envelope.tag_bits || GCM_TAG_BITS)
    };
    if (additionalData) algorithm.additionalData = additionalData;
    try {
      return new Uint8Array(await subtle.decrypt(algorithm, key, ciphertext));
    } catch (error) {
      const wrapped = new Error("Dekripsi gagal: key/AAD salah atau ciphertext telah berubah.");
      wrapped.cause = error;
      throw wrapped;
    }
  }

  async function encryptJson(key, value, { aad = null } = {}) {
    const bytes = utf8(JSON.stringify(value));
    try {
      return await encryptBytes(key, bytes, { aad });
    } finally {
      zeroize(bytes);
    }
  }

  async function decryptJson(key, envelope, { aad = null } = {}) {
    const bytes = await decryptBytes(key, envelope, { aad });
    try {
      return JSON.parse(utf8Decode(bytes));
    } finally {
      zeroize(bytes);
    }
  }

  async function deriveRecoveryKek(recoverySecretBytes, saltBytes) {
    assertAvailable();
    assertBytes(recoverySecretBytes, "recoverySecretBytes");
    assertBytes(saltBytes, "saltBytes");
    if (recoverySecretBytes.byteLength !== RECOVERY_SECRET_BYTES) {
      throw new Error("Recovery secret v1 harus 32 byte (256-bit random).");
    }
    if (saltBytes.byteLength < 16) throw new Error("HKDF salt terlalu pendek.");

    const material = await subtle.importKey("raw", recoverySecretBytes, "HKDF", false, ["deriveKey"]);
    return subtle.deriveKey(
      {
        name: "HKDF",
        hash: HKDF_HASH,
        salt: saltBytes,
        info: utf8("RuangKitha Security Foundation v1 / recovery-kek")
      },
      material,
      { name: AES_NAME, length: AES_BITS },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function createRecoveryEnvelope(masterKey, { recoverySecretBytes = null } = {}) {
    if (!masterKey || masterKey.type !== "secret") throw new TypeError("Master CryptoKey diperlukan.");
    if (!masterKey.extractable) {
      throw new Error("Master key bootstrap harus sementara extractable agar dapat dibuat recovery envelope.");
    }

    const recoverySecret = recoverySecretBytes ? copyBytes(recoverySecretBytes) : randomBytes(RECOVERY_SECRET_BYTES);
    const salt = randomBytes(HKDF_SALT_BYTES);
    const kek = await deriveRecoveryKek(recoverySecret, salt);
    const rawMaster = await exportRawKey(masterKey);
    try {
      const wrapped = await encryptBytes(kek, rawMaster, {
        aad: `rk-security|v${VERSION}|recovery-master-key`
      });
      return {
        recoverySecret: bytesToBase64Url(recoverySecret),
        envelope: {
          v: VERSION,
          suite: SUITE,
          kind: "recovery-master-key",
          kdf: {
            name: "HKDF",
            hash: HKDF_HASH,
            salt: bytesToBase64Url(salt),
            info: "RuangKitha Security Foundation v1 / recovery-kek"
          },
          wrapped
        }
      };
    } finally {
      zeroize(rawMaster);
      zeroize(recoverySecret);
      zeroize(salt);
    }
  }

  async function recoverMasterKey(recoverySecret, envelope, { extractable = false } = {}) {
    if (typeof recoverySecret !== "string" || !recoverySecret.length) throw new TypeError("Recovery secret diperlukan.");
    if (!envelope || envelope.v !== VERSION || envelope.suite !== SUITE || envelope.kind !== "recovery-master-key") {
      throw new Error("Recovery envelope tidak didukung.");
    }
    if (!envelope.kdf || envelope.kdf.name !== "HKDF" || envelope.kdf.hash !== HKDF_HASH) {
      throw new Error("Recovery KDF tidak didukung.");
    }
    const secretBytes = base64UrlToBytes(recoverySecret);
    const salt = base64UrlToBytes(envelope.kdf.salt);
    const kek = await deriveRecoveryKek(secretBytes, salt);
    let rawMaster;
    try {
      rawMaster = await decryptBytes(kek, envelope.wrapped, {
        aad: `rk-security|v${VERSION}|recovery-master-key`
      });
      return await importAesKey(rawMaster, { extractable, usages: ["encrypt", "decrypt"] });
    } finally {
      if (rawMaster) zeroize(rawMaster);
      zeroize(secretBytes);
      zeroize(salt);
    }
  }

  async function wrapAesKey(kek, childKey, { context }) {
    if (!context || typeof context !== "string") throw new Error("Context AAD wajib untuk key wrapping.");
    if (!childKey || childKey.type !== "secret" || !childKey.extractable) {
      throw new Error("Child key harus secret CryptoKey yang sementara extractable.");
    }
    const rawChild = await exportRawKey(childKey);
    try {
      return await encryptBytes(kek, rawChild, { aad: `rk-keywrap|v${VERSION}|${context}` });
    } finally {
      zeroize(rawChild);
    }
  }

  async function unwrapAesKey(kek, envelope, { context, extractable = false } = {}) {
    if (!context || typeof context !== "string") throw new Error("Context AAD wajib untuk key unwrapping.");
    let rawChild;
    try {
      rawChild = await decryptBytes(kek, envelope, { aad: `rk-keywrap|v${VERSION}|${context}` });
      return await importAesKey(rawChild, { extractable, usages: ["encrypt", "decrypt"] });
    } finally {
      if (rawChild) zeroize(rawChild);
    }
  }

  async function bootstrapMasterKey() {
    // Only bootstrap returns an extractable master key. The caller should create all
    // envelopes immediately, then re-import the raw master as non-extractable for runtime.
    return generateAesKey({ extractable: true, usages: ["encrypt", "decrypt"] });
  }

  async function hardenRuntimeKey(extractableKey) {
    const raw = await exportRawKey(extractableKey);
    try {
      return await importAesKey(raw, { extractable: false, usages: ["encrypt", "decrypt"] });
    } finally {
      zeroize(raw);
    }
  }

  function buildAad(parts) {
    if (!Array.isArray(parts) || !parts.length) throw new TypeError("parts AAD wajib berupa array non-kosong.");
    const safe = parts.map((part) => {
      const value = String(part ?? "");
      if (value.includes("|")) throw new Error("Bagian AAD tidak boleh berisi karakter |.");
      return value;
    });
    return ["rk", `v${VERSION}`, ...safe].join("|");
  }

  const api = Object.freeze({
    VERSION,
    SUITE,
    constants: Object.freeze({
      AES_BITS,
      GCM_IV_BYTES,
      GCM_TAG_BITS,
      RECOVERY_SECRET_BYTES,
      HKDF_SALT_BYTES,
      MAX_PLAINTEXT_BYTES
    }),
    assertAvailable,
    randomBytes,
    zeroize,
    utf8,
    utf8Decode,
    bytesToBase64Url,
    base64UrlToBytes,
    sha256,
    generateAesKey,
    importAesKey,
    exportRawKey,
    encryptBytes,
    decryptBytes,
    encryptJson,
    decryptJson,
    deriveRecoveryKek,
    createRecoveryEnvelope,
    recoverMasterKey,
    wrapAesKey,
    unwrapAesKey,
    bootstrapMasterKey,
    hardenRuntimeKey,
    buildAad
  });

  root.RuangKithaCrypto = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
