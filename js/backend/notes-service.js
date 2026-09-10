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
    "folder_name",
    "pinned",
    "created_at",
    "updated_at",
    "archived_at"
  ].join(",");

  const ACTIVE_NOTE_TYPES = ["basic", "checklist"];

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
      folder_name: clean(input.folderName ?? input.folder_name, 80) || null,
      pinned: Boolean(input.pinned)
    };
  }

  async function simpanByType(input = {}, noteType = "basic") {
    const db = client();
    const id = clean(input.id);
    const payload = normalizePayload(input, noteType);

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
      .is("archived_at", null);
    query = applyTypeFilter(query, noteTypes);

    const { data, error } = await query
      .order("pinned", { ascending: false })
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
      .is("archived_at", null);
    query = applyTypeFilter(query, noteTypes);

    const { data, error } = await query
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function ambilCatatanKeluarga(familyId, noteTypes = ACTIVE_NOTE_TYPES) {
    const fid = clean(familyId);
    if (!fid) return [];

    let query = client()
      .from("notes")
      .select(NOTE_FIELDS)
      .eq("family_id", fid)
      .eq("scope", "family")
      .is("archived_at", null);
    query = applyTypeFilter(query, noteTypes);

    const { data, error } = await query
      .order("pinned", { ascending: false })
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

  async function arsipkan(id) {
    const noteId = clean(id);
    if (!noteId) throw new Error("Catatan tidak ditemukan.");

    const { data, error } = await client()
      .from("notes")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", noteId)
      .select(NOTE_FIELDS)
      .single();

    if (error) throw error;
    return data;
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

  function tagSchemaBelumTerpasang(error) {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || error?.details || error?.hint || "").toLowerCase();
    return code === "PGRST202" ||
      message.includes("notes_list_tags_v1") ||
      message.includes("notes_create_tag_v1") ||
      message.includes("notes_get_note_tags_v1") ||
      message.includes("notes_sync_note_tags_v1") ||
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
    ambilCatatan,
    ambilCatatanPersonal,
    ambilCatatanAnggota,
    ambilCatatanKeluarga,
    ambilBasicPersonal,
    ambilBasicAnggota,
    ambilBasicKeluarga,
    ambilChecklistItems,
    syncChecklistItems,
    arsipkan,
    ambilTagCatalog,
    buatTag,
    ambilTagCatatan,
    syncTagCatatan,
    tagSchemaBelumTerpasang,
    checklistSchemaBelumTerpasang,
    schemaBelumTerpasang
  };
})();
