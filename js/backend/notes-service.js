(() => {
  "use strict";

  const NOTE_FIELDS = [
    "id",
    "family_id",
    "created_by",
    "scope",
    "visibility",
    "note_type",
    "title",
    "body_html",
    "body_text",
    "folder_id",
    "folder_name",
    "pinned",
    "card_color",
    "reminder_at",
    "reminder_timezone",
    "reminder_recurrence",
    "created_at",
    "updated_at",
    "archived_at"
  ].join(",");

  const ACTIVE_NOTE_TYPES = ["basic", "checklist", "reminder"];

  function client() {
    const value = window.supabaseClient;
    if (!value) throw new Error("Supabase belum tersedia.");
    return value;
  }

  function clean(value, max = 0) {
    const text = String(value ?? "").trim();
    return max > 0 ? text.slice(0, max) : text;
  }

  function normalizeScope(value) {
    return String(value || "").toLowerCase() === "family" ? "family" : "personal";
  }

  function normalizeVisibility(value, scope) {
    if (scope === "family") return "family-read";
    return String(value || "").toLowerCase() === "family-read" ? "family-read" : "private";
  }

  function normalizeNoteType(value) {
    const type = String(value || "").toLowerCase();
    return ["basic", "checklist", "reminder"].includes(type) ? type : "basic";
  }

  function normalizeCardColor(value) {
    const color = String(value || "default").toLowerCase();
    return ["default", "sage", "sand", "sky", "rose", "lavender"].includes(color) ? color : "default";
  }

  function normalizePayload(input = {}, forcedType = "basic") {
    const scope = normalizeScope(input.scope);
    const visibility = normalizeVisibility(input.visibility, scope);
    const familyId = clean(input.familyId || input.family_id);
    const needsFamily = scope === "family" || visibility === "family-read";

    if (needsFamily && !familyId) {
      throw new Error("Area keluarga aktif belum tersedia.");
    }

    return {
      family_id: needsFamily ? familyId : null,
      scope,
      visibility,
      note_type: normalizeNoteType(forcedType),
      title: clean(input.title, 160),
      body_html: String(input.bodyHtml ?? input.body_html ?? "").slice(0, 1000000),
      body_text: String(input.bodyText ?? input.body_text ?? "").trim().slice(0, 500000),
      folder_id: clean(input.folderId ?? input.folder_id) || null,
      folder_name: clean(input.folderName ?? input.folder_name, 80) || null,
      pinned: Boolean(input.pinned),
      card_color: normalizeCardColor(input.cardColor ?? input.card_color)
    };
  }

  async function simpanByType(input = {}, noteType = "basic") {
    const db = client();
    const id = clean(input.id);
    const payload = normalizePayload(input, noteType);

    // a32: folder_name bukan lagi sekadar snapshot. Jika editor dibuka dari
    // sebuah folder, resolve/create relasi folder Supabase sebelum menyimpan.
    if (payload.folder_name && !payload.folder_id) {
      payload.folder_id = await resolveFolder(payload.scope, payload.family_id, payload.folder_name);
    }
    if (!payload.folder_name) payload.folder_id = null;

    if (id) {
      const updatePayload = { ...payload };
      delete updatePayload.note_type;

      const { data, error } = await db
        .from("notes")
        .update(updatePayload)
        .eq("id", id)
        .eq("note_type", normalizeNoteType(noteType))
        .select(NOTE_FIELDS)
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await db
      .from("notes")
      .insert(payload)
      .select(NOTE_FIELDS)
      .single();

    if (error) throw error;
    return data;
  }

  function simpanBasic(input = {}) {
    return simpanByType(input, "basic");
  }

  function simpanChecklist(input = {}) {
    return simpanByType(input, "checklist");
  }

  async function pindahkanCatatanKeFolder(note = {}, { folderName = "", folderId = null } = {}) {
    const id = clean(note?.id);
    if (!id) throw new Error("Catatan tidak ditemukan.");

    const input = {
      id,
      familyId: note?.family_id,
      scope: note?.scope,
      visibility: note?.visibility,
      title: note?.title,
      bodyHtml: note?.body_html,
      bodyText: note?.body_text,
      folderId: clean(folderId) || null,
      folderName: clean(folderName, 80),
      pinned: Boolean(note?.pinned),
      cardColor: note?.card_color
    };

    const type = normalizeNoteType(note?.note_type);
    if (type === "reminder") {
      return simpanReminder({
        ...input,
        reminderAt: note?.reminder_at,
        reminderTimezone: note?.reminder_timezone,
        reminderRecurrence: note?.reminder_recurrence
      });
    }
    if (type === "checklist") return simpanChecklist(input);
    return simpanBasic(input);
  }


  function normalizeReminderRecurrence(value) {
    const recurrence = String(value || "none").toLowerCase();
    return ["none", "daily", "weekly", "monthly", "yearly"].includes(recurrence) ? recurrence : "none";
  }

  async function simpanReminder(input = {}) {
    const payload = normalizePayload(input, "reminder");
    if (payload.folder_name && !payload.folder_id) {
      payload.folder_id = await resolveFolder(payload.scope, payload.family_id, payload.folder_name);
    }
    if (!payload.folder_name) payload.folder_id = null;

    const { data, error } = await client().rpc("notes_save_reminder_v1", {
      p_note_id: clean(input.id) || null,
      p_family_id: payload.family_id,
      p_scope: payload.scope,
      p_visibility: payload.visibility,
      p_title: payload.title,
      p_body_html: payload.body_html,
      p_body_text: payload.body_text,
      p_folder_id: payload.folder_id,
      p_folder_name: payload.folder_name,
      p_card_color: payload.card_color,
      p_reminder_at: input.reminderAt ?? input.reminder_at ?? null,
      p_reminder_timezone: clean(input.reminderTimezone ?? input.reminder_timezone, 80) || null,
      p_reminder_recurrence: normalizeReminderRecurrence(input.reminderRecurrence ?? input.reminder_recurrence)
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row || null;
  }

  async function ambilReminderRecipients(noteId) {
    const id = clean(noteId);
    if (!id) return [];
    const { data, error } = await client().rpc("notes_get_reminder_recipients_v1", { p_note_id: id });
    if (error) throw error;
    return Array.from(new Set((data || []).map(row => clean(row?.user_id)).filter(Boolean)));
  }

  async function syncReminderRecipients(noteId, userIds = []) {
    const id = clean(noteId);
    if (!id) throw new Error("Reminder belum tersimpan.");
    const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map(value => clean(value)).filter(Boolean))).slice(0, 250);
    const { data, error } = await client().rpc("notes_sync_reminder_recipients_v1", {
      p_note_id: id,
      p_user_ids: ids
    });
    if (error) throw error;
    return Number(data || 0);
  }

  async function claimDueReminders(limit = 20) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const { data, error } = await client().rpc("notes_claim_due_reminders_v1", { p_limit: safeLimit });
    if (error) throw error;
    return data || [];
  }

  async function ambilCatatan(id) {
    const noteId = clean(id);
    if (!noteId) return null;

    const { data, error } = await client()
      .from("notes")
      .select(NOTE_FIELDS)
      .eq("id", noteId)
      .is("archived_at", null)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  function applyTypeFilter(query, noteTypes = ACTIVE_NOTE_TYPES) {
    const types = Array.from(new Set(
      (Array.isArray(noteTypes) ? noteTypes : [noteTypes])
        .map(normalizeNoteType)
        .filter(type => ACTIVE_NOTE_TYPES.includes(type))
    ));
    return query.in("note_type", types.length ? types : ACTIVE_NOTE_TYPES);
  }

  async function ambilCatatanPersonal(userId, noteTypes = ACTIVE_NOTE_TYPES) {
    const uid = clean(userId);
    if (!uid) return [];

    let query = client()
      .from("notes")
      .select(NOTE_FIELDS)
      .eq("created_by", uid)
      .eq("scope", "personal")
      .is("archived_at", null)
      .is("folder_id", null);
    query = applyTypeFilter(query, noteTypes);

    const { data, error } = await query
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function ambilCatatanAnggota(familyId, memberId, noteTypes = ACTIVE_NOTE_TYPES) {
    const fid = clean(familyId);
    const uid = clean(memberId);
    if (!fid || !uid) return [];

    let query = client()
      .from("notes")
      .select(NOTE_FIELDS)
      .eq("family_id", fid)
      .eq("created_by", uid)
      .eq("scope", "personal")
      .eq("visibility", "family-read")
      .is("archived_at", null)
      .is("folder_id", null);
    query = applyTypeFilter(query, noteTypes);

    const { data, error } = await query
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function ambilFolderAnggota(familyId, memberId) {
    const fid = clean(familyId);
    const uid = clean(memberId);
    if (!fid || !uid) return [];

    const { data, error } = await client()
      .from("notes")
      .select("folder_name")
      .eq("family_id", fid)
      .eq("created_by", uid)
      .eq("scope", "personal")
      .eq("visibility", "family-read")
      .not("folder_id", "is", null)
      .is("archived_at", null)
      .order("folder_name", { ascending: true });

    if (error) throw error;

    const counts = new Map();
    (data || []).forEach(row => {
      const name = clean(row?.folder_name, 80);
      if (!name) return;
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts, ([name, noteCount]) => ({ name, noteCount }));
  }

  async function ambilCatatanKeluarga(familyId, noteTypes = ACTIVE_NOTE_TYPES) {
    const fid = clean(familyId);
    if (!fid) return [];

    let query = client()
      .from("notes")
      .select(NOTE_FIELDS)
      .eq("family_id", fid)
      .eq("scope", "family")
      .is("archived_at", null)
      .is("folder_id", null);
    query = applyTypeFilter(query, noteTypes);

    const { data, error } = await query
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Alias lama dipertahankan agar halaman lama tetap kompatibel.
  function ambilBasicPersonal(userId) {
    return ambilCatatanPersonal(userId, ["basic"]);
  }

  function ambilBasicAnggota(familyId, memberId) {
    return ambilCatatanAnggota(familyId, memberId, ["basic"]);
  }

  function ambilBasicKeluarga(familyId) {
    return ambilCatatanKeluarga(familyId, ["basic"]);
  }

  async function ambilHakLifecycleCatatan(noteIds = []) {
    const ids = Array.from(new Set((Array.isArray(noteIds) ? noteIds : []).map(value => clean(value)).filter(Boolean))).slice(0, 250);
    if (!ids.length) return {};
    const { data, error } = await client().rpc("notes_get_lifecycle_capabilities_v1", {
      p_note_ids: ids
    });
    if (error) throw error;
    const map = {};
    (data || []).forEach(row => {
      const id = clean(row?.note_id);
      if (!id) return;
      map[id] = {
        canArchive: Boolean(row?.can_archive),
        canRestore: Boolean(row?.can_restore),
        canDeletePermanent: Boolean(row?.can_delete_permanent)
      };
    });
    return map;
  }

  async function bolehArsipkanCatatan(noteId) {
    const id = clean(noteId);
    if (!id) return false;
    const map = await ambilHakLifecycleCatatan([id]);
    return Boolean(map[id]?.canArchive);
  }

  async function arsipkan(id) {
    const noteId = clean(id);
    if (!noteId) throw new Error("Catatan tidak ditemukan.");
    const { data, error } = await client().rpc("notes_archive_note_v1", {
      p_note_id: noteId
    });
    if (error) throw error;
    return Boolean(data);
  }

  async function arsipkanBanyak(noteIds = []) {
    const ids = Array.from(new Set((Array.isArray(noteIds) ? noteIds : []).map(value => clean(value)).filter(Boolean))).slice(0, 250);
    if (!ids.length) return 0;
    const { data, error } = await client().rpc("notes_archive_notes_v1", {
      p_note_ids: ids
    });
    if (error) throw error;
    return Number(data || 0);
  }

  async function ambilCatatanArsip(scope = "personal", familyId = null) {
    const archiveScope = normalizeScope(scope);
    const fid = clean(familyId);
    const { data, error } = await client().rpc("notes_list_archived_v1", {
      p_scope: archiveScope,
      p_family_id: archiveScope === "family" ? (fid || null) : null
    });
    if (error) throw error;
    return (data || []).filter(row => ACTIVE_NOTE_TYPES.includes(normalizeNoteType(row?.note_type)));
  }

  async function ambilTagMapArsip(noteIds = []) {
    const ids = Array.from(new Set((Array.isArray(noteIds) ? noteIds : []).map(value => clean(value)).filter(Boolean))).slice(0, 250);
    if (!ids.length) return {};
    const { data, error } = await client().rpc("notes_get_archived_tags_v1", {
      p_note_ids: ids
    });
    if (error) throw error;
    const map = {};
    (data || []).forEach(row => {
      const id = clean(row?.note_id);
      const name = normalizeTagName(row?.name);
      if (!id || !name) return;
      if (!map[id]) map[id] = [];
      if (!map[id].includes(name)) map[id].push(name);
    });
    Object.values(map).forEach(values => values.sort());
    return map;
  }

  async function pulihkanCatatan(noteId) {
    const id = clean(noteId);
    if (!id) throw new Error("Catatan Arsip tidak ditemukan.");
    const { data, error } = await client().rpc("notes_restore_note_v1", { p_note_id: id });
    if (error) throw error;
    return Boolean(data);
  }

  async function hapusPermanenArsip(noteId) {
    const id = clean(noteId);
    if (!id) throw new Error("Catatan Arsip tidak ditemukan.");
    const { data, error } = await client().rpc("notes_delete_archived_note_v1", { p_note_id: id });
    if (error) throw error;
    return Boolean(data);
  }

  async function hapusSemuaArsip(scope = "personal", familyId = null) {
    const archiveScope = normalizeScope(scope);
    const fid = clean(familyId);
    const { data, error } = await client().rpc("notes_delete_archived_all_v1", {
      p_scope: archiveScope,
      p_family_id: archiveScope === "family" ? (fid || null) : null
    });
    if (error) throw error;
    return Number(data || 0);
  }

  function normalizeRelatedRow(row = {}) {
    return {
      id: clean(row?.id),
      created_by: clean(row?.created_by),
      scope: normalizeScope(row?.scope),
      visibility: String(row?.visibility || ""),
      note_type: normalizeNoteType(row?.note_type),
      title: String(row?.title || "").trim().slice(0, 160),
      folder_id: clean(row?.folder_id) || null,
      folder_name: clean(row?.folder_name, 80),
      archived_at: row?.archived_at || null,
      updated_at: row?.updated_at || null,
      is_related: Boolean(row?.is_related),
      is_same_folder: Boolean(row?.is_same_folder)
    };
  }

  async function ambilCatatanTerkait(noteId) {
    const id = clean(noteId);
    if (!id) return [];
    const { data, error } = await client().rpc("notes_list_related_v1", { p_note_id: id });
    if (error) throw error;
    return (data || []).map(normalizeRelatedRow).filter(row => row.id);
  }

  async function ambilKandidatCatatanTerkait(noteId, limit = 250) {
    const id = clean(noteId);
    if (!id) return [];
    const safeLimit = Math.min(Math.max(Number(limit) || 250, 20), 400);
    const { data, error } = await client().rpc("notes_list_related_candidates_v1", {
      p_note_id: id,
      p_limit: safeLimit
    });
    if (error) throw error;
    return (data || []).map(normalizeRelatedRow).filter(row => row.id);
  }

  async function syncCatatanTerkait(noteId, relatedIds = []) {
    const id = clean(noteId);
    if (!id) throw new Error("Catatan belum tersimpan.");
    const ids = Array.from(new Set((Array.isArray(relatedIds) ? relatedIds : []).map(value => clean(value)).filter(Boolean))).slice(0, 250);
    const { data, error } = await client().rpc("notes_sync_related_v1", {
      p_note_id: id,
      p_related_ids: ids
    });
    if (error) throw error;
    return Number(data || 0);
  }

  function relatedSchemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" ||
      message.includes("notes_list_related_v1") ||
      message.includes("notes_list_related_candidates_v1") ||
      message.includes("notes_sync_related_v1") ||
      message.includes("catatan_note_relations");
  }

  function normalizeChecklistItem(item = {}, index = 0) {
    return {
      id: clean(item?.id),
      text: String(item?.text ?? item?.item_text ?? "").trim().slice(0, 600),
      completed: Boolean(item?.completed ?? item?.is_completed),
      sortOrder: Number.isFinite(Number(item?.sortOrder ?? item?.sort_order))
        ? Math.max(0, Number(item?.sortOrder ?? item?.sort_order))
        : index
    };
  }

  async function ambilChecklistItems(noteId) {
    const id = clean(noteId);
    if (!id) return [];

    const { data, error } = await client().rpc("notes_get_checklist_items_v1", {
      p_note_id: id
    });

    if (error) throw error;
    return (data || []).map((item, index) => normalizeChecklistItem(item, index));
  }

  async function syncChecklistItems(noteId, items = []) {
    const id = clean(noteId);
    if (!id) throw new Error("Checklist belum tersimpan.");

    const payload = (Array.isArray(items) ? items : [])
      .map((item, index) => normalizeChecklistItem(item, index))
      .filter(item => item.text)
      .slice(0, 500)
      .map(item => ({ text: item.text, completed: item.completed }));

    const { data, error } = await client().rpc("notes_sync_checklist_v1", {
      p_note_id: id,
      p_items: payload
    });

    if (error) throw error;
    return (data || []).map((item, index) => normalizeChecklistItem(item, index));
  }

  async function resolveFolder(scope, familyId, name) {
    const folderName = clean(name, 80);
    if (!folderName) return null;
    const folderScope = normalizeScope(scope);
    const fid = clean(familyId);

    const { data, error } = await client().rpc("notes_resolve_folder_v1", {
      p_scope: folderScope,
      p_family_id: folderScope === "family" ? (fid || null) : null,
      p_name: folderName
    });
    if (error) throw error;
    return clean(data) || null;
  }

  async function buatFolder(scope, familyId, name) {
    const folderScope = normalizeScope(scope);
    const folderName = clean(name, 80);
    const fid = clean(familyId);
    if (!folderName) throw new Error("Nama folder wajib diisi.");

    const { data, error } = await client().rpc("notes_create_folder_v1", {
      p_scope: folderScope,
      p_family_id: folderScope === "family" ? (fid || null) : null,
      p_name: folderName
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { id: clean(row?.id), name: clean(row?.name, folderName) };
  }

  function rpcFunctionMissing(error, functionName = "") {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" || (functionName && message.includes(String(functionName).toLowerCase()));
  }

  async function ambilPreferensiCatatan(noteIds = []) {
    const ids = Array.from(new Set((Array.isArray(noteIds) ? noteIds : []).map(value => clean(value)).filter(Boolean))).slice(0, 250);
    if (!ids.length) return {};

    let result = await client().rpc("notes_get_preferences_v2", { p_note_ids: ids });
    if (result.error && rpcFunctionMissing(result.error, "notes_get_preferences_v2")) {
      result = await client().rpc("notes_get_preferences_v1", { p_note_ids: ids });
    }
    if (result.error) throw result.error;

    const map = {};
    (result.data || []).forEach(row => {
      const id = clean(row?.note_id);
      if (id) map[id] = { pinned: Boolean(row?.pinned) };
    });
    return map;
  }

  async function setPinCatatan(noteId, pinned) {
    const id = clean(noteId);
    if (!id) throw new Error("Catatan belum tersimpan.");

    let result = await client().rpc("notes_set_pin_v2", {
      p_note_id: id,
      p_pinned: Boolean(pinned)
    });
    if (result.error && rpcFunctionMissing(result.error, "notes_set_pin_v2")) {
      result = await client().rpc("notes_set_pin_v1", {
        p_note_id: id,
        p_pinned: Boolean(pinned)
      });
    }
    if (result.error) throw result.error;
    return Boolean(result.data);
  }

  async function setWarnaKartuCatatan(noteId, color) {
    const id = clean(noteId);
    if (!id) throw new Error("Catatan belum tersimpan.");
    const { data, error } = await client().rpc("notes_set_card_color_v1", {
      p_note_id: id,
      p_color: normalizeCardColor(color)
    });
    if (error) throw error;
    return normalizeCardColor(data);
  }

  async function ambilFolderCatalog(scope, familyId = null) {
    const folderScope = normalizeScope(scope);
    const fid = clean(familyId);
    const { data, error } = await client().rpc("notes_list_folders_v2", {
      p_scope: folderScope,
      p_family_id: folderScope === "family" ? (fid || null) : null
    });
    if (error) throw error;
    return (data || []).map(row => ({
      id: clean(row?.id),
      name: clean(row?.name),
      noteCount: Number(row?.note_count || 0),
      deleteCount: Number(row?.delete_count ?? row?.note_count ?? 0),
      canDelete: Boolean(row?.can_delete)
    })).filter(row => row.name);
  }

  async function ambilTagMapCatatan(noteIds = []) {
    const ids = Array.from(new Set((Array.isArray(noteIds) ? noteIds : []).map(value => clean(value)).filter(Boolean))).slice(0, 250);
    if (!ids.length) return {};
    const { data, error } = await client().rpc("notes_get_tags_for_notes_v1", {
      p_note_ids: ids
    });
    if (error) throw error;
    const map = {};
    (data || []).forEach(row => {
      const id = clean(row?.note_id);
      const name = normalizeTagName(row?.name);
      if (!id || !name) return;
      if (!map[id]) map[id] = [];
      if (!map[id].includes(name)) map[id].push(name);
    });
    Object.values(map).forEach(values => values.sort());
    return map;
  }

  async function ambilHakHapusCatatan(noteIds = []) {
    const ids = Array.from(new Set((Array.isArray(noteIds) ? noteIds : []).map(value => clean(value)).filter(Boolean))).slice(0, 250);
    if (!ids.length) return {};
    const { data, error } = await client().rpc("notes_get_delete_capabilities_v1", {
      p_note_ids: ids
    });
    if (error) throw error;
    const map = {};
    (data || []).forEach(row => {
      const id = clean(row?.note_id);
      if (id) map[id] = Boolean(row?.can_delete);
    });
    return map;
  }

  async function bolehHapusCatatan(noteId) {
    const id = clean(noteId);
    if (!id) return false;
    const map = await ambilHakHapusCatatan([id]);
    return Boolean(map[id]);
  }

  async function hapusCatatan(noteId) {
    const id = clean(noteId);
    if (!id) throw new Error("Catatan tidak ditemukan.");
    const { data, error } = await client().rpc("notes_delete_note_v1", {
      p_note_id: id
    });
    if (error) throw error;
    return Boolean(data);
  }

  async function hapusFolder(folderId) {
    const id = clean(folderId);
    if (!id) throw new Error("Folder tidak ditemukan.");
    const { data, error } = await client().rpc("notes_delete_folder_v1", {
      p_folder_id: id
    });
    if (error) throw error;
    return Number(data || 0);
  }

  async function ambilCatatanDalamFolder({
    scope = "personal",
    familyId = null,
    ownerId = null,
    folderName = "",
    noteTypes = ACTIVE_NOTE_TYPES,
    sharedWithFamilyOnly = false
  } = {}) {
    const folderScope = normalizeScope(scope);
    const folder = clean(folderName, 80);
    const fid = clean(familyId);
    const uid = clean(ownerId);
    if (!folder) return [];

    let query = client()
      .from("notes")
      .select(NOTE_FIELDS)
      .eq("scope", folderScope)
      .eq("folder_name", folder)
      .is("archived_at", null);

    if (folderScope === "family") {
      if (!fid) return [];
      query = query.eq("family_id", fid);
    } else if (uid) {
      query = query.eq("created_by", uid);
      // Member-folder view harus tetap dibatasi ke catatan Personal yang
      // memang dibagikan ke family aktif ini. RLS tetap menjadi pagar utama,
      // filter ini mencegah konteks silang bila user punya >1 membership.
      if (sharedWithFamilyOnly) {
        if (!fid) return [];
        query = query
          .eq("family_id", fid)
          .eq("visibility", "family-read");
      }
    }

    query = applyTypeFilter(query, noteTypes);
    const { data, error } = await query
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  function folderSchemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" ||
      code === "PGRST204" ||
      message.includes("notes_resolve_folder_v1") ||
      message.includes("notes_list_folders_v1") ||
      message.includes("notes_list_folders_v2") ||
      message.includes("notes_delete_folder_v1") ||
      message.includes("catatan_folders") ||
      message.includes("folder_id");
  }

  function normalizeTagScope(value) {
    return String(value || "").toLowerCase() === "family" ? "family" : "personal";
  }

  function normalizeTagName(value) {
    return String(value ?? "")
      .trim()
      .replace(/^#+/, "")
      .replace(/[\s#]+/g, "-")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 36);
  }

  async function ambilKelolaTagCatalog(scope, familyId = null) {
    const tagScope = normalizeTagScope(scope);
    const fid = clean(familyId);
    const { data, error } = await client().rpc("notes_list_tag_management_v1", {
      p_scope: tagScope,
      p_family_id: tagScope === "family" ? (fid || null) : null
    });
    if (error) throw error;
    return (data || []).map(row => ({
      id: clean(row?.id),
      name: normalizeTagName(row?.name),
      usageCount: Math.max(0, Number(row?.usage_count || 0)),
      canManage: Boolean(row?.can_manage)
    })).filter(row => row.id && row.name);
  }

  async function hapusTagCatalog(tagId) {
    const id = clean(tagId);
    if (!id) throw new Error("Tag tidak ditemukan.");
    const { data, error } = await client().rpc("notes_delete_tag_v1", { p_tag_id: id });
    if (error) throw error;
    return Math.max(0, Number(data || 0));
  }

  async function hapusTagTidakTerpakai(scope, familyId = null) {
    const tagScope = normalizeTagScope(scope);
    const fid = clean(familyId);
    const { data, error } = await client().rpc("notes_delete_unused_tags_v1", {
      p_scope: tagScope,
      p_family_id: tagScope === "family" ? (fid || null) : null
    });
    if (error) throw error;
    return Math.max(0, Number(data || 0));
  }

  async function ambilTagCatalog(scope, familyId = null) {
    const tagScope = normalizeTagScope(scope);
    const fid = clean(familyId);

    const { data, error } = await client().rpc("notes_list_tags_v1", {
      p_scope: tagScope,
      p_family_id: tagScope === "family" ? (fid || null) : null
    });

    if (error) throw error;
    return Array.from(new Set((data || []).map(item => normalizeTagName(item?.name)).filter(Boolean))).sort();
  }

  async function buatTag(scope, familyId, name) {
    const tagScope = normalizeTagScope(scope);
    const tagName = normalizeTagName(name);
    const fid = clean(familyId);
    if (!tagName) throw new Error("Nama tag tidak valid.");

    const { data, error } = await client().rpc("notes_create_tag_v1", {
      p_scope: tagScope,
      p_family_id: tagScope === "family" ? (fid || null) : null,
      p_name: tagName
    });

    if (error) throw error;
    return normalizeTagName(data) || tagName;
  }

  async function ambilTagCatatan(noteId) {
    const id = clean(noteId);
    if (!id) return [];

    const { data, error } = await client().rpc("notes_get_note_tags_v1", {
      p_note_id: id
    });

    if (error) throw error;
    return Array.from(new Set((data || []).map(item => normalizeTagName(item?.name)).filter(Boolean))).sort();
  }

  async function syncTagCatatan(noteId, names = []) {
    const id = clean(noteId);
    if (!id) throw new Error("Catatan belum tersimpan.");

    const cleanNames = Array.from(new Set(
      (Array.isArray(names) ? names : [])
        .map(normalizeTagName)
        .filter(Boolean)
    )).sort();

    const { data, error } = await client().rpc("notes_sync_note_tags_v1", {
      p_note_id: id,
      p_names: cleanNames
    });

    if (error) throw error;
    return Array.from(new Set((data || []).map(item => normalizeTagName(item?.name)).filter(Boolean))).sort();
  }

  function managementSchemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" ||
      message.includes("notes_list_folders_v2") ||
      message.includes("notes_get_tags_for_notes_v1") ||
      message.includes("notes_get_delete_capabilities_v1") ||
      message.includes("notes_delete_note_v1") ||
      message.includes("notes_delete_folder_v1");
  }

  function lifecycleSchemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" ||
      message.includes("notes_get_lifecycle_capabilities_v1") ||
      message.includes("notes_archive_note_v1") ||
      message.includes("notes_archive_notes_v1") ||
      message.includes("notes_list_archived_v1") ||
      message.includes("notes_get_archived_tags_v1") ||
      message.includes("notes_restore_note_v1") ||
      message.includes("notes_delete_archived_note_v1") ||
      message.includes("notes_delete_archived_all_v1");
  }

  function customizationSchemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" ||
      code === "PGRST204" ||
      message.includes("notes_create_folder_v1") ||
      message.includes("notes_get_preferences_v1") ||
      message.includes("notes_get_preferences_v2") ||
      message.includes("notes_set_pin_v1") ||
      message.includes("notes_set_pin_v2") ||
      message.includes("notes_set_card_color_v1") ||
      message.includes("catatan_note_preferences") ||
      message.includes("card_color");
  }

  function tagSchemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" ||
      message.includes("notes_list_tags_v1") ||
      message.includes("notes_create_tag_v1") ||
      message.includes("notes_get_note_tags_v1") ||
      message.includes("notes_sync_note_tags_v1") ||
      message.includes("notes_list_tag_management_v1") ||
      message.includes("notes_delete_tag_v1") ||
      message.includes("notes_delete_unused_tags_v1") ||
      message.includes("catatan_tags") ||
      message.includes("catatan_note_tags");
  }

  function checklistSchemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" ||
      message.includes("notes_get_checklist_items_v1") ||
      message.includes("notes_sync_checklist_v1") ||
      message.includes("catatan_checklist_items");
  }


  function reminderSchemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" ||
      code === "PGRST204" ||
      message.includes("notes_save_reminder_v1") ||
      message.includes("notes_get_reminder_recipients_v1") ||
      message.includes("notes_sync_reminder_recipients_v1") ||
      message.includes("notes_claim_due_reminders_v1") ||
      message.includes("catatan_reminder_recipients") ||
      message.includes("reminder_at") ||
      message.includes("reminder_recurrence");
  }

  function schemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || "").toLowerCase();
    return ["42P01", "PGRST205", "PGRST204"].includes(code) ||
      message.includes("relation \"public.notes\" does not exist") ||
      message.includes("could not find the table 'public.notes'") ||
      (message.includes("schema cache") && message.includes("notes"));
  }

  window.NotesService = {
    simpanBasic,
    simpanChecklist,
    simpanReminder,
    pindahkanCatatanKeFolder,
    ambilCatatan,
    ambilCatatanPersonal,
    ambilCatatanAnggota,
    ambilFolderAnggota,
    ambilCatatanKeluarga,
    ambilBasicPersonal,
    ambilBasicAnggota,
    ambilBasicKeluarga,
    ambilChecklistItems,
    syncChecklistItems,
    ambilReminderRecipients,
    syncReminderRecipients,
    claimDueReminders,
    resolveFolder,
    buatFolder,
    ambilFolderCatalog,
    ambilCatatanDalamFolder,
    ambilPreferensiCatatan,
    setPinCatatan,
    setWarnaKartuCatatan,
    ambilTagMapCatatan,
    ambilHakHapusCatatan,
    bolehHapusCatatan,
    hapusCatatan,
    ambilHakLifecycleCatatan,
    bolehArsipkanCatatan,
    arsipkan,
    arsipkanBanyak,
    ambilCatatanArsip,
    ambilTagMapArsip,
    pulihkanCatatan,
    hapusPermanenArsip,
    hapusSemuaArsip,
    ambilCatatanTerkait,
    ambilKandidatCatatanTerkait,
    syncCatatanTerkait,
    relatedSchemaBelumTerpasang,
    hapusFolder,
    folderSchemaBelumTerpasang,
    managementSchemaBelumTerpasang,
    lifecycleSchemaBelumTerpasang,
    customizationSchemaBelumTerpasang,
    ambilTagCatalog,
    ambilKelolaTagCatalog,
    hapusTagCatalog,
    hapusTagTidakTerpakai,
    buatTag,
    ambilTagCatatan,
    syncTagCatatan,
    tagSchemaBelumTerpasang,
    checklistSchemaBelumTerpasang,
    reminderSchemaBelumTerpasang,
    schemaBelumTerpasang
  };
})();
