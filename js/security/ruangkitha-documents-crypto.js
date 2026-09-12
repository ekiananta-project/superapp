/*
 * RuangKitha v2.0.0a50b — Encrypted Attachments + Family Key Distribution Crypto V1 (a50-compatible)
 *
 * SECURITY CONTRACT
 * - File bytes and sensitive metadata are encrypted on-device before upload.
 * - Every document receives a random AES-256-GCM Document Key.
 * - The Document Key is wrapped by the already-unlocked non-extractable User Master Key.
 * - Plaintext filename, MIME type, document bytes, and Document Key never go to Supabase.
 * - This V1 intentionally caps plaintext files at 24 MiB and uses one-shot AES-GCM.
 *   A future large-file layer can introduce chunking without changing the Master Key model.
 */
(function initRuangKithaDocumentsCrypto(root) {
  "use strict";

  const Crypto = root.RuangKithaCrypto || (typeof require === "function" ? require("./ruangkitha-crypto-core.js") : null);
  if (!Crypto) throw new Error("RuangKithaCrypto wajib dimuat sebelum Documents Crypto.");
  const webcrypto = root.crypto;
  const subtle = webcrypto && webcrypto.subtle;
  if (!subtle) throw new Error("Web Crypto diperlukan untuk Documents Crypto.");

  const VERSION = 1;
  const BUILD = "v2.0.0a50a";
  const SHARE_BUILD = "v2.0.0a50b";
  const LEGACY_BUILD = "v2.0.0a50";
  const RECORD_BUILD = "v2.0.0a50a";
  const SHARE_SUITE = "RK-DOCSHARE1-ECDH-P256-HKDF-SHA256-A256GCM";
  const SHARE_KDF_INFO = "RuangKitha Documents Family Share V1";
  const FORMAT_MAGIC = "RKD1";
  const FORMAT_VERSION = 1;
  const HEADER_BYTES = 12;
  const MAX_FILE_BYTES = 24 * 1024 * 1024;

  function asBytes(value, label = "bytes") {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new TypeError(`${label} harus berupa bytes.`);
  }

  function cleanUuid(value, label = "UUID") {
    const text = String(value || "").trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text)) {
      throw new Error(`${label} tidak valid.`);
    }
    return text;
  }

  function buildFileAad(documentId, contentRevision = 1) {
    return Crypto.buildAad(["document-file", cleanUuid(documentId, "Document ID"), String(contentRevision)]);
  }

  function buildMetadataAad(documentId, metadataRevision = 1) {
    return Crypto.buildAad(["document-metadata", cleanUuid(documentId, "Document ID"), String(metadataRevision)]);
  }

  function buildKeyContext(documentId) {
    return `document-key-v1:${cleanUuid(documentId, "Document ID")}`;
  }

  function buildStoragePath(userId, documentId) {
    return `${cleanUuid(userId, "User ID")}/${cleanUuid(documentId, "Document ID")}/content-v1.rkd`;
  }

  function packFileEnvelope(envelope) {
    if (!envelope || envelope.v !== Crypto.VERSION || envelope.alg !== "A256GCM") {
      throw new Error("File envelope tidak didukung.");
    }
    const iv = Crypto.base64UrlToBytes(envelope.iv);
    const cipher = Crypto.base64UrlToBytes(envelope.ciphertext);
    if (iv.byteLength !== Crypto.constants.GCM_IV_BYTES) throw new Error("IV file tidak valid.");
    if (cipher.byteLength < 16 || cipher.byteLength > MAX_FILE_BYTES + 64) throw new Error("Ukuran ciphertext file tidak valid.");

    const out = new Uint8Array(HEADER_BYTES + iv.byteLength + cipher.byteLength);
    out[0] = FORMAT_MAGIC.charCodeAt(0);
    out[1] = FORMAT_MAGIC.charCodeAt(1);
    out[2] = FORMAT_MAGIC.charCodeAt(2);
    out[3] = FORMAT_MAGIC.charCodeAt(3);
    out[4] = FORMAT_VERSION;
    out[5] = iv.byteLength;
    const view = new DataView(out.buffer);
    view.setUint16(6, Number(envelope.tag_bits || Crypto.constants.GCM_TAG_BITS), false);
    view.setUint32(8, cipher.byteLength, false);
    out.set(iv, HEADER_BYTES);
    out.set(cipher, HEADER_BYTES + iv.byteLength);
    return out;
  }

  function unpackFileEnvelope(value) {
    const bytes = asBytes(value, "encrypted file");
    if (bytes.byteLength < HEADER_BYTES + 12 + 16) throw new Error("Container dokumen terlalu pendek.");
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== FORMAT_MAGIC || bytes[4] !== FORMAT_VERSION) throw new Error("Format dokumen terenkripsi tidak didukung.");
    const ivLength = bytes[5];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tagBits = view.getUint16(6, false);
    const cipherLength = view.getUint32(8, false);
    if (ivLength !== Crypto.constants.GCM_IV_BYTES || tagBits !== Crypto.constants.GCM_TAG_BITS) {
      throw new Error("Parameter AES-GCM dokumen tidak valid.");
    }
    if (HEADER_BYTES + ivLength + cipherLength !== bytes.byteLength) throw new Error("Panjang container dokumen tidak konsisten.");
    const iv = bytes.slice(HEADER_BYTES, HEADER_BYTES + ivLength);
    const cipher = bytes.slice(HEADER_BYTES + ivLength);
    return {
      v: Crypto.VERSION,
      alg: "A256GCM",
      iv: Crypto.bytesToBase64Url(iv),
      tag_bits: tagBits,
      ciphertext: Crypto.bytesToBase64Url(cipher)
    };
  }

  async function sha256Base64Url(bytes) {
    const digest = await Crypto.sha256(asBytes(bytes));
    try {
      return Crypto.bytesToBase64Url(digest);
    } finally {
      Crypto.zeroize(digest);
    }
  }

  function normalizeMetadata(documentId, metadata, { contentRevision = 1, metadataRevision = 1 } = {}) {
    const source = metadata && typeof metadata === "object" ? metadata : {};
    const name = String(source.name || "Dokumen").trim().slice(0, 255) || "Dokumen";
    const mimeType = String(source.mimeType || source.type || "application/octet-stream").trim().slice(0, 180) || "application/octet-stream";
    const size = Number(source.size || 0);
    if (!Number.isFinite(size) || size < 0 || size > MAX_FILE_BYTES) throw new Error("Ukuran dokumen tidak valid.");
    return {
      schema_version: 1,
      document_id: cleanUuid(documentId, "Document ID"),
      name,
      mime_type: mimeType,
      size,
      last_modified: Number.isFinite(Number(source.lastModified)) ? Number(source.lastModified) : null,
      content_revision: Number(contentRevision),
      metadata_revision: Number(metadataRevision),
      encrypted_at: new Date().toISOString()
    };
  }

  async function sealDocument({ masterKey, documentId, fileBytes, metadata, contentRevision = 1, metadataRevision = 1 } = {}) {
    if (!masterKey || masterKey.type !== "secret" || masterKey.extractable !== false) {
      throw new Error("Runtime Master Key non-extractable diperlukan.");
    }
    const docId = cleanUuid(documentId, "Document ID");
    const plain = asBytes(fileBytes, "fileBytes");
    if (plain.byteLength < 1) throw new Error("Dokumen kosong tidak didukung pada V1.");
    if (plain.byteLength > MAX_FILE_BYTES) throw new Error("Dokumen melebihi batas 24 MiB untuk Storage Foundation V1.");

    const safeMetadata = normalizeMetadata(docId, { ...(metadata || {}), size: plain.byteLength }, { contentRevision, metadataRevision });
    const documentKey = await Crypto.generateAesKey({ extractable: true });
    const fileEnvelope = await Crypto.encryptBytes(documentKey, plain, { aad: buildFileAad(docId, contentRevision) });
    const encryptedFile = packFileEnvelope(fileEnvelope);
    const metadataEnvelope = await Crypto.encryptJson(documentKey, safeMetadata, { aad: buildMetadataAad(docId, metadataRevision) });
    const keyEnvelope = await Crypto.wrapAesKey(masterKey, documentKey, { context: buildKeyContext(docId) });
    const ciphertextSha256 = await sha256Base64Url(encryptedFile);

    return {
      documentId: docId,
      encryptedFile,
      metadataEnvelope,
      keyEnvelope,
      ciphertextSha256,
      ciphertextBytes: encryptedFile.byteLength,
      plaintextBytes: plain.byteLength,
      contentRevision: Number(contentRevision),
      metadataRevision: Number(metadataRevision)
    };
  }

  async function decryptMetadata({ masterKey, documentId, metadataEnvelope, keyEnvelope, metadataRevision = 1 } = {}) {
    if (!masterKey || masterKey.type !== "secret") throw new Error("Master Key diperlukan.");
    const docId = cleanUuid(documentId, "Document ID");
    const documentKey = await Crypto.unwrapAesKey(masterKey, keyEnvelope, {
      context: buildKeyContext(docId),
      extractable: false
    });
    const metadata = await Crypto.decryptJson(documentKey, metadataEnvelope, {
      aad: buildMetadataAad(docId, metadataRevision)
    });
    if (!metadata || metadata.document_id !== docId) throw new Error("Metadata dokumen tidak cocok dengan Document ID.");
    return metadata;
  }

  async function openDocument({ masterKey, documentId, encryptedFile, metadataEnvelope, keyEnvelope, ciphertextSha256 = null, contentRevision = 1, metadataRevision = 1 } = {}) {
    if (!masterKey || masterKey.type !== "secret") throw new Error("Master Key diperlukan.");
    const docId = cleanUuid(documentId, "Document ID");
    const packed = asBytes(encryptedFile, "encryptedFile");
    if (ciphertextSha256) {
      const actual = await sha256Base64Url(packed);
      if (actual !== ciphertextSha256) throw new Error("Hash ciphertext dokumen tidak cocok.");
    }
    const documentKey = await Crypto.unwrapAesKey(masterKey, keyEnvelope, {
      context: buildKeyContext(docId),
      extractable: false
    });
    const metadata = await Crypto.decryptJson(documentKey, metadataEnvelope, {
      aad: buildMetadataAad(docId, metadataRevision)
    });
    if (!metadata || metadata.document_id !== docId) throw new Error("Metadata dokumen tidak cocok dengan Document ID.");
    const fileEnvelope = unpackFileEnvelope(packed);
    const bytes = await Crypto.decryptBytes(documentKey, fileEnvelope, {
      aad: buildFileAad(docId, contentRevision)
    });
    if (Number(metadata.size) !== bytes.byteLength) {
      Crypto.zeroize(bytes);
      throw new Error("Ukuran plaintext dokumen tidak cocok dengan metadata terenkripsi.");
    }
    return { metadata, bytes };
  }


  function buildAttachmentStoragePath(userId, documentId, attachmentId) {
    return `${cleanUuid(userId, "User ID")}/${cleanUuid(documentId, "Document ID")}/${cleanUuid(attachmentId, "Attachment ID")}/content-v1.rkd`;
  }

  async function sealAttachment({ masterKey, attachmentId, fileBytes, metadata, contentRevision = 1, metadataRevision = 1 } = {}) {
    const result = await sealDocument({
      masterKey,
      documentId: attachmentId,
      fileBytes,
      metadata,
      contentRevision,
      metadataRevision
    });
    return { ...result, attachmentId: result.documentId };
  }

  async function decryptAttachmentMetadata({ masterKey, attachmentId, metadataEnvelope, keyEnvelope, metadataRevision = 1 } = {}) {
    return decryptMetadata({
      masterKey,
      documentId: attachmentId,
      metadataEnvelope,
      keyEnvelope,
      metadataRevision
    });
  }

  async function openAttachment({ masterKey, attachmentId, encryptedFile, metadataEnvelope, keyEnvelope, ciphertextSha256 = null, contentRevision = 1, metadataRevision = 1 } = {}) {
    return openDocument({
      masterKey,
      documentId: attachmentId,
      encryptedFile,
      metadataEnvelope,
      keyEnvelope,
      ciphertextSha256,
      contentRevision,
      metadataRevision
    });
  }



  function canonicalPublicJwk(jwk) {
    if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) {
      throw new Error("Public key perangkat penerima tidak valid.");
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

  function shareTransferContext(attachmentId, granteeUserId, recipientDeviceFingerprint) {
    return `document-share-transfer-v1:${cleanUuid(attachmentId, "Attachment ID")}:${cleanUuid(granteeUserId, "Grantee User ID")}:${String(recipientDeviceFingerprint || "").trim()}`;
  }

  function shareKdfInfo(attachmentId, granteeUserId, recipientDeviceFingerprint) {
    return Crypto.utf8(`${SHARE_KDF_INFO}|${cleanUuid(attachmentId, "Attachment ID")}|${cleanUuid(granteeUserId, "Grantee User ID")}|${String(recipientDeviceFingerprint || "").trim()}`);
  }

  async function importEcdhPublicKey(jwk) {
    canonicalPublicJwk(jwk);
    return subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );
  }

  async function deriveShareKek(privateKey, publicKey, saltBytes, infoBytes) {
    if (!privateKey || privateKey.type !== "private" || privateKey.algorithm?.name !== "ECDH") {
      throw new Error("Private key ECDH perangkat tidak valid.");
    }
    const bits = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256));
    try {
      const material = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
      return subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: saltBytes, info: infoBytes },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    } finally {
      Crypto.zeroize(bits);
    }
  }

  async function unwrapAttachmentKey({ masterKey, attachmentId, keyEnvelope, extractable = true } = {}) {
    if (!masterKey || masterKey.type !== "secret") throw new Error("Master Key diperlukan.");
    return Crypto.unwrapAesKey(masterKey, keyEnvelope, {
      context: buildKeyContext(attachmentId),
      extractable: Boolean(extractable)
    });
  }

  async function wrapAttachmentKey({ masterKey, attachmentId, attachmentKey } = {}) {
    if (!masterKey || masterKey.type !== "secret") throw new Error("Master Key diperlukan.");
    if (!attachmentKey || attachmentKey.type !== "secret" || attachmentKey.extractable !== true) {
      throw new Error("Attachment Key sementara harus extractable untuk key distribution.");
    }
    return Crypto.wrapAesKey(masterKey, attachmentKey, { context: buildKeyContext(attachmentId) });
  }

  async function createAttachmentShareTransfer({ attachmentKey, attachmentId, granteeUserId, recipientPublicJwk, recipientDeviceFingerprint } = {}) {
    if (!attachmentKey || attachmentKey.type !== "secret" || attachmentKey.extractable !== true) {
      throw new Error("Attachment Key extractable diperlukan untuk membuat share transfer.");
    }
    const attachment = cleanUuid(attachmentId, "Attachment ID");
    const grantee = cleanUuid(granteeUserId, "Grantee User ID");
    const expectedFingerprint = String(recipientDeviceFingerprint || "").trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(expectedFingerprint)) throw new Error("Fingerprint perangkat penerima tidak valid.");
    const actualFingerprint = await publicKeyFingerprint(recipientPublicJwk);
    if (actualFingerprint !== expectedFingerprint) throw new Error("Public key perangkat penerima tidak cocok dengan fingerprint.");

    const recipientPublicKey = await importEcdhPublicKey(recipientPublicJwk);
    const ephemeral = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey", "deriveBits"]);
    const ephemeralPublicJwk = await subtle.exportKey("jwk", ephemeral.publicKey);
    const salt = Crypto.randomBytes(Crypto.constants.HKDF_SALT_BYTES);
    const info = shareKdfInfo(attachment, grantee, expectedFingerprint);
    try {
      const kek = await deriveShareKek(ephemeral.privateKey, recipientPublicKey, salt, info);
      const context = shareTransferContext(attachment, grantee, expectedFingerprint);
      const wrapped = await Crypto.wrapAesKey(kek, attachmentKey, { context });
      return {
        v: 1,
        suite: SHARE_SUITE,
        kind: "attachment-share-transfer",
        attachment_id: attachment,
        grantee_user_id: grantee,
        recipient_device_fingerprint: expectedFingerprint,
        ephemeral_public_key: ephemeralPublicJwk,
        kdf: {
          name: "HKDF",
          hash: "SHA-256",
          salt: Crypto.bytesToBase64Url(salt),
          info: SHARE_KDF_INFO
        },
        wrapped
      };
    } finally {
      Crypto.zeroize(salt);
      Crypto.zeroize(info);
    }
  }

  async function openAttachmentShareTransfer({ recipientPrivateKey, attachmentId, granteeUserId, recipientDeviceFingerprint, transferEnvelope } = {}) {
    const attachment = cleanUuid(attachmentId, "Attachment ID");
    const grantee = cleanUuid(granteeUserId, "Grantee User ID");
    const fingerprint = String(recipientDeviceFingerprint || "").trim();
    const env = transferEnvelope;
    if (!env || env.v !== 1 || env.suite !== SHARE_SUITE || env.kind !== "attachment-share-transfer") {
      throw new Error("Share transfer lampiran tidak didukung.");
    }
    if (env.attachment_id !== attachment || env.grantee_user_id !== grantee || env.recipient_device_fingerprint !== fingerprint) {
      throw new Error("Share transfer tidak terikat ke lampiran/perangkat ini.");
    }
    if (!env.kdf || env.kdf.name !== "HKDF" || env.kdf.hash !== "SHA-256" || env.kdf.info !== SHARE_KDF_INFO) {
      throw new Error("KDF share transfer tidak valid.");
    }
    const ephemeralPublicKey = await importEcdhPublicKey(env.ephemeral_public_key);
    const salt = Crypto.base64UrlToBytes(env.kdf.salt);
    const info = shareKdfInfo(attachment, grantee, fingerprint);
    try {
      const kek = await deriveShareKek(recipientPrivateKey, ephemeralPublicKey, salt, info);
      return Crypto.unwrapAesKey(kek, env.wrapped, {
        context: shareTransferContext(attachment, grantee, fingerprint),
        extractable: true
      });
    } finally {
      Crypto.zeroize(salt);
      Crypto.zeroize(info);
    }
  }
  const api = Object.freeze({
    VERSION,
    BUILD,
    LEGACY_BUILD,
    RECORD_BUILD,
    SHARE_BUILD,
    SHARE_SUITE,
    FORMAT_MAGIC,
    FORMAT_VERSION,
    MAX_FILE_BYTES,
    buildFileAad,
    buildMetadataAad,
    buildKeyContext,
    buildStoragePath,
    buildAttachmentStoragePath,
    packFileEnvelope,
    unpackFileEnvelope,
    sha256Base64Url,
    sealDocument,
    decryptMetadata,
    openDocument,
    sealAttachment,
    decryptAttachmentMetadata,
    openAttachment,
    unwrapAttachmentKey,
    wrapAttachmentKey,
    createAttachmentShareTransfer,
    openAttachmentShareTransfer
  });

  root.RuangKithaDocumentsCrypto = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
