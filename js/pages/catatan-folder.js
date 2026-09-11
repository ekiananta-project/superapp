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
  let noteCount = 0;
  let renderedNotes = [];
  let notesById = new Map();
  let selectionMode = false;
  const selectedIds = new Set();
  let notesFingerprint = "";

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

  function ensureEmpty() {
    let empty = q("[data-folder-backend-empty]");
    if (empty) return empty;
    const section = q(".catatan-notes-section");
    if (!section || !window.CatatanManagement) return null;
    empty = CatatanManagement.createEmptyState("notes", {
      title: "Folder masih kosong",
      message: `Belum ada catatan di folder ${folderName}.`,
      actionLabel: scope === "member" ? "" : "Buat catatan",
      onAction: scope === "member" ? null : openCreateSheet
    });
    empty.dataset.folderBackendEmpty = "";
    empty.hidden = true;
    section.appendChild(empty);
    return empty;
  }

  function filterPreview() {
    const needle = clean(q("#catatan-folder-search")?.value).toLocaleLowerCase("id-ID");
    let visible = 0;
    qa("[data-folder-note]").forEach(item => {
      const show = !needle || clean(item.dataset.searchText).toLocaleLowerCase("id-ID").includes(needle);
      item.hidden = !show;
      if (show) visible += 1;
    });

    const searchEmpty = q("[data-search-empty]");
    if (searchEmpty) {
      searchEmpty.hidden = !needle || visible > 0;
      const copy = q("[data-folder-empty-copy]");
      if (copy) copy.textContent = `Coba kata kunci lain di folder ${folderName}.`;
      const strong = searchEmpty.querySelector("strong");
      if (strong) strong.textContent = "Tidak ada yang cocok";
    }
    const backendEmpty = q("[data-folder-backend-empty]");
    if (backendEmpty) backendEmpty.hidden = noteCount !== 0 || Boolean(needle);
    if (selectionMode) renderSelectionUI();
  }

  async function confirmArchiveNote(note) {
    if (scope === "member") return;
    const title = clean(note?.title, "Tanpa judul");
    const ok = await CatatanManagement.confirmArchive({
      title: `Arsipkan “${title}”?`,
      message: scope === "family"
        ? "Catatan ini akan dipindahkan ke Arsip untuk seluruh keluarga dan dapat dipulihkan nanti."
        : "Catatan ini akan dipindahkan ke Arsip dan dapat dipulihkan nanti.",
      confirmLabel: "Arsipkan"
    });
    if (!ok) return;
    try {
      await NotesService.arsipkan(note.id);
      showToast("Catatan dipindahkan ke Arsip.");
      await loadNotes();
    } catch (error) {
      console.error("[Catatan Folder Archive]", error);
      if (NotesService.lifecycleSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004F agar fitur Arsip aktif.");
      else showToast(error?.message || "Catatan belum dapat diarsipkan.");
    }
  }

  async function togglePinNote(note) {
    if (scope === "member") return;
    try {
      const next = !Boolean(note?._pinned);
      await NotesService.setPinCatatan(note.id, next);
      note._pinned = next;
      showToast(next ? "Catatan dipin." : "Pin dilepas.");
      const sorted = CatatanManagement.sortPinnedFirst(renderedNotes);
      renderNotes(sorted);
      window.CatatanPerformance?.write?.("folder-notes", {
        userId,
        familyId,
        scope,
        memberId,
        folderName
      }, sorted);
    } catch (error) {
      console.error("[Catatan Folder Pin]", error);
      if (NotesService.customizationSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004G agar Pin aktif.");
      else showToast(error?.message || "Pin belum dapat diubah.");
    }
  }

  async function changeCardColor(note) {
    if (scope === "member") return;
    const color = await CatatanManagement.pickCardColor(note?.card_color || "default");
    if (!color) return;
    try {
      await NotesService.setWarnaKartuCatatan(note.id, color);
      note.card_color = color;
      showToast("Warna kartu diperbarui.");
      await loadNotes();
    } catch (error) {
      console.error("[Catatan Folder Color]", error);
      if (NotesService.customizationSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004G agar Warna Catatan aktif.");
      else showToast(error?.message || "Warna catatan belum dapat diubah.");
    }
  }

  function invalidateMoveOutCaches() {
    const perf = window.CatatanPerformance;
    if (!perf?.remove || !userId) return;

    perf.remove("folder-notes", {
      userId,
      familyId,
      scope,
      memberId,
      folderName
    });

    if (scope === "family") {
      perf.remove("family-notes", { userId, familyId });
      perf.remove("family-folders", { userId, familyId });
    } else if (scope === "personal") {
      perf.remove("personal-notes", { userId });
      perf.remove("personal-folders", { userId });
    }
  }

  async function removeNoteFromFolder(note) {
    if (scope === "member") return;
    if (!window.NotesService?.pindahkanCatatanKeFolder) {
      showToast("Pemindahan folder belum siap.");
      return;
    }

    try {
      await NotesService.pindahkanCatatanKeFolder(note, { folderName: "", folderId: null });

      const next = renderedNotes.filter(item => clean(item?.id) !== clean(note?.id));
      notesFingerprint = "";
      renderNotes(next);

      invalidateMoveOutCaches();
      window.CatatanPerformance?.write?.("folder-notes", {
        userId,
        familyId,
        scope,
        memberId,
        folderName
      }, next);

      showToast("Catatan dikeluarkan dari folder.");
    } catch (error) {
      console.error("[Catatan Folder Remove]", error);
      if (NotesService.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      else showToast(error?.message || "Catatan belum dapat dikeluarkan dari folder.");
    }
  }

  function visibleSelectableIds() {
    if (scope === "member") return [];
    return qa('[data-folder-note-grid] .catatan-card-shell[data-note-selectable="true"]')
      .filter(shell => !shell.hidden)
      .map(shell => clean(shell.dataset.noteId))
      .filter(Boolean);
  }

  function allSelectedCanArchive() {
    if (!selectedIds.size) return false;
    return Array.from(selectedIds).every(id => Boolean(notesById.get(id)?._canArchive));
  }

  function renderSelectionUI() {
    const root = q("[data-catatan-folder]");
    const actions = q("[data-folder-selection-actions]");
    const toggle = q("[data-toggle-selection]");
    const selectAll = q("[data-select-all]");
    const countLabel = q("[data-selection-count]");
    const bulk = q("[data-bulk-bar]");
    const bulkCount = q("[data-bulk-count]");
    const bulkRemove = q("[data-bulk-remove-folder]");
    const bulkArchive = q("[data-bulk-archive]");
    const readonly = scope === "member";

    root?.classList.toggle("is-selection-mode", selectionMode && !readonly);
    if (actions) actions.hidden = readonly;

    if (toggle) {
      toggle.textContent = selectionMode ? "Selesai" : "Pilih";
      toggle.disabled = readonly || (!selectionMode && notesById.size === 0);
    }
    if (selectAll) selectAll.hidden = readonly || !selectionMode;
    if (countLabel) {
      countLabel.hidden = readonly || !selectionMode;
      countLabel.textContent = `${selectedIds.size} dipilih`;
    }
    if (bulk) bulk.hidden = readonly || !selectionMode;
    if (bulkCount) bulkCount.textContent = `${selectedIds.size} dipilih`;
    if (bulkRemove) bulkRemove.disabled = selectedIds.size === 0;
    if (bulkArchive) {
      const canArchiveAll = allSelectedCanArchive();
      bulkArchive.disabled = !canArchiveAll;
      bulkArchive.title = selectedIds.size && !canArchiveAll
        ? "Sebagian catatan hanya dapat diarsipkan oleh pembuat atau Family Owner."
        : "";
    }

    const visibleIds = visibleSelectableIds();
    if (selectAll && selectionMode && !readonly) {
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
      selectAll.textContent = allSelected ? "Batalkan semua" : "Pilih semua";
      selectAll.disabled = visibleIds.length === 0;
    }

    qa("[data-folder-note-grid] .catatan-card-shell[data-note-id]").forEach(shell => {
      CatatanManagement.setSelectionState(shell, selectedIds.has(clean(shell.dataset.noteId)));
    });
  }

  function setSelectionMode(active) {
    selectionMode = scope !== "member" && Boolean(active);
    CatatanManagement.closeActiveMenu?.();
    if (!selectionMode) selectedIds.clear();
    renderSelectionUI();
  }

  function toggleSelected(id) {
    if (!selectionMode || scope === "member" || !id || !notesById.has(id)) return;
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    renderSelectionUI();
  }

  function renderAfterBulkRemoval(ids = []) {
    const removed = new Set((Array.isArray(ids) ? ids : []).map(clean).filter(Boolean));
    const next = renderedNotes.filter(note => !removed.has(clean(note?.id)));
    notesFingerprint = "";
    setSelectionMode(false);
    renderNotes(next);
    window.CatatanPerformance?.write?.("folder-notes", {
      userId,
      familyId,
      scope,
      memberId,
      folderName
    }, next);
    return next;
  }

  async function removeSelectedFromFolder() {
    if (scope === "member") return;
    const notes = Array.from(selectedIds)
      .map(id => notesById.get(id))
      .filter(Boolean);
    if (!notes.length) return;
    if (!window.NotesService?.pindahkanBanyakCatatanKeFolder) {
      showToast("Pemindahan folder belum siap.");
      return;
    }

    try {
      const movedIds = await NotesService.pindahkanBanyakCatatanKeFolder(notes, {
        folderName: "",
        folderId: null
      });
      if (!movedIds.length) {
        showToast("Catatan terpilih belum dapat dikeluarkan dari folder.");
        return;
      }

      invalidateMoveOutCaches();
      renderAfterBulkRemoval(movedIds);
      showToast(`${movedIds.length} catatan dikeluarkan dari folder.`);
    } catch (error) {
      console.error("[Catatan Folder Bulk Remove]", error);
      if (NotesService.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      else showToast(error?.message || "Catatan terpilih belum dapat dikeluarkan dari folder.");
    }
  }

  async function archiveSelected() {
    if (scope === "member") return;
    const ids = Array.from(selectedIds).filter(id => notesById.has(id));
    if (!ids.length) return;
    if (!ids.every(id => notesById.get(id)?._canArchive)) {
      showToast("Sebagian catatan hanya dapat diarsipkan oleh pembuat atau Family Owner.");
      return;
    }

    const ok = await CatatanManagement.confirmArchive({
      title: `Arsipkan ${ids.length} catatan?`,
      message: scope === "family"
        ? "Catatan yang dipilih akan dipindahkan ke Arsip untuk seluruh keluarga dan dapat dipulihkan nanti."
        : "Catatan yang dipilih akan dipindahkan ke Arsip dan dapat dipulihkan nanti.",
      confirmLabel: `Arsipkan ${ids.length}`
    });
    if (!ok) return;

    try {
      const count = await NotesService.arsipkanBanyak(ids);
      invalidateMoveOutCaches();
      renderAfterBulkRemoval(ids);
      showToast(`${count} catatan dipindahkan ke Arsip.`);
    } catch (error) {
      console.error("[Catatan Folder Bulk Archive]", error);
      if (NotesService.lifecycleSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004F agar bulk Arsip aktif.");
      else showToast(error?.message || "Catatan terpilih belum dapat diarsipkan.");
    }
  }

  function noteCard(note) {
    const isChecklist = note?.note_type === "checklist";
    const isReminder = note?.note_type === "reminder";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catatan-note-card";
    button.dataset.noteId = clean(note?.id);
    CatatanManagement.applyCardColor(button, note?.card_color || "default");

    const title = clean(note?.title, "Tanpa judul");
    const body = clean(note?.body_text) || (isChecklist ? "Checklist belum memiliki item." : isReminder ? "Reminder belum memiliki catatan." : "Catatan belum memiliki isi.");
    const preview = body.length > 180 ? `${body.slice(0, 177)}...` : body;
    const tags = Array.isArray(note?._tags) ? note._tags : [];

    let access = "Hanya Saya";
    if (scope === "member") access = "Keluarga dapat melihat · Hanya baca";
    else if (scope === "family") access = "Area Keluarga · Kolaboratif";
    else if (note?.visibility === "family-read") access = "Keluarga dapat melihat";

    button.dataset.searchText = clean(`${title} ${body} ${folderName} ${access} ${tags.join(" ")}`);

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
      if (selectionMode && scope !== "member") return toggleSelected(note.id);
      const params = new URLSearchParams();
      params.set("scope", scope === "member" ? "personal" : scope);
      params.set("id", clean(note?.id));
      params.set("folder", folderName);
      if (scope === "member") {
        params.set("from", "member");
        params.set("member", memberId);
      }
      if (isReminder) params.set("type", "reminder");
      location.href = `${isChecklist ? "catatan-checklist.html" : "catatan-editor.html"}?${params.toString()}`;
    });
    button.dataset.folderNote = "";

    const actions = [];
    if (scope !== "member") {
      actions.push(
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
          label: "Keluarkan dari folder",
          icon: "folder-open-outline",
          onSelect: () => removeNoteFromFolder(note)
        }
      );
      if (note?._canArchive) actions.push({
        label: "Arsipkan",
        icon: "archive-outline",
        tone: "archive",
        onSelect: () => confirmArchiveNote(note)
      });
    }

    const shell = CatatanManagement.createCardShell(button, {
      menuLabel: `Menu ${title}`,
      actions
    });
    if (scope !== "member") {
      CatatanManagement.attachSelectionControl(shell, {
        selectable: true,
        label: `Pilih ${title}`,
        onToggle: () => toggleSelected(note.id)
      });
    }
    return shell;
  }

  function renderNotes(notes = []) {
    const grid = q("[data-folder-note-grid]");
    if (!grid) return;
    const list = Array.isArray(notes) ? notes : [];
    const nextFingerprint = window.CatatanPerformance?.fingerprint?.(list) || "";
    if (nextFingerprint && nextFingerprint === notesFingerprint) {
      noteCount = list.length;
      renderSelectionUI();
      return;
    }
    notesFingerprint = nextFingerprint;
    grid.textContent = "";
    renderedNotes = list;
    notesById = new Map(renderedNotes.map(note => [clean(note?.id), note]));
    for (const id of Array.from(selectedIds)) {
      if (!notesById.has(id)) selectedIds.delete(id);
    }
    noteCount = renderedNotes.length;
    renderedNotes.forEach(note => {
      const shell = noteCard(note);
      shell.dataset.folderNote = "";
      grid.appendChild(shell);
    });
    const empty = ensureEmpty();
    if (empty) empty.hidden = notes.length !== 0;
    filterPreview();
    renderSelectionUI();
  }

  function applyBaseContext() {
    const title = q("[data-folder-area-title]");
    const back = q("[data-folder-back]");
    const folder = q("[data-folder-name]");
    const search = q("#catatan-folder-search");
    const context = q("[data-create-context]");
    const archiveNav = q("[data-folder-archive]");

    if (folder) folder.textContent = folderName;
    if (search) {
      search.placeholder = `Cari di folder ${folderName}...`;
      search.setAttribute("aria-label", `Cari di folder ${folderName}`);
    }
    if (context) context.textContent = `Folder ${folderName}`;
    if (archiveNav) {
      const archiveScope = scope === "family" ? "family" : "personal";
      archiveNav.href = `catatan-arsip.html?scope=${archiveScope}`;
      archiveNav.setAttribute("aria-label", archiveScope === "family" ? "Buka Arsip Keluarga" : "Buka Arsip Pribadi");
    }

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
    const selectionActions = q("[data-folder-selection-actions]");
    if (selectionActions) selectionActions.hidden = true;
    setSelectionMode(false);
    document.title = `${folderName} · Catatan ${memberName} · RuangKitha`;
  }

  async function loadNotes() {
    if (!window.NotesService?.ambilCatatanDalamFolder) return;
    try {
      const ownerId = scope === "member" ? memberId : (scope === "personal" ? userId : null);
      const noteScope = scope === "member" ? "personal" : scope;
      const notes = await NotesService.ambilCatatanDalamFolder({
        scope: noteScope,
        familyId,
        ownerId,
        folderName,
        sharedWithFamilyOnly: scope === "member"
      });
      const ids = notes.map(note => note.id);
      try {
        const [tags, preferences] = await Promise.all([
          NotesService.ambilTagMapCatatan(ids),
          NotesService.ambilPreferensiCatatan(ids)
        ]);
        let capabilities = {};
        if (scope !== "member") capabilities = await NotesService.ambilHakLifecycleCatatan(ids);
        notes.forEach(note => {
          note._tags = tags[note.id] || [];
          note._canArchive = Boolean(capabilities[note.id]?.canArchive);
          note._pinned = Boolean(preferences[note.id]?.pinned);
        });
      } catch (metaError) {
        console.warn("[Catatan Folder Card Metadata]", metaError);
      }
      const sorted = CatatanManagement.sortPinnedFirst(notes);
      renderNotes(sorted);
      window.CatatanPerformance?.write?.("folder-notes", {
        userId,
        familyId,
        scope,
        memberId,
        folderName
      }, sorted);
    } catch (error) {
      console.error("[Catatan Folder Backend]", error);
      if (NotesService?.managementSchemaBelumTerpasang?.(error)) showToast("Backend lifecycle belum aktif — jalankan SQL 004F di Supabase dulu.");
      else if (NotesService?.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      else showToast(error?.message || "Isi folder belum dapat dimuat.");
    }
  }

  function setupInteractions() {
    q("#catatan-folder-search")?.addEventListener("input", filterPreview);
    q("[data-create-note]")?.addEventListener("click", openCreateSheet);
    q("[data-create-close]")?.addEventListener("click", closeCreateSheet);
    q("[data-create-layer]")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeCreateSheet();
    });
    q("[data-toggle-selection]")?.addEventListener("click", () => setSelectionMode(!selectionMode));
    q("[data-bulk-cancel]")?.addEventListener("click", () => setSelectionMode(false));
    q("[data-bulk-remove-folder]")?.addEventListener("click", removeSelectedFromFolder);
    q("[data-bulk-archive]")?.addEventListener("click", archiveSelected);
    q("[data-select-all]")?.addEventListener("click", () => {
      const ids = visibleSelectableIds();
      const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id));
      ids.forEach(id => allSelected ? selectedIds.delete(id) : selectedIds.add(id));
      renderSelectionUI();
    });

    qa("[data-create-type]").forEach(button => {
      button.addEventListener("click", () => {
        if (scope === "member") return;
        const type = button.dataset.createType || "Catatan";
        closeCreateSheet();
        const params = new URLSearchParams({ scope, folder: folderName });
        if (type === "Catatan Biasa") location.href = `catatan-editor.html?${params.toString()}`;
        else if (type === "Checklist") location.href = `catatan-checklist.html?${params.toString()}`;
        else if (type === "Reminder") {
          params.set("type", "reminder");
          location.href = `catatan-editor.html?${params.toString()}`;
        }
      });
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
      const [user, family] = await Promise.all([AuthService.ambilUserAktif(), AuthRouter.ambilFamilyAktif()]);
      if (!user || !family) return;
      userId = clean(user.id);
      familyId = clean(family.id);

      if (scope === "member") {
        if (!memberId) return location.replace("catatan.html");
        if (memberId === user.id) return location.replace(`catatan-folder.html?scope=personal&folder=${encodeURIComponent(folderName)}`);
        const members = await FamilyService.ambilAnggotaKeluarga(family.id);
        const member = (members || []).find(item => item?.user_id === memberId);
        if (!member) return location.replace("catatan.html");
        applyMemberContext(member?.profile?.display_name);
      }

      const perf = window.CatatanPerformance;
      const cacheContext = { userId, familyId, scope, memberId, folderName };
      const cachedNotes = perf?.read?.("folder-notes", cacheContext);
      if (Array.isArray(cachedNotes)) renderNotes(cachedNotes);
      const loading = Array.isArray(cachedNotes)
        ? null
        : perf?.startSkeleton?.(q("[data-folder-note-grid]"), { kind: "notes", count: 4 });
      try {
        await loadNotes();
      } finally {
        loading?.finish?.();
      }
    } catch (error) {
      console.error("[Catatan Folder]", error);
      showToast("Folder Catatan tidak dapat dimuat.");
    } finally {
      q("[data-catatan-folder]")?.setAttribute("aria-busy", "false");
    }
  }

  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    closeCreateSheet();
    window.CatatanManagement?.closeActiveMenu?.();
    if (selectionMode) setSelectionMode(false);
    if (!userId || !folderName) return;
    loadNotes();
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
