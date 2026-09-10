(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let createScope = null;
  let memberName = "Anggota";
  let activeMemberId = "";
  let backendNoteCount = null;
  let backendFolderCount = null;

  function clean(value, fallback = "") {
    const text = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!text || ["undefined", "null", "[object object]"].includes(text.toLowerCase())) return fallback;
    return text;
  }

  function showToast(message) {
    const el = q("[data-catatan-toast]");
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function setCreateStep(step) {
    qa("[data-create-step]").forEach(el => { el.hidden = el.dataset.createStep !== step; });
    const title = q("[data-create-title]");
    if (title) title.textContent = step === "scope" ? "Pilih ruang catatan" : "Pilih jenis catatan";
  }

  function openCreateSheet() {
    createScope = null;
    setCreateStep("scope");
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = false;
  }

  function closeCreateSheet() {
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = true;
    createScope = null;
  }

  function ensureEmpty(kind) {
    const selector = kind === "folders" ? "[data-backend-folders-empty]" : "[data-backend-notes-empty]";
    let empty = q(selector);
    if (empty) return empty;
    const grid = kind === "folders" ? q("[data-member-folder-grid]") : q("[data-member-note-grid]");
    const section = grid?.closest(".catatan-area-section");
    if (!section || !window.CatatanManagement) return null;
    empty = CatatanManagement.createEmptyState(kind, kind === "folders" ? {
      title: "Belum ada folder yang dibagikan",
      message: `Folder milik ${memberName} akan tampil jika berisi catatan yang dibagikan ke keluarga.`
    } : {
      title: "Belum ada catatan yang dibagikan",
      message: `Catatan pribadi ${memberName} akan tampil saat visibilitasnya menjadi Keluarga dapat melihat.`
    });
    if (kind === "folders") empty.dataset.backendFoldersEmpty = "";
    else empty.dataset.backendNotesEmpty = "";
    empty.hidden = true;
    section.appendChild(empty);
    return empty;
  }

  function filterPreview() {
    const needle = clean(q("#catatan-member-search")?.value).toLocaleLowerCase("id-ID");
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

  function folderCard(folder) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catatan-folder-card";
    button.dataset.folderName = clean(folder?.name);
    button.dataset.searchText = clean(`${folder?.name || ""} folder catatan anggota`);
    const icon = document.createElement("span");
    icon.className = "catatan-folder-icon";
    icon.innerHTML = '<ion-icon name="folder-outline" aria-hidden="true"></ion-icon>';
    const copy = document.createElement("span");
    copy.className = "catatan-folder-copy";
    const strong = document.createElement("strong");
    strong.textContent = clean(folder?.name, "Folder");
    const small = document.createElement("small");
    small.textContent = `${Number(folder?.noteCount || 0)} catatan`;
    copy.append(strong, small);
    button.append(icon, copy);
    button.addEventListener("click", () => {
      if (!activeMemberId || !folder?.name) return;
      location.href = `catatan-folder.html?scope=member&member=${encodeURIComponent(activeMemberId)}&folder=${encodeURIComponent(folder.name)}`;
    });
    button.dataset.previewItem = "";
    return CatatanManagement.createCardShell(button);
  }

  function renderBackendFolders(folders = []) {
    const grid = q("[data-member-folder-grid]");
    if (!grid) return;
    grid.textContent = "";
    backendFolderCount = folders.length;
    folders.forEach(folder => grid.appendChild(folderCard(folder)));
    const empty = ensureEmpty("folders");
    if (empty) empty.hidden = folders.length !== 0;
    filterPreview();
  }

  async function loadBackendFolders(familyId, memberId) {
    if (!window.NotesService?.ambilFolderAnggota) return;
    try {
      const folders = await NotesService.ambilFolderAnggota(familyId, memberId);
      renderBackendFolders(folders);
    } catch (error) {
      console.warn("[Catatan Member Folder Backend]", error);
    }
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
    const tags = Array.isArray(note?._tags) ? note._tags : [];
    button.dataset.searchText = clean(`${title} ${body} ${note?.folder_name || ""} keluarga dapat melihat hanya baca ${tags.join(" ")}`);

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
    accessEl.textContent = "Keluarga dapat melihat · Hanya baca";

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
      const member = encodeURIComponent(activeMemberId);
      location.href = isChecklist
        ? `catatan-checklist.html?scope=personal&id=${encodeURIComponent(note.id)}&from=member&member=${member}`
        : `catatan-editor.html?scope=personal&id=${encodeURIComponent(note.id)}&from=member&member=${member}${isReminder ? "&type=reminder" : ""}`;
    });
    button.dataset.previewItem = "";
    return CatatanManagement.createCardShell(button);
  }

  function renderBackendNotes(notes = []) {
    const grid = q("[data-member-note-grid]");
    if (!grid) return;
    grid.textContent = "";
    backendNoteCount = notes.length;
    notes.forEach(note => grid.appendChild(noteCard(note)));
    const empty = ensureEmpty("notes");
    if (empty) empty.hidden = notes.length !== 0;
    filterPreview();
  }

  async function loadBackendNotes(familyId, memberId) {
    if (!window.NotesService?.ambilCatatanAnggota) return;
    try {
      const notes = await NotesService.ambilCatatanAnggota(familyId, memberId);
      try {
        const ids = notes.map(note => note.id);
        const [tags, preferences] = await Promise.all([
          NotesService.ambilTagMapCatatan(ids),
          NotesService.ambilPreferensiCatatan(ids)
        ]);
        notes.forEach(note => {
          note._tags = tags[note.id] || [];
          note._pinned = Boolean(preferences[note.id]?.pinned);
        });
      } catch (metaError) {
        console.warn("[Catatan Member Card Tags]", metaError);
      }
      renderBackendNotes(CatatanManagement.sortPinnedFirst(notes));
    } catch (error) {
      console.error("[Catatan Member Backend]", error);
      if (NotesService.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      else if (NotesService.schemaBelumTerpasang?.(error)) showToast("Backend Catatan belum aktif — jalankan SQL 004A di Supabase dulu.");
      else showToast(error?.message || "Catatan anggota belum dapat dimuat.");
    }
  }

  function applyMemberName(name) {
    memberName = clean(name, "Anggota");
    const title = q("[data-member-page-title]");
    const titleName = q("[data-member-page-name]");
    const search = q("#catatan-member-search");
    const empty = q("[data-member-empty-copy]");
    if (titleName) titleName.textContent = memberName;
    if (title) title.setAttribute("aria-label", `Catatan anggota ${memberName}`);
    if (search) {
      search.placeholder = `Cari di Catatan ${memberName}...`;
      search.setAttribute("aria-label", `Cari di Catatan ${memberName}`);
    }
    if (empty) empty.textContent = `Coba kata kunci lain di Catatan ${memberName}.`;
    document.title = `Catatan ${memberName} · RuangKitha`;
  }

  function setupInteractions() {
    q("#catatan-member-search")?.addEventListener("input", filterPreview);
    q("[data-create-note]")?.addEventListener("click", openCreateSheet);
    q("[data-create-close]")?.addEventListener("click", closeCreateSheet);
    q("[data-create-layer]")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeCreateSheet();
    });
    qa("[data-create-scope]").forEach(button => {
      button.addEventListener("click", () => {
        createScope = button.dataset.createScope;
        setCreateStep("type");
      });
    });
    qa("[data-create-type]").forEach(button => {
      button.addEventListener("click", () => {
        const type = button.dataset.createType || "Catatan";
        closeCreateSheet();
        if (type === "Catatan Biasa") location.href = `catatan-editor.html?scope=${encodeURIComponent(createScope || "personal")}`;
        else if (type === "Checklist") location.href = `catatan-checklist.html?scope=${encodeURIComponent(createScope || "personal")}`;
        else if (type === "Reminder") location.href = `catatan-editor.html?scope=${encodeURIComponent(createScope || "personal")}&type=reminder`;
      });
    });
    qa("[data-nav-placeholder]").forEach(button => {
      button.addEventListener("click", () => showToast(`${button.dataset.navPlaceholder} akan aktif bersama data Catatan.`));
    });
  }

  async function init() {
    activeMemberId = clean(new URLSearchParams(location.search).get("member"));
    setupInteractions();
    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }
    try {
      const memberId = activeMemberId;
      const [user, family] = await Promise.all([AuthService.ambilUserAktif(), AuthRouter.ambilFamilyAktif()]);
      if (!user || !family) return;
      if (!memberId) return location.replace("catatan.html");
      if (memberId === user.id) return location.replace("catatan-pribadi.html");
      const members = await FamilyService.ambilAnggotaKeluarga(family.id);
      const member = (members || []).find(item => item?.user_id === memberId);
      if (!member) return location.replace("catatan.html");
      applyMemberName(member?.profile?.display_name);
      await Promise.all([loadBackendNotes(family.id, memberId), loadBackendFolders(family.id, memberId)]);
    } catch (error) {
      console.error("[Catatan Member]", error);
      showToast("Ruang catatan anggota tidak dapat dimuat.");
    } finally {
      q("[data-catatan-member]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
