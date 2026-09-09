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

  function normalizePayload(input = {}) {
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
      note_type: "basic",
      title: clean(input.title, 160),
      body_html: String(input.bodyHtml ?? input.body_html ?? "").slice(0, 1000000),
      body_text: String(input.bodyText ?? input.body_text ?? "").trim().slice(0, 500000),
      folder_name: clean(input.folderName ?? input.folder_name, 80) || null,
      pinned: Boolean(input.pinned)
    };
  }

  async function simpanBasic(input = {}) {
    const db = client();
    const id = clean(input.id);
    const payload = normalizePayload(input);

    if (id) {
      const updatePayload = { ...payload };
      delete updatePayload.note_type;

      const { data, error } = await db
        .from("notes")
        .update(updatePayload)
        .eq("id", id)
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

  async function ambilBasicPersonal(userId) {
    const uid = clean(userId);
    if (!uid) return [];

    const { data, error } = await client()
      .from("notes")
      .select(NOTE_FIELDS)
      .eq("created_by", uid)
      .eq("scope", "personal")
      .eq("note_type", "basic")
      .is("archived_at", null)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function ambilBasicAnggota(familyId, memberId) {
    const fid = clean(familyId);
    const uid = clean(memberId);
    if (!fid || !uid) return [];

    const { data, error } = await client()
      .from("notes")
      .select(NOTE_FIELDS)
      .eq("family_id", fid)
      .eq("created_by", uid)
      .eq("scope", "personal")
      .eq("visibility", "family-read")
      .eq("note_type", "basic")
      .is("archived_at", null)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function ambilBasicKeluarga(familyId) {
    const fid = clean(familyId);
    if (!fid) return [];

    const { data, error } = await client()
      .from("notes")
      .select(NOTE_FIELDS)
      .eq("family_id", fid)
      .eq("scope", "family")
      .eq("note_type", "basic")
      .is("archived_at", null)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
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
    ambilCatatan,
    ambilBasicPersonal,
    ambilBasicAnggota,
    ambilBasicKeluarga,
    arsipkan,
    schemaBelumTerpasang
  };
})();
