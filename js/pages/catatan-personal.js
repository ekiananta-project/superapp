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
    const input = q("#catatan-personal-search");
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
    empty.innerHTML = '<ion-icon name="document-text-outline" aria-hidden="true"></ion-icon><strong>Belum ada catatan</strong><span>Buat catatan atau checklist pertamamu dari tombol +.</span>';
    empty.hidden = true;
    section.appendChild(empty);
    return empty;
  }

  function noteCard(note) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catatan-note-card";
    button.dataset.previewItem = "";
    button.dataset.noteId = clean(note?.id);

    const isChecklist = note?.note_type === "checklist";
    const title = clean(note?.title) || "Tanpa judul";
    const body = clean(note?.body_text) || (isChecklist ? "Checklist belum memiliki item." : "Catatan belum memiliki isi.");
    const preview = body.length > 180 ? `${body.slice(0, 177)}...` : body;
    const access = note?.visibility === "family-read" ? "Keluarga dapat melihat" : "Hanya Saya";
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
        ? `catatan-checklist.html?scope=personal&id=${encodeURIComponent(note.id)}`
        : `catatan-editor.html?scope=personal&id=${encodeURIComponent(note.id)}`;
    });
    return button;
  }

  function renderBackendNotes(notes) {
    const grid = q("[data-personal-note-grid]");
    if (!grid) return;
    grid.textContent = "";
    backendNoteCount = Array.isArray(notes) ? notes.length : 0;
    (notes || []).forEach(note => grid.appendChild(noteCard(note)));
    const empty = ensureBackendEmpty();
    if (empty) empty.hidden = Boolean(notes?.length);
    filterPreview();
  }

  async function loadBackendNotes(userId) {
    if (!window.NotesService?.ambilCatatanPersonal) return;
    try {
      const notes = await window.NotesService.ambilCatatanPersonal(userId);
      renderBackendNotes(notes);
    } catch (error) {
      console.error("[Catatan Personal Backend]", error);
      if (window.NotesService.schemaBelumTerpasang?.(error)) {
        showToast("Backend Catatan belum aktif — jalankan SQL 004A di Supabase dulu.");
      } else {
        showToast(error?.message || "Catatan Pribadi belum dapat dimuat.");
      }
    }
  }

  function setupInteractions() {
    q("[data-add-folder]")?.addEventListener("click", () => {
      showToast("Tambah Folder Pribadi masuk tahap backend Folder berikutnya.");
    });

    qa("[data-preview-item]").forEach(item => {
      item.addEventListener("click", () => {
        if (item.classList.contains("catatan-folder-card")) {
          const folder = clean(item.dataset.folderName || item.querySelector("strong")?.textContent);
          if (folder) {
            location.href = `catatan-folder.html?scope=personal&folder=${encodeURIComponent(folder)}`;
            return;
          }
        }
        if (!item.classList.contains("catatan-note-card")) return;
        showToast("Preview contoh akan digantikan data Supabase setelah SQL 004A aktif.");
      });
    });

    q("#catatan-personal-search")?.addEventListener("input", filterPreview);
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
          location.href = "catatan-editor.html?scope=personal";
          return;
        }
        if (type === "Checklist") {
          location.href = "catatan-checklist.html?scope=personal";
          return;
        }
        if (type === "Reminder") {
          location.href = "catatan-editor.html?scope=personal&type=reminder";
          return;
        }
        showToast(`${type} Pribadi akan aktif pada tahap berikutnya.`);
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
      const user = await AuthService.ambilUserAktif();
      if (!user) return;
      await loadBackendNotes(user.id);
    } catch (error) {
      console.error("[Catatan Personal]", error);
    } finally {
      q("[data-catatan-personal]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
