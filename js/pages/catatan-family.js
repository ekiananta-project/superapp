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
  let notesFingerprint = "";
  let foldersFingerprint = "";


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
      message: "Buat catatan, checklist, atau reminder pertama untuk ruang keluarga ini.",
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

  async function togglePinNote(note) {
    try {
      const next = !Boolean(note?._pinned);
      await NotesService.setPinCatatan(note.id, next);
      note._pinned = next;
      showToast(next ? "Catatan dipin untuk kamu." : "Pin dilepas.");
      const sorted = CatatanManagement.sortPinnedFirst(Array.from(notesById.values()));
      renderBackendNotes(sorted);
      window.CatatanPerformance?.write?.("family-notes", { userId, familyId }, sorted);
    } catch (error) {
      console.error("[Catatan Family Pin]", error);
      if (NotesService.customizationSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004G agar Pin aktif.");
      else showToast(error?.message || "Pin belum dapat diubah.");
    }
  }

  async function changeCardColor(note) {
    const color = await CatatanManagement.pickCardColor(note?.card_color || "default");
    if (!color) return;
    try {
      await NotesService.setWarnaKartuCatatan(note.id, color);
      note.card_color = color;
      showToast("Warna kartu keluarga diperbarui.");
      await loadBackendNotes();
    } catch (error) {
      console.error("[Catatan Family Color]", error);
      if (NotesService.customizationSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004G agar Warna Catatan aktif.");
      else showToast(error?.message || "Warna catatan belum dapat diubah.");
    }
  }

  function invalidateMoveIntoFolderCaches(folderName = "") {
    const perf = window.CatatanPerformance;
    if (!perf?.remove || !userId) return;
    perf.remove("family-notes", { userId, familyId });
    perf.remove("family-folders", { userId, familyId });
    if (folderName) {
      perf.remove("folder-notes", {
        userId,
        familyId,
        scope: "family",
        memberId: "",
        folderName
      });
    }
  }

  async function moveNoteIntoFolder(note) {
    if (!window.NotesService?.pindahkanCatatanKeFolder || !window.CatatanManagement?.pickFolder) {
      showToast("Pemindahan folder belum siap.");
      return;
    }
    try {
      const folders = await NotesService.ambilFolderCatalog("family", familyId);
      let choice = await CatatanManagement.pickFolder(folders, { currentName: "", context: "Catatan Keluarga" });
      if (!choice) return;
      if (choice.create) {
        const name = await CatatanManagement.askFolderName({ context: "Catatan Keluarga" });
        if (!name) return;
        const created = await NotesService.buatFolder("family", familyId, name);
        choice = { id: created?.id || null, name: created?.name || name };
      }
      const targetName = clean(choice?.name);
      if (!targetName) return;
      await NotesService.pindahkanCatatanKeFolder(note, { folderName: targetName, folderId: choice?.id || null });

      notesById.delete(clean(note?.id));
      notesFingerprint = "";
      const next = CatatanManagement.sortPinnedFirst(Array.from(notesById.values()));
      renderBackendNotes(next);
      invalidateMoveIntoFolderCaches(targetName);
      window.CatatanPerformance?.write?.("family-notes", { userId, familyId }, next);
      loadBackendFolders().catch(() => {});
      showToast(`Catatan dipindahkan ke folder “${targetName}”.`);
    } catch (error) {
      console.error("[Catatan Family Move Folder]", error);
      if (NotesService.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      else showToast(error?.message || "Catatan belum dapat dipindahkan ke folder.");
    }
  }

  async function createFolder() {
    const name = await CatatanManagement.askFolderName({ context: "Catatan Keluarga" });
    if (!name) return;
    try {
      await NotesService.buatFolder("family", familyId, name);
      showToast(`Folder “${name}” dibuat untuk keluarga.`);
      await loadBackendFolders();
    } catch (error) {
      console.error("[Catatan Family Folder Create]", error);
      if (NotesService.customizationSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004G agar Tambah Folder aktif.");
      else showToast(error?.message || "Folder keluarga belum dapat dibuat.");
    }
  }

  async function confirmDeleteFolder(folder) {
    const count = Number(folder?.deleteCount ?? folder?.noteCount ?? 0);
    const ok = await CatatanManagement.confirmDanger({
      title: `Hapus folder “${clean(folder?.name) || "Folder"}”?`,
      message: count
        ? `${count} catatan/checklist/reminder keluarga di dalam folder ini juga akan dihapus permanen untuk seluruh anggota.`
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
    CatatanManagement.applyCardColor(button, note?.card_color || "default");
    const isChecklist = note?.note_type === "checklist";
    const isReminder = note?.note_type === "reminder";
    const title = clean(note?.title) || "Tanpa judul";
    const body = clean(note?.body_text) || (isChecklist ? "Checklist belum memiliki item." : isReminder ? "Reminder belum memiliki catatan." : "Catatan belum memiliki isi.");
    const preview = body.length > 180 ? `${body.slice(0, 177)}...` : body;
    const own = note?.created_by === userId;
    const access = own ? "Area Keluarga · Kamu pembuat" : "Area Keluarga · Kolaboratif";
    const tags = Array.isArray(note?._tags) ? note._tags : [];
    button.dataset.searchText = clean(`${title} ${body} ${note?.folder_name || ""} ${access} ${tags.join(" ")}`);

    const type = document.createElement("span");
    type.className = "catatan-note-type";
    type.innerHTML = `<ion-icon name="${isChecklist ? "checkbox-outline" : isReminder ? "notifications-outline" : "document-text-outline"}" aria-hidden="true"></ion-icon>`;
    const titleEl = document.createElement("strong");
    titleEl.textContent = title;
    const previewEl = document.createElement("span");
    previewEl.className = "catatan-note-preview";
    previewEl.textContent = preview;
    const accessEl = document.createElement("small");
    accessEl.className = "catatan-note-access";
    accessEl.textContent = access;

    button.append(type, titleEl);
    if (note?._pinned) {
      button.appendChild(CatatanManagement.createPinIndicator?.() || (() => {
        const pin = document.createElement("span");
        pin.className = "catatan-note-pin-indicator";
        pin.innerHTML = '<ion-icon name="pin" aria-hidden="true"></ion-icon>';
        return pin;
      })());
    }
    button.appendChild(previewEl);
    const tagSummary = CatatanManagement.renderTagSummary(tags);
    if (tagSummary) button.appendChild(tagSummary);
    button.appendChild(accessEl);
    button.addEventListener("click", () => {
      if (selectionMode) return toggleSelected(note.id, Boolean(note?._canArchive));
      location.href = isChecklist
        ? `catatan-checklist.html?scope=family&id=${encodeURIComponent(note.id)}`
        : `catatan-editor.html?scope=family&id=${encodeURIComponent(note.id)}${isReminder ? "&type=reminder" : ""}`;
    });
    button.dataset.previewItem = "";

    const actions = [
      {
        label: note?._pinned ? "Lepas pin" : "Pin catatan",
        icon: note?._pinned ? "pin" : "pin-outline",
        onSelect: () => togglePinNote(note)
      },
      {
        label: "Ganti warna",
        icon: "color-palette-outline",
        onSelect: () => changeCardColor(note)
      },
      {
        label: "Masukkan ke folder",
        icon: "folder-outline",
        onSelect: () => moveNoteIntoFolder(note)
      }
    ];
    if (note?._canArchive) actions.push({
      label: "Arsipkan",
      icon: "archive-outline",
      tone: "archive",
      onSelect: () => confirmArchiveNote(note)
    });
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
    const nextFingerprint = window.CatatanPerformance?.fingerprint?.(notes) || "";
    if (nextFingerprint && nextFingerprint === notesFingerprint) {
      backendNoteCount = notes.length;
      renderSelectionUI();
      return;
    }
    notesFingerprint = nextFingerprint;
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
    const nextFingerprint = window.CatatanPerformance?.fingerprint?.(folders) || "";
    if (nextFingerprint && nextFingerprint === foldersFingerprint) {
      backendFolderCount = folders.length;
      return;
    }
    foldersFingerprint = nextFingerprint;
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
        const [tags, capabilities, preferences] = await Promise.all([
          NotesService.ambilTagMapCatatan(ids),
          NotesService.ambilHakLifecycleCatatan(ids),
          NotesService.ambilPreferensiCatatan(ids)
        ]);
        notes.forEach(note => {
          note._tags = tags[note.id] || [];
          note._canArchive = Boolean(capabilities[note.id]?.canArchive);
          note._pinned = Boolean(preferences[note.id]?.pinned);
        });
      } catch (metaError) {
        if (NotesService.customizationSchemaBelumTerpasang?.(metaError)) showToast("Jalankan SQL 004G agar Pin & Warna Catatan aktif.");
        else if (NotesService.lifecycleSchemaBelumTerpasang?.(metaError)) showToast("Jalankan SQL 004F agar Arsip & multi-select aktif.");
        else if (NotesService.managementSchemaBelumTerpasang?.(metaError)) showToast("Jalankan SQL 004E agar tag kartu aktif.");
        else console.warn("[Catatan Family Card Metadata]", metaError);
      }
      const sorted = CatatanManagement.sortPinnedFirst(notes);
      renderBackendNotes(sorted);
      window.CatatanPerformance?.write?.("family-notes", { userId, familyId }, sorted);
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
      window.CatatanPerformance?.write?.("family-folders", { userId, familyId }, folders || []);
    } catch (error) {
      console.warn("[Catatan Family Folder]", error);
      if (NotesService.managementSchemaBelumTerpasang?.(error)) showToast("Backend management belum aktif — jalankan SQL 004E di Supabase dulu.");
    }
  }

  function setupInteractions() {
    q("[data-add-folder]")?.addEventListener("click", createFolder);
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

      const perf = window.CatatanPerformance;
      const cacheContext = { userId, familyId };
      const cachedNotes = perf?.read?.("family-notes", cacheContext);
      const cachedFolders = perf?.read?.("family-folders", cacheContext);
      if (Array.isArray(cachedNotes)) renderBackendNotes(cachedNotes);
      if (Array.isArray(cachedFolders)) renderBackendFolders(cachedFolders);

      const notesLoading = Array.isArray(cachedNotes)
        ? null
        : perf?.startSkeleton?.(q("[data-family-note-grid]"), { kind: "notes", count: 4 });
      const foldersLoading = Array.isArray(cachedFolders)
        ? null
        : perf?.startSkeleton?.(q("[data-family-folder-grid]"), { kind: "folders", count: 2 });

      try {
        await Promise.all([loadBackendNotes(), loadBackendFolders()]);
      } finally {
        notesLoading?.finish?.();
        foldersLoading?.finish?.();
      }
    } catch (error) {
      console.error("[Catatan Family]", error);
    } finally {
      q("[data-catatan-family]")?.setAttribute("aria-busy", "false");
    }
  }

  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    closeCreateSheet();
    window.CatatanManagement?.closeActiveMenu?.();
    if (selectionMode) setSelectionMode(false);
    if (!userId || !familyId) return;
    Promise.allSettled([loadBackendNotes(), loadBackendFolders()]);
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
