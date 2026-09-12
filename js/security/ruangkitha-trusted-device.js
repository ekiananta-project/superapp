/*
 * RuangKitha Security Foundation v1 — Trusted Device + Local Unlock
 * Build: v2.0.0a49c
 *
 * SECURITY CONTRACT
 * - Depends on ruangkitha-crypto-core.js (a49). Do not weaken/replace that core here.
 * - PIN is a LOCAL unlock factor only. It is never sent to Supabase and is never the root key.
 * - The user Master Key is wrapped by a random per-device AES-256 unlock key.
 * - The per-device unlock key is itself wrapped by a PIN-derived PBKDF2-HMAC-SHA-256 key.
 * - A non-extractable local AES anchor and ECDH P-256 private key are persisted as CryptoKey
 *   objects in IndexedDB. No plaintext secret key is written to localStorage/sessionStorage.
 * - Runtime Master Keys are non-extractable and held only in memory. Locking drops references.
 * - There is deliberately NO insecure fallback if Web Crypto / IndexedDB requirements fail.
 *
 * Loading order in browser:
 *   <script src="js/security/ruangkitha-crypto-core.js"></script>
 *   <script src="js/security/ruangkitha-trusted-device.js"></script>
 *
 * Exposes: globalThis.RuangKithaTrustedDevice
 */
