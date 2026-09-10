(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let userId = "";
  let familyId = "";
  let backendNoteCount = null;
  let backendFolderCount = null;

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
  }

  async function confirmDeleteNote(note) {
    const title = clean(note?.title) || "Tanpa judul";
    const ok = await CatatanManagement.confirmDanger({
      title: `Hapus “${title}”?`,
      message: "Catatan Keluarga ini akan dihapus permanen untuk seluruh anggota.",
      confirmLabel: "Hapus catatan"
    });
    if (!ok) return;
    try {
      await NotesService.hapusCatatan(note.id);
      showToast("Catatan Keluarga dihapus.");
      await loadBackendNotes();
    } catch (error) {
      console.error("[Catatan Family Delete]", error);
      showToast(error?.message || "Catatan belum dapat dihapus.");
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
      await loadBackendFolders();
    } catch (error) {
      console.error("[Catatan Family Folder Delete]", error);
      showToast(error?.message || "Folder belum dapat dihapus.");
    }
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
      location.href = isChecklist
        ? `catatan-checklist.html?scope=family&id=${encodeURIComponent(note.id)}`
        : `catatan-editor.html?scope=family&id=${encodeURIComponent(note.id)}`;
    });
    button.dataset.previewItem = "";

    return CatatanManagement.createCardShell(button, {
      canDelete: Boolean(note?._canDelete),
      menuLabel: `Menu ${title}`,
      onDelete: () => confirmDeleteNote(note)
    });
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
    notes.forEach(note => grid.appendChild(noteCard(note)));
    const empty = ensureEmpty("notes");
    if (empty) empty.hidden = notes.length !== 0;
    filterPreview();
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

  async function loadBackendNotes() {
    if (!familyId || !window.NotesService?.ambilCatatanKeluarga) return;
    try {
      const notes = await NotesService.ambilCatatanKeluarga(familyId);
      const ids = notes.map(note => note.id);
      try {
        const [tags, capabilities] = await Promise.all([
          NotesService.ambilTagMapCatatan(ids),
          NotesService.ambilHakHapusCatatan(ids)
        ]);
        notes.forEach(note => {
          note._tags = tags[note.id] || [];
          note._canDelete = Boolean(capabilities[note.id]);
        });
      } catch (metaError) {
        if (NotesService.managementSchemaBelumTerpasang?.(metaError)) showToast("Jalankan SQL 004E agar tag kartu & fitur hapus aktif.");
        else console.warn("[Catatan Family Card Metadata]", metaError);
      }
      renderBackendNotes(notes);
    } catch (error) {
      console.error("[Catatan Family Backend]", error);
      if (NotesService.managementSchemaBelumTerpasang?.(error)) showToast("Backend management belum aktif — jalankan SQL 004E di Supabase dulu.");
      else if (NotesService.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
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
    qa("[data-create-type]").forEach(button => {
      button.addEventListener("click", () => {
        const type = button.dataset.createType || "Catatan";
        closeCreateSheet();
        if (type === "Catatan Biasa") location.href = "catatan-editor.html?scope=family";
        else if (type === "Checklist") location.href = "catatan-checklist.html?scope=family";
        else if (type === "Reminder") location.href = "catatan-editor.html?scope=family&type=reminder";
      });
    });
    qa("[data-nav-placeholder]").forEach(button => {
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
