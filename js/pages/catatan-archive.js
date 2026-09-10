(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let scope = "personal";
  let userId = "";
  let familyId = "";
  let source = "";
  let archiveNotes = [];
  let archiveFingerprint = "";

  function clean(value, fallback = "") {
    const text = String(value ?? "").trim().replace(/\s+/g, " ");
    return text || fallback;
  }

  function showToast(message) {
    const el = q("[data-catatan-toast]");
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function formatArchiveDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "Diarsipkan";
    try {
      return `Diarsipkan ${new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(date)}`;
    } catch (_) {
      return "Diarsipkan";
    }
  }

  function applyContext() {
    const personal = scope === "personal";
    const scopeHref = personal ? "catatan-pribadi.html" : "catatan-keluarga.html";
    const backHref = source === "home" ? "catatan.html" : scopeHref;
    const title = personal ? "Arsip Pribadi" : "Arsip Keluarga";
    const description = personal
      ? "Catatan Pribadi yang diarsipkan tetap aman dan dapat dipulihkan."
      : "Catatan Keluarga yang diarsipkan tetap terlihat bagi anggota, tetapi lifecycle hanya dikelola pembuat atau Family Owner.";

    q("[data-archive-back]")?.setAttribute("href", backHref);
    q("[data-archive-back]")?.setAttribute("aria-label", source === "home"
      ? "Kembali ke Catatan"
      : (personal ? "Kembali ke Catatan Pribadi" : "Kembali ke Catatan Keluarga"));
    q("[data-archive-title]") && (q("[data-archive-title]").textContent = title);
    q("[data-archive-description]") && (q("[data-archive-description]").textContent = description);
    q("[data-archive-home]")?.setAttribute("href", "catatan.html");
    q("[data-archive-nav]")?.setAttribute("href", `catatan-arsip.html?scope=${scope}`);
    q("[data-archive-create]")?.setAttribute("href", `catatan-editor.html?scope=${scope}`);
    const search = q("#catatan-archive-search");
    if (search) {
      search.placeholder = `Cari di ${title}...`;
      search.setAttribute("aria-label", `Cari di ${title}`);
    }
    document.title = `${title} · RuangKitha`;
  }

  function ensureEmpty() {
    let empty = q("[data-archive-empty]");
    if (empty) return empty;
    const section = q(".catatan-notes-section");
    if (!section || !window.CatatanManagement) return null;
    empty = CatatanManagement.createEmptyState("notes", {
      title: "Arsip masih kosong",
      message: scope === "family"
        ? "Catatan Keluarga yang diarsipkan akan tampil di sini."
        : "Catatan yang kamu arsipkan akan tampil di sini."
    });
    empty.dataset.archiveEmpty = "";
    empty.hidden = true;
    section.appendChild(empty);
    return empty;
  }

  function filterArchive() {
    const needle = clean(q("#catatan-archive-search")?.value).toLocaleLowerCase("id-ID");
    let visible = 0;
    qa("[data-archive-item]").forEach(item => {
      const match = !needle || clean(item.dataset.searchText).toLocaleLowerCase("id-ID").includes(needle);
      item.hidden = !match;
      if (match) visible += 1;
    });
    const searchEmpty = q("[data-search-empty]");
    if (searchEmpty) searchEmpty.hidden = !needle || visible > 0;
    const empty = q("[data-archive-empty]");
    if (empty) empty.hidden = archiveNotes.length !== 0 || Boolean(needle);
  }

  async function restoreNote(note) {
    const title = clean(note?.title, "Tanpa judul");
    const ok = await CatatanManagement.confirmAction({
      title: `Pulihkan “${title}”?`,
      message: note?.folder_name
        ? `Catatan akan kembali aktif di folder “${clean(note.folder_name)}”.`
        : "Catatan akan kembali ke daftar aktif.",
      confirmLabel: "Pulihkan",
      tone: "archive",
      icon: "refresh-outline"
    });
    if (!ok) return;
    try {
      await NotesService.pulihkanCatatan(note.id);
      showToast("Catatan dipulihkan.");
      await loadArchive();
    } catch (error) {
      console.error("[Catatan Archive Restore]", error);
      showToast(error?.message || "Catatan belum dapat dipulihkan.");
    }
  }

  async function deletePermanent(note) {
    const title = clean(note?.title, "Tanpa judul");
    const ok = await CatatanManagement.confirmDanger({
      title: `Hapus permanen “${title}”?`,
      message: "Setelah dihapus dari Arsip, catatan ini tidak dapat dipulihkan lagi.",
      confirmLabel: "Hapus permanen"
    });
    if (!ok) return;
    try {
      await NotesService.hapusPermanenArsip(note.id);
      showToast("Catatan dihapus permanen.");
      await loadArchive();
    } catch (error) {
      console.error("[Catatan Archive Permanent Delete]", error);
      showToast(error?.message || "Catatan belum dapat dihapus permanen.");
    }
  }

  function archiveCard(note) {
    const card = document.createElement("article");
    card.className = "catatan-note-card catatan-archive-card";
    card.dataset.noteId = clean(note?.id);
    CatatanManagement.applyCardColor(card, note?.card_color || "default");
    const isChecklist = note?.note_type === "checklist";
    const isReminder = note?.note_type === "reminder";
    const title = clean(note?.title, "Tanpa judul");
    const body = clean(note?.body_text) || (isChecklist ? "Checklist belum memiliki item." : isReminder ? "Reminder belum memiliki catatan." : "Catatan belum memiliki isi.");
    const preview = body.length > 180 ? `${body.slice(0, 177)}...` : body;
    const tags = Array.isArray(note?._tags) ? note._tags : [];
    const ownerLabel = scope === "family"
      ? (note?.created_by === userId ? "Kamu pembuat" : "Catatan keluarga")
      : (note?.visibility === "family-read" ? "Sebelumnya dibagikan ke keluarga" : "Pribadi");
    card.dataset.searchText = clean(`${title} ${body} ${note?.folder_name || ""} ${ownerLabel} ${tags.join(" ")}`);

    const type = document.createElement("span");
    type.className = "catatan-note-type";
    type.innerHTML = `<ion-icon name="${isChecklist ? "checkbox-outline" : isReminder ? "notifications-outline" : "document-text-outline"}" aria-hidden="true"></ion-icon>`;
    const titleEl = document.createElement("strong");
    titleEl.textContent = title;
    const previewEl = document.createElement("span");
    previewEl.className = "catatan-note-preview";
    previewEl.textContent = preview;

    card.append(type, titleEl, previewEl);
    const tagSummary = CatatanManagement.renderTagSummary(tags);
    if (tagSummary) card.appendChild(tagSummary);

    const meta = document.createElement("span");
    meta.className = "catatan-archive-meta";
    if (note?.folder_name) {
      const folder = document.createElement("span");
      folder.textContent = `Folder ${clean(note.folder_name)}`;
      meta.appendChild(folder);
    }
    const archived = document.createElement("span");
    archived.textContent = formatArchiveDate(note?.archived_at);
    meta.appendChild(archived);
    const access = document.createElement("span");
    access.textContent = ownerLabel;
    meta.appendChild(access);
    card.appendChild(meta);

    const actions = [];
    if (note?._canRestore) {
      actions.push({
        label: "Pulihkan",
        icon: "refresh-outline",
        tone: "restore",
        onSelect: () => restoreNote(note)
      });
    }
    if (note?._canDeletePermanent) {
      actions.push({
        label: "Hapus permanen",
        icon: "trash-outline",
        tone: "danger",
        onSelect: () => deletePermanent(note)
      });
    }

    const shell = CatatanManagement.createCardShell(card, {
      actions,
      menuLabel: `Menu Arsip ${title}`
    });
    shell.dataset.archiveItem = "";
    shell.dataset.searchText = card.dataset.searchText;
    return shell;
  }

  function renderArchive(notes = []) {
    const list = Array.isArray(notes) ? notes : [];
    const nextFingerprint = window.CatatanPerformance?.fingerprint?.(list) || "";
    if (nextFingerprint && nextFingerprint === archiveFingerprint) {
      archiveNotes = list;
      return;
    }
    archiveFingerprint = nextFingerprint;
    archiveNotes = list;
    const grid = q("[data-archive-note-grid]");
    if (!grid) return;
    grid.textContent = "";
    notes.forEach(note => grid.appendChild(archiveCard(note)));

    const empty = ensureEmpty();
    if (empty) empty.hidden = notes.length !== 0;

    const deleteAll = q("[data-delete-all-archive]");
    const deletable = notes.filter(note => note?._canDeletePermanent).length;
    if (deleteAll) {
      deleteAll.hidden = deletable === 0;
      if (deletable === notes.length && deletable > 0) deleteAll.textContent = "Hapus semua";
      else if (deletable > 0) deleteAll.textContent = `Hapus yang bisa dikelola (${deletable})`;
    }
    filterArchive();
  }

  async function deleteAllArchive() {
    const deletable = archiveNotes.filter(note => note?._canDeletePermanent).length;
    if (!deletable) return;
    const all = deletable === archiveNotes.length;
    const ok = await CatatanManagement.confirmDanger({
      title: all ? `Hapus semua ${deletable} catatan Arsip?` : `Hapus ${deletable} catatan yang bisa kamu kelola?`,
      message: all
        ? "Semua catatan Arsip ini akan dihapus permanen dan tidak dapat dipulihkan."
        : "Hanya catatan Arsip yang memang boleh kamu kelola yang akan dihapus permanen. Catatan anggota lain tetap aman.",
      confirmLabel: all ? "Hapus semua" : `Hapus ${deletable}`
    });
    if (!ok) return;
    try {
      const count = await NotesService.hapusSemuaArsip(scope, familyId || null);
      showToast(`${count} catatan Arsip dihapus permanen.`);
      await loadArchive();
    } catch (error) {
      console.error("[Catatan Archive Delete All]", error);
      showToast(error?.message || "Arsip belum dapat dibersihkan.");
    }
  }

  async function loadArchive() {
    try {
      const notes = await NotesService.ambilCatatanArsip(scope, familyId || null);
      const ids = notes.map(note => note.id);
      const [tags, capabilities] = await Promise.all([
        NotesService.ambilTagMapArsip(ids),
        NotesService.ambilHakLifecycleCatatan(ids)
      ]);
      notes.forEach(note => {
        note._tags = tags[note.id] || [];
        note._canRestore = Boolean(capabilities[note.id]?.canRestore);
        note._canDeletePermanent = Boolean(capabilities[note.id]?.canDeletePermanent);
      });
      renderArchive(notes);
      window.CatatanPerformance?.write?.("archive-notes", {
        userId,
        familyId,
        scope
      }, notes);
    } catch (error) {
      console.error("[Catatan Archive Load]", error);
      if (NotesService.lifecycleSchemaBelumTerpasang?.(error)) showToast("Backend Arsip belum aktif — jalankan SQL 004F di Supabase dulu.");
      else showToast(error?.message || "Arsip belum dapat dimuat.");
    }
  }

  function setupInteractions() {
    q("#catatan-archive-search")?.addEventListener("input", filterArchive);
    q("[data-delete-all-archive]")?.addEventListener("click", deleteAllArchive);
    qa("[data-nav-placeholder]").forEach(button => {
      button.addEventListener("click", () => showToast(`${button.dataset.navPlaceholder} akan aktif pada tahap berikutnya.`));
    });
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    scope = clean(params.get("scope")).toLowerCase() === "family" ? "family" : "personal";
    source = clean(params.get("from")).toLowerCase() === "home" ? "home" : "";
    applyContext();
    setupInteractions();

    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }

    try {
      const user = await AuthService.ambilUserAktif();
      if (!user) return;
      userId = clean(user.id);
      if (scope === "family") {
        const family = await AuthRouter.ambilFamilyAktif();
        familyId = clean(family?.id);
        if (!familyId) {
          location.replace("catatan.html");
          return;
        }
      }
      const perf = window.CatatanPerformance;
      const cacheContext = { userId, familyId, scope };
      const cachedNotes = perf?.read?.("archive-notes", cacheContext);
      if (Array.isArray(cachedNotes)) renderArchive(cachedNotes);
      const loading = Array.isArray(cachedNotes)
        ? null
        : perf?.startSkeleton?.(q("[data-archive-note-grid]"), { kind: "notes", count: 4 });
      try {
        await loadArchive();
      } finally {
        loading?.finish?.();
      }
    } catch (error) {
      console.error("[Catatan Archive Init]", error);
      showToast("Arsip belum dapat dibuka.");
    } finally {
      q("[data-catatan-archive]")?.setAttribute("aria-busy", "false");
    }
  }

  window.addEventListener("pageshow", event => {
    if (!event.persisted || !userId) return;
    loadArchive();
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
