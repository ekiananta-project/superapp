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
    const main = root?.querySelector(".catatan-editor-main");
    if (!root || !main) return null;

    let related = [];
    let candidates = [];
    let loaded = false;
    let draft = new Set();
    let busy = false;
    let warnedSchema = false;
    let actionTarget = null;

    const section = document.createElement("section");
    section.className = "catatan-related-section";
    section.dataset.relatedSection = "";
    section.hidden = true;
    section.innerHTML = `
      <div class="catatan-related-heading">
        <div>
          <h2>Catatan Terkait</h2>
          <small data-related-count>0 catatan</small>
        </div>
        <button type="button" class="catatan-related-manage" data-related-manage>Kelola</button>
      </div>
      <div class="catatan-related-cards" data-related-cards></div>
      <div class="catatan-related-empty" data-related-empty hidden>
        <span><ion-icon name="git-network-outline" aria-hidden="true"></ion-icon></span>
        <div>
          <strong>Hubungkan catatan</strong>
          <p>Buat jalan cepat ke catatan atau checklist yang masih berhubungan.</p>
        </div>
        <button type="button" data-related-empty-add>+ Hubungkan catatan</button>
      </div>
    `;
    main.appendChild(section);

    const layer = document.createElement("div");
    layer.className = "catatan-sheet-layer catatan-related-layer";
    layer.dataset.relatedLayer = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="catatan-sheet catatan-editor-sheet catatan-related-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-related-title">
        <div class="catatan-sheet-handle" aria-hidden="true"></div>
        <div class="catatan-sheet-header">
          <div><small>Hubungkan</small><h2 id="catatan-related-title">Catatan Terkait</h2></div>
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

    const actionLayer = document.createElement("div");
    actionLayer.className = "catatan-sheet-layer catatan-related-action-layer";
    actionLayer.hidden = true;
    actionLayer.innerHTML = `
      <section class="catatan-sheet catatan-related-action-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-related-action-title">
        <div class="catatan-sheet-handle" aria-hidden="true"></div>
        <div class="catatan-sheet-header">
          <div><small>Catatan Terkait</small><h2 id="catatan-related-action-title" data-related-action-title>Catatan</h2></div>
          <button class="catatan-sheet-close" type="button" data-related-action-close aria-label="Tutup"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <button class="catatan-related-unlink-action" type="button" data-related-unlink-action>
          <ion-icon name="unlink-outline" aria-hidden="true"></ion-icon>
          <span><strong>Lepas hubungan</strong><small>Catatan tidak dihapus. Hanya hubungan antarcatatan yang dilepas.</small></span>
        </button>
      </section>
    `;
    root.appendChild(actionLayer);

    function context() {
      return { canManage: false, isReminder: false, noteId: "", userId: "", folderName: "", ...getContext() };
    }

    function infoSummary() {
      const small = q('[data-info-action="related"] small');
      if (!small) return;
      const ctx = context();
      if (ctx.noteId && !loaded) {
        small.textContent = "Memuat hubungan...";
        return;
      }
      small.textContent = related.length ? `${related.length} catatan terhubung` : "Belum ada catatan terhubung";
    }

    function noteMeta(note) {
      const parts = [];
      parts.push(note.scope === "family" ? "Area Keluarga" : "Area Pribadi");
      if (note.folder_name) parts.push(note.folder_name);
      if (note.archived_at) parts.push("Diarsipkan");
      return parts.join(" · ");
    }

    function noteIcon(note) {
      return note.note_type === "checklist" ? "checkbox-outline" : "document-text-outline";
    }

    function noteHref(note) {
      const ctx = context();
      const page = note.note_type === "checklist" ? "catatan-checklist.html" : "catatan-editor.html";
      const url = new URL(page, location.href);
      url.searchParams.set("scope", note.scope === "family" ? "family" : "personal");
      url.searchParams.set("id", note.id);
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

    function renderSection() {
      const ctx = context();
      const canManage = Boolean(ctx.canManage && !ctx.isReminder);
      infoSummary();
      if (ctx.noteId && !loaded) {
        section.hidden = true;
        return;
      }
      const visible = !ctx.isReminder && (related.length > 0 || canManage);
      section.hidden = !visible;
      if (!visible) return;

      const count = section.querySelector("[data-related-count]");
      if (count) count.textContent = related.length ? `${related.length} terhubung` : "Belum ada";

      const manage = section.querySelector("[data-related-manage]");
      if (manage) {
        manage.hidden = related.length === 0 || (!canManage && related.length <= 3);
        manage.textContent = canManage
          ? (related.length > 3 ? `Kelola · ${related.length}` : "Kelola")
          : `Lihat semua · ${related.length}`;
      }

      const empty = section.querySelector("[data-related-empty]");
      const cards = section.querySelector("[data-related-cards]");
      if (empty) empty.hidden = related.length !== 0 || !canManage;
      if (!cards) return;

      cards.innerHTML = "";
      related.slice(0, 3).forEach(note => {
        const card = document.createElement("article");
        card.className = "catatan-related-card";
        card.innerHTML = `
          <button class="catatan-related-card-main" type="button" data-open-related-note aria-label="Buka ${escapeHtml(clean(note.title, "Tanpa judul"))}">
            <span class="catatan-related-card-icon"><ion-icon name="${noteIcon(note)}" aria-hidden="true"></ion-icon></span>
            <span class="catatan-related-card-copy">
              <strong>${escapeHtml(clean(note.title, "Tanpa judul"))}</strong>
              <small>${escapeHtml(noteMeta(note))}</small>
            </span>
            <ion-icon class="catatan-related-card-chevron" name="chevron-forward-outline" aria-hidden="true"></ion-icon>
          </button>
          ${canManage ? '<button class="catatan-related-card-menu" type="button" data-related-card-menu aria-label="Menu hubungan"><ion-icon name="ellipsis-horizontal" aria-hidden="true"></ion-icon></button>' : ""}
        `;
        card.querySelector("[data-open-related-note]")?.addEventListener("click", () => openNote(note));
        card.querySelector("[data-related-card-menu]")?.addEventListener("click", () => openAction(note));
        cards.appendChild(card);
      });
    }

    function matchSearch(note, query) {
      if (!query) return true;
      const haystack = [note.title, note.folder_name, note.scope === "family" ? "keluarga" : "pribadi", note.note_type === "checklist" ? "checklist" : "catatan"]
        .map(value => String(value || "").toLowerCase())
        .join(" ");
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
      if (readOnly) row.addEventListener("click", () => openNote(note));
      else row.addEventListener("click", () => {
        if (draft.has(note.id)) draft.delete(note.id);
        else draft.add(note.id);
        renderPicker();
      });
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

    function renderPicker() {
      const container = layer.querySelector("[data-related-picker]");
      const empty = layer.querySelector("[data-related-picker-empty]");
      const search = clean(layer.querySelector("[data-related-search]")?.value).toLowerCase();
      const ctx = context();
      if (!container) return;
      container.innerHTML = "";

      if (!ctx.canManage) {
        const visible = related.filter(note => matchSearch(note, search));
        addPickerGroup(container, "TERHUBUNG", visible, { readOnly: true });
        if (empty) empty.hidden = visible.length > 0;
        return;
      }

      const byId = new Map(candidates.map(note => [note.id, note]));
      related.forEach(note => { if (!byId.has(note.id)) byId.set(note.id, note); });

      // Selected stays visible even while filtering, so users always know what
      // will remain attached when they press Terapkan.
      const selectedNotes = Array.from(draft).map(id => byId.get(id)).filter(Boolean);
      const unselected = Array.from(byId.values())
        .filter(note => !draft.has(note.id) && !note.archived_at && matchSearch(note, search));
      const sameFolder = unselected.filter(note => note.is_same_folder || (ctx.folderName && note.folder_name === ctx.folderName));
      const sameIds = new Set(sameFolder.map(note => note.id));
      const others = unselected.filter(note => !sameIds.has(note.id));

      addPickerGroup(container, "DIPILIH", selectedNotes, { selected: true });
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
        toast("Tulis judul atau isi catatan dulu sebelum menghubungkan catatan.");
        return "";
      }
      return ctx.noteId;
    }

    async function loadRelated({ explicit = false } = {}) {
      const ctx = context();
      if (ctx.isReminder || !ctx.noteId || !window.NotesService?.ambilCatatanTerkait) {
        related = [];
        loaded = !ctx.noteId || ctx.isReminder;
        renderSection();
        return [];
      }
      try {
        related = await window.NotesService.ambilCatatanTerkait(ctx.noteId);
        loaded = true;
        renderSection();
        return related;
      } catch (error) {
        loaded = true;
        console.warn("[Catatan Terkait]", error);
        if (explicit && window.NotesService?.relatedSchemaBelumTerpasang?.(error)) {
          toast("Backend Catatan Terkait belum aktif — jalankan SQL 004I di Supabase dulu.");
          warnedSchema = true;
        }
        renderSection();
        return [];
      }
    }

    async function openPicker() {
      if (busy) return;
      const ctxBefore = context();
      if (ctxBefore.isReminder) {
        toast("Catatan Terkait untuk Reminder akan aktif bersama backend Reminder.");
        return;
      }
      const id = await ensureNote();
      if (!id) return;

      busy = true;
      layer.hidden = false;
      layer.classList.add("is-loading");
      const search = layer.querySelector("[data-related-search]");
      if (search) search.value = "";
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
        const titleSmall = layer.querySelector(".catatan-sheet-header small");
        if (titleSmall) titleSmall.textContent = ctx.canManage ? "Hubungkan" : "Lihat hubungan";
        renderSection();
        renderPicker();
        setTimeout(() => search?.focus(), 80);
      } catch (error) {
        console.error("[Catatan Related Picker]", error);
        layer.hidden = true;
        if (window.NotesService?.relatedSchemaBelumTerpasang?.(error)) {
          toast("Backend Catatan Terkait belum aktif — jalankan SQL 004I di Supabase dulu.");
          warnedSchema = true;
        } else {
          toast(error?.message || "Catatan Terkait belum dapat dimuat.");
        }
      } finally {
        layer.classList.remove("is-loading");
        busy = false;
      }
    }

    async function applyPicker() {
      const ctx = context();
      if (!ctx.canManage || busy || !ctx.noteId) return;
      busy = true;
      const apply = layer.querySelector("[data-related-apply]");
      if (apply) apply.disabled = true;
      try {
        await window.NotesService.syncCatatanTerkait(ctx.noteId, Array.from(draft));
        layer.hidden = true;
        await loadRelated({ explicit: true });
        toast("Catatan Terkait diperbarui.");
      } catch (error) {
        console.error("[Catatan Related Apply]", error);
        if (window.NotesService?.relatedSchemaBelumTerpasang?.(error)) toast("Jalankan SQL 004I agar Catatan Terkait aktif.");
        else toast(error?.message || "Hubungan catatan belum dapat disimpan.");
      } finally {
        if (apply) apply.disabled = false;
        busy = false;
      }
    }

    function openAction(note) {
      if (!context().canManage || !note?.id) return;
      actionTarget = note;
      const title = actionLayer.querySelector("[data-related-action-title]");
      if (title) title.textContent = clean(note.title, "Tanpa judul");
      actionLayer.hidden = false;
    }

    async function unlinkAction() {
      const ctx = context();
      if (!ctx.canManage || !ctx.noteId || !actionTarget || busy) return;
      busy = true;
      try {
        const keep = related.filter(note => note.id !== actionTarget.id).map(note => note.id);
        await window.NotesService.syncCatatanTerkait(ctx.noteId, keep);
        actionLayer.hidden = true;
        actionTarget = null;
        await loadRelated({ explicit: true });
        toast("Hubungan catatan dilepas.");
      } catch (error) {
        console.error("[Catatan Related Unlink]", error);
        toast(error?.message || "Hubungan catatan belum dapat dilepas.");
      } finally {
        busy = false;
      }
    }

    section.querySelector("[data-related-manage]")?.addEventListener("click", openPicker);
    section.querySelector("[data-related-empty-add]")?.addEventListener("click", openPicker);
    layer.querySelector("[data-related-close]")?.addEventListener("click", () => { layer.hidden = true; });
    layer.querySelector("[data-related-cancel]")?.addEventListener("click", () => { layer.hidden = true; });
    layer.querySelector("[data-related-apply]")?.addEventListener("click", applyPicker);
    layer.querySelector("[data-related-search]")?.addEventListener("input", renderPicker);
    layer.addEventListener("click", event => { if (event.target === layer) layer.hidden = true; });
    actionLayer.querySelector("[data-related-action-close]")?.addEventListener("click", () => { actionLayer.hidden = true; actionTarget = null; });
    actionLayer.querySelector("[data-related-unlink-action]")?.addEventListener("click", unlinkAction);
    actionLayer.addEventListener("click", event => { if (event.target === actionLayer) { actionLayer.hidden = true; actionTarget = null; } });

    renderSection();

    return {
      open: openPicker,
      refresh: () => loadRelated({ explicit: false }),
      render: renderSection,
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
    refresh() { return activeController?.refresh?.(); },
    render() { return activeController?.render?.(); }
  };
})();
