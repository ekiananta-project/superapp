(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  let activeController = null;

  function clean(value, fallback = "") {
    const text = String(value ?? "").trim().replace(/\s+/g, " ");
    return text || fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createController(options = {}) {
    const getContext = typeof options.getContext === "function" ? options.getContext : () => ({});
    const ensureSaved = typeof options.ensureSaved === "function" ? options.ensureSaved : async () => null;
    const toast = typeof options.showToast === "function" ? options.showToast : () => {};

    const root = q("[data-catatan-editor]") || q("[data-catatan-checklist]");
    if (!root) return null;

    let related = [];
    let candidates = [];
    let loaded = false;
    let draft = new Set();
    let busy = false;
    let pickerMode = "manage"; // manage | single
    let singleOnSelect = null;

    const layer = document.createElement("div");
    layer.className = "catatan-sheet-layer catatan-related-layer";
    layer.dataset.relatedLayer = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="catatan-sheet catatan-editor-sheet catatan-related-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-related-title">
        <div class="catatan-sheet-handle" aria-hidden="true"></div>
        <div class="catatan-sheet-header">
          <div><small data-related-kicker>Hubungkan</small><h2 id="catatan-related-title" data-related-title>Catatan Terkait</h2></div>
          <button class="catatan-sheet-close" type="button" data-related-close aria-label="Tutup"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <label class="catatan-related-search">
          <ion-icon name="search-outline" aria-hidden="true"></ion-icon>
          <input type="search" autocomplete="off" placeholder="Cari catatan..." data-related-search>
        </label>
        <div class="catatan-related-picker-scroll" data-related-picker-scroll>
          <div class="catatan-related-picker" data-related-picker></div>
          <div class="catatan-related-picker-empty" data-related-picker-empty hidden>Tidak ada catatan yang cocok.</div>
        </div>
        <div class="catatan-related-actions" data-related-actions>
          <button class="is-secondary" type="button" data-related-cancel>Batal</button>
          <button class="is-primary" type="button" data-related-apply>Terapkan</button>
        </div>
      </section>
    `;
    root.appendChild(layer);

    function context() {
      return { canManage: false, isReminder: false, noteId: "", userId: "", folderName: "", visibility: "private", ...getContext() };
    }

    function infoSummary() {
      const small = q('[data-info-action="related"] small');
      if (!small) return;
      const ctx = context();
      if (ctx.noteId && !loaded) {
        small.textContent = "Memuat tautan catatan...";
        return;
      }
      small.textContent = related.length ? `${related.length} catatan tertaut` : "Belum ada catatan tertaut";
    }

    function noteMeta(note) {
      const parts = [];
      const type = note.note_type === "checklist" ? "Checklist" : note.note_type === "reminder" ? "Reminder" : "Catatan";
      parts.push(type);
      parts.push(note.scope === "family" ? "Area Keluarga" : "Area Pribadi");
      if (note.folder_name) parts.push(note.folder_name);
      if (note.archived_at) parts.push("Diarsipkan");
      return parts.join(" · ");
    }

    function noteIcon(note) {
      if (note.note_type === "checklist") return "checkbox-outline";
      if (note.note_type === "reminder") return "notifications-outline";
      return "document-text-outline";
    }

    function noteHref(note) {
      const ctx = context();
      const page = note.note_type === "checklist" ? "catatan-checklist.html" : "catatan-editor.html";
      const url = new URL(page, location.href);
      url.searchParams.set("scope", note.scope === "family" ? "family" : "personal");
      url.searchParams.set("id", note.id);
      if (note.note_type === "reminder") url.searchParams.set("type", "reminder");
      if (note.folder_name) url.searchParams.set("folder", note.folder_name);
      if (note.scope === "personal" && note.created_by && note.created_by !== ctx.userId) {
        url.searchParams.set("from", "member");
        url.searchParams.set("member", note.created_by);
      }
      return `${url.pathname.split("/").pop()}${url.search}`;
    }

    function openNote(note) {
      if (!note || !note.id) return;
      if (note.archived_at) {
        toast("Catatan ini sedang diarsipkan. Pulihkan dari Arsip untuk membukanya.");
        return;
      }
      location.href = noteHref(note);
    }

    function render() {
      // a38: relasi tidak lagi memenuhi canvas editor/view. Hubungan dikelola
      // sebagai metadata dan dipakai oleh inline links di dalam tulisan.
      infoSummary();
    }

    function matchSearch(note, query) {
      if (!query) return true;
      const haystack = [
        note.title,
        note.folder_name,
        note.scope === "family" ? "keluarga" : "pribadi",
        note.note_type === "checklist" ? "checklist" : note.note_type === "reminder" ? "reminder" : "catatan"
      ].map(value => String(value || "").toLowerCase()).join(" ");
      return haystack.includes(query);
    }

    function pickerRow(note, selected, readOnly = false) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `catatan-related-picker-row${selected ? " is-selected" : ""}${note.archived_at ? " is-archived" : ""}`;
      row.innerHTML = `
        <span class="catatan-related-picker-icon"><ion-icon name="${noteIcon(note)}" aria-hidden="true"></ion-icon></span>
        <span class="catatan-related-picker-copy">
          <strong>${escapeHtml(clean(note.title, "Tanpa judul"))}</strong>
          <small>${escapeHtml(noteMeta(note))}</small>
        </span>
        <ion-icon class="catatan-related-picker-check" name="${readOnly ? "chevron-forward-outline" : (selected ? "checkmark-circle" : "ellipse-outline")}" aria-hidden="true"></ion-icon>
      `;

      if (readOnly) {
        row.addEventListener("click", () => openNote(note));
      } else {
        row.addEventListener("click", () => {
          if (pickerMode === "single") {
            draft = new Set([note.id]);
          } else if (draft.has(note.id)) {
            draft.delete(note.id);
          } else {
            draft.add(note.id);
          }
          renderPicker();
        });
      }
      return row;
    }

    function addPickerGroup(container, label, notes, { selected = false, readOnly = false } = {}) {
      if (!notes.length) return;
      const group = document.createElement("section");
      group.className = "catatan-related-picker-group";
      const heading = document.createElement("div");
      heading.className = "catatan-related-picker-heading";
      heading.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${notes.length}</span>`;
      group.appendChild(heading);
      notes.forEach(note => group.appendChild(pickerRow(note, selected || draft.has(note.id), readOnly)));
      container.appendChild(group);
    }


    function candidateMap() {
      const byId = new Map(candidates.map(note => [note.id, note]));
      related.forEach(note => { if (!byId.has(note.id)) byId.set(note.id, note); });
      return byId;
    }

    function renderPicker() {
      const container = layer.querySelector("[data-related-picker]");
      const empty = layer.querySelector("[data-related-picker-empty]");
      const search = clean(layer.querySelector("[data-related-search]")?.value).toLowerCase();
      const ctx = context();
      if (!container) return;
      container.innerHTML = "";

      if (!ctx.canManage && pickerMode === "manage") {
        const visible = related.filter(note => matchSearch(note, search));
        addPickerGroup(container, "TERTAUT", visible, { readOnly: true });
        if (empty) empty.hidden = visible.length > 0;
        return;
      }

      const byId = candidateMap();
      const selectedNotes = Array.from(draft).map(id => byId.get(id)).filter(Boolean);
      const unselected = Array.from(byId.values())
        .filter(note => !draft.has(note.id) && !note.archived_at && matchSearch(note, search));
      const sameFolder = unselected.filter(note => note.is_same_folder || (ctx.folderName && note.folder_name === ctx.folderName));
      const sameIds = new Set(sameFolder.map(note => note.id));
      const others = unselected.filter(note => !sameIds.has(note.id));

      addPickerGroup(container, pickerMode === "single" ? "DIPILIH" : "DIPILIH", selectedNotes, { selected: true });
      addPickerGroup(container, "FOLDER YANG SAMA", sameFolder);
      addPickerGroup(container, "CATATAN LAINNYA", others);

      const visibleCount = selectedNotes.length + sameFolder.length + others.length;
      if (empty) empty.hidden = visibleCount > 0;
    }

    async function ensureNote() {
      let ctx = context();
      if (ctx.noteId) return ctx.noteId;
      await ensureSaved();
      ctx = context();
      if (!ctx.noteId) {
        toast("Tulis judul atau isi catatan dulu sebelum membuat tautan catatan.");
        return "";
      }
      return ctx.noteId;
    }

    async function loadRelated({ explicit = false } = {}) {
      const ctx = context();
      if (!ctx.noteId || !window.NotesService?.ambilCatatanTerkait) {
        related = [];
        loaded = !ctx.noteId;
        render();
        return [];
      }
      try {
        related = await window.NotesService.ambilCatatanTerkait(ctx.noteId);
        loaded = true;
        render();
        return related;
      } catch (error) {
        loaded = true;
        console.warn("[Catatan Terkait]", error);
        if (explicit && window.NotesService?.relatedSchemaBelumTerpasang?.(error)) {
          toast("Backend Catatan Terkait belum aktif — jalankan SQL 004I di Supabase dulu.");
        }
        render();
        return [];
      }
    }

    function prepareLayer(mode) {
      pickerMode = mode;
      const search = layer.querySelector("[data-related-search]");
      if (search) search.value = "";
      const kicker = layer.querySelector("[data-related-kicker]");
      const title = layer.querySelector("[data-related-title]");
      const apply = layer.querySelector("[data-related-apply]");
      if (kicker) kicker.textContent = mode === "single" ? "Tautkan teks" : "Hubungkan";
      if (title) title.textContent = mode === "single" ? "Pilih Catatan" : "Catatan Terkait";
      if (apply) apply.textContent = mode === "single" ? "Tautkan" : "Terapkan";
      layer.hidden = false;
      layer.classList.add("is-loading");
    }

    async function openPicker() {
      if (busy) return;
      const ctxBefore = context();
      const id = await ensureNote();
      if (!id) return;

      busy = true;
      singleOnSelect = null;
      prepareLayer("manage");
      try {
        related = await window.NotesService.ambilCatatanTerkait(id);
        loaded = true;
        const ctx = context();
        if (ctx.canManage) {
          candidates = await window.NotesService.ambilKandidatCatatanTerkait(id, 250);
          draft = new Set(related.map(note => note.id));
        } else {
          candidates = [];
          draft = new Set();
        }
        const actions = layer.querySelector("[data-related-actions]");
        if (actions) actions.hidden = !ctx.canManage;
        render();
        renderPicker();
        setTimeout(() => layer.querySelector("[data-related-search]")?.focus(), 80);
      } catch (error) {
        console.error("[Catatan Related Picker]", error);
        layer.hidden = true;
        if (window.NotesService?.relatedSchemaBelumTerpasang?.(error)) toast("Backend Catatan Terkait belum aktif — jalankan SQL 004I di Supabase dulu.");
        else toast(error?.message || "Catatan Terkait belum dapat dimuat.");
      } finally {
        layer.classList.remove("is-loading");
        busy = false;
      }
    }

    async function openSingle({ onSelect, currentTargetId = "" } = {}) {
      if (busy) return;
      const ctxBefore = context();
      const id = await ensureNote();
      if (!id) return;
      if (!ctxBefore.canManage) {
        toast("Catatan ini hanya bisa dibaca.");
        return;
      }

      busy = true;
      singleOnSelect = typeof onSelect === "function" ? onSelect : null;
      prepareLayer("single");
      try {
        related = await window.NotesService.ambilCatatanTerkait(id);
        loaded = true;
        // Keep every note the current editor is allowed to read/select, including
        // the owner's `Hanya Saya` notes. A family-visible source is allowed to
        // point to a private target; readers without access are stopped at click
        // time by the 004L access preflight and remain on the source note.
        candidates = await window.NotesService.ambilKandidatCatatanTerkait(id, 250);
        const target = clean(currentTargetId);
        draft = target ? new Set([target]) : new Set();
        const actions = layer.querySelector("[data-related-actions]");
        if (actions) actions.hidden = false;
        render();
        renderPicker();
        setTimeout(() => layer.querySelector("[data-related-search]")?.focus(), 80);
      } catch (error) {
        console.error("[Catatan Inline Link Picker]", error);
        layer.hidden = true;
        if (window.NotesService?.relatedSchemaBelumTerpasang?.(error)) toast("Backend Catatan Terkait belum aktif — jalankan SQL 004I di Supabase dulu.");
        else toast(error?.message || "Daftar catatan belum dapat dimuat.");
      } finally {
        layer.classList.remove("is-loading");
        busy = false;
      }
    }

    async function applyPicker() {
      const ctx = context();
      if (busy || !ctx.noteId) return;
      if (!ctx.canManage && pickerMode === "manage") return;
      const apply = layer.querySelector("[data-related-apply]");

      if (pickerMode === "single" && draft.size !== 1) {
        toast("Pilih satu catatan sebagai tujuan tautan.");
        return;
      }

      busy = true;
      if (apply) apply.disabled = true;
      try {
        if (pickerMode === "single") {
          const selectedId = Array.from(draft)[0];
          const selectedNote = candidateMap().get(selectedId);
          if (!selectedNote) throw new Error("Catatan tujuan tidak ditemukan.");

          // Simpan relation/backlink sebagai metadata. Backend 004I menjaga
          // hidden/private relations yang tidak boleh dilihat collaborator.
          const keep = new Set(related.map(note => note.id));
          keep.add(selectedId);
          await window.NotesService.syncCatatanTerkait(ctx.noteId, Array.from(keep));
          related = await window.NotesService.ambilCatatanTerkait(ctx.noteId);
          loaded = true;
          layer.hidden = true;
          render();
          const callback = singleOnSelect;
          singleOnSelect = null;
          callback?.(selectedNote);
          return;
        }

        await window.NotesService.syncCatatanTerkait(ctx.noteId, Array.from(draft));
        layer.hidden = true;
        await loadRelated({ explicit: true });
        toast("Catatan Terkait diperbarui.");
      } catch (error) {
        console.error("[Catatan Related Apply]", error);
        if (window.NotesService?.relatedSchemaBelumTerpasang?.(error)) toast("Jalankan SQL 004I agar Catatan Terkait aktif.");
        else toast(error?.message || "Tautan catatan belum dapat disimpan.");
      } finally {
        if (apply) apply.disabled = false;
        busy = false;
      }
    }

    async function unlinkTarget(targetId) {
      const ctx = context();
      const id = clean(targetId);
      if (!ctx.noteId || !ctx.canManage || !id || !window.NotesService?.syncCatatanTerkait) return false;
      try {
        const visible = await window.NotesService.ambilCatatanTerkait(ctx.noteId);
        const keep = visible.filter(note => note.id !== id).map(note => note.id);
        await window.NotesService.syncCatatanTerkait(ctx.noteId, keep);
        related = await window.NotesService.ambilCatatanTerkait(ctx.noteId);
        loaded = true;
        render();
        return true;
      } catch (error) {
        console.warn("[Catatan Inline Unlink]", error);
        return false;
      }
    }

    function closePicker() {
      layer.hidden = true;
      singleOnSelect = null;
      pickerMode = "manage";
    }

    layer.querySelector("[data-related-close]")?.addEventListener("click", closePicker);
    layer.querySelector("[data-related-cancel]")?.addEventListener("click", closePicker);
    layer.querySelector("[data-related-apply]")?.addEventListener("click", applyPicker);
    layer.querySelector("[data-related-search]")?.addEventListener("input", renderPicker);
    layer.addEventListener("click", event => { if (event.target === layer) closePicker(); });

    render();

    return {
      open: openPicker,
      openSingle,
      refresh: () => loadRelated({ explicit: false }),
      render,
      hrefFor: noteHref,
      unlinkTarget,
      get count() { return related.length; }
    };
  }

  function init(options = {}) {
    activeController = createController(options);
    return activeController;
  }

  window.CatatanRelated = {
    init,
    open() { return activeController?.open?.(); },
    openSingle(options) { return activeController?.openSingle?.(options); },
    refresh() { return activeController?.refresh?.(); },
    render() { return activeController?.render?.(); },
    hrefFor(note) { return activeController?.hrefFor?.(note) || ""; },
    unlinkTarget(noteId) { return activeController?.unlinkTarget?.(noteId); }
  };
})();
