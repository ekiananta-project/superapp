/* RuangKitha v2.0.0a50e — Documents Service + Reminder Integration V1 */
(function initRuangKithaDocumentsService(root) {
  "use strict";

  const BUILD = "v2.0.0a50e";
  const RECORD_BUILD = "v2.0.0a50a";
  const BUCKET = "ruangkitha-documents-v1";
  const LEGACY_BUILD = "v2.0.0a50";

  function clientOnly() {
    const client = root.supabaseClient;
    if (!client) throw new Error("Supabase client belum tersedia.");
    return client;
  }

  function securityDeps() {
    const client = clientOnly();
    const Trusted = root.RuangKithaTrustedDevice;
    const Recovery = root.RuangKithaRecoveryKit;
    const DocCrypto = root.RuangKithaDocumentsCrypto;
    const Crypto = root.RuangKithaCrypto;
    if (!Trusted || !Recovery || !DocCrypto || !Crypto) {
      throw new Error("Security Foundation lampiran belum dimuat lengkap.");
    }
    return { client, Trusted, Recovery, DocCrypto, Crypto };
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

  function cleanText(value, max = 120) {
    return String(value ?? "").trim().slice(0, max);
  }

  function normalizeScope(value) {
    return String(value || "private").toLowerCase() === "family" ? "family" : "private";
  }

  function normalizeDate(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function normalizeReminder(value, expiresOn) {
    if (!expiresOn) return null;
    if (value === null || value === undefined || value === "") return null;
    const days = Number(value);
    return Number.isInteger(days) && days >= 1 && days <= 3650 ? days : null;
  }

  function newUuid(label = "ID") {
    if (!root.crypto || typeof root.crypto.randomUUID !== "function") {
      throw new Error(`crypto.randomUUID() diperlukan untuk membuat ${label}.`);
    }
    return root.crypto.randomUUID();
  }

  function notifyCatalogChanged() {
    try { root.RuangKithaDocumentReminders?.signalChanged?.(); } catch {}
    try {
      const task = root.RuangKithaDocumentReminders?.syncNotifications?.(24 * 30);
      if (task && typeof task.catch === "function") {
        task.catch(error => console.debug?.("[Documents reminder sync]", error));
      }
    } catch (error) {
      console.debug?.("[Documents reminder sync]", error);
    }
  }


  // ---------------------------------------------------------------------------
  // Catalog / reminder layer — intentionally does not require Vault unlock.
  // ---------------------------------------------------------------------------
  async function createRecord({
    documentId = null,
    familyId = null,
    scope = "private",
    displayName,
    documentType,
    expiresOn = null,
    reminderDays = null
  } = {}) {
    const client = clientOnly();
    const normalizedScope = normalizeScope(scope);
    const name = cleanText(displayName, 120);
    const type = cleanText(documentType, 80);
    const expiry = normalizeDate(expiresOn);
    if (!name) throw new Error("Nama dokumen wajib diisi.");
    if (!type) throw new Error("Jenis dokumen wajib diisi.");
    if (normalizedScope === "family" && !familyId) throw new Error("Keluarga aktif diperlukan.");
    const result = await rpc(client, "document_records_create_v1", {
      p_document_id: documentId || newUuid("Document ID"),
      p_family_id: normalizedScope === "family" ? familyId : null,
      p_scope: normalizedScope,
      p_display_name: name,
      p_document_type: type,
      p_expires_on: expiry,
      p_reminder_days: normalizeReminder(reminderDays, expiry)
    });
    notifyCatalogChanged();
    return result;
  }

  async function listRecords({ familyId = null, view = "personal" } = {}) {
    const client = clientOnly();
    const safeView = ["family", "personal", "attention"].includes(String(view)) ? String(view) : "personal";
    const result = await rpc(client, "document_records_list_v1", {
      p_family_id: familyId || null,
      p_view: safeView
    });
    return Array.isArray(result?.documents) ? result.documents : [];
  }

  async function getRecord(documentId, { familyId = null } = {}) {
    const client = clientOnly();
    const result = await rpc(client, "document_records_get_v1", {
      p_document_id: documentId,
      p_family_id: familyId || null
    });
    if (!result || result.found === false || !result.document_id) {
      const error = new Error("Dokumen tidak ditemukan.");
      error.code = "DOCUMENT_NOT_FOUND";
      throw error;
    }
    return result;
  }

  async function updateRecord(documentId, {
    familyId = null,
    scope = "private",
    displayName,
    documentType,
    expiresOn = null,
    reminderDays = null
  } = {}) {
    const client = clientOnly();
    const normalizedScope = normalizeScope(scope);
    const name = cleanText(displayName, 120);
    const type = cleanText(documentType, 80);
    const expiry = normalizeDate(expiresOn);
    if (!name) throw new Error("Nama dokumen wajib diisi.");
    if (!type) throw new Error("Jenis dokumen wajib diisi.");
    const result = await rpc(client, "document_records_update_v1", {
      p_document_id: documentId,
      p_family_id: normalizedScope === "family" ? familyId : null,
      p_scope: normalizedScope,
      p_display_name: name,
      p_document_type: type,
      p_expires_on: expiry,
      p_reminder_days: normalizeReminder(reminderDays, expiry)
    });
    notifyCatalogChanged();
    return result;
  }

  async function archiveRecord(documentId) {
    const client = clientOnly();
    const result = await rpc(client, "document_records_archive_v1", { p_document_id: documentId });
    notifyCatalogChanged();
    return result;
  }

  async function listArchivedRecords({ familyId = null } = {}) {
    const client = clientOnly();
    const result = await rpc(client, "document_records_archived_list_v1", {
      p_family_id: familyId || null
    });
    return Array.isArray(result?.documents) ? result.documents : [];
  }

  async function restoreRecord(documentId, { familyId = null } = {}) {
    const client = clientOnly();
    const result = await rpc(client, "document_records_restore_v1", {
      p_document_id: documentId,
      p_family_id: familyId || null
    });
    notifyCatalogChanged();
    return result;
  }

  async function deleteArchivedRecord(documentId, { hasAttachments = false } = {}) {
    if (!hasAttachments) {
      const client = clientOnly();
      const result = await rpc(client, "document_records_delete_empty_v1", { p_document_id: documentId });
      notifyCatalogChanged();
      return result;
    }

    const { client, status } = await secureContext({ requireUnlocked: true });
    const plan = await rpc(client, "document_records_delete_plan_v1", {
      p_document_id: documentId,
      p_device_client_id: status.deviceInstanceId
    });
    const attachments = Array.isArray(plan?.attachments) ? plan.attachments : [];
    const byBucket = new Map();
    for (const item of attachments) {
      const bucket = String(item?.storage_bucket || BUCKET);
      const storagePath = String(item?.storage_path || "").trim();
      if (!storagePath) continue;
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket).push(storagePath);
    }
    for (const [bucket, paths] of byBucket.entries()) {
      if (!paths.length) continue;
      const { error } = await client.storage.from(bucket).remove(paths);
      if (error) throw new Error(error.message || "Ciphertext lampiran gagal dihapus.");
    }
    const result = await rpc(client, "document_records_delete_finalize_v1", {
      p_document_id: documentId,
      p_device_client_id: status.deviceInstanceId
    });
    notifyCatalogChanged();
    return result;
  }

  // ---------------------------------------------------------------------------
  // Vault / attachment layer — PIN is contextual and only required here.
  // ---------------------------------------------------------------------------
  async function localStatus() {
    const { client, Trusted } = securityDeps();
    return Trusted.localDeviceStatus({ supabase: client });
  }

  async function secureContext({ requireUnlocked = false } = {}) {
    const { client, Trusted } = securityDeps();
    const status = await Trusted.localDeviceStatus({ supabase: client });
    if (!status.ready || !status.deviceInstanceId) {
      const error = new Error("Trusted Device diperlukan untuk lampiran terenkripsi.");
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
    const { client, status } = await secureContext({ requireUnlocked: false });
    return rpc(client, "documents_preflight_v1", {
      p_device_client_id: status.deviceInstanceId
    });
  }

  async function unlock(pin) {
    const { client, Trusted } = securityDeps();
    return Trusted.unlockWithPin({ supabase: client, pin });
  }

  async function ensureAttachmentReady() {
    const { client, Trusted, status } = await secureContext({ requireUnlocked: true });
    const readiness = await rpc(client, "documents_preflight_v1", {
      p_device_client_id: status.deviceInstanceId
    });
    if (!readiness?.trusted_device) {
      const error = new Error("Trusted Device tidak aktif.");
      error.code = "TRUSTED_DEVICE_REQUIRED";
      throw error;
    }
    if (!readiness?.recovery_ready) {
      const error = new Error("Aktifkan Recovery Kit sebelum menyimpan lampiran terenkripsi.");
      error.code = "RECOVERY_KIT_REQUIRED";
      throw error;
    }
    return { client, Trusted, status, readiness };
  }

  async function uploadAttachment(documentId, file, { familyId = null, onStage = null } = {}) {
    if (!file || typeof file.arrayBuffer !== "function") throw new TypeError("File browser diperlukan.");
    const { client, Trusted, status } = await ensureAttachmentReady();
    const { DocCrypto, Crypto } = securityDeps();
    if (file.size < 1) throw new Error("File kosong tidak dapat disimpan.");
    if (file.size > DocCrypto.MAX_FILE_BYTES) throw new Error("Ukuran file maksimal 24 MiB.");

    // Verify record visibility/ownership before crypto work.
    const record = await getRecord(documentId, { familyId });
    if (!record.can_edit) {
      const error = new Error("Lampiran baru hanya dapat ditambahkan oleh pemilik dokumen pada a50a.");
      error.code = "DOCUMENT_OWNER_REQUIRED";
      throw error;
    }

    const attachmentId = newUuid("Attachment ID");
    const storagePath = DocCrypto.buildAttachmentStoragePath(status.userId, documentId, attachmentId);
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    let sealed = null;
    let prepared = false;
    let uploaded = false;

    try {
      onStage?.("encrypting");
      sealed = await Trusted.withMasterKey(status.userId, (masterKey) => DocCrypto.sealAttachment({
        masterKey,
        attachmentId,
        fileBytes,
        metadata: {
          name: file.name || "Lampiran",
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          lastModified: file.lastModified || null
        }
      }));

      onStage?.("preparing");
      await rpc(client, "document_attachments_prepare_upload_v1", {
        p_document_id: documentId,
        p_attachment_id: attachmentId,
        p_device_client_id: status.deviceInstanceId,
        p_storage_path: storagePath,
        p_ciphertext_bytes: sealed.ciphertextBytes,
        p_ciphertext_sha256: sealed.ciphertextSha256,
        p_encrypted_metadata: sealed.metadataEnvelope,
        p_attachment_key_envelope: sealed.keyEnvelope,
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
      if (uploadError) throw new Error(uploadError.message || "Upload ciphertext lampiran gagal.");
      uploaded = true;

      onStage?.("committing");
      const committed = await rpc(client, "document_attachments_commit_upload_v1", {
        p_attachment_id: attachmentId,
        p_device_client_id: status.deviceInstanceId
      });

      let shareSyncWarning = null;
      if (record.scope === "family") {
        try {
          onStage?.("sharing");
          await syncActiveShares(documentId);
        } catch (shareError) {
          // The encrypted attachment itself is already safely committed. A sharing sync
          // failure must not roll back or delete the owner's ciphertext. The owner can
          // retry from Kelola akses later.
          shareSyncWarning = shareError?.message || "Akses keluarga perlu disinkronkan ulang.";
        }
      }
      onStage?.("done");
      return { ...committed, attachmentId, documentId, storagePath, shareSyncWarning };
    } catch (error) {
      if (uploaded && prepared) {
        try {
          await rpc(client, "document_attachments_reconcile_pending_v1", {
            p_device_client_id: status.deviceInstanceId
          });
          const reconciled = await rpc(client, "document_attachments_get_v1", {
            p_attachment_id: attachmentId,
            p_device_client_id: status.deviceInstanceId
          });
          if (reconciled?.attachment_id && reconciled.status === "ready") {
            onStage?.("done");
            return { committed: true, reconciled: true, attachmentId, documentId, storagePath };
          }
        } catch (_) {}
      }
      if (uploaded) {
        try { await client.storage.from(BUCKET).remove([storagePath]); } catch (_) {}
      }
      if (prepared) {
        try {
          await rpc(client, "document_attachments_cancel_upload_v1", {
            p_attachment_id: attachmentId,
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

  async function listAttachments(documentId, { familyId = null } = {}) {
    const { client, status } = await secureContext({ requireUnlocked: true });
    try {
      await rpc(client, "document_attachments_reconcile_pending_v1", {
        p_device_client_id: status.deviceInstanceId
      });
    } catch (_) {}
    const result = await rpc(client, "document_attachments_list_v1", {
      p_document_id: documentId,
      p_family_id: familyId || null,
      p_device_client_id: status.deviceInstanceId
    });
    return Array.isArray(result?.attachments) ? result.attachments : [];
  }

  async function listReadableAttachments(documentId, { familyId = null } = {}) {
    const { Trusted, status } = await secureContext({ requireUnlocked: true });
    // If this is the first open on a recipient account, convert one device-bound
    // ECDH transfer into the recipient's normal Master-Key envelope first.
    await acceptIncomingShares(documentId);
    const rows = await listAttachments(documentId, { familyId });
    const { DocCrypto } = securityDeps();
    return Trusted.withMasterKey(status.userId, async (masterKey) => {
      const output = [];
      for (const row of rows) {
        try {
          const metadata = await DocCrypto.decryptAttachmentMetadata({
            masterKey,
            attachmentId: row.attachment_id,
            metadataEnvelope: row.encrypted_metadata,
            keyEnvelope: row.attachment_key_envelope,
            metadataRevision: Number(row.metadata_revision || 1)
          });
          output.push({ ...row, metadata, decryptError: null });
        } catch (error) {
          output.push({ ...row, metadata: null, decryptError: error?.message || "Metadata lampiran tidak dapat dibuka." });
        }
      }
      return output;
    });
  }

  async function getAttachment(attachmentId) {
    const { client, status } = await secureContext({ requireUnlocked: true });
    const row = await rpc(client, "document_attachments_get_v1", {
      p_attachment_id: attachmentId,
      p_device_client_id: status.deviceInstanceId
    });
    if (!row || row.found === false || !row.attachment_id) {
      const error = new Error("Lampiran tidak ditemukan atau akses belum dibagikan.");
      error.code = "ATTACHMENT_NOT_FOUND";
      throw error;
    }
    return row;
  }

  async function downloadAttachment(attachmentId) {
    const { client, Trusted, status } = await secureContext({ requireUnlocked: true });
    const { DocCrypto, Crypto } = securityDeps();
    const row = await getAttachment(attachmentId);
    const { data, error } = await client.storage.from(row.storage_bucket || BUCKET).download(row.storage_path);
    if (error || !data) throw new Error(error?.message || "Ciphertext lampiran gagal diunduh.");
    const encrypted = new Uint8Array(await data.arrayBuffer());
    try {
      return await Trusted.withMasterKey(status.userId, (masterKey) => DocCrypto.openAttachment({
        masterKey,
        attachmentId: row.attachment_id,
        encryptedFile: encrypted,
        metadataEnvelope: row.encrypted_metadata,
        keyEnvelope: row.attachment_key_envelope,
        ciphertextSha256: row.ciphertext_sha256,
        contentRevision: Number(row.content_revision || 1),
        metadataRevision: Number(row.metadata_revision || 1)
      }));
    } finally {
      Crypto.zeroize(encrypted);
    }
  }

  async function downloadAttachmentToBrowser(attachmentId) {
    const result = await downloadAttachment(attachmentId);
    const mime = String(result.metadata?.mime_type || "application/octet-stream");
    const name = String(result.metadata?.name || "lampiran").replace(/[\\/:*?"<>|]+/g, "_");
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
      securityDeps().Crypto.zeroize(result.bytes);
    }
    return { downloaded: true, name, mime };
  }

  async function deleteAttachment(attachmentId) {
    const { client, status } = await secureContext({ requireUnlocked: true });
    const row = await getAttachment(attachmentId);
    if (row.owner_user_id !== status.userId) {
      const error = new Error("Hanya pemilik lampiran yang dapat menghapusnya.");
      error.code = "ATTACHMENT_OWNER_REQUIRED";
      throw error;
    }
    const { error } = await client.storage.from(row.storage_bucket || BUCKET).remove([row.storage_path]);
    if (error) throw new Error(error.message || "Ciphertext lampiran gagal dihapus.");
    return rpc(client, "document_attachments_mark_deleted_v1", {
      p_attachment_id: attachmentId,
      p_device_client_id: status.deviceInstanceId
    });
  }

  async function replaceAttachment(documentId, attachmentId, file, { familyId = null, onStage = null } = {}) {
    onStage?.("uploading-replacement");
    const uploaded = await uploadAttachment(documentId, file, { familyId, onStage });
    try {
      onStage?.("removing-old");
      await deleteAttachment(attachmentId);
      onStage?.("done");
      return { ...uploaded, replaced: true, replacedAttachmentId: attachmentId };
    } catch (error) {
      onStage?.("done");
      return {
        ...uploaded,
        replaced: false,
        replacedAttachmentId: attachmentId,
        replaceWarning: error?.message || "Lampiran baru tersimpan, tetapi lampiran lama belum dapat dihapus."
      };
    }
  }

  // ---------------------------------------------------------------------------
  // a50b Family Document Sharing / Key Distribution V1
  // ---------------------------------------------------------------------------
  async function listShareCandidates(familyId) {
    const client = clientOnly();
    if (!familyId) throw new Error("Keluarga aktif diperlukan.");
    const result = await rpc(client, "document_share_candidates_v1", {
      p_family_id: familyId
    });
    return Array.isArray(result?.members) ? result.members : [];
  }

  async function listShareTargets(documentId) {
    const client = clientOnly();
    const result = await rpc(client, "document_share_targets_v1", {
      p_document_id: documentId
    });
    return Array.isArray(result?.members) ? result.members : [];
  }

  async function sharePlan(documentId, granteeUserId) {
    const client = clientOnly();
    return rpc(client, "document_share_plan_v1", {
      p_document_id: documentId,
      p_grantee_user_id: granteeUserId
    });
  }

  async function buildShareTransfers(plan, status, Trusted, DocCrypto) {
    const devices = Array.isArray(plan?.trusted_devices) ? plan.trusted_devices : [];
    const attachments = Array.isArray(plan?.attachments_needing_transfer) ? plan.attachments_needing_transfer : [];
    if (!plan?.recovery_ready) {
      const error = new Error(`${plan?.display_name || "Anggota keluarga"} perlu mengaktifkan Recovery Kit sebelum menerima lampiran aman.`);
      error.code = "GRANTEE_RECOVERY_KIT_REQUIRED";
      throw error;
    }
    if (!devices.length) {
      const error = new Error(`${plan?.display_name || "Anggota keluarga"} belum memiliki Trusted Device yang siap menerima lampiran aman.`);
      error.code = "GRANTEE_TRUSTED_DEVICE_REQUIRED";
      throw error;
    }
    if (!attachments.length) return [];

    return Trusted.withMasterKey(status.userId, async (masterKey) => {
      const transfers = [];
      for (const attachment of attachments) {
        const attachmentKey = await DocCrypto.unwrapAttachmentKey({
          masterKey,
          attachmentId: attachment.attachment_id,
          keyEnvelope: attachment.owner_key_envelope,
          extractable: true
        });
        for (const device of devices) {
          const transferEnvelope = await DocCrypto.createAttachmentShareTransfer({
            attachmentKey,
            attachmentId: attachment.attachment_id,
            granteeUserId: plan.grantee_user_id,
            recipientPublicJwk: device.public_key,
            recipientDeviceFingerprint: device.public_key_fingerprint
          });
          transfers.push({
            attachment_id: attachment.attachment_id,
            grantee_device_id: device.device_id,
            grantee_device_fingerprint: device.public_key_fingerprint,
            transfer_envelope: transferEnvelope
          });
        }
      }
      return transfers;
    });
  }

  async function shareWithMember(documentId, granteeUserId, { onStage = null } = {}) {
    const { client, Trusted, status } = await secureContext({ requireUnlocked: true });
    const { DocCrypto } = securityDeps();
    onStage?.("planning");
    const plan = await sharePlan(documentId, granteeUserId);
    onStage?.("wrapping");
    const transfers = await buildShareTransfers(plan, status, Trusted, DocCrypto);
    onStage?.("committing");
    const result = await rpc(client, "document_share_commit_v1", {
      p_document_id: documentId,
      p_grantee_user_id: granteeUserId,
      p_transfers: transfers
    });
    onStage?.("done");
    return { ...result, transferCount: transfers.length };
  }

  async function revokeMemberShare(documentId, granteeUserId) {
    const { client } = await secureContext({ requireUnlocked: true });
    return rpc(client, "document_share_revoke_v1", {
      p_document_id: documentId,
      p_grantee_user_id: granteeUserId
    });
  }

  async function syncActiveShares(documentId) {
    const members = await listShareTargets(documentId);
    const active = members.filter((member) => member.share_active && Number(member.trusted_device_count || 0) > 0);
    const results = [];
    for (const member of active) {
      results.push(await shareWithMember(documentId, member.user_id));
    }
    return { synced: results.length, results };
  }

  async function pendingIncomingShares(documentId, { masterProofSha256 = null } = {}) {
    const { client, status } = await secureContext({ requireUnlocked: true });
    const { Recovery } = securityDeps();
    const proof = masterProofSha256 || await Recovery.masterProofFromUnlocked({ supabase: client });
    const result = await rpc(client, "document_attachment_share_pending_v1", {
      p_document_id: documentId,
      p_device_client_id: status.deviceInstanceId,
      p_master_proof_sha256: proof
    });
    return { transfers: Array.isArray(result?.transfers) ? result.transfers : [], masterProofSha256: proof };
  }

  async function acceptIncomingShares(documentId) {
    const { client, Trusted, status } = await secureContext({ requireUnlocked: true });
    const { DocCrypto, Recovery } = securityDeps();
    const masterProofSha256 = await Recovery.masterProofFromUnlocked({ supabase: client });
    const pending = await pendingIncomingShares(documentId, { masterProofSha256 });
    const transfers = pending.transfers;
    let accepted = 0;

    for (const transfer of transfers) {
      const attachmentKey = await Trusted.withDeviceIdentityPrivateKey(status.userId, async (privateKey, identity) => {
        if (identity.publicKeyFingerprint !== transfer.grantee_device_fingerprint) {
          throw new Error("Fingerprint Trusted Device lokal tidak cocok dengan key transfer.");
        }
        return DocCrypto.openAttachmentShareTransfer({
          recipientPrivateKey: privateKey,
          attachmentId: transfer.attachment_id,
          granteeUserId: status.userId,
          recipientDeviceFingerprint: transfer.grantee_device_fingerprint,
          transferEnvelope: transfer.transfer_envelope
        });
      });

      const recipientEnvelope = await Trusted.withMasterKey(status.userId, (masterKey) => DocCrypto.wrapAttachmentKey({
        masterKey,
        attachmentId: transfer.attachment_id,
        attachmentKey
      }));

      await rpc(client, "document_attachment_share_accept_v1", {
        p_transfer_id: transfer.transfer_id,
        p_device_client_id: status.deviceInstanceId,
        p_master_proof_sha256: masterProofSha256,
        p_recipient_key_envelope: recipientEnvelope
      });
      accepted += 1;
    }
    return { accepted, pending: transfers.length };
  }

  // ---------------------------------------------------------------------------
  // a50 compatibility surface. Kept so the locked crypto/storage foundation can
  // still be regression-tested while the product UI uses record + attachment.
  // ---------------------------------------------------------------------------
  async function listEncrypted() {
    const { client, status } = await secureContext({ requireUnlocked: false });
    try {
      await rpc(client, "documents_reconcile_pending_v1", { p_device_client_id: status.deviceInstanceId });
    } catch (_) {}
    const result = await rpc(client, "documents_list_v1", { p_device_client_id: status.deviceInstanceId });
    return Array.isArray(result?.documents) ? result.documents : [];
  }

  async function listReadable() {
    const { Trusted, status } = await secureContext({ requireUnlocked: true });
    const rows = await listEncrypted();
    const { DocCrypto } = securityDeps();
    return Trusted.withMasterKey(status.userId, async (masterKey) => {
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

  async function getEncrypted(documentId) {
    const { client, status } = await secureContext({ requireUnlocked: false });
    const result = await rpc(client, "documents_get_v1", {
      p_document_id: documentId,
      p_device_client_id: status.deviceInstanceId
    });
    if (!result || result.found === false || !result.document_id) throw new Error("Dokumen a50 tidak ditemukan.");
    return result;
  }

  async function uploadFile(file, options = {}) {
    const record = await createRecord({
      scope: "private",
      displayName: file?.name || "Dokumen",
      documentType: "Lainnya"
    });
    await uploadAttachment(record.document_id, file, options);
    return record;
  }

  async function downloadDecrypted(attachmentId) {
    return downloadAttachment(attachmentId);
  }

  async function downloadToBrowser(attachmentId) {
    return downloadAttachmentToBrowser(attachmentId);
  }

  const api = Object.freeze({
    BUILD,
    RECORD_BUILD,
    LEGACY_BUILD,
    BUCKET,
    createRecord,
    listRecords,
    getRecord,
    updateRecord,
    archiveRecord,
    listArchivedRecords,
    restoreRecord,
    deleteArchivedRecord,
    localStatus,
    preflight,
    unlock,
    uploadAttachment,
    listAttachments,
    listReadableAttachments,
    getAttachment,
    downloadAttachment,
    downloadAttachmentToBrowser,
    deleteAttachment,
    replaceAttachment,
    listShareCandidates,
    listShareTargets,
    sharePlan,
    shareWithMember,
    revokeMemberShare,
    syncActiveShares,
    pendingIncomingShares,
    acceptIncomingShares,
    // compatibility
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
