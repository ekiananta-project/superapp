(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let backendNoteCount = null;

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

  function filterPreview() {
    const input = q("#catatan-family-search");
    const needle = clean(input?.value).toLocaleLowerCase("id-ID");
    const items = qa("[data-preview-item]");
    let visibleNotes = 0;

    items.forEach(item => {
      const haystack = clean(item.dataset.searchText).toLocaleLowerCase("id-ID");
      const visible = !needle || haystack.includes(needle);
      item.hidden = !visible;
      if (visible && item.classList.contains("catatan-note-card")) visibleNotes += 1;
    });

    const empty = q("[data-search-empty]");
    if (empty) empty.hidden = !needle || visibleNotes > 0;
    const backendEmpty = q("[data-backend-notes-empty]");
    if (backendEmpty && backendNoteCount !== null) {
      backendEmpty.hidden = backendNoteCount !== 0 || Boolean(needle);
    }
  }

  function ensureBackendEmpty() {
    let empty = q("[data-backend-notes-empty]");
    if (empty) return empty;
    const section = q(".catatan-notes-section");
    if (!section) return null;
    empty = document.createElement("div");
    empty.className = "catatan-area-empty";
    empty.dataset.backendNotesEmpty = "";
    empty.innerHTML = '<ion-icon name="people-outline" aria-hidden="true"></ion-icon><strong>Belum ada Catatan Keluarga</strong><span>Buat catatan atau checklist pertama untuk ruang keluarga ini.</span>';
    empty.hidden = true;
    section.appendChild(empty);
    return empty;
  }

  function noteCard(note, userId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catatan-note-card";
    button.dataset.previewItem = "";
    button.dataset.noteId = clean(note?.id);

    const isChecklist = note?.note_type === "checklist";
    const title = clean(note?.title) || "Tanpa judul";
    const body = clean(note?.body_text) || (isChecklist ? "Checklist belum memiliki item." : "Catatan belum memiliki isi.");
    const preview = body.length > 180 ? `${body.slice(0, 177)}...` : body;
    const own = note?.created_by === userId;
    const access = own ? "Area Keluarga · Kamu pembuat" : "Area Keluarga · Kolaboratif";
    button.dataset.searchText = clean(`${title} ${body} ${note?.folder_name || ""} ${access}`);

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
    button.append(previewEl, accessEl);
    button.addEventListener("click", () => {
      location.href = isChecklist
        ? `catatan-checklist.html?scope=family&id=${encodeURIComponent(note.id)}`
        : `catatan-editor.html?scope=family&id=${encodeURIComponent(note.id)}`;
    });
    return button;
  }

  function renderBackendNotes(notes, userId) {
    const grid = q("[data-family-note-grid]");
    if (!grid) return;
    grid.textContent = "";
    backendNoteCount = Array.isArray(notes) ? notes.length : 0;
    (notes || []).forEach(note => grid.appendChild(noteCard(note, userId)));
    const empty = ensureBackendEmpty();
    if (empty) empty.hidden = Boolean(notes?.length);
    filterPreview();
  }

  async function loadBackendNotes(familyId, userId) {
    if (!window.NotesService?.ambilCatatanKeluarga) return;
    try {
      const notes = await window.NotesService.ambilCatatanKeluarga(familyId);
      renderBackendNotes(notes, userId);
    } catch (error) {
      console.error("[Catatan Family Backend]", error);
      if (window.NotesService.folderSchemaBelumTerpasang?.(error)) {
        showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      } else if (window.NotesService.schemaBelumTerpasang?.(error)) {
        showToast("Backend Catatan belum aktif — jalankan SQL 004A di Supabase dulu.");
      } else {
        showToast(error?.message || "Catatan Keluarga belum dapat dimuat.");
      }
    }
  }

  async function refreshFolderCounts(familyId) {
    if (!window.NotesService?.ambilFolderCatalog) return;
    try {
      const folders = await window.NotesService.ambilFolderCatalog("family", familyId);
      const counts = new Map((folders || []).map(item => [clean(item.name).toLocaleLowerCase("id-ID"), Number(item.noteCount || 0)]));
      qa(".catatan-folder-card").forEach(card => {
        const name = clean(card.dataset.folderName || card.querySelector("strong")?.textContent);
        const count = counts.get(name.toLocaleLowerCase("id-ID")) || 0;
        const small = card.querySelector("small");
        if (small) small.textContent = `${count} catatan`;
      });
    } catch (error) {
      console.warn("[Catatan Family Folder Count]", error);
    }
  }

  function setupInteractions() {
    q("[data-add-folder]")?.addEventListener("click", () => {
      showToast("Tambah Folder khusus akan aktif pada tahap berikutnya. Catatan di folder yang sudah ada kini tersimpan ke backend.");
    });

    qa("[data-preview-item]").forEach(item => {
      item.addEventListener("click", () => {
        if (item.classList.contains("catatan-folder-card")) {
          const folder = clean(item.dataset.folderName || item.querySelector("strong")?.textContent);
          if (folder) {
            location.href = `catatan-folder.html?scope=family&folder=${encodeURIComponent(folder)}`;
            return;
          }
        }
        if (!item.classList.contains("catatan-note-card")) return;
        showToast("Preview contoh akan digantikan data Supabase setelah SQL 004A aktif.");
      });
    });

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
        if (type === "Catatan Biasa") {
          location.href = "catatan-editor.html?scope=family";
          return;
        }
        if (type === "Checklist") {
          location.href = "catatan-checklist.html?scope=family";
          return;
        }
        if (type === "Reminder") {
          location.href = "catatan-editor.html?scope=family&type=reminder";
          return;
        }
        showToast(`${type} Keluarga akan aktif pada tahap berikutnya.`);
      });
    });

    qa("[data-nav-placeholder]").forEach(button => {
      button.addEventListener("click", () => {
        showToast(`${button.dataset.navPlaceholder} akan aktif bersama data Catatan.`);
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
      const [user, family] = await Promise.all([
        AuthService.ambilUserAktif(),
        AuthRouter.ambilFamilyAktif()
      ]);
      if (!user || !family) return;
      await Promise.all([loadBackendNotes(family.id, user.id), refreshFolderCounts(family.id)]);
    } catch (error) {
      console.error("[Catatan Family]", error);
    } finally {
      q("[data-catatan-family]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
