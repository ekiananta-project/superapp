(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));

  let toastTimer = null;
  let scope = "";
  let folderName = "Folder";
  let memberName = "Anggota";
  let memberId = "";
  let userId = "";
  let familyId = "";

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

  function openCreateSheet() {
    if (scope === "member") return;
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = false;
  }

  function closeCreateSheet() {
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = true;
  }

  function noteCard(note) {
    const isChecklist = note?.note_type === "checklist";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catatan-note-card";
    button.dataset.folderNote = "";
    button.dataset.noteId = clean(note?.id);

    const title = clean(note?.title) || "Tanpa judul";
    const body = clean(note?.body_text) || (isChecklist ? "Checklist belum memiliki item." : "Catatan belum memiliki isi.");
    const preview = body.length > 180 ? `${body.slice(0, 177)}...` : body;

    let access = "Hanya Saya";
    if (scope === "member") access = "Keluarga dapat melihat · Hanya baca";
    else if (scope === "family") access = "Area Keluarga · Kolaboratif";
    else if (note?.visibility === "family-read") access = "Keluarga dapat melihat";

    button.dataset.searchText = clean(`${title} ${body} ${folderName} ${access}`);

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
      const params = new URLSearchParams();
      params.set("scope", scope === "member" ? "personal" : scope);
      params.set("id", clean(note?.id));
      params.set("folder", folderName);
      if (scope === "member") {
        params.set("from", "member");
        params.set("member", memberId);
      }
      location.href = `${isChecklist ? "catatan-checklist.html" : "catatan-editor.html"}?${params.toString()}`;
    });

    return button;
  }

  function renderNotes(notes = []) {
    const grid = q("[data-folder-note-grid]");
    if (!grid) return;
    grid.textContent = "";
    notes.forEach(note => grid.appendChild(noteCard(note)));
    filterPreview();
  }

  function filterPreview() {
    const input = q("#catatan-folder-search");
    const needle = clean(input?.value).toLocaleLowerCase("id-ID");
    const items = qa("[data-folder-note]");
    let visible = 0;

    items.forEach(item => {
      const haystack = clean(item.dataset.searchText).toLocaleLowerCase("id-ID");
      const show = !needle || haystack.includes(needle);
      item.hidden = !show;
      if (show) visible += 1;
    });

    const empty = q("[data-search-empty]");
    if (empty) {
      empty.hidden = visible > 0;
      const copy = q("[data-folder-empty-copy]");
      if (copy) {
        copy.textContent = needle
          ? `Coba kata kunci lain di folder ${folderName}.`
          : `Belum ada catatan di folder ${folderName}.`;
      }
      const strong = empty.querySelector("strong");
      if (strong) strong.textContent = needle ? "Tidak ada yang cocok" : "Folder masih kosong";
    }
  }

  function applyBaseContext() {
    const title = q("[data-folder-area-title]");
    const back = q("[data-folder-back]");
    const folder = q("[data-folder-name]");
    const search = q("#catatan-folder-search");
    const context = q("[data-create-context]");

    if (folder) folder.textContent = folderName;
    if (search) {
      search.placeholder = `Cari di folder ${folderName}...`;
      search.setAttribute("aria-label", `Cari di folder ${folderName}`);
    }
    if (context) context.textContent = `Folder ${folderName}`;

    if (scope === "family") {
      if (title) title.textContent = "Catatan Keluarga";
      if (back) back.href = "catatan-keluarga.html";
      document.title = `${folderName} · Catatan Keluarga · RuangKitha`;
    } else if (scope === "personal") {
      if (title) title.textContent = "Catatan Pribadi";
      if (back) back.href = "catatan-pribadi.html";
      document.title = `${folderName} · Catatan Pribadi · RuangKitha`;
    }
  }

  function applyMemberContext(name) {
    memberName = clean(name, "Anggota");
    const title = q("[data-folder-area-title]");
    const memberWrap = q("[data-folder-member-container]");
    const member = q("[data-folder-member-name]");
    const back = q("[data-folder-back]");

    if (title) title.textContent = "Catatan";
    if (memberWrap) memberWrap.hidden = false;
    if (member) member.textContent = memberName;
    if (back) back.href = `catatan-anggota.html?member=${encodeURIComponent(memberId)}`;

    const add = q("[data-create-note]");
    if (add) add.hidden = true;
    document.title = `${folderName} · Catatan ${memberName} · RuangKitha`;
  }

  async function loadNotes() {
    if (!window.NotesService?.ambilCatatanDalamFolder) return;
    try {
      const ownerId = scope === "member" ? memberId : (scope === "personal" ? userId : null);
      const noteScope = scope === "member" ? "personal" : scope;
      const notes = await window.NotesService.ambilCatatanDalamFolder({
        scope: noteScope,
        familyId,
        ownerId,
        folderName,
        sharedWithFamilyOnly: scope === "member"
      });
      renderNotes(notes);
    } catch (error) {
      console.error("[Catatan Folder Backend]", error);
      if (window.NotesService?.folderSchemaBelumTerpasang?.(error)) {
        showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      } else {
        showToast(error?.message || "Isi folder belum dapat dimuat.");
      }
      renderNotes([]);
    }
  }

  function setupInteractions() {
    q("#catatan-folder-search")?.addEventListener("input", filterPreview);
    q("[data-create-note]")?.addEventListener("click", openCreateSheet);
    q("[data-create-close]")?.addEventListener("click", closeCreateSheet);
    q("[data-create-layer]")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeCreateSheet();
    });

    qa("[data-create-type]").forEach(button => {
      button.addEventListener("click", () => {
        if (scope === "member") return;
        const type = button.dataset.createType || "Catatan";
        closeCreateSheet();
        const params = new URLSearchParams({ scope, folder: folderName });

        if (type === "Catatan Biasa") {
          location.href = `catatan-editor.html?${params.toString()}`;
          return;
        }
        if (type === "Checklist") {
          location.href = `catatan-checklist.html?${params.toString()}`;
          return;
        }
        if (type === "Reminder") {
          params.set("type", "reminder");
          location.href = `catatan-editor.html?${params.toString()}`;
        }
      });
    });

    qa("[data-nav-placeholder]").forEach(button => {
      button.addEventListener("click", () => showToast(`${button.dataset.navPlaceholder} akan aktif bersama data Catatan.`));
    });
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    scope = clean(params.get("scope")).toLowerCase();
    folderName = clean(params.get("folder"), "Folder");
    memberId = clean(params.get("member"));

    if (!["family", "personal", "member"].includes(scope) || !clean(params.get("folder"))) {
      location.replace("catatan.html");
      return;
    }

    setupInteractions();
    applyBaseContext();

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
      userId = clean(user.id);
      familyId = clean(family.id);

      if (scope === "member") {
        if (!memberId) {
          location.replace("catatan.html");
          return;
        }
        if (memberId === user.id) {
          location.replace(`catatan-folder.html?scope=personal&folder=${encodeURIComponent(folderName)}`);
          return;
        }
        const members = await FamilyService.ambilAnggotaKeluarga(family.id);
        const member = (members || []).find(item => item?.user_id === memberId);
        if (!member) {
          location.replace("catatan.html");
          return;
        }
        applyMemberContext(member?.profile?.display_name);
      }

      await loadNotes();
    } catch (error) {
      console.error("[Catatan Folder]", error);
      showToast("Folder Catatan tidak dapat dimuat.");
    } finally {
      q("[data-catatan-folder]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
