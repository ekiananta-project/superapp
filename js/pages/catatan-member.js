(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let createScope = null;
  let memberName = "Anggota";
  let activeMemberId = "";
  let backendNoteCount = null;

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

  function filterPreview() {
    const input = q("#catatan-member-search");
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
    empty.innerHTML = '<ion-icon name="eye-outline" aria-hidden="true"></ion-icon><strong>Belum ada catatan yang dibagikan</strong><span>Catatan pribadi anggota akan tampil di sini saat visibilitasnya diubah menjadi Keluarga dapat melihat.</span>';
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
    button.dataset.searchText = clean(`${title} ${body} ${note?.folder_name || ""} keluarga dapat melihat hanya baca`);

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
    accessEl.textContent = "Keluarga dapat melihat · Hanya baca";

    button.append(type, titleEl);
    if (note?.pinned) {
      const pin = document.createElement("span");
      pin.className = "catatan-note-special";
      pin.textContent = "Dipin";
      button.appendChild(pin);
    }
    button.append(previewEl, accessEl);
    button.addEventListener("click", () => {
      const member = encodeURIComponent(activeMemberId);
      location.href = isChecklist
        ? `catatan-checklist.html?scope=personal&id=${encodeURIComponent(note.id)}&from=member&member=${member}`
        : `catatan-editor.html?scope=personal&id=${encodeURIComponent(note.id)}&from=member&member=${member}`;
    });
    return button;
  }

  function renderBackendNotes(notes) {
    const grid = q("[data-member-note-grid]");
    if (!grid) return;
    grid.textContent = "";
    backendNoteCount = Array.isArray(notes) ? notes.length : 0;
    (notes || []).forEach(note => grid.appendChild(noteCard(note)));
    const empty = ensureBackendEmpty();
    if (empty) empty.hidden = Boolean(notes?.length);
    filterPreview();
  }

  async function loadBackendNotes(familyId, memberId) {
    if (!window.NotesService?.ambilCatatanAnggota) return;
    try {
      const notes = await window.NotesService.ambilCatatanAnggota(familyId, memberId);
      renderBackendNotes(notes);
    } catch (error) {
      console.error("[Catatan Member Backend]", error);
      if (window.NotesService.schemaBelumTerpasang?.(error)) {
        showToast("Backend Catatan belum aktif — jalankan SQL 004A di Supabase dulu.");
      } else {
        showToast(error?.message || "Catatan anggota belum dapat dimuat.");
      }
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
    qa("[data-preview-item]").forEach(item => {
      item.addEventListener("click", () => {
        if (item.classList.contains("catatan-folder-card")) {
          const folder = clean(item.dataset.folderName || item.querySelector("strong")?.textContent);
          if (folder && activeMemberId) {
            location.href = `catatan-folder.html?scope=member&member=${encodeURIComponent(activeMemberId)}&folder=${encodeURIComponent(folder)}`;
            return;
          }
        }
        showToast(`Catatan ${memberName} dibuka dalam mode hanya baca.`);
      });
    });

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
        const scopeLabel = createScope === "family" ? "Catatan Keluarga" : "Catatan Pribadi";
        const type = button.dataset.createType || "Catatan";
        closeCreateSheet();
        if (type === "Catatan Biasa") {
          location.href = `catatan-editor.html?scope=${encodeURIComponent(createScope || "personal")}`;
          return;
        }
        if (type === "Checklist") {
          location.href = `catatan-checklist.html?scope=${encodeURIComponent(createScope || "personal")}`;
          return;
        }
        if (type === "Reminder") {
          location.href = `catatan-editor.html?scope=${encodeURIComponent(createScope || "personal")}&type=reminder`;
          return;
        }
        showToast(`${type} di ${scopeLabel} akan aktif pada tahap berikutnya.`);
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
      const [user, family] = await Promise.all([
        AuthService.ambilUserAktif(),
        AuthRouter.ambilFamilyAktif()
      ]);
      if (!user || !family) return;

      if (!memberId) {
        location.replace("catatan.html");
        return;
      }
      if (memberId === user.id) {
        location.replace("catatan-pribadi.html");
        return;
      }

      const members = await FamilyService.ambilAnggotaKeluarga(family.id);
      const member = (members || []).find(item => item?.user_id === memberId);
      if (!member) {
        location.replace("catatan.html");
        return;
      }

      applyMemberName(member?.profile?.display_name);
      await loadBackendNotes(family.id, memberId);
    } catch (error) {
      console.error("[Catatan Member]", error);
      showToast("Ruang catatan anggota tidak dapat dimuat.");
    } finally {
      q("[data-catatan-member]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