(function initRuangKithaTrustedDevice(root) {
  "use strict";

  const Crypto = root.RuangKithaCrypto ||
    (typeof module !== "undefined" && module.exports ? require("./ruangkitha-crypto-core.js") : null);

  const webcrypto = root.crypto;
  const subtle = webcrypto && webcrypto.subtle;

  const VERSION = 1;
  const BUILD = "v2.0.0a49c";
  const DEVICE_ALGORITHM = "ECDH-P256";
  const PIN_KDF = "PBKDF2-HMAC-SHA256";
  const PIN_ITERATIONS = 600000;
  const PIN_SALT_BYTES = 32;
  const MIN_PIN_LENGTH = 6;
  const MAX_PIN_LENGTH = 12;
  const DEFAULT_AUTO_LOCK_MINUTES = 5;
  const MAX_AUTO_LOCK_MINUTES = 60;
  const DB_NAME = "ruangkitha-security-v1";
  const DB_VERSION = 1;
  const STORE_NAME = "device_local";
  const PENDING_PHASE = "pending-bootstrap";
  const READY_PHASE = "ready";
  const TRUST_RECHECK_MS = 60 * 1000;

  const runtime = new Map();
  const STATE_EVENT = "ruangkitha:security-vault-statechange";
  let activityHooksInstalled = false;

  function emitStateChange(detail = {}) {
    if (!isBrowser() || typeof root.dispatchEvent !== "function" || typeof root.CustomEvent !== "function") return;
    try {
      root.dispatchEvent(new root.CustomEvent(STATE_EVENT, {
        detail: {
          source: "trusted-device",
          at: nowIso(),
          ...detail
        }
      }));
    } catch (_) {
      // Runtime security state must not depend on UI event delivery.
    }
  }

  function assertCore() {
    if (!Crypto) throw new Error("RuangKitha Crypto Core belum dimuat.");
    Crypto.assertAvailable();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function isBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  function secureContextOkay() {
    if (!isBrowser()) return true;
    return root.isSecureContext === true;
  }

  function randomUuid() {
    assertCore();
    if (typeof webcrypto.randomUUID === "function") return webcrypto.randomUUID();
    const bytes = Crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
    Crypto.zeroize(bytes);
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  function validatePin(pin) {
    if (typeof pin !== "string") throw new TypeError("PIN harus berupa teks.");
    if (!/^\d+$/.test(pin)) throw new Error("PIN hanya boleh berisi angka.");
    if (pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH) {
      throw new Error(`PIN harus ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digit.`);
    }
    return true;
  }

  function validateUserId(userId) {
    const value = String(userId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error("User ID tidak valid.");
    }
    return value.toLowerCase();
  }

  function validateDeviceLabel(label) {
    const value = String(label || "").trim();
    if (!value || value.length > 120) throw new Error("Nama perangkat harus 1-120 karakter.");
    return value;
  }

  function normalizeAutoLockMinutes(value) {
    const n = Number(value == null ? DEFAULT_AUTO_LOCK_MINUTES : value);
    if (!Number.isFinite(n) || n < 1 || n > MAX_AUTO_LOCK_MINUTES) {
      throw new Error(`Auto-lock harus antara 1-${MAX_AUTO_LOCK_MINUTES} menit.`);
    }
    return Math.round(n);
  }

  function canonicalPublicJwk(jwk) {
    if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) {
      throw new Error("Public key perangkat tidak valid.");
    }
    return JSON.stringify({ crv: "P-256", kty: "EC", x: jwk.x, y: jwk.y });
  }

  async function publicKeyFingerprint(jwk) {
    const digest = await Crypto.sha256(Crypto.utf8(canonicalPublicJwk(jwk)));
    try {
      return Crypto.bytesToBase64Url(digest);
    } finally {
      Crypto.zeroize(digest);
    }
  }

  function pinAad(userId, deviceInstanceId, fingerprint) {
    return Crypto.buildAad(["device-pin-wrap", userId, deviceInstanceId, fingerprint]);
  }

  function localSealAad(userId, deviceInstanceId) {
    return Crypto.buildAad(["device-local-seal", userId, deviceInstanceId]);
  }

  function masterWrapContext(userId, deviceInstanceId, fingerprint) {
    return `device-master-key:${userId}:${deviceInstanceId}:${fingerprint}`;
  }

  async function derivePinKek(pin, saltBytes, iterations = PIN_ITERATIONS) {
    assertCore();
    validatePin(pin);
    if (!(saltBytes instanceof Uint8Array) || saltBytes.byteLength < 16) {
      throw new Error("Salt PIN tidak valid.");
    }
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) {
      throw new Error("Work factor PIN tidak valid.");
    }

    const pinBytes = Crypto.utf8(pin);
    try {
      const material = await subtle.importKey("raw", pinBytes, "PBKDF2", false, ["deriveKey"]);
      return subtle.deriveKey(
        { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    } finally {
      Crypto.zeroize(pinBytes);
    }
  }

  async function generateDeviceIdentity() {
    assertCore();
    const pair = await subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey", "deriveBits"]
    );
    const publicJwk = await subtle.exportKey("jwk", pair.publicKey);
    const fingerprint = await publicKeyFingerprint(publicJwk);
    return {
      privateKey: pair.privateKey,
      publicJwk,
      fingerprint,
      algorithm: DEVICE_ALGORITHM
    };
  }

  async function createProvisionalRecoveryEnvelope(masterKey) {
    // a49a needs a server-side recovery envelope to satisfy the atomic bootstrap contract,
    // but Recovery Kit presentation/storage belongs to a49b. Therefore the random recovery
    // secret is deliberately destroyed here and the envelope is marked provisional.
    const secret = Crypto.randomBytes(Crypto.constants.RECOVERY_SECRET_BYTES);
    const salt = Crypto.randomBytes(Crypto.constants.HKDF_SALT_BYTES);
    let rawMaster;
    try {
      const kek = await Crypto.deriveRecoveryKek(secret, salt);
      rawMaster = await Crypto.exportRawKey(masterKey);
      const wrapped = await Crypto.encryptBytes(kek, rawMaster, {
        aad: `rk-security|v${Crypto.VERSION}|recovery-master-key`
      });
      return {
        v: Crypto.VERSION,
        suite: Crypto.SUITE,
        kind: "recovery-master-key",
        recovery_state: "provisional",
        kdf: {
          name: "HKDF",
          hash: "SHA-256",
          salt: Crypto.bytesToBase64Url(salt),
          info: "RuangKitha Security Foundation v1 / recovery-kek"
        },
        wrapped
      };
    } finally {
      if (rawMaster) Crypto.zeroize(rawMaster);
      Crypto.zeroize(secret);
      Crypto.zeroize(salt);
    }
  }

  async function createDeviceBundleForMaster({ userId, pin, deviceLabel, autoLockMinutes = DEFAULT_AUTO_LOCK_MINUTES, masterKey } = {}) {
    assertCore();
    const uid = validateUserId(userId);
    const label = validateDeviceLabel(deviceLabel);
    validatePin(pin);
    const lockMinutes = normalizeAutoLockMinutes(autoLockMinutes);
    if (!masterKey || masterKey.type !== "secret" || masterKey.extractable !== true) {
      throw new Error("Master Key recovery harus sementara extractable untuk membuat envelope perangkat baru.");
    }

    const deviceInstanceId = randomUuid();
    const identity = await generateDeviceIdentity();
    const anchorKey = await Crypto.generateAesKey({ extractable: false });
    const unlockKey = await Crypto.generateAesKey({ extractable: true });
    const pinSalt = Crypto.randomBytes(PIN_SALT_BYTES);
    let rawUnlock;

    try {
      const context = masterWrapContext(uid, deviceInstanceId, identity.fingerprint);
      const wrappedMaster = await Crypto.wrapAesKey(unlockKey, masterKey, { context });
      const deviceKeyEnvelope = {
        v: VERSION,
        suite: Crypto.SUITE,
        kind: "device-master-key",
        context,
        public_key_fingerprint: identity.fingerprint,
        wrapped: wrappedMaster
      };

      const pinKey = await derivePinKek(pin, pinSalt, PIN_ITERATIONS);
      rawUnlock = await Crypto.exportRawKey(unlockKey);
      const pinWrappedUnlockKey = await Crypto.encryptBytes(pinKey, rawUnlock, {
        aad: pinAad(uid, deviceInstanceId, identity.fingerprint)
      });

      const localPayload = {
        v: VERSION,
        kind: "local-unlock-bundle",
        pin_kdf: {
          name: PIN_KDF,
          iterations: PIN_ITERATIONS,
          salt: Crypto.bytesToBase64Url(pinSalt)
        },
        pin_wrapped_unlock_key: pinWrappedUnlockKey,
        public_key_fingerprint: identity.fingerprint,
        created_at: nowIso()
      };
      const localSeal = await Crypto.encryptJson(anchorKey, localPayload, {
        aad: localSealAad(uid, deviceInstanceId)
      });

      const runtimeMasterKey = await Crypto.hardenRuntimeKey(masterKey);
      const localRecord = {
        record_key: uid,
        version: VERSION,
        build: BUILD,
        phase: PENDING_PHASE,
        user_id: uid,
        vault_id: null,
        device_id: null,
        device_instance_id: deviceInstanceId,
        device_label: label,
        public_key_algorithm: DEVICE_ALGORITHM,
        public_key: identity.publicJwk,
        public_key_fingerprint: identity.fingerprint,
        identity_private_key: identity.privateKey,
        anchor_key: anchorKey,
        local_seal: localSeal,
        cached_device_key_envelope: deviceKeyEnvelope,
        pending_recovery_envelope: null,
        auto_lock_minutes: lockMinutes,
        failed_attempts: 0,
        locked_until_ms: 0,
        created_at: nowIso(),
        updated_at: nowIso()
      };

      return {
        localRecord,
        runtimeMasterKey,
        deviceRpc: {
          p_device_label: label,
          p_device_public_key_algorithm: DEVICE_ALGORITHM,
          p_device_public_key: identity.publicJwk,
          p_device_public_key_fingerprint: identity.fingerprint,
          p_device_client_id: deviceInstanceId,
          p_device_key_envelope: deviceKeyEnvelope,
          p_key_suite: Crypto.SUITE
        }
      };
    } finally {
      if (rawUnlock) Crypto.zeroize(rawUnlock);
      Crypto.zeroize(pinSalt);
    }
  }

  async function createBootstrapBundle({ userId, pin, deviceLabel, autoLockMinutes = DEFAULT_AUTO_LOCK_MINUTES } = {}) {
    assertCore();
    const uid = validateUserId(userId);
    const label = validateDeviceLabel(deviceLabel);
    validatePin(pin);
    const lockMinutes = normalizeAutoLockMinutes(autoLockMinutes);
    const deviceInstanceId = randomUuid();

    const identity = await generateDeviceIdentity();
    const anchorKey = await Crypto.generateAesKey({ extractable: false });
    const unlockKey = await Crypto.generateAesKey({ extractable: true });
    const masterBootstrap = await Crypto.bootstrapMasterKey();
    const pinSalt = Crypto.randomBytes(PIN_SALT_BYTES);
    let rawUnlock;

    try {
      const context = masterWrapContext(uid, deviceInstanceId, identity.fingerprint);
      const wrappedMaster = await Crypto.wrapAesKey(unlockKey, masterBootstrap, { context });
      const deviceKeyEnvelope = {
        v: VERSION,
        suite: Crypto.SUITE,
        kind: "device-master-key",
        context,
        public_key_fingerprint: identity.fingerprint,
        wrapped: wrappedMaster
      };

      const pinKey = await derivePinKek(pin, pinSalt, PIN_ITERATIONS);
      rawUnlock = await Crypto.exportRawKey(unlockKey);
      const pinWrappedUnlockKey = await Crypto.encryptBytes(pinKey, rawUnlock, {
        aad: pinAad(uid, deviceInstanceId, identity.fingerprint)
      });

      const localPayload = {
        v: VERSION,
        kind: "local-unlock-bundle",
        pin_kdf: {
          name: PIN_KDF,
          iterations: PIN_ITERATIONS,
          salt: Crypto.bytesToBase64Url(pinSalt)
        },
        pin_wrapped_unlock_key: pinWrappedUnlockKey,
        public_key_fingerprint: identity.fingerprint,
        created_at: nowIso()
      };
      const localSeal = await Crypto.encryptJson(anchorKey, localPayload, {
        aad: localSealAad(uid, deviceInstanceId)
      });

      const recoveryEnvelope = await createProvisionalRecoveryEnvelope(masterBootstrap);
      const runtimeMasterKey = await Crypto.hardenRuntimeKey(masterBootstrap);

      const localRecord = {
        record_key: uid,
        version: VERSION,
        build: BUILD,
        phase: PENDING_PHASE,
        user_id: uid,
        vault_id: null,
        device_id: null,
        device_instance_id: deviceInstanceId,
        device_label: label,
        public_key_algorithm: DEVICE_ALGORITHM,
        public_key: identity.publicJwk,
        public_key_fingerprint: identity.fingerprint,
        identity_private_key: identity.privateKey,
        anchor_key: anchorKey,
        local_seal: localSeal,
        cached_device_key_envelope: deviceKeyEnvelope,
        pending_recovery_envelope: recoveryEnvelope,
        auto_lock_minutes: lockMinutes,
        failed_attempts: 0,
        locked_until_ms: 0,
        created_at: nowIso(),
        updated_at: nowIso()
      };

      return {
        localRecord,
        runtimeMasterKey,
        bootstrapRpc: {
          p_recovery_envelope: recoveryEnvelope,
          p_device_label: label,
          p_device_public_key_algorithm: DEVICE_ALGORITHM,
          p_device_public_key: identity.publicJwk,
          p_device_public_key_fingerprint: identity.fingerprint,
          p_device_client_id: deviceInstanceId,
          p_device_key_envelope: deviceKeyEnvelope,
          p_key_suite: Crypto.SUITE
        }
      };
    } finally {
      if (rawUnlock) Crypto.zeroize(rawUnlock);
      Crypto.zeroize(pinSalt);
      // CryptoKey objects cannot be zeroized. Extractable bootstrap keys are intentionally
      // allowed to fall out of scope after all required envelopes have been created.
    }
  }

  async function unlockFromRecord({ userId, pin, record, deviceKeyEnvelope = null, extractable = false } = {}) {
    assertCore();
    const uid = validateUserId(userId);
    validatePin(pin);
    if (!record || record.user_id !== uid || record.version !== VERSION) {
      throw new Error("Data trusted device lokal tidak cocok.");
    }
    if (!record.anchor_key || record.anchor_key.extractable !== false) {
      throw new Error("Local device anchor tidak valid.");
    }

    const localPayload = await Crypto.decryptJson(record.anchor_key, record.local_seal, {
      aad: localSealAad(uid, record.device_instance_id)
    });
    if (!localPayload || localPayload.kind !== "local-unlock-bundle") {
      throw new Error("Local unlock bundle tidak valid.");
    }
    if (localPayload.public_key_fingerprint !== record.public_key_fingerprint) {
      throw new Error("Fingerprint trusted device tidak cocok.");
    }

    const kdf = localPayload.pin_kdf || {};
    if (kdf.name !== PIN_KDF) throw new Error("KDF PIN tidak didukung.");
    const salt = Crypto.base64UrlToBytes(kdf.salt);
    let rawUnlock;
    try {
      const pinKey = await derivePinKek(pin, salt, Number(kdf.iterations));
      try {
        rawUnlock = await Crypto.decryptBytes(pinKey, localPayload.pin_wrapped_unlock_key, {
          aad: pinAad(uid, record.device_instance_id, record.public_key_fingerprint)
        });
      } catch (error) {
        const wrapped = new Error("PIN salah atau data trusted device lokal rusak.");
        wrapped.code = "LOCAL_UNLOCK_FAILED";
        wrapped.cause = error;
        throw wrapped;
      }

      const unlockKey = await Crypto.importAesKey(rawUnlock, { extractable: false });
      const envelope = deviceKeyEnvelope || record.cached_device_key_envelope;
      if (!envelope || envelope.kind !== "device-master-key" || envelope.suite !== Crypto.SUITE) {
        throw new Error("Device Master Key envelope tidak valid.");
      }
      const expectedContext = masterWrapContext(uid, record.device_instance_id, record.public_key_fingerprint);
      if (envelope.context !== expectedContext || envelope.public_key_fingerprint !== record.public_key_fingerprint) {
        throw new Error("Device Master Key envelope tidak terikat ke trusted device ini.");
      }
      return Crypto.unwrapAesKey(unlockKey, envelope.wrapped, {
        context: expectedContext,
        extractable: Boolean(extractable)
      });
    } finally {
      Crypto.zeroize(salt);
      if (rawUnlock) Crypto.zeroize(rawUnlock);
    }
  }

  async function rewrapLocalPin({ userId, currentPin, newPin, record } = {}) {
    assertCore();
    const uid = validateUserId(userId);
    validatePin(currentPin);
    validatePin(newPin);
    if (currentPin === newPin) {
      const error = new Error("PIN baru sama dengan PIN perangkat saat ini.");
      error.code = "LOCAL_PIN_UNCHANGED";
      throw error;
    }
    if (!record || record.user_id !== uid || record.version !== VERSION || record.phase !== READY_PHASE) {
      const error = new Error("Trusted Device lokal yang siap diperlukan untuk mengubah PIN.");
      error.code = "LOCAL_DEVICE_NOT_READY";
      throw error;
    }
    if (!record.anchor_key || record.anchor_key.extractable !== false) {
      throw new Error("Local device anchor tidak valid.");
    }

    const localPayload = await Crypto.decryptJson(record.anchor_key, record.local_seal, {
      aad: localSealAad(uid, record.device_instance_id)
    });
    if (!localPayload || localPayload.kind !== "local-unlock-bundle") {
      throw new Error("Local unlock bundle tidak valid.");
    }
    if (localPayload.public_key_fingerprint !== record.public_key_fingerprint) {
      throw new Error("Fingerprint trusted device tidak cocok.");
    }

    const oldKdf = localPayload.pin_kdf || {};
    if (oldKdf.name !== PIN_KDF) throw new Error("KDF PIN tidak didukung.");
    const oldSalt = Crypto.base64UrlToBytes(oldKdf.salt);
    const newSalt = Crypto.randomBytes(PIN_SALT_BYTES);
    let rawUnlock;

    try {
      const currentPinKey = await derivePinKek(currentPin, oldSalt, Number(oldKdf.iterations));
      try {
        rawUnlock = await Crypto.decryptBytes(currentPinKey, localPayload.pin_wrapped_unlock_key, {
          aad: pinAad(uid, record.device_instance_id, record.public_key_fingerprint)
        });
      } catch (error) {
        const wrapped = new Error("PIN perangkat saat ini salah atau material Trusted Device lokal rusak.");
        wrapped.code = "LOCAL_UNLOCK_FAILED";
        wrapped.cause = error;
        throw wrapped;
      }

      const newPinKey = await derivePinKek(newPin, newSalt, PIN_ITERATIONS);
      const pinWrappedUnlockKey = await Crypto.encryptBytes(newPinKey, rawUnlock, {
        aad: pinAad(uid, record.device_instance_id, record.public_key_fingerprint)
      });
      const changedAt = nowIso();
      const nextPayload = {
        ...localPayload,
        pin_kdf: {
          name: PIN_KDF,
          iterations: PIN_ITERATIONS,
          salt: Crypto.bytesToBase64Url(newSalt)
        },
        pin_wrapped_unlock_key: pinWrappedUnlockKey,
        pin_changed_at: changedAt
      };
      const localSeal = await Crypto.encryptJson(record.anchor_key, nextPayload, {
        aad: localSealAad(uid, record.device_instance_id)
      });

      return {
        ...record,
        build: BUILD,
        local_seal: localSeal,
        failed_attempts: 0,
        locked_until_ms: 0,
        pin_changed_at: changedAt
      };
    } finally {
      Crypto.zeroize(oldSalt);
      Crypto.zeroize(newSalt);
      if (rawUnlock) Crypto.zeroize(rawUnlock);
    }
  }

  function idbAvailable() {
    return Boolean(root.indexedDB);
  }

  function openDb() {
    if (!idbAvailable()) return Promise.reject(new Error("IndexedDB tidak tersedia."));
    return new Promise((resolve, reject) => {
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "record_key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Gagal membuka IndexedDB."));
      request.onblocked = () => reject(new Error("IndexedDB sedang diblokir oleh tab RuangKitha lain."));
    });
  }

  async function idbRequest(mode, operation) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let request;
        try {
          request = operation(store);
        } catch (error) {
          reject(error);
          return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Operasi IndexedDB gagal."));
        tx.onabort = () => reject(tx.error || new Error("Transaksi IndexedDB dibatalkan."));
      });
    } finally {
      db.close();
    }
  }

  function getLocalRecord(userId) {
    return idbRequest("readonly", (store) => store.get(validateUserId(userId)));
  }

  function sanitizeRecordForPersistence(record) {
    if (!record || typeof record !== "object") return record;
    if (record.phase !== READY_PHASE) return record;
    // a49c: a ready Trusted Device must not persist the server Device Master Key envelope.
    // Fresh unlock always fetches it from a trusted-only RPC so revocation cannot be bypassed
    // by the normal client using a stale IndexedDB cache.
    return { ...record, cached_device_key_envelope: null };
  }

  function putLocalRecord(record) {
    if (!record || !record.record_key) return Promise.reject(new Error("Local record tidak valid."));
    record.updated_at = nowIso();
    const persisted = sanitizeRecordForPersistence(record);
    persisted.updated_at = record.updated_at;
    return idbRequest("readwrite", (store) => store.put(persisted));
  }

  function deleteLocalRecord(userId) {
    return idbRequest("readwrite", (store) => store.delete(validateUserId(userId)));
  }

  async function probePersistentCryptoKey() {
    if (!idbAvailable()) throw new Error("IndexedDB tidak tersedia.");
    const probeKey = `__probe__:${randomUuid()}`;
    const anchor = await Crypto.generateAesKey({ extractable: false });
    const record = {
      record_key: probeKey,
      version: VERSION,
      anchor_key: anchor,
      created_at: nowIso()
    };
    await idbRequest("readwrite", (store) => store.put(record));
    const loaded = await idbRequest("readonly", (store) => store.get(probeKey));
    await idbRequest("readwrite", (store) => store.delete(probeKey));
    if (!loaded || !loaded.anchor_key || loaded.anchor_key.type !== "secret" || loaded.anchor_key.extractable !== false) {
      throw new Error("Browser tidak dapat mempersistenkan non-extractable CryptoKey di IndexedDB.");
    }
    return true;
  }

  async function checkCapabilities({ deep = false } = {}) {
    const reasons = [];
    if (!Crypto) reasons.push("Crypto Core tidak tersedia.");
    if (!webcrypto || !subtle || typeof webcrypto.getRandomValues !== "function") {
      reasons.push("Web Crypto API tidak tersedia.");
    }
    if (!secureContextOkay()) reasons.push("RuangKitha harus berjalan di HTTPS/secure context.");
    if (!idbAvailable()) reasons.push("IndexedDB tidak tersedia.");

    if (!reasons.length && deep) {
      try {
        const identity = await generateDeviceIdentity();
        if (!identity.privateKey || identity.privateKey.extractable !== false) {
          reasons.push("ECDH private key tidak dapat dibuat non-extractable.");
        }
      } catch (error) {
        reasons.push(`ECDH P-256 tidak tersedia: ${error && error.message ? error.message : error}`);
      }
      try {
        await probePersistentCryptoKey();
      } catch (error) {
        reasons.push(error && error.message ? error.message : String(error));
      }
    }

    return {
      supported: reasons.length === 0,
      reasons,
      secureContext: secureContextOkay(),
      webCrypto: Boolean(webcrypto && subtle),
      indexedDB: idbAvailable(),
      deviceAlgorithm: DEVICE_ALGORITHM,
      pinKdf: PIN_KDF,
      pinIterations: PIN_ITERATIONS
    };
  }

  async function currentUserId(supabase) {
    if (!supabase || !supabase.auth || typeof supabase.auth.getUser !== "function") {
      throw new Error("Supabase client yang valid diperlukan.");
    }
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data || !data.user || !data.user.id) throw new Error("User belum login.");
    return validateUserId(data.user.id);
  }

  async function rpc(supabase, name, params = {}) {
    if (!supabase || typeof supabase.rpc !== "function") throw new Error("Supabase client tidak valid.");
    const { data, error } = await supabase.rpc(name, params);
    if (error) throw error;
    return data;
  }

  function throttleDelayMs(failedAttempts) {
    if (failedAttempts < 5) return 0;
    const power = Math.min(failedAttempts - 5, 5);
    return Math.min(30000 * (2 ** power), 15 * 60 * 1000);
  }

  async function noteUnlockFailure(record) {
    const attempts = Number(record.failed_attempts || 0) + 1;
    const delay = throttleDelayMs(attempts);
    record.failed_attempts = attempts;
    record.locked_until_ms = delay ? Date.now() + delay : 0;
    await putLocalRecord(record);
    return { attempts, retryAfterMs: delay };
  }

  async function clearUnlockFailures(record) {
    if (record.failed_attempts || record.locked_until_ms) {
      record.failed_attempts = 0;
      record.locked_until_ms = 0;
      await putLocalRecord(record);
    }
  }

  function assertNotThrottled(record) {
    const until = Number(record.locked_until_ms || 0);
    if (until > Date.now()) {
      const error = new Error("Terlalu banyak percobaan PIN. Coba lagi setelah jeda lokal selesai.");
      error.code = "LOCAL_UNLOCK_THROTTLED";
      error.retryAfterMs = until - Date.now();
      throw error;
    }
  }

  function clearRuntimeTimer(session) {
    if (session && session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }
    if (session && session.trustTimer) {
      clearTimeout(session.trustTimer);
      session.trustTimer = null;
    }
  }

  function lock(userId, reason = "manual") {
    const uid = validateUserId(userId);
    const session = runtime.get(uid);
    if (session) clearRuntimeTimer(session);
    const hadSession = runtime.delete(uid); // Drop CryptoKey references; CryptoKey cannot be manually zeroized.
    if (hadSession) emitStateChange({ userId: uid, unlocked: false, reason });
    return true;
  }

  function lockAll(reason = "all") {
    const ids = [...runtime.keys()];
    for (const session of runtime.values()) clearRuntimeTimer(session);
    runtime.clear();
    for (const uid of ids) emitStateChange({ userId: uid, unlocked: false, reason });
    return true;
  }

  function scheduleAutoLock(userId) {
    const session = runtime.get(userId);
    if (!session) return;
    clearRuntimeTimer(session);
    const remaining = Math.max(0, session.expiresAtMs - Date.now());
    session.timer = setTimeout(() => lock(userId, "auto-lock"), remaining);
  }

  async function serverDeviceStatus(supabase, deviceInstanceId) {
    if (!deviceInstanceId) return { found: false };
    return rpc(supabase, "security_device_status_v1", {
      p_device_client_id: deviceInstanceId
    });
  }

  async function purgeRevokedLocalDevice(userId, reason = "device-revoked") {
    const uid = validateUserId(userId);
    lock(uid, reason);
    await deleteLocalRecord(uid);
    emitStateChange({ userId: uid, unlocked: false, reason, localDeviceRemoved: true });
    return true;
  }

  async function revalidateCurrentDevice({ supabase, purgeRevoked = true } = {}) {
    const userId = await currentUserId(supabase);
    const record = await getLocalRecord(userId);
    if (!record || record.phase !== READY_PHASE) {
      return { userId, present: Boolean(record), trusted: false, status: null };
    }
    const status = await serverDeviceStatus(supabase, record.device_instance_id);
    const trusted = Boolean(status && status.found && status.trust_state === "trusted");
    if (!trusted && purgeRevoked) await purgeRevokedLocalDevice(userId, "device-revoked");
    return { userId, present: true, trusted, status: status || { found: false } };
  }

  function scheduleTrustRecheck(userId) {
    const session = runtime.get(userId);
    if (!session || !session.supabase || !session.deviceInstanceId) return;
    if (session.trustTimer) clearTimeout(session.trustTimer);
    session.trustTimer = setTimeout(async () => {
      const active = runtime.get(userId);
      if (!active) return;
      try {
        const status = await serverDeviceStatus(active.supabase, active.deviceInstanceId);
        if (!status || !status.found || status.trust_state !== "trusted") {
          await purgeRevokedLocalDevice(userId, "device-revoked");
          return;
        }
      } catch (_) {
        // A transient network failure does not destroy an already-unlocked runtime session.
        // Fresh unlock remains online-only; the monitor retries when connectivity returns.
      }
      if (runtime.has(userId)) scheduleTrustRecheck(userId);
    }, TRUST_RECHECK_MS);
  }

  function setRuntimeSession(userId, masterKey, autoLockMinutes, { supabase = null, deviceInstanceId = null } = {}) {
    const uid = validateUserId(userId);
    if (!masterKey || masterKey.type !== "secret" || masterKey.extractable !== false) {
      throw new Error("Runtime Master Key harus non-extractable.");
    }
    const minutes = normalizeAutoLockMinutes(autoLockMinutes);
    const session = {
      masterKey,
      autoLockMinutes: minutes,
      lastActivityMs: Date.now(),
      expiresAtMs: Date.now() + minutes * 60 * 1000,
      timer: null,
      trustTimer: null,
      supabase,
      deviceInstanceId
    };
    runtime.set(uid, session);
    scheduleAutoLock(uid);
    scheduleTrustRecheck(uid);
    installActivityHooks();
  }

  function touchActivity(userId = null) {
    const ids = userId ? [validateUserId(userId)] : [...runtime.keys()];
    for (const uid of ids) {
      const session = runtime.get(uid);
      if (!session) continue;
      session.lastActivityMs = Date.now();
      session.expiresAtMs = Date.now() + session.autoLockMinutes * 60 * 1000;
      scheduleAutoLock(uid);
    }
  }

  function installActivityHooks() {
    if (!isBrowser() || activityHooksInstalled) return;
    activityHooksInstalled = true;
    const activity = () => touchActivity();
    ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
      document.addEventListener(eventName, activity, { capture: true, passive: true });
    });
    const recheck = () => {
      for (const [uid, session] of runtime.entries()) {
        if (!session.supabase || !session.deviceInstanceId) continue;
        serverDeviceStatus(session.supabase, session.deviceInstanceId).then(async (status) => {
          if (!status || !status.found || status.trust_state !== "trusted") {
            await purgeRevokedLocalDevice(uid, "device-revoked");
          }
        }).catch(() => {});
      }
    };
    window.addEventListener("online", recheck, { passive: true });
    window.addEventListener("focus", recheck, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recheck(); }, { passive: true });
    window.addEventListener("pagehide", () => lockAll("pagehide"), { capture: true });
    window.addEventListener("beforeunload", () => lockAll("beforeunload"), { capture: true });
  }

  function isUnlocked(userId) {
    const uid = validateUserId(userId);
    const session = runtime.get(uid);
    if (!session) return false;
    if (session.expiresAtMs <= Date.now()) {
      lock(uid, "expired");
      return false;
    }
    return true;
  }

  async function withMasterKey(userId, callback) {
    const uid = validateUserId(userId);
    if (typeof callback !== "function") throw new TypeError("callback wajib berupa function.");
    const session = runtime.get(uid);
    if (!session || !isUnlocked(uid)) throw new Error("Security Vault sedang terkunci.");
    touchActivity(uid);
    return callback(session.masterKey);
  }

  async function withDeviceIdentityPrivateKey(userId, callback) {
    const uid = validateUserId(userId);
    if (typeof callback !== "function") throw new TypeError("callback wajib berupa function.");
    if (!isUnlocked(uid)) throw new Error("Security Vault sedang terkunci.");
    const record = await getLocalRecord(uid);
    if (!record || record.phase !== READY_PHASE) throw new Error("Trusted Device lokal belum siap.");
    const privateKey = record.identity_private_key;
    if (!privateKey || privateKey.type !== "private" || privateKey.algorithm?.name !== "ECDH") {
      throw new Error("Identity private key Trusted Device tidak tersedia.");
    }
    touchActivity(uid);
    return callback(privateKey, {
      deviceId: record.device_id || null,
      deviceInstanceId: record.device_instance_id || null,
      publicKeyFingerprint: record.public_key_fingerprint || null
    });
  }

  async function resumePendingSetup(supabase, record) {
    const result = await rpc(supabase, "security_resume_device_v1", {
      p_device_client_id: record.device_instance_id
    });
    if (!result || !result.found) return null;
    if (result.trust_state !== "trusted") throw new Error("Perangkat lokal tidak berstatus trusted.");
    record.vault_id = result.vault_id;
    record.device_id = result.device_id;
    record.cached_device_key_envelope = null;
    record.phase = READY_PHASE;
    record.pending_recovery_envelope = null;
    await putLocalRecord(record);
    return result;
  }

  async function setupFirstVault({ supabase, pin, deviceLabel, autoLockMinutes = DEFAULT_AUTO_LOCK_MINUTES } = {}) {
    const capabilities = await checkCapabilities({ deep: true });
    if (!capabilities.supported) {
      const error = new Error(`Browser/perangkat belum mendukung Security Vault: ${capabilities.reasons.join(" ")}`);
      error.code = "SECURITY_CAPABILITY_UNSUPPORTED";
      error.capabilities = capabilities;
      throw error;
    }

    const userId = await currentUserId(supabase);
    let existing = await getLocalRecord(userId);
    if (existing) {
      if (existing.phase === READY_PHASE) throw new Error("Trusted device lokal sudah tersedia untuk akun ini.");
      if (existing.phase === PENDING_PHASE) {
        const resumed = await resumePendingSetup(supabase, existing);
        if (resumed) {
          // Retry setup setelah respons network yang ambigu harus dapat selesai dari UI yang sama.
          // PIN tetap hanya dipakai lokal untuk membuka material device yang sudah direkonsiliasi.
          return unlockWithPin({ supabase, pin });
        }
      }
    }

    const state = await rpc(supabase, "security_vault_state_v1");
    if (state && state.configured) {
      const error = new Error("Security Vault sudah ada. Perangkat baru harus memakai Recovery/Device Trust flow pada patch berikutnya.");
      error.code = "VAULT_ALREADY_CONFIGURED";
      throw error;
    }

    const bundle = await createBootstrapBundle({ userId, pin, deviceLabel, autoLockMinutes });
    existing = bundle.localRecord;
    // Persist BEFORE network commit so an uncertain network response cannot strand the newly
    // created server vault without its local device material.
    await putLocalRecord(existing);

    let result;
    try {
      result = await rpc(supabase, "security_bootstrap_vault_v2", bundle.bootstrapRpc);
    } catch (error) {
      try {
        const resumed = await resumePendingSetup(supabase, existing);
        if (resumed) result = resumed;
      } catch (_) {
        // Preserve pending local material. Caller can safely retry setup; v2 RPC is reconciled
        // by client_instance_id. Do not delete key material after an ambiguous network failure.
      }
      if (!result) throw error;
    }

    existing.vault_id = result.vault_id;
    existing.device_id = result.device_id;
    existing.phase = READY_PHASE;
    existing.pending_recovery_envelope = null;
    existing.cached_device_key_envelope = null;
    await putLocalRecord(existing);

    setRuntimeSession(userId, bundle.runtimeMasterKey, existing.auto_lock_minutes, { supabase, deviceInstanceId: existing.device_instance_id });

    return {
      configured: true,
      vaultId: existing.vault_id,
      deviceId: existing.device_id,
      deviceInstanceId: existing.device_instance_id,
      deviceLabel: existing.device_label,
      recoveryReady: false,
      recoveryState: "provisional",
      unlocked: true,
      autoLockMinutes: existing.auto_lock_minutes
    };
  }

  async function unlockWithPin({ supabase, pin } = {}) {
    const userId = await currentUserId(supabase);
    const record = await getLocalRecord(userId);
    if (!record) {
      const error = new Error("Perangkat ini belum menjadi Trusted Device untuk akun tersebut.");
      error.code = "LOCAL_DEVICE_NOT_FOUND";
      throw error;
    }
    if (record.phase === PENDING_PHASE) {
      const resumed = await resumePendingSetup(supabase, record);
      if (!resumed) {
        const error = new Error("Setup Trusted Device belum selesai. Jalankan setup lagi.");
        error.code = "DEVICE_SETUP_PENDING";
        throw error;
      }
    }

    assertNotThrottled(record);

    // Trust state is checked online on every fresh unlock. a49a intentionally does not
    // implement an offline-unlock bypass, because that would weaken later device revocation.
    const material = await rpc(supabase, "security_local_unlock_material_v1", {
      p_device_client_id: record.device_instance_id
    });

    if (!material || !material.found || material.trust_state !== "trusted" || !material.device_key_envelope) {
      lock(userId);
      const error = new Error("Trusted Device ini sudah tidak aktif, telah dicabut, atau material unlock tidak tersedia.");
      error.code = "DEVICE_NOT_TRUSTED";
      throw error;
    }

    record.vault_id = material.vault_id;
    record.device_id = material.device_id;
    record.cached_device_key_envelope = null;
    await putLocalRecord(record);

    let masterKey;
    try {
      masterKey = await unlockFromRecord({
        userId,
        pin,
        record,
        deviceKeyEnvelope: material.device_key_envelope
      });
    } catch (error) {
      if (error && error.code === "LOCAL_UNLOCK_FAILED") {
        const throttle = await noteUnlockFailure(record);
        error.failedAttempts = throttle.attempts;
        error.retryAfterMs = throttle.retryAfterMs;
      }
      throw error;
    }

    await clearUnlockFailures(record);
    setRuntimeSession(userId, masterKey, record.auto_lock_minutes, { supabase, deviceInstanceId: record.device_instance_id });

    if (record.device_id) {
      rpc(supabase, "security_touch_device_v1", { p_device_id: record.device_id }).catch(() => {});
    }

    return {
      unlocked: true,
      vaultId: record.vault_id,
      deviceId: record.device_id,
      deviceInstanceId: record.device_instance_id,
      deviceLabel: record.device_label,
      autoLockMinutes: record.auto_lock_minutes
    };
  }

  async function withExtractableMasterKeyFromPin({ supabase, pin, callback } = {}) {
    if (typeof callback !== "function") throw new TypeError("callback wajib berupa function.");
    const userId = await currentUserId(supabase);
    const record = await getLocalRecord(userId);
    if (!record || record.phase !== READY_PHASE) {
      const error = new Error("Trusted Device lokal yang siap diperlukan.");
      error.code = "LOCAL_DEVICE_NOT_READY";
      throw error;
    }

    assertNotThrottled(record);
    const material = await rpc(supabase, "security_local_unlock_material_v1", {
      p_device_client_id: record.device_instance_id
    });
    if (!material || !material.found || material.trust_state !== "trusted" || !material.device_key_envelope) {
      const error = new Error("Trusted Device ini sudah tidak aktif atau material unlock tidak tersedia.");
      error.code = "DEVICE_NOT_TRUSTED";
      throw error;
    }

    let masterKey;
    try {
      masterKey = await unlockFromRecord({
        userId,
        pin,
        record,
        deviceKeyEnvelope: material.device_key_envelope,
        extractable: true
      });
    } catch (error) {
      if (error && error.code === "LOCAL_UNLOCK_FAILED") {
        const throttle = await noteUnlockFailure(record);
        error.failedAttempts = throttle.attempts;
        error.retryAfterMs = throttle.retryAfterMs;
      }
      throw error;
    }

    await clearUnlockFailures(record);
    if (record.device_id) rpc(supabase, "security_touch_device_v1", { p_device_id: record.device_id }).catch(() => {});
    return callback(masterKey, {
      userId,
      vaultId: material.vault_id || record.vault_id,
      deviceId: material.device_id || record.device_id,
      deviceInstanceId: record.device_instance_id
    });
  }

  async function recoverDeviceWithMaster({
    supabase,
    pin,
    deviceLabel,
    autoLockMinutes = DEFAULT_AUTO_LOCK_MINUTES,
    masterKey,
    recoveryEnvelopeId,
    masterProofSha256
  } = {}) {
    const capabilities = await checkCapabilities({ deep: true });
    if (!capabilities.supported) {
      const error = new Error(`Browser/perangkat belum mendukung Security Vault: ${capabilities.reasons.join(" ")}`);
      error.code = "SECURITY_CAPABILITY_UNSUPPORTED";
      throw error;
    }
    if (!masterKey || masterKey.type !== "secret" || masterKey.extractable !== true) {
      throw new Error("Master Key hasil recovery harus sementara extractable.");
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(recoveryEnvelopeId || ""))) {
      throw new Error("Recovery envelope ID tidak valid.");
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(String(masterProofSha256 || ""))) {
      throw new Error("Master proof recovery tidak valid.");
    }

    const userId = await currentUserId(supabase);
    let existing = await getLocalRecord(userId);
    if (existing) {
      if (existing.phase === READY_PHASE) {
        throw new Error("Perangkat ini sudah menjadi Trusted Device.");
      }
      if (existing.phase === PENDING_PHASE) {
        try {
          const resumed = await resumePendingSetup(supabase, existing);
          if (resumed) return unlockWithPin({ supabase, pin });
        } catch (_) {
          // If the server did not commit the recovered device, regenerate a fresh local bundle below.
        }
        await deleteLocalRecord(userId);
        existing = null;
      }
    }

    const state = await rpc(supabase, "security_vault_state_v1");
    if (!state || !state.configured || !state.recovery_ready) {
      const error = new Error("Recovery Kit aktif belum tersedia untuk akun ini.");
      error.code = "RECOVERY_NOT_READY";
      throw error;
    }

    const bundle = await createDeviceBundleForMaster({
      userId,
      pin,
      deviceLabel,
      autoLockMinutes,
      masterKey
    });
    existing = bundle.localRecord;
    await putLocalRecord(existing);

    let result;
    try {
      result = await rpc(supabase, "security_recover_device_v1", {
        p_recovery_envelope_id: recoveryEnvelopeId,
        p_master_proof_sha256: masterProofSha256,
        ...bundle.deviceRpc
      });
    } catch (error) {
      try {
        const resumed = await resumePendingSetup(supabase, existing);
        if (resumed) result = resumed;
      } catch (_) {
        // Preserve pending local material after an ambiguous network result.
      }
      if (!result) throw error;
    }

    existing.vault_id = result.vault_id;
    existing.device_id = result.device_id;
    existing.phase = READY_PHASE;
    existing.cached_device_key_envelope = null;
    await putLocalRecord(existing);
    setRuntimeSession(userId, bundle.runtimeMasterKey, existing.auto_lock_minutes, { supabase, deviceInstanceId: existing.device_instance_id });

    return {
      recovered: true,
      unlocked: true,
      vaultId: existing.vault_id,
      deviceId: existing.device_id,
      deviceInstanceId: existing.device_instance_id,
      deviceLabel: existing.device_label,
      autoLockMinutes: existing.auto_lock_minutes
    };
  }

  async function changeLocalPin({ supabase, currentPin, newPin } = {}) {
    const userId = await currentUserId(supabase);
    const record = await getLocalRecord(userId);
    if (!record || record.phase !== READY_PHASE) {
      const error = new Error("Trusted Device lokal yang siap diperlukan untuk mengubah PIN.");
      error.code = "LOCAL_DEVICE_NOT_READY";
      throw error;
    }

    validatePin(currentPin);
    validatePin(newPin);
    assertNotThrottled(record);

    // PIN tetap faktor lokal per-device, tetapi perubahan hanya diizinkan bila server
    // masih menganggap device ini trusted. Tidak ada PIN yang dikirim ke RPC ini.
    const material = await rpc(supabase, "security_local_unlock_material_v1", {
      p_device_client_id: record.device_instance_id
    });
    if (!material || !material.found || material.trust_state !== "trusted") {
      lock(userId, "device-not-trusted");
      const error = new Error("Trusted Device ini sudah tidak aktif atau telah dicabut.");
      error.code = "DEVICE_NOT_TRUSTED";
      throw error;
    }

    record.vault_id = material.vault_id || record.vault_id;
    record.device_id = material.device_id || record.device_id;
    record.cached_device_key_envelope = null;

    let updated;
    try {
      updated = await rewrapLocalPin({ userId, currentPin, newPin, record });
    } catch (error) {
      if (error && error.code === "LOCAL_UNLOCK_FAILED") {
        const throttle = await noteUnlockFailure(record);
        error.failedAttempts = throttle.attempts;
        error.retryAfterMs = throttle.retryAfterMs;
      }
      throw error;
    }

    await putLocalRecord(updated);
    lock(userId, "pin-changed");
    if (updated.device_id) {
      rpc(supabase, "security_touch_device_v1", { p_device_id: updated.device_id }).catch(() => {});
    }

    return {
      changed: true,
      userId,
      deviceId: updated.device_id,
      deviceInstanceId: updated.device_instance_id,
      deviceLabel: updated.device_label,
      changedAt: updated.pin_changed_at,
      unlocked: false
    };
  }

  async function localDeviceStatus({ supabase } = {}) {
    const userId = await currentUserId(supabase);
    let record = await getLocalRecord(userId);
    if (record && record.phase === READY_PHASE && record.cached_device_key_envelope) {
      record = { ...record, cached_device_key_envelope: null };
      await putLocalRecord(record);
    }
    return {
      userId,
      present: Boolean(record),
      ready: Boolean(record && record.phase === READY_PHASE),
      phase: record ? record.phase : null,
      deviceId: record ? record.device_id : null,
      deviceInstanceId: record ? record.device_instance_id : null,
      deviceLabel: record ? record.device_label : null,
      unlocked: isUnlocked(userId),
      autoLockMinutes: record ? record.auto_lock_minutes : null,
      failedAttempts: record ? Number(record.failed_attempts || 0) : 0,
      retryAfterMs: record && Number(record.locked_until_ms || 0) > Date.now()
        ? Number(record.locked_until_ms) - Date.now()
        : 0
    };
  }

  async function listDevices({ supabase } = {}) {
    const userId = await currentUserId(supabase);
    const record = await getLocalRecord(userId);
    const result = await rpc(supabase, "security_list_devices_v1", {
      p_current_device_client_id: record && record.phase === READY_PHASE ? record.device_instance_id : null
    });
    return result || { devices: [], trusted_device_count: 0 };
  }

  async function renameDevice({ supabase, deviceId, deviceLabel } = {}) {
    const userId = await currentUserId(supabase);
    const record = await getLocalRecord(userId);
    if (!record || record.phase !== READY_PHASE) throw new Error("Trusted Device aktif diperlukan untuk mengubah nama perangkat.");
    const label = validateDeviceLabel(deviceLabel);
    const result = await rpc(supabase, "security_rename_device_v1", {
      p_device_id: deviceId,
      p_device_label: label,
      p_actor_device_client_id: record.device_instance_id
    });
    if (result?.renamed && result.device_id === record.device_id) {
      record.device_label = result.device_label || label;
      await putLocalRecord(record);
    }
    return result;
  }

  async function revokeDevice({ supabase, deviceId, masterProofSha256 } = {}) {
    const userId = await currentUserId(supabase);
    const record = await getLocalRecord(userId);
    if (!record || record.phase !== READY_PHASE) throw new Error("Trusted Device aktif diperlukan untuk mencabut perangkat.");
    const proof = String(masterProofSha256 || "");
    if (!/^[A-Za-z0-9_-]{43}$/.test(proof)) throw new Error("Master proof perangkat tidak valid.");
    const result = await rpc(supabase, "security_revoke_device_v1", {
      p_device_id: deviceId,
      p_actor_device_client_id: record.device_instance_id,
      p_master_proof_sha256: proof
    });
    if (result?.revoked && result.device_id === record.device_id) {
      await purgeRevokedLocalDevice(userId, "self-revoked");
    }
    return result;
  }

  async function updateAutoLock({ supabase, minutes } = {}) {
    const userId = await currentUserId(supabase);
    const record = await getLocalRecord(userId);
    if (!record) throw new Error("Trusted Device lokal tidak ditemukan.");
    record.auto_lock_minutes = normalizeAutoLockMinutes(minutes);
    await putLocalRecord(record);
    const session = runtime.get(userId);
    if (session) {
      session.autoLockMinutes = record.auto_lock_minutes;
      touchActivity(userId);
    }
    return record.auto_lock_minutes;
  }

  function suggestDeviceLabel() {
    if (typeof navigator === "undefined") return "Perangkat ini";
    const platform = navigator.userAgentData && navigator.userAgentData.platform
      ? navigator.userAgentData.platform
      : navigator.platform;
    return platform ? `Perangkat ${String(platform).slice(0, 80)}` : "Perangkat ini";
  }

  const api = {
    VERSION,
    BUILD,
    DEVICE_ALGORITHM,
    PIN_KDF,
    PIN_ITERATIONS,
    DEFAULT_AUTO_LOCK_MINUTES,
    STATE_EVENT,
    validatePin,
    checkCapabilities,
    suggestDeviceLabel,
    setupFirstVault,
    unlockWithPin,
    withExtractableMasterKeyFromPin,
    recoverDeviceWithMaster,
    changeLocalPin,
    localDeviceStatus,
    revalidateCurrentDevice,
    listDevices,
    renameDevice,
    revokeDevice,
    updateAutoLock,
    isUnlocked,
    touchActivity,
    withMasterKey,
    withDeviceIdentityPrivateKey,
    lock,
    lockAll
  };

  // Local Node self-tests only. Not documented as production API.
  if (typeof module !== "undefined" && module.exports) {
    api.__test = Object.freeze({
      derivePinKek,
      generateDeviceIdentity,
      publicKeyFingerprint,
      createBootstrapBundle,
      createDeviceBundleForMaster,
      unlockFromRecord,
      rewrapLocalPin,
      throttleDelayMs,
      masterWrapContext,
      sanitizeRecordForPersistence
    });
    module.exports = Object.freeze(api);
  }

  root.RuangKithaTrustedDevice = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : window);
