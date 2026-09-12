/* RuangKitha v2.0.0a50 — Encrypted Documents Storage Service V1 */
(function initRuangKithaDocumentsService(root) {
  "use strict";

  const BUILD = "v2.0.0a50";
  const BUCKET = "ruangkitha-documents-v1";

  function deps() {
    const client = root.supabaseClient;
    const Trusted = root.RuangKithaTrustedDevice;
    const DocCrypto = root.RuangKithaDocumentsCrypto;
    const Crypto = root.RuangKithaCrypto;
    if (!client) throw new Error("Supabase client belum tersedia.");
    if (!Trusted || !DocCrypto || !Crypto) throw new Error("Security Foundation dokumen belum dimuat lengkap.");
    return { client, Trusted, DocCrypto, Crypto };
  }

  async function rpc(client, name, params = {}) {
    const { data, error } = await client.rpc(name, params);
    if (error) {
      const err = new Error(error.message || `RPC ${name} gagal.`);
      err.code = error.code || "SUPABASE_RPC_ERROR";
      err.details = error.details || null;
      throw err;
    }
    return data;
  }

  async function context({ requireUnlocked = false } = {}) {
    const { client, Trusted } = deps();
    const status = await Trusted.localDeviceStatus({ supabase: client });
    if (!status.ready || !status.deviceInstanceId) {
      const error = new Error("Trusted Device diperlukan untuk Dokumen terenkripsi.");
      error.code = "TRUSTED_DEVICE_REQUIRED";
      throw error;
    }
    if (requireUnlocked && !status.unlocked) {
      const error = new Error("Security Vault sedang terkunci.");
      error.code = "VAULT_LOCKED";
      throw error;
    }
    return { client, Trusted, status };
  }

  async function preflight() {
    const { client, status } = await context({ requireUnlocked: false });
    return rpc(client, "documents_preflight_v1", {
      p_device_client_id: status.deviceInstanceId
    });
  }

  async function unlock(pin) {
    const { client, Trusted } = deps();
    return Trusted.unlockWithPin({ supabase: client, pin });
  }

  async function localStatus() {
    const { client, Trusted } = deps();
    return Trusted.localDeviceStatus({ supabase: client });
  }

  async function listEncrypted() {
    const { client, status } = await context({ requireUnlocked: false });
    // Reconcile an upload whose commit response may have been lost after the Storage object
    // was already accepted. This avoids deleting good ciphertext after ambiguous networks.
    try {
      await rpc(client, "documents_reconcile_pending_v1", {
        p_device_client_id: status.deviceInstanceId
      });
    } catch (_) {}
    const result = await rpc(client, "documents_list_v1", {
      p_device_client_id: status.deviceInstanceId
    });
    return Array.isArray(result?.documents) ? result.documents : [];
  }

  async function listReadable() {
    const { Trusted, status } = await context({ requireUnlocked: true });
    const rows = await listEncrypted();
    return Trusted.withMasterKey(status.userId, async (masterKey) => {
      const { DocCrypto } = deps();
      const output = [];
      for (const row of rows) {
        try {
          const metadata = await DocCrypto.decryptMetadata({
            masterKey,
            documentId: row.document_id,
            metadataEnvelope: row.encrypted_metadata,
            keyEnvelope: row.document_key_envelope,
            metadataRevision: Number(row.metadata_revision || 1)
          });
          output.push({ ...row, metadata, decryptError: null });
        } catch (error) {
          output.push({ ...row, metadata: null, decryptError: error?.message || "Metadata tidak dapat dibuka." });
        }
      }
      return output;
    });
  }

  function newDocumentId() {
    if (!root.crypto || typeof root.crypto.randomUUID !== "function") {
      throw new Error("crypto.randomUUID() diperlukan untuk membuat Document ID.");
    }
    return root.crypto.randomUUID();
  }

  async function uploadFile(file, { onStage = null } = {}) {
    if (!file || typeof file.arrayBuffer !== "function") throw new TypeError("File browser diperlukan.");
    const { client, Trusted, status } = await context({ requireUnlocked: true });
    const { DocCrypto, Crypto } = deps();
    if (file.size < 1) throw new Error("File kosong tidak dapat disimpan.");
    if (file.size > DocCrypto.MAX_FILE_BYTES) throw new Error("Ukuran file maksimal 24 MiB pada Storage Foundation V1.");

    const readiness = await preflight();
    if (!readiness?.trusted_device) {
      const error = new Error("Trusted Device tidak aktif.");
      error.code = "TRUSTED_DEVICE_REQUIRED";
      throw error;
    }
    if (!readiness?.recovery_ready) {
      const error = new Error("Aktifkan Recovery Kit sebelum menyimpan dokumen terenkripsi.");
      error.code = "RECOVERY_KIT_REQUIRED";
      throw error;
    }

    const documentId = newDocumentId();
    const storagePath = DocCrypto.buildStoragePath(status.userId, documentId);
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    let sealed = null;
    let prepared = false;
    let uploaded = false;

    try {
      onStage?.("encrypting");
      sealed = await Trusted.withMasterKey(status.userId, (masterKey) => DocCrypto.sealDocument({
        masterKey,
        documentId,
        fileBytes,
        metadata: {
          name: file.name || "Dokumen",
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          lastModified: file.lastModified || null
        }
      }));

      onStage?.("preparing");
      await rpc(client, "documents_prepare_upload_v1", {
        p_document_id: documentId,
        p_device_client_id: status.deviceInstanceId,
        p_storage_path: storagePath,
        p_ciphertext_bytes: sealed.ciphertextBytes,
        p_ciphertext_sha256: sealed.ciphertextSha256,
        p_encrypted_metadata: sealed.metadataEnvelope,
        p_document_key_envelope: sealed.keyEnvelope,
        p_content_revision: sealed.contentRevision,
        p_metadata_revision: sealed.metadataRevision
      });
      prepared = true;

      onStage?.("uploading");
      const encryptedBlob = new Blob([sealed.encryptedFile], { type: "application/octet-stream" });
      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(storagePath, encryptedBlob, {
          cacheControl: "0",
          contentType: "application/octet-stream",
          upsert: false
        });
      if (uploadError) throw new Error(uploadError.message || "Upload ciphertext gagal.");
      uploaded = true;

      onStage?.("committing");
      const committed = await rpc(client, "documents_commit_upload_v1", {
        p_document_id: documentId,
        p_device_client_id: status.deviceInstanceId
      });

      onStage?.("done");
      return { ...committed, documentId, storagePath };
    } catch (error) {
      if (uploaded && prepared) {
        // Commit responses can be ambiguous on unstable networks. Ask the server to reconcile
        // pending rows against Storage before treating the upload as failed.
        try {
          await rpc(client, "documents_reconcile_pending_v1", {
            p_device_client_id: status.deviceInstanceId
          });
          const reconciled = await rpc(client, "documents_get_v1", {
            p_document_id: documentId,
            p_device_client_id: status.deviceInstanceId
          });
          if (reconciled?.document_id && reconciled.status === "ready") {
            onStage?.("done");
            return { committed: true, reconciled: true, documentId, storagePath };
          }
        } catch (_) {}
      }
      if (uploaded) {
        try { await client.storage.from(BUCKET).remove([storagePath]); } catch (_) {}
      }
      if (prepared) {
        try {
          await rpc(client, "documents_cancel_upload_v1", {
            p_document_id: documentId,
            p_device_client_id: status.deviceInstanceId
          });
        } catch (_) {}
      }
      throw error;
    } finally {
      Crypto.zeroize(fileBytes);
      if (sealed?.encryptedFile) Crypto.zeroize(sealed.encryptedFile);
    }
  }

  async function getEncrypted(documentId) {
    const { client, status } = await context({ requireUnlocked: false });
    const result = await rpc(client, "documents_get_v1", {
      p_document_id: documentId,
      p_device_client_id: status.deviceInstanceId
    });
    if (!result || result.found === false || !result.document_id) {
      const error = new Error("Dokumen tidak ditemukan atau akses sudah dicabut.");
      error.code = "DOCUMENT_NOT_FOUND";
      throw error;
    }
    return result;
  }

  async function downloadDecrypted(documentId) {
    const { client, Trusted, status } = await context({ requireUnlocked: true });
    const { DocCrypto, Crypto } = deps();
    const row = await getEncrypted(documentId);
    const { data, error } = await client.storage.from(row.storage_bucket || BUCKET).download(row.storage_path);
    if (error || !data) throw new Error(error?.message || "Ciphertext dokumen gagal diunduh.");
    const encrypted = new Uint8Array(await data.arrayBuffer());
    try {
      return await Trusted.withMasterKey(status.userId, (masterKey) => DocCrypto.openDocument({
        masterKey,
        documentId: row.document_id,
        encryptedFile: encrypted,
        metadataEnvelope: row.encrypted_metadata,
        keyEnvelope: row.document_key_envelope,
        ciphertextSha256: row.ciphertext_sha256,
        contentRevision: Number(row.content_revision || 1),
        metadataRevision: Number(row.metadata_revision || 1)
      }));
    } finally {
      Crypto.zeroize(encrypted);
    }
  }

  async function downloadToBrowser(documentId) {
    const result = await downloadDecrypted(documentId);
    const mime = String(result.metadata?.mime_type || "application/octet-stream");
    const name = String(result.metadata?.name || "dokumen").replace(/[\\/:*?"<>|]+/g, "_");
    const blob = new Blob([result.bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      deps().Crypto.zeroize(result.bytes);
    }
    return { downloaded: true, name, mime };
  }

  const api = Object.freeze({
    BUILD,
    BUCKET,
    preflight,
    localStatus,
    unlock,
    listEncrypted,
    listReadable,
    uploadFile,
    getEncrypted,
    downloadDecrypted,
    downloadToBrowser
  });

  root.RuangKithaDocumentsService = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
