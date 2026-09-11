// RuangKitha v2.0.0a43 — Named Relation Graph + Inline Link Bridge
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
    const onLegacyGrouped = typeof options.onLegacyGrouped === "function" ? options.onLegacyGrouped : () => {};

    const root = q("[data-catatan-editor]") || q("[data-catatan-checklist]");
    if (!root) return null;

    let related = [];
    let relationGroups = [];
    let candidates = [];
    let ungroupedRelated = [];
    let loaded = false;
    let draft = new Set();
    let busy = false;
    let singleOnSelect = null;

    function context() {
      return {
        canManage: false,
        isReminder: false,
        noteId: "",
        userId: "",
        folderName: "",
        visibility: "private",
        scope: "personal",
        ...getContext()
      };
    }

    function noteMeta(note) {
      const parts = [];
      const type = note.note_type === "checklist" ? "Checklist" : note.note_type === "reminder" ? "Reminder" : "Catatan";
      parts.push(type);
      parts.push(note.scope === "family" ? "Area Keluarga" : "Area Pribadi");
      if (note.scope === "personal") parts.push(note.visibility === "family-read" ? "Keluarga dapat melihat" : "Hanya Saya");
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

    function infoSummary() {
      const small = q('[data-info-action="related"] small');
      if (!small) return;
      const ctx = context();
      if (ctx.noteId && !loaded) {
        small.textContent = "Memuat relasi...";
        return;
      }
      if (relationGroups.length) {
        small.textContent = `${relationGroups.length} relasi`;
      } else if (related.length) {
        small.textContent = `${related.length} tautan belum dikelompokkan`;
      } else {
        small.textContent = "Belum ada relasi";
      }
    }

    function render() {
      infoSummary();
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
      if (!ctx.noteId) {
        related = [];
        relationGroups = [];
        loaded = true;
        render();
        return [];
      }
      try {
        const tasks = [];
        tasks.push(window.NotesService?.ambilCatatanTerkait ? window.NotesService.ambilCatatanTerkait(ctx.noteId) : Promise.resolve([]));
        tasks.push(window.NotesService?.ambilRelasiUntukCatatan ? window.NotesService.ambilRelasiUntukCatatan(ctx.noteId) : Promise.resolve([]));
        const [legacy, groups] = await Promise.all(tasks);
        related = Array.isArray(legacy) ? legacy : [];
        relationGroups = Array.isArray(groups) ? groups : [];
        loaded = true;
        render();
        return relationGroups;
      } catch (error) {
        loaded = true;
        console.warn("[Relasi Catatan]", error);
        if (explicit && window.NotesService?.relationGraphSchemaBelumTerpasang?.(error)) {
          toast("Backend Relasi Catatan belum aktif — jalankan SQL 004M di Supabase dulu.");
        }
        render();
        return [];
      }
    }

    // ----------------------------------------------------------
    // Relation list sheet (Info -> Relasi Catatan)
    // ----------------------------------------------------------
    const relationLayer = document.createElement("div");
    relationLayer.className = "catatan-sheet-layer catatan-relation-list-layer";
    relationLayer.dataset.relationListLayer = "";
    relationLayer.hidden = true;
    relationLayer.innerHTML = `
      <section class="catatan-sheet catatan-editor-sheet catatan-relation-list-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-relation-list-title">
        <div class="catatan-sheet-handle" aria-hidden="true"></div>
        <div class="catatan-sheet-header">
          <div><small>Peta hubungan</small><h2 id="catatan-relation-list-title">Relasi Catatan</h2></div>
          <button class="catatan-sheet-close" type="button" data-relation-list-close aria-label="Tutup"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <p class="catatan-relation-list-intro">Pilih relasi untuk melihat peta node catatan yang saling terhubung.</p>
        <div class="catatan-relation-list" data-relation-list></div>
        <div class="catatan-relation-list-empty" data-relation-list-empty hidden>
          <span><ion-icon name="git-network-outline" aria-hidden="true"></ion-icon></span>
          <strong>Belum ada relasi</strong>
          <p>Buat tautan ke Catatan RuangKitha dari toolbar. Setelah memilih tujuan, kamu dapat membuat atau memilih nama relasinya.</p>
        </div>
        <div class="catatan-relation-legacy" data-relation-legacy hidden>
          <div class="catatan-relation-legacy-heading">
            <strong>Tautan lama</strong>
            <small>Belum masuk ke peta relasi</small>
          </div>
          <div data-relation-legacy-list></div>
        </div>
      </section>`;
    root.appendChild(relationLayer);

    function scopeLabel(scope) {
      return scope === "family" ? "Relasi Keluarga" : "Relasi Pribadi";
    }

    function graphHref(group) {
      const ctx = context();
      const url = new URL("catatan-relasi.html", location.href);
      url.searchParams.set("id", group.id);
      url.searchParams.set("scope", group.scope === "family" ? "family" : "personal");
      if (ctx.noteId) url.searchParams.set("focus", ctx.noteId);
      return `${url.pathname.split("/").pop()}${url.search}`;
    }

    async function computeUngroupedRelated() {
      if (!related.length || !relationGroups.length || !window.NotesService?.ambilGraphRelasi) {
        ungroupedRelated = related.slice();
        return ungroupedRelated;
      }
      const sourceId = context().noteId;
      const groupedTargets = new Set();
      const payloads = await Promise.allSettled(relationGroups.map(group => window.NotesService.ambilGraphRelasi(group.id)));
      payloads.forEach(result => {
        if (result.status !== "fulfilled") return;
        (result.value?.edges || []).forEach(edge => {
          if (edge.a === sourceId) groupedTargets.add(edge.b);
          if (edge.b === sourceId) groupedTargets.add(edge.a);
        });
      });
      ungroupedRelated = related.filter(note => !groupedTargets.has(note.id));
      return ungroupedRelated;
    }

    function renderRelationList() {
      const list = relationLayer.querySelector("[data-relation-list]");
      const empty = relationLayer.querySelector("[data-relation-list-empty]");
      const legacyBox = relationLayer.querySelector("[data-relation-legacy]");
      const legacyList = relationLayer.querySelector("[data-relation-legacy-list]");
      if (!list || !empty || !legacyBox || !legacyList) return;
      list.innerHTML = "";
      legacyList.innerHTML = "";

      relationGroups.forEach(group => {
        const link = document.createElement("a");
        link.className = "catatan-relation-list-row";
        link.href = graphHref(group);
        link.innerHTML = `
          <span class="catatan-relation-list-icon"><ion-icon name="git-network-outline" aria-hidden="true"></ion-icon></span>
          <span class="catatan-relation-list-copy">
            <strong>${escapeHtml(group.name)}</strong>
            <small>${escapeHtml(scopeLabel(group.scope))} · ${group.node_count} catatan</small>
          </span>
          <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>`;
        list.appendChild(link);
      });

      const canGroupLegacy = context().canManage && ungroupedRelated.length > 0;
      empty.hidden = relationGroups.length > 0 || canGroupLegacy;
      legacyBox.hidden = !canGroupLegacy;
      if (canGroupLegacy) {
        ungroupedRelated.forEach(note => {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "catatan-relation-legacy-row";
          row.innerHTML = `
            <span class="catatan-related-picker-icon"><ion-icon name="${noteIcon(note)}" aria-hidden="true"></ion-icon></span>
            <span><strong>${escapeHtml(clean(note.title, "Tanpa judul"))}</strong><small>${escapeHtml(noteMeta(note))}</small></span>
            <em>Kelompokkan</em>`;
          row.addEventListener("click", async () => {
            const choice = await chooseRelationForPair(note);
            if (!choice) return;
            try {
              const savedRelationId = await window.NotesService.simpanEdgeRelasi(context().noteId, note.id, choice);
              onLegacyGrouped(note.id, savedRelationId);
              toast("Tautan dimasukkan ke peta relasi.");
              await loadRelated({ explicit: true });
              await computeUngroupedRelated();
              renderRelationList();
            } catch (error) {
              console.error("[Relasi Legacy Group]", error);
              toast(error?.message || "Relasi belum dapat disimpan.");
            }
          });
          legacyList.appendChild(row);
        });
      }
    }

    async function openRelationList() {
      const id = await ensureNote();
      if (!id) return;
      relationLayer.hidden = false;
      relationLayer.classList.add("is-loading");
      try {
        await loadRelated({ explicit: true });
        await computeUngroupedRelated();
        renderRelationList();
      } finally {
        relationLayer.classList.remove("is-loading");
      }
    }

    function closeRelationList() {
      relationLayer.hidden = true;
    }

    relationLayer.querySelector("[data-relation-list-close]")?.addEventListener("click", closeRelationList);
    relationLayer.addEventListener("click", event => { if (event.target === relationLayer) closeRelationList(); });

    // ----------------------------------------------------------
    // Note target picker used by editor bottom toolbar
    // ----------------------------------------------------------
    const pickerLayer = document.createElement("div");
    pickerLayer.className = "catatan-sheet-layer catatan-related-layer";
    pickerLayer.dataset.relatedLayer = "";
    pickerLayer.hidden = true;
    pickerLayer.innerHTML = `
      <section class="catatan-sheet catatan-editor-sheet catatan-related-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-related-title">
        <div class="catatan-sheet-handle" aria-hidden="true"></div>
        <div class="catatan-sheet-header">
          <div><small>Tautkan teks</small><h2 id="catatan-related-title">Pilih Catatan</h2></div>
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
        <div class="catatan-related-actions">
          <button class="is-secondary" type="button" data-related-cancel>Batal</button>
          <button class="is-primary" type="button" data-related-apply>Tautkan</button>
        </div>
      </section>`;
    root.appendChild(pickerLayer);

    function matchSearch(note, query) {
      if (!query) return true;
      const haystack = [
        note.title,
        note.folder_name,
        note.scope === "family" ? "keluarga" : "pribadi",
        note.visibility === "family-read" ? "keluarga dapat melihat" : "hanya saya",
        note.note_type === "checklist" ? "checklist" : note.note_type === "reminder" ? "reminder" : "catatan"
      ].map(value => String(value || "").toLowerCase()).join(" ");
      return haystack.includes(query);
    }

    function candidateMap() {
      const byId = new Map(candidates.map(note => [note.id, note]));
      related.forEach(note => { if (!byId.has(note.id)) byId.set(note.id, note); });
      return byId;
    }

    function pickerRow(note, selected) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `catatan-related-picker-row${selected ? " is-selected" : ""}${note.archived_at ? " is-archived" : ""}`;
      row.innerHTML = `
        <span class="catatan-related-picker-icon"><ion-icon name="${noteIcon(note)}" aria-hidden="true"></ion-icon></span>
        <span class="catatan-related-picker-copy">
          <strong>${escapeHtml(clean(note.title, "Tanpa judul"))}</strong>
          <small>${escapeHtml(noteMeta(note))}</small>
        </span>
        <ion-icon class="catatan-related-picker-check" name="${selected ? "checkmark-circle" : "ellipse-outline"}" aria-hidden="true"></ion-icon>`;
      row.addEventListener("click", () => {
        draft = new Set([note.id]);
        renderPicker();
      });
      return row;
    }

    function addPickerGroup(container, label, notes, { selected = false } = {}) {
      if (!notes.length) return;
      const group = document.createElement("section");
      group.className = "catatan-related-picker-group";
      const heading = document.createElement("div");
      heading.className = "catatan-related-picker-heading";
      heading.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${notes.length}</span>`;
      group.appendChild(heading);
      notes.forEach(note => group.appendChild(pickerRow(note, selected || draft.has(note.id))));
      container.appendChild(group);
    }

    function renderPicker() {
      const container = pickerLayer.querySelector("[data-related-picker]");
      const empty = pickerLayer.querySelector("[data-related-picker-empty]");
      const search = clean(pickerLayer.querySelector("[data-related-search]")?.value).toLowerCase();
      const ctx = context();
      if (!container) return;
      container.innerHTML = "";

      const byId = candidateMap();
      const selectedNotes = Array.from(draft).map(id => byId.get(id)).filter(Boolean);
      const unselected = Array.from(byId.values())
        .filter(note => !draft.has(note.id) && !note.archived_at && matchSearch(note, search));
      const sameFolder = unselected.filter(note => note.is_same_folder || (ctx.folderName && note.folder_name === ctx.folderName));
      const sameIds = new Set(sameFolder.map(note => note.id));
      const others = unselected.filter(note => !sameIds.has(note.id));

      addPickerGroup(container, "DIPILIH", selectedNotes, { selected: true });
      addPickerGroup(container, "FOLDER YANG SAMA", sameFolder);
      addPickerGroup(container, "CATATAN LAINNYA", others);
      if (empty) empty.hidden = (selectedNotes.length + sameFolder.length + others.length) > 0;
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
      const search = pickerLayer.querySelector("[data-related-search]");
      if (search) search.value = "";
      pickerLayer.hidden = false;
      pickerLayer.classList.add("is-loading");
      try {
        related = await window.NotesService.ambilCatatanTerkait(id);
        candidates = await window.NotesService.ambilKandidatCatatanTerkait(id, 250);
        const target = clean(currentTargetId);
        draft = target ? new Set([target]) : new Set();
        renderPicker();
        setTimeout(() => pickerLayer.querySelector("[data-related-search]")?.focus(), 80);
      } catch (error) {
        console.error("[Catatan Inline Link Picker]", error);
        pickerLayer.hidden = true;
        if (window.NotesService?.relatedSchemaBelumTerpasang?.(error)) toast("Backend tautan catatan belum aktif — jalankan SQL 004I di Supabase dulu.");
        else toast(error?.message || "Daftar catatan belum dapat dimuat.");
      } finally {
        pickerLayer.classList.remove("is-loading");
        busy = false;
      }
    }

    // ----------------------------------------------------------
    // Relation assignment after selecting a note target
    // ----------------------------------------------------------
    const assignLayer = document.createElement("div");
    assignLayer.className = "catatan-sheet-layer catatan-relation-assign-layer";
    assignLayer.dataset.relationAssignLayer = "";
    assignLayer.hidden = true;
    assignLayer.innerHTML = `
      <section class="catatan-sheet catatan-editor-sheet catatan-relation-assign-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-relation-assign-title">
        <div class="catatan-sheet-handle" aria-hidden="true"></div>
        <div class="catatan-sheet-header">
          <div><small>Peta hubungan</small><h2 id="catatan-relation-assign-title">Hubungkan ke relasi</h2></div>
          <button class="catatan-sheet-close" type="button" data-relation-assign-close aria-label="Tutup"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <p class="catatan-relation-assign-copy" data-relation-assign-copy></p>
        <div class="catatan-relation-existing" data-relation-existing></div>
        <button class="catatan-relation-create-toggle" type="button" data-relation-create-toggle>
          <ion-icon name="add-circle-outline" aria-hidden="true"></ion-icon>
          <span><strong>Buat relasi baru</strong><small>Beri nama konteks hubungan catatan ini.</small></span>
          <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>
        </button>
        <div class="catatan-relation-create-fields" data-relation-create-fields hidden>
          <label><span>Nama relasi</span><input type="text" maxlength="120" placeholder="Contoh: Renovasi Rumah" data-relation-name></label>
          <div class="catatan-relation-scope-wrap" data-relation-scope-wrap>
            <span>Simpan sebagai</span>
            <div class="catatan-relation-scope-options" data-relation-scope-options></div>
          </div>
        </div>
        <div class="catatan-related-actions">
          <button class="is-secondary" type="button" data-relation-assign-cancel>Batal</button>
          <button class="is-primary" type="button" data-relation-assign-ok>Oke</button>
        </div>
      </section>`;
    root.appendChild(assignLayer);

    let assignResolver = null;
    let assignTargetNote = null;
    let assignOptions = { scopes: [], relations: [] };
    let assignSelection = { mode: "new", relationId: "", scope: "personal" };

    function closeAssign(result = null) {
      assignLayer.hidden = true;
      const resolve = assignResolver;
      assignResolver = null;
      if (resolve) resolve(result);
    }

    function renderAssignOptions(targetNote = assignTargetNote) {
      if (targetNote) assignTargetNote = targetNote;
      targetNote = assignTargetNote;
      const existing = assignLayer.querySelector("[data-relation-existing]");
      const fields = assignLayer.querySelector("[data-relation-create-fields]");
      const scopeWrap = assignLayer.querySelector("[data-relation-scope-wrap]");
      const scopeOptions = assignLayer.querySelector("[data-relation-scope-options]");
      const copy = assignLayer.querySelector("[data-relation-assign-copy]");
      if (copy) copy.textContent = `“${clean(targetNote?.title, "Catatan tujuan")}” akan ditambahkan ke peta hubungan catatan.`;
      if (!existing || !fields || !scopeOptions) return;
      existing.innerHTML = "";
      scopeOptions.innerHTML = "";

      if (assignOptions.relations.length) {
        const heading = document.createElement("div");
        heading.className = "catatan-relation-existing-heading";
        heading.textContent = "PILIH RELASI YANG SUDAH ADA";
        existing.appendChild(heading);
        assignOptions.relations.forEach(group => {
          const row = document.createElement("button");
          row.type = "button";
          row.className = `catatan-relation-choice${assignSelection.mode === "existing" && assignSelection.relationId === group.id ? " is-selected" : ""}`;
          row.innerHTML = `
            <span class="catatan-relation-choice-icon"><ion-icon name="git-network-outline"></ion-icon></span>
            <span><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(scopeLabel(group.scope))} · ${group.node_count} catatan</small></span>
            <ion-icon name="${assignSelection.mode === "existing" && assignSelection.relationId === group.id ? "checkmark-circle" : "ellipse-outline"}"></ion-icon>`;
          row.addEventListener("click", () => {
            assignSelection = { mode: "existing", relationId: group.id, scope: group.scope };
            fields.hidden = true;
            renderAssignOptions(targetNote);
          });
          existing.appendChild(row);
        });
      }

      const scopes = assignOptions.scopes.map(item => item.scope);
      if (!scopes.includes(assignSelection.scope)) {
        assignSelection.scope = scopes.includes(context().scope === "family" ? "family" : "personal")
          ? (context().scope === "family" ? "family" : "personal")
          : (scopes[0] || "personal");
      }
      scopeWrap.hidden = scopes.length <= 1;
      scopes.forEach(scope => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = assignSelection.scope === scope ? "is-selected" : "";
        button.dataset.scope = scope;
        button.innerHTML = `<ion-icon name="${scope === "family" ? "people-outline" : "person-outline"}"></ion-icon><span>${scope === "family" ? "Keluarga" : "Pribadi"}</span>`;
        button.addEventListener("click", () => {
          assignSelection = { mode: "new", relationId: "", scope };
          fields.hidden = false;
          renderAssignOptions(targetNote);
          setTimeout(() => assignLayer.querySelector("[data-relation-name]")?.focus(), 20);
        });
        scopeOptions.appendChild(button);
      });
    }

    async function chooseRelationForPair(targetNote) {
      const ctx = context();
      if (!window.NotesService?.ambilOpsiRelasiPasangan || !window.NotesService?.simpanEdgeRelasi) {
        toast("Relasi Catatan belum siap.");
        return null;
      }
      let optionsData;
      try {
        optionsData = await window.NotesService.ambilOpsiRelasiPasangan(ctx.noteId, targetNote.id);
      } catch (error) {
        console.error("[Relation Pair Options]", error);
        if (window.NotesService?.relationGraphSchemaBelumTerpasang?.(error)) toast("Jalankan SQL 004M agar Peta Relasi aktif.");
        else toast(error?.message || "Pilihan relasi belum dapat dimuat.");
        return null;
      }
      if (!optionsData?.scopes?.length) {
        toast("Kedua catatan belum dapat dimasukkan ke relasi.");
        return null;
      }

      assignOptions = optionsData;
      assignTargetNote = targetNote;
      const preferredScope = optionsData.scopes.some(item => item.scope === "family") && ctx.scope === "family" ? "family" : "personal";
      const preferredExisting = optionsData.relations.find(item => item.scope === preferredScope) || optionsData.relations[0] || null;
      assignSelection = { mode: preferredExisting ? "existing" : "new", relationId: preferredExisting?.id || "", scope: preferredExisting?.scope || preferredScope };
      const fields = assignLayer.querySelector("[data-relation-create-fields]");
      const input = assignLayer.querySelector("[data-relation-name]");
      if (input) input.value = "";
      if (fields) fields.hidden = assignSelection.mode !== "new";
      assignLayer.hidden = false;
      renderAssignOptions(targetNote);
      if (assignSelection.mode === "new") setTimeout(() => input?.focus(), 80);

      return new Promise(resolve => { assignResolver = resolve; });
    }

    assignLayer.querySelector("[data-relation-create-toggle]")?.addEventListener("click", () => {
      const scopes = assignOptions.scopes.map(item => item.scope);
      const preferred = scopes.includes(context().scope === "family" ? "family" : "personal")
        ? (context().scope === "family" ? "family" : "personal")
        : (scopes[0] || "personal");
      assignSelection = { mode: "new", relationId: "", scope: preferred };
      const fields = assignLayer.querySelector("[data-relation-create-fields]");
      if (fields) fields.hidden = false;
      renderAssignOptions();
      setTimeout(() => assignLayer.querySelector("[data-relation-name]")?.focus(), 40);
    });
    assignLayer.querySelector("[data-relation-assign-close]")?.addEventListener("click", () => closeAssign(null));
    assignLayer.querySelector("[data-relation-assign-cancel]")?.addEventListener("click", () => closeAssign(null));
    assignLayer.querySelector("[data-relation-assign-ok]")?.addEventListener("click", () => {
      if (assignSelection.mode === "existing") {
        const group = assignOptions.relations.find(item => item.id === assignSelection.relationId);
        if (!group) return;
        closeAssign({ relationId: group.id, scope: group.scope, name: group.name });
        return;
      }
      const name = clean(assignLayer.querySelector("[data-relation-name]")?.value);
      if (!name) {
        toast("Beri nama untuk relasi catatan ini.");
        assignLayer.querySelector("[data-relation-name]")?.focus();
        return;
      }
      closeAssign({ relationId: "", scope: assignSelection.scope, name });
    });
    assignLayer.addEventListener("click", event => { if (event.target === assignLayer) closeAssign(null); });

    async function applyPicker() {
      const ctx = context();
      if (busy || !ctx.noteId) return;
      if (draft.size !== 1) {
        toast("Pilih satu catatan sebagai tujuan tautan.");
        return;
      }
      const selectedId = Array.from(draft)[0];
      const selectedNote = candidateMap().get(selectedId);
      if (!selectedNote) {
        toast("Catatan tujuan tidak ditemukan.");
        return;
      }

      busy = true;
      const apply = pickerLayer.querySelector("[data-related-apply]");
      if (apply) apply.disabled = true;
      try {
        pickerLayer.hidden = true;
        const relationChoice = await chooseRelationForPair(selectedNote);
        if (!relationChoice) {
          pickerLayer.hidden = false;
          return;
        }
        const savedRelationId = await window.NotesService.simpanEdgeRelasi(ctx.noteId, selectedId, relationChoice);

        // Keep legacy bidirectional metadata for backlink compatibility while
        // named relation graphs become the primary relation model.
        const keep = new Set(related.map(note => note.id));
        keep.add(selectedId);
        try {
          await window.NotesService.syncCatatanTerkait(ctx.noteId, Array.from(keep));
        } catch (legacyError) {
          console.warn("[Catatan Legacy Backlink Compatibility]", legacyError);
        }
        await loadRelated({ explicit: false });

        const callback = singleOnSelect;
        singleOnSelect = null;
        callback?.(selectedNote, { relationId: savedRelationId, relation: relationChoice });
      } catch (error) {
        console.error("[Catatan Relation Link Apply]", error);
        pickerLayer.hidden = false;
        if (window.NotesService?.relationGraphSchemaBelumTerpasang?.(error)) toast("Jalankan SQL 004M agar Peta Relasi aktif.");
        else toast(error?.message || "Tautan catatan belum dapat disimpan.");
      } finally {
        if (apply) apply.disabled = false;
        busy = false;
      }
    }

    async function unlinkTarget(targetId, relationId = "", keepLegacy = false) {
      const ctx = context();
      const id = clean(targetId);
      if (!ctx.noteId || !ctx.canManage || !id) return false;
      try {
        if (!keepLegacy) {
          const visible = await window.NotesService.ambilCatatanTerkait(ctx.noteId);
          const keep = visible.filter(note => note.id !== id).map(note => note.id);
          await window.NotesService.syncCatatanTerkait(ctx.noteId, keep);
        }
        const exactRelationId = clean(relationId);
        if (exactRelationId && window.NotesService?.hapusEdgeRelasiPasangan) {
          await window.NotesService.hapusEdgeRelasiPasangan(ctx.noteId, id, exactRelationId);
        }
        await loadRelated({ explicit: false });
        return true;
      } catch (error) {
        console.warn("[Catatan Inline Unlink]", error);
        return false;
      }
    }

    function closePicker() {
      pickerLayer.hidden = true;
      singleOnSelect = null;
    }

    pickerLayer.querySelector("[data-related-close]")?.addEventListener("click", closePicker);
    pickerLayer.querySelector("[data-related-cancel]")?.addEventListener("click", closePicker);
    pickerLayer.querySelector("[data-related-apply]")?.addEventListener("click", applyPicker);
    pickerLayer.querySelector("[data-related-search]")?.addEventListener("input", renderPicker);
    pickerLayer.addEventListener("click", event => { if (event.target === pickerLayer) closePicker(); });

    render();

    return {
      open: openRelationList,
      openSingle,
      refresh: () => loadRelated({ explicit: false }),
      render,
      hrefFor: noteHref,
      unlinkTarget,
      get count() { return relationGroups.length; }
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
    unlinkTarget(noteId, relationId, keepLegacy = false) { return activeController?.unlinkTarget?.(noteId, relationId, keepLegacy); }
  };
})();
