(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let userId = "";
  let familyId = "";
  let backendNoteCount = null;
  let backendFolderCount = null;
  let notesById = new Map();
  let selectionMode = false;
  const selectedIds = new Set();

  function clean(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function showToast(message) {
    const el = q("[data-catatan-toast]");
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  function openCreateSheet() {
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = false;
  }

  function closeCreateSheet() {
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = true;
  }

  function ensureEmpty(kind) {
    const selector = kind === "folders" ? "[data-backend-folders-empty]" : "[data-backend-notes-empty]";
    let empty = q(selector);
    if (empty) return empty;
    const section = kind === "folders"
      ? q("[data-family-folder-grid]")?.closest(".catatan-area-section")
      : q(".catatan-notes-section");
    if (!section || !window.CatatanManagement) return null;
    empty = CatatanManagement.createEmptyState(kind, kind === "folders" ? {
      title: "Belum ada folder keluarga",
      message: "Folder bersama yang dibuat keluarga akan tampil di sini."
    } : {
      title: "Belum ada Catatan Keluarga",
      message: "Buat catatan atau checklist pertama untuk ruang keluarga ini.",
      actionLabel: "Buat catatan",
      onAction: openCreateSheet
    });
    if (kind === "folders") empty.dataset.backendFoldersEmpty = "";
    else empty.dataset.backendNotesEmpty = "";
    empty.hidden = true;
    section.appendChild(empty);
    return empty;
  }

  function filterPreview() {
    const needle = clean(q("#catatan-family-search")?.value).toLocaleLowerCase("id-ID");
    let visibleItems = 0;
    qa("[data-preview-item]").forEach(item => {
      const visible = !needle || clean(item.dataset.searchText).toLocaleLowerCase("id-ID").includes(needle);
      item.hidden = !visible;
      if (visible) visibleItems += 1;
    });
    const searchEmpty = q("[data-search-empty]");
    if (searchEmpty) searchEmpty.hidden = !needle || visibleItems > 0;
    const noteEmpty = q("[data-backend-notes-empty]");
    if (noteEmpty && backendNoteCount !== null) noteEmpty.hidden = backendNoteCount !== 0 || Boolean(needle);
    const folderEmpty = q("[data-backend-folders-empty]");
    if (folderEmpty && backendFolderCount !== null) folderEmpty.hidden = backendFolderCount !== 0 || Boolean(needle);
    if (selectionMode) renderSelectionUI();
  }

  async function confirmArchiveNote(note) {
    const title = clean(note?.title) || "Tanpa judul";
    const ok = await CatatanManagement.confirmArchive({
      title: `Arsipkan “${title}”?`,
      message: "Catatan Keluarga ini akan dipindahkan ke Arsip untuk seluruh anggota dan dapat dipulihkan nanti.",
      confirmLabel: "Arsipkan"
    });
    if (!ok) return;
    try {
      await NotesService.arsipkan(note.id);
      showToast("Catatan Keluarga dipindahkan ke Arsip.");
      selectedIds.delete(note.id);
      await loadBackendNotes();
    } catch (error) {
      console.error("[Catatan Family Archive]", error);
      if (NotesService.lifecycleSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004F agar fitur Arsip aktif.");
      else showToast(error?.message || "Catatan belum dapat diarsipkan.");
    }
  }

  async function confirmDeleteFolder(folder) {
    const count = Number(folder?.deleteCount ?? folder?.noteCount ?? 0);
    const ok = await CatatanManagement.confirmDanger({
      title: `Hapus folder “${clean(folder?.name) || "Folder"}”?`,
      message: count
        ? `${count} catatan/checklist keluarga di dalam folder ini juga akan dihapus permanen untuk seluruh anggota.`
        : "Folder keluarga ini kosong dan akan dihapus permanen.",
      confirmLabel: "Hapus folder"
    });
    if (!ok) return;
    try {
      await NotesService.hapusFolder(folder.id);
      showToast("Folder Keluarga dihapus.");
      await Promise.all([loadBackendFolders(), loadBackendNotes()]);
    } catch (error) {
      console.error("[Catatan Family Folder Delete]", error);
      showToast(error?.message || "Folder belum dapat dihapus.");
    }
  }

  function toggleSelected(id, canSelect = true) {
    if (!selectionMode || !id) return;
    if (!canSelect) {
      showToast("Hanya pembuat catatan atau Family Owner yang dapat mengarsipkannya.");
      return;
    }
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    renderSelectionUI();
  }

  function noteCard(note) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catatan-note-card";
    button.dataset.noteId = clean(note?.id);
    const isChecklist = note?.note_type === "checklist";
    const title = clean(note?.title) || "Tanpa judul";
    const body = clean(note?.body_text) || (isChecklist ? "Checklist belum memiliki item." : "Catatan belum memiliki isi.");
    const preview = body.length > 180 ? `${body.slice(0, 177)}...` : body;
    const own = note?.created_by === userId;
    const access = own ? "Area Keluarga · Kamu pembuat" : "Area Keluarga · Kolaboratif";
    const tags = Array.isArray(note?._tags) ? note._tags : [];
    button.dataset.searchText = clean(`${title} ${body} ${note?.folder_name || ""} ${access} ${tags.join(" ")}`);

    const type = document.createElement("span");
    type.className = "catatan-note-type";
    type.innerHTML = `<ion-icon name="${isChecklist ? "checkbox-outline" : "document-text-outline"}" aria-hidden="true"></ion-icon>`;
    const titleEl = document.createElement("strong");
    titleEl.textContent = title;
    const previewEl = document.createElement("span");
    previewEl.className = "catatan-note-preview";
    previewEl.textContent = preview;
    const accessEl = document.createElement("small");
    accessEl.className = "catatan-note-access";
    accessEl.textContent = access;

    button.append(type, titleEl);
    if (note?.pinned) {
      const pin = document.createElement("span");
      pin.className = "catatan-note-special";
      pin.textContent = "Dipin";
      button.appendChild(pin);
    }
    button.appendChild(previewEl);
    const tagSummary = CatatanManagement.renderTagSummary(tags);
    if (tagSummary) button.appendChild(tagSummary);
    button.appendChild(accessEl);
    button.addEventListener("click", () => {
      if (selectionMode) return toggleSelected(note.id, Boolean(note?._canArchive));
      location.href = isChecklist
        ? `catatan-checklist.html?scope=family&id=${encodeURIComponent(note.id)}`
        : `catatan-editor.html?scope=family&id=${encodeURIComponent(note.id)}`;
    });
    button.dataset.previewItem = "";

    const actions = note?._canArchive ? [{
      label: "Arsipkan",
      icon: "archive-outline",
      tone: "archive",
      onSelect: () => confirmArchiveNote(note)
    }] : [];
    const shell = CatatanManagement.createCardShell(button, {
      actions,
      menuLabel: `Menu ${title}`
    });
    CatatanManagement.attachSelectionControl(shell, {
      selectable: Boolean(note?._canArchive),
      label: note?._canArchive ? `Pilih ${title}` : `${title} tidak dapat diarsipkan oleh akun ini`,
      onToggle: () => toggleSelected(note.id, Boolean(note?._canArchive))
    });
    return shell;
  }

  function folderCard(folder) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catatan-folder-card";
    button.dataset.folderName = clean(folder?.name);
    button.dataset.searchText = clean(`${folder?.name || ""} folder catatan keluarga`);
    button.innerHTML = '<span class="catatan-folder-icon"><ion-icon name="folder-outline" aria-hidden="true"></ion-icon></span>';
    const copy = document.createElement("span");
    copy.className = "catatan-folder-copy";
    const strong = document.createElement("strong");
    strong.textContent = clean(folder?.name) || "Folder";
    const small = document.createElement("small");
    small.textContent = `${Number(folder?.noteCount || 0)} catatan`;
    copy.append(strong, small);
    button.appendChild(copy);
    button.addEventListener("click", () => {
      if (!folder?.name) return;
      location.href = `catatan-folder.html?scope=family&folder=${encodeURIComponent(folder.name)}`;
    });
    button.dataset.previewItem = "";
    return CatatanManagement.createCardShell(button, {
      canDelete: Boolean(folder?.canDelete),
      deleteLabel: "Hapus folder",
      menuLabel: `Menu folder ${clean(folder?.name)}`,
      onDelete: () => confirmDeleteFolder(folder)
    });
  }

  function renderBackendNotes(notes = []) {
    const grid = q("[data-family-note-grid]");
    if (!grid) return;
    grid.textContent = "";
    backendNoteCount = notes.length;
    notesById = new Map(notes.map(note => [clean(note.id), note]));
    for (const id of Array.from(selectedIds)) {
      if (!notesById.get(id)?._canArchive) selectedIds.delete(id);
    }
    notes.forEach(note => grid.appendChild(noteCard(note)));
    const empty = ensureEmpty("notes");
    if (empty) empty.hidden = notes.length !== 0;
    filterPreview();
    renderSelectionUI();
  }

  function renderBackendFolders(folders = []) {
    const grid = q("[data-family-folder-grid]");
    if (!grid) return;
    grid.textContent = "";
    backendFolderCount = folders.length;
    folders.forEach(folder => grid.appendChild(folderCard(folder)));
    const empty = ensureEmpty("folders");
    if (empty) empty.hidden = folders.length !== 0;
    filterPreview();
  }

  function visibleSelectableIds() {
    return qa('[data-family-note-grid] .catatan-card-shell[data-note-selectable="true"]')
      .filter(shell => !shell.hidden)
      .map(shell => clean(shell.dataset.noteId))
      .filter(Boolean);
  }

  function manageableCount() {
    return Array.from(notesById.values()).filter(note => note?._canArchive).length;
  }

  function renderSelectionUI() {
    const root = q("[data-catatan-family]");
    root?.classList.toggle("is-selection-mode", selectionMode);
    const toggle = q("[data-toggle-selection]");
    const selectAll = q("[data-select-all]");
    const countLabel = q("[data-selection-count]");
    const bulk = q("[data-bulk-bar]");
    const bulkCount = q("[data-bulk-count]");
    const bulkArchive = q("[data-bulk-archive]");

    if (toggle) {
      toggle.textContent = selectionMode ? "Selesai" : "Pilih";
      toggle.disabled = !selectionMode && manageableCount() === 0;
    }
    if (selectAll) selectAll.hidden = !selectionMode;
    if (countLabel) {
      countLabel.hidden = !selectionMode;
      countLabel.textContent = `${selectedIds.size} dipilih`;
    }
    if (bulk) bulk.hidden = !selectionMode;
    if (bulkCount) bulkCount.textContent = `${selectedIds.size} dipilih`;
    if (bulkArchive) bulkArchive.disabled = selectedIds.size === 0;

    const visibleIds = visibleSelectableIds();
    if (selectAll && selectionMode) {
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
      selectAll.textContent = allSelected ? "Batalkan semua" : "Pilih semua";
      selectAll.disabled = visibleIds.length === 0;
    }

    qa("[data-family-note-grid] .catatan-card-shell[data-note-id]").forEach(shell => {
      CatatanManagement.setSelectionState(shell, selectedIds.has(clean(shell.dataset.noteId)));
    });
  }

  function setSelectionMode(active) {
    selectionMode = Boolean(active);
    CatatanManagement.closeActiveMenu?.();
    if (!selectionMode) selectedIds.clear();
    renderSelectionUI();
  }

  async function archiveSelected() {
    const ids = Array.from(selectedIds).filter(id => notesById.get(id)?._canArchive);
    if (!ids.length) return;
    const ok = await CatatanManagement.confirmArchive({
      title: `Arsipkan ${ids.length} catatan keluarga?`,
      message: "Catatan yang dipilih akan dipindahkan ke Arsip untuk seluruh keluarga dan dapat dipulihkan nanti.",
      confirmLabel: `Arsipkan ${ids.length}`
    });
    if (!ok) return;
    try {
      const count = await NotesService.arsipkanBanyak(ids);
      showToast(`${count} catatan keluarga dipindahkan ke Arsip.`);
      setSelectionMode(false);
      await loadBackendNotes();
    } catch (error) {
      console.error("[Catatan Family Bulk Archive]", error);
      if (NotesService.lifecycleSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004F agar bulk Arsip aktif.");
      else showToast(error?.message || "Catatan terpilih belum dapat diarsipkan.");
    }
  }

  async function loadBackendNotes() {
    if (!familyId || !window.NotesService?.ambilCatatanKeluarga) return;
    try {
      const notes = await NotesService.ambilCatatanKeluarga(familyId);
      const ids = notes.map(note => note.id);
      try {
        const [tags, capabilities] = await Promise.all([
          NotesService.ambilTagMapCatatan(ids),
          NotesService.ambilHakLifecycleCatatan(ids)
        ]);
        notes.forEach(note => {
          note._tags = tags[note.id] || [];
          note._canArchive = Boolean(capabilities[note.id]?.canArchive);
        });
      } catch (metaError) {
        if (NotesService.lifecycleSchemaBelumTerpasang?.(metaError)) showToast("Jalankan SQL 004F agar Arsip & multi-select aktif.");
        else if (NotesService.managementSchemaBelumTerpasang?.(metaError)) showToast("Jalankan SQL 004E agar tag kartu aktif.");
        else console.warn("[Catatan Family Card Metadata]", metaError);
      }
      renderBackendNotes(notes);
    } catch (error) {
      console.error("[Catatan Family Backend]", error);
      if (NotesService.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      else if (NotesService.schemaBelumTerpasang?.(error)) showToast("Backend Catatan belum aktif — jalankan SQL 004A di Supabase dulu.");
      else showToast(error?.message || "Catatan Keluarga belum dapat dimuat.");
    }
  }

  async function loadBackendFolders() {
    if (!familyId || !window.NotesService?.ambilFolderCatalog) return;
    try {
      const folders = await NotesService.ambilFolderCatalog("family", familyId);
      renderBackendFolders(folders);
    } catch (error) {
      console.warn("[Catatan Family Folder]", error);
      if (NotesService.managementSchemaBelumTerpasang?.(error)) showToast("Backend management belum aktif — jalankan SQL 004E di Supabase dulu.");
    }
  }

  function setupInteractions() {
    q("[data-add-folder]")?.addEventListener("click", () => showToast("Tambah Folder khusus akan aktif pada tahap berikutnya."));
    q("#catatan-family-search")?.addEventListener("input", filterPreview);
    q("[data-create-note]")?.addEventListener("click", openCreateSheet);
    q("[data-create-close]")?.addEventListener("click", closeCreateSheet);
    q("[data-create-layer]")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeCreateSheet();
    });
    q("[data-toggle-selection]")?.addEventListener("click", () => setSelectionMode(!selectionMode));
    q("[data-bulk-cancel]")?.addEventListener("click", () => setSelectionMode(false));
    q("[data-bulk-archive]")?.addEventListener("click", archiveSelected);
    q("[data-select-all]")?.addEventListener("click", () => {
      const ids = visibleSelectableIds();
      const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id));
      ids.forEach(id => allSelected ? selectedIds.delete(id) : selectedIds.add(id));
      renderSelectionUI();
    });
    qa("[data-create-type]").forEach(button => {
      button.addEventListener("click", () => {
        const type = button.dataset.createType || "Catatan";
        closeCreateSheet();
        if (type === "Catatan Biasa") location.href = "catatan-editor.html?scope=family";
        else if (type === "Checklist") location.href = "catatan-checklist.html?scope=family";
        else if (type === "Reminder") location.href = "catatan-editor.html?scope=family&type=reminder";
      });
    });
    qa('[data-nav-placeholder]:not([data-nav-placeholder="Arsip"])').forEach(button => {
      button.addEventListener("click", () => showToast(`${button.dataset.navPlaceholder} akan aktif bersama data Catatan.`));
    });
  }

  async function init() {
    setupInteractions();
    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }
    try {
      const [user, family] = await Promise.all([AuthService.ambilUserAktif(), AuthRouter.ambilFamilyAktif()]);
      if (!user || !family) return;
      userId = clean(user.id);
      familyId = clean(family.id);
      await Promise.all([loadBackendNotes(), loadBackendFolders()]);
    } catch (error) {
      console.error("[Catatan Family]", error);
    } finally {
      q("[data-catatan-family]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
