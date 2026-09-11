// RuangKitha v2.0.0a43 — Checklist + Relation Graph integration
(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));

  let scope = "personal";
  let folderName = "";
  let visibility = "private";
  let pinned = false;
  let cardColor = "default";
  let userId = "guest";
  let activeFamilyId = "";
  let noteId = "";
  let noteOwnerId = "";
  let noteReadOnly = false;
  let noteDeleteAllowed = false;
  let noteDeleting = false;
  let sourceContext = "";
  let memberSourceId = "";
  let memberViewName = "Anggota";

  let checklistBackendReady = false;
  let backendWarningShown = false;
  let hydratingNote = false;
  let noteDirty = false;
  let autosaveTimer = null;
  let saveRunning = false;
  let saveAgain = false;
  let currentSavePromise = null;
  let lastSavedFingerprint = "";

  let tagBackendReady = false;
  let tagBackendWarningShown = false;
  let tagDirty = false;
  let tagSaveRunning = false;
  let tagSaveAgain = false;
  let currentTagSavePromise = null;
  let lastSavedTagFingerprint = "[]";
  let availableTags = [];
  let selectedTags = new Set();
  let draftTags = new Set();

  let toastTimer = null;
  let editorMode = "edit";
  let itemSequence = 0;
  let reminderDate = "";
  let reminderTime = "";

  function clean(value, fallback = "") {
    const text = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!text || ["undefined", "null", "[object object]"].includes(text.toLowerCase())) return fallback;
    return text;
  }

  function itemText(value) {
    return String(value ?? "").trim().slice(0, 600);
  }

  function normalizeTag(value) {
    return clean(value)
      .replace(/^#+/, "")
      .replace(/[\s#]+/g, "-")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 36);
  }

  function showToast(message) {
    const el = q("[data-catatan-toast]");
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function setLayer(selector, open) {
    const layer = q(selector);
    if (layer) layer.hidden = !open;
  }

  function openSheet(selector) {
    q("[data-note-title]")?.blur();
    qa("[data-check-text]").forEach(input => input.blur());
    setLayer(selector, true);
  }

  function resizeTitle() {
    const input = q("[data-note-title]");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 116)}px`;
  }

  function resizeItem(input) {
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 34), 132)}px`;
  }

  async function resolveMemberViewContext() {
    if (sourceContext !== "member" || !noteReadOnly || !noteOwnerId) return;
    if (!memberSourceId || memberSourceId !== noteOwnerId) memberSourceId = noteOwnerId;
    memberViewName = "Anggota";
    if (!activeFamilyId || !window.FamilyService?.ambilAnggotaKeluarga) return;

    try {
      const members = await FamilyService.ambilAnggotaKeluarga(activeFamilyId);
      const owner = (members || []).find(item => item?.user_id === noteOwnerId);
      memberViewName = clean(owner?.profile?.display_name, "Anggota");
    } catch (error) {
      console.warn("[Checklist Member View Context]", error);
    }
  }

  function editorBackUrl() {
    if (sourceContext === "member" && noteReadOnly && memberSourceId && folderName) {
      return `catatan-folder.html?scope=member&member=${encodeURIComponent(memberSourceId)}&folder=${encodeURIComponent(folderName)}`;
    }
    if (sourceContext === "member" && noteReadOnly && memberSourceId) {
      return `catatan-anggota.html?member=${encodeURIComponent(memberSourceId)}`;
    }
    if (folderName) {
      return `catatan-folder.html?scope=${encodeURIComponent(scope)}&folder=${encodeURIComponent(folderName)}`;
    }
    return scope === "family" ? "catatan-keluarga.html" : "catatan-pribadi.html";
  }

  function applyMemberReadingView() {
    const memberReadOnly = sourceContext === "member" && noteReadOnly;
    const root = q("[data-catatan-checklist]");
    const header = q(".catatan-editor-header");
    const nav = q("[data-member-readonly-nav]");
    const navBack = q("[data-member-readonly-back]");

    root?.classList.toggle("is-member-readonly", memberReadOnly);
    root?.classList.toggle("is-readonly", noteReadOnly);

    if (header) {
      header.hidden = memberReadOnly;
      if (memberReadOnly) header.style.setProperty("display", "none", "important");
      else header.style.removeProperty("display");
    }
    if (nav) nav.hidden = !memberReadOnly;
    if (navBack) navBack.href = editorBackUrl();

    const modeToggle = q("[data-mode-toggle]");
    const infoButton = q("[data-open-info]");
    if (modeToggle) modeToggle.hidden = noteReadOnly;
    if (infoButton) infoButton.hidden = noteReadOnly;
  }

  function renderDeleteAction() {
    const row = q("[data-delete-row]");
    if (!row) return;
    row.hidden = !noteId || !noteDeleteAllowed || noteReadOnly;
  }

  async function refreshDeletePermission() {
    noteDeleteAllowed = false;
    if (!noteId || noteReadOnly || !window.NotesService?.bolehArsipkanCatatan) {
      renderDeleteAction();
      return;
    }
    try {
      noteDeleteAllowed = await window.NotesService.bolehArsipkanCatatan(noteId);
    } catch (error) {
      console.warn("[Checklist Archive Permission]", error);
      noteDeleteAllowed = noteOwnerId === userId;
    }
    renderDeleteAction();
  }

  async function deleteCurrentNote() {
    if (!noteId || !noteDeleteAllowed || noteReadOnly || noteDeleting) return;
    const title = clean(q("[data-note-title]")?.value, "Tanpa judul");
    setLayer("[data-info-layer]", false);
    const ok = await window.CatatanManagement?.confirmArchive?.({
      title: `Arsipkan “${title}”?`,
      message: scope === "family"
        ? "Checklist Keluarga ini akan dipindahkan ke Arsip untuk seluruh anggota dan dapat dipulihkan nanti."
        : "Checklist ini akan dipindahkan ke Arsip dan dapat dipulihkan nanti.",
      confirmLabel: "Arsipkan"
    });
    if (!ok) return;

    noteDeleting = true;
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    noteDirty = false;
    tagDirty = false;
    saveAgain = false;
    tagSaveAgain = false;
    try {
      if (currentSavePromise) await currentSavePromise;
      if (currentTagSavePromise) await currentTagSavePromise;
      await window.NotesService.arsipkan(noteId);
      location.replace(editorBackUrl());
    } catch (error) {
      noteDeleting = false;
      console.error("[Checklist Archive]", error);
      if (window.NotesService?.lifecycleSchemaBelumTerpasang?.(error)) showToast("Backend Arsip belum aktif — jalankan SQL 004F di Supabase dulu.");
      else showToast(error?.message || "Checklist belum dapat diarsipkan.");
    }
  }

  function renderVisibility() {
    const privateMode = visibility === "private";
    const label = privateMode ? "Hanya Saya" : "Keluarga dapat melihat";
    const icon = privateMode ? "lock-closed-outline" : "eye-outline";
    const chip = q("[data-visibility-chip]");
    const chipLabel = q("[data-visibility-label]");
    const info = q("[data-info-visibility]");
    if (chipLabel) chipLabel.textContent = label;
    chip?.querySelector("ion-icon")?.setAttribute("name", icon);
    if (info) info.textContent = label;
    qa("[data-visibility-check]").forEach(el => {
      const expected = String(el.dataset.visibilityCheck || "").replace("_", "-");
      const active = expected === visibility;
      el.setAttribute("name", active ? "checkmark-circle" : "ellipse-outline");
    });
  }

  function renderPinState() {
    q("[data-pin-switch]")?.classList.toggle("is-on", pinned);
    const state = q("[data-pin-state]");
    if (state) state.textContent = pinned ? "Dipin" : "Tidak dipin";
  }

  function renderCardColorState() {
    const state = q("[data-info-color]");
    if (state) state.textContent = window.CatatanManagement?.cardColorLabel?.(cardColor) || "Default";
  }

  async function changeCardColor() {
    if (noteReadOnly) return;
    const next = await window.CatatanManagement?.pickCardColor?.(cardColor, { title: "Warna Checklist" });
    if (!next) return;
    const previous = cardColor;
    cardColor = next;
    renderCardColorState();

    if (!noteId) {
      await saveChecklistNow();
      if (!noteId) {
        showToast("Warna akan diterapkan setelah checklist mulai diisi.");
        return;
      }
    }

    try {
      await window.NotesService.setWarnaKartuCatatan(noteId, cardColor);
      showToast("Warna kartu diperbarui.");
    } catch (error) {
      cardColor = previous;
      renderCardColorState();
      console.error("[Checklist Color]", error);
      if (window.NotesService?.customizationSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004G agar Warna Catatan aktif.");
      else showToast(error?.message || "Warna checklist belum dapat diubah.");
    }
  }

  function invalidateFolderCaches(previousFolder = "", nextFolder = "") {
    const perf = window.CatatanPerformance;
    if (!perf?.remove || !userId) return;
    if (scope === "family") {
      perf.remove("family-notes", { userId, familyId: activeFamilyId });
      perf.remove("family-folders", { userId, familyId: activeFamilyId });
    } else {
      perf.remove("personal-notes", { userId });
      perf.remove("personal-folders", { userId });
    }
    Array.from(new Set([clean(previousFolder), clean(nextFolder)].filter(Boolean))).forEach(name => {
      perf.remove("folder-notes", {
        userId,
        familyId: activeFamilyId,
        scope,
        memberId: "",
        folderName: name
      });
    });
  }

  async function changeFolder() {
    if (noteReadOnly) return;
    if (!window.NotesService?.ambilFolderCatalog || !window.CatatanManagement?.pickFolder) {
      showToast("Pemilih folder belum siap.");
      return;
    }
    if (scope === "family" && !activeFamilyId) {
      showToast("Keluarga aktif belum ditemukan.");
      return;
    }

    let folders = [];
    try {
      folders = await window.NotesService.ambilFolderCatalog(scope, activeFamilyId || null);
    } catch (error) {
      console.error("[Checklist Folder Catalog]", error);
      if (window.NotesService?.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      else showToast(error?.message || "Folder belum dapat dimuat.");
      return;
    }

    let choice = await window.CatatanManagement.pickFolder(folders, {
      currentName: folderName,
      context: scope === "family" ? "Checklist Keluarga" : "Checklist Pribadi"
    });
    if (!choice) return;

    if (choice.create) {
      const requested = await window.CatatanManagement.askFolderName({
        context: scope === "family" ? "Checklist Keluarga" : "Checklist Pribadi"
      });
      if (!requested) return;
      try {
        const created = await window.NotesService.buatFolder(scope, activeFamilyId || null, requested);
        choice = { name: clean(created?.name, requested) };
      } catch (error) {
        console.error("[Checklist Create Folder]", error);
        if (window.NotesService?.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004G di Supabase dulu.");
        else showToast(error?.message || "Folder belum dapat dibuat.");
        return;
      }
    }

    const nextName = clean(choice.name);
    if (nextName === folderName) return;
    const previous = folderName;
    const hadPersistedNote = Boolean(noteId);
    folderName = nextName;
    applyContext();
    noteDirty = true;

    const saved = await saveChecklistNow();
    const saveState = q("[data-catatan-checklist]")?.getAttribute("data-save-state");
    if (hadPersistedNote && !saved && saveState === "error") {
      folderName = previous;
      applyContext();
      return;
    }

    if (!noteId) {
      showToast(folderName
        ? `Folder “${folderName}” akan diterapkan setelah checklist mulai diisi.`
        : "Checklist akan disimpan tanpa folder setelah mulai diisi.");
      return;
    }
    invalidateFolderCaches(previous, folderName);
    showToast(folderName ? `Dipindahkan ke folder “${folderName}”.` : "Checklist dikeluarkan dari folder.");
  }

  function applyContext() {
    const root = q("[data-catatan-checklist]");
    root?.classList.toggle("is-family-scope", scope === "family");
    const modeArea = q("[data-mode-area]");
    if (modeArea) modeArea.textContent = scope === "family" ? "Area Keluarga" : "Area Pribadi";
    const memberReadContext = q("[data-member-readonly-context]");
    if (memberReadContext && sourceContext === "member" && noteReadOnly) {
      memberReadContext.textContent = `Area Pribadi · Milik ${memberViewName || "anggota"}`;
    }
    const areaLabel = q("[data-area-label]");
    const areaChip = q("[data-area-chip]");
    const areaIcon = areaChip?.querySelector("ion-icon");
    const visibilityChip = q("[data-visibility-chip]");
    const visibilityChevron = visibilityChip?.querySelector(".catatan-context-chevron");
    const visibilityRow = q("[data-visibility-row]");
    const promoteRow = q("[data-promote-row]");
    const folderChip = q("[data-folder-chip]");
    const folderLabel = q("[data-folder-label]");
    const infoFolder = q("[data-info-folder]");
    const back = q("[data-editor-back]");
    const readBack = q("[data-member-readonly-back]");

    if (back) back.href = editorBackUrl();
    if (readBack) readBack.href = editorBackUrl();

    if (sourceContext === "member" && noteReadOnly) {
      if (areaLabel) areaLabel.textContent = memberViewName ? `Milik ${memberViewName}` : "Milik anggota";
      if (areaIcon) areaIcon.setAttribute("name", "person-circle-outline");
      if (visibilityChip) {
        visibilityChip.hidden = false;
        visibilityChip.disabled = true;
      }
      if (visibilityChevron) visibilityChevron.hidden = true;
      const visibilityLabel = q("[data-visibility-label]");
      if (visibilityLabel) visibilityLabel.textContent = "Hanya baca";
      visibilityChip?.querySelector("ion-icon")?.setAttribute("name", "eye-outline");
      if (visibilityRow) visibilityRow.hidden = false;
      if (promoteRow) promoteRow.hidden = true;
    } else if (scope === "family") {
      if (areaLabel) areaLabel.textContent = "Catatan Keluarga";
      if (areaIcon) areaIcon.setAttribute("name", "people-outline");
      if (visibilityChip) visibilityChip.hidden = true;
      if (visibilityChevron) visibilityChevron.hidden = true;
      if (visibilityRow) visibilityRow.hidden = true;
      if (promoteRow) promoteRow.hidden = true;
    } else {
      if (areaLabel) areaLabel.textContent = "Pribadi";
      if (areaIcon) areaIcon.setAttribute("name", "person-outline");
      if (visibilityChip) visibilityChip.hidden = false;
      if (visibilityChevron) visibilityChevron.hidden = false;
      if (visibilityRow) visibilityRow.hidden = false;
      if (promoteRow) promoteRow.hidden = false;
      renderVisibility();
    }

    if (folderName) {
      if (folderChip) folderChip.hidden = false;
      if (folderLabel) folderLabel.textContent = folderName;
      if (infoFolder) infoFolder.textContent = folderName;
    } else {
      if (folderChip) folderChip.hidden = true;
      if (infoFolder) infoFolder.textContent = "Tanpa folder";
    }

    renderDeleteAction();
    renderPinState();
    renderMetadataTags();
    renderReminder();
    applyMemberReadingView();
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function reminderLabel() {
    if (!reminderDate || !reminderTime) return "";
    const value = new Date(`${reminderDate}T${reminderTime}:00`);
    if (Number.isNaN(value.getTime())) return `${reminderDate} · ${reminderTime}`;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(value).replace(" pukul ", " · ");
  }

  function renderReminder() {
    const hasReminder = Boolean(reminderDate && reminderTime);
    const chip = q("[data-reminder-chip]");
    const chipLabel = q("[data-reminder-chip-label]");
    const info = q("[data-info-reminder]");
    const remove = q("[data-reminder-remove]");
    const label = reminderLabel();
    if (chip) chip.hidden = !hasReminder;
    if (chipLabel) chipLabel.textContent = label;
    if (info) info.textContent = hasReminder ? label : "Belum diatur";
    if (remove) remove.hidden = !hasReminder;
  }

  function openReminderSheet() {
    if (noteReadOnly || editorMode !== "edit") {
      showToast("Masuk ke Edit catatan untuk mengubah reminder.");
      return;
    }
    const dateInput = q("[data-reminder-date]");
    const timeInput = q("[data-reminder-time]");
    if (dateInput) {
      dateInput.min = localDateString();
      dateInput.value = reminderDate;
    }
    if (timeInput) timeInput.value = reminderTime;
    openSheet("[data-reminder-layer]");
  }

  function saveReminder() {
    if (noteReadOnly) return;
    const date = clean(q("[data-reminder-date]")?.value);
    const time = clean(q("[data-reminder-time]")?.value);
    if (!date || !time) {
      showToast("Pilih tanggal dan waktu reminder dulu.");
      return;
    }
    reminderDate = date;
    reminderTime = time;
    renderReminder();
    setLayer("[data-reminder-layer]", false);
    showToast("Reminder disimpan di checklist. Backend Reminder menyusul di tahap berikutnya.");
  }

  function removeReminder() {
    if (noteReadOnly) return;
    reminderDate = "";
    reminderTime = "";
    renderReminder();
    setLayer("[data-reminder-layer]", false);
    showToast("Reminder dihapus dari checklist.");
  }

  function warningStorageKey() {
    return `ruangkitha_catatan_sensitive_notice_v1:${userId}`;
  }

  function tagCatalogStorageKey() {
    return `ruangkitha_catatan_tag_catalog_preview_v1:${userId}:${scope}`;
  }

  function loadLegacyTagCatalog() {
    try {
      const parsed = JSON.parse(localStorage.getItem(tagCatalogStorageKey()) || "[]");
      availableTags = Array.isArray(parsed)
        ? Array.from(new Set(parsed.map(normalizeTag).filter(Boolean))).sort()
        : [];
    } catch {
      availableTags = [];
    }
  }

  function saveLegacyTagCatalog() {
    try { localStorage.setItem(tagCatalogStorageKey(), JSON.stringify(availableTags)); } catch {}
  }

  function tagFingerprint(tags = selectedTags) {
    return JSON.stringify(Array.from(tags || []).map(normalizeTag).filter(Boolean).sort());
  }

  function showTagBackendWarning(error) {
    if (tagBackendWarningShown) return;
    tagBackendWarningShown = true;
    if (window.NotesService?.tagSchemaBelumTerpasang?.(error)) {
      showToast("Backend Tag belum aktif — jalankan SQL 004B di Supabase dulu.");
    } else {
      showToast(error?.message || "Tag belum dapat disinkronkan ke Supabase.");
    }
  }

  async function loadTagCatalog({ silent = true } = {}) {
    if (!tagBackendReady || !window.NotesService?.ambilTagCatalog) {
      loadLegacyTagCatalog();
      return availableTags;
    }

    try {
      const tags = await window.NotesService.ambilTagCatalog(scope, activeFamilyId || null);
      availableTags = Array.from(new Set((tags || []).map(normalizeTag).filter(Boolean))).sort();
      return availableTags;
    } catch (error) {
      console.error("[Checklist Tag Catalog]", error);
      if (window.NotesService?.tagSchemaBelumTerpasang?.(error)) tagBackendReady = false;
      loadLegacyTagCatalog();
      if (!silent) showTagBackendWarning(error);
      return availableTags;
    }
  }

  async function loadSelectedTags() {
    if (!noteId || !tagBackendReady || !window.NotesService?.ambilTagCatatan) {
      selectedTags = new Set();
      lastSavedTagFingerprint = tagFingerprint();
      tagDirty = false;
      return;
    }
    try {
      const tags = await window.NotesService.ambilTagCatatan(noteId);
      selectedTags = new Set((tags || []).map(normalizeTag).filter(Boolean));
      lastSavedTagFingerprint = tagFingerprint();
      tagDirty = false;
    } catch (error) {
      console.error("[Checklist Tags Load]", error);
      if (window.NotesService?.tagSchemaBelumTerpasang?.(error)) tagBackendReady = false;
      showTagBackendWarning(error);
    }
  }

  async function saveTagsNow({ announce = false } = {}) {
    if (noteReadOnly || noteDeleting || !noteId || !tagBackendReady || !window.NotesService?.syncTagCatatan) return [];
    const currentFingerprint = tagFingerprint();
    if (!tagDirty && currentFingerprint === lastSavedTagFingerprint) return Array.from(selectedTags);

    if (tagSaveRunning) {
      tagSaveAgain = true;
      if (currentTagSavePromise) await currentTagSavePromise;
      if (tagDirty && tagBackendReady) return saveTagsNow({ announce });
      return Array.from(selectedTags);
    }

    const requestedNames = Array.from(selectedTags);
    const requestedFingerprint = tagFingerprint(new Set(requestedNames));
    tagSaveRunning = true;
    currentTagSavePromise = (async () => {
      try {
        const tags = await window.NotesService.syncTagCatatan(noteId, requestedNames);
        const savedSet = new Set((tags || []).map(normalizeTag).filter(Boolean));
        const savedFingerprint = tagFingerprint(savedSet);
        availableTags = Array.from(new Set([...availableTags, ...savedSet])).sort();
        lastSavedTagFingerprint = savedFingerprint;

        if (tagFingerprint() === requestedFingerprint) {
          selectedTags = savedSet;
          tagDirty = false;
        } else {
          tagDirty = true;
          tagSaveAgain = true;
        }
        renderMetadataTags();
        if (announce && !tagDirty) showToast("Tag tersimpan.");
        return Array.from(savedSet);
      } catch (error) {
        tagDirty = true;
        console.error("[Checklist Tags Save]", error);
        if (window.NotesService?.tagSchemaBelumTerpasang?.(error)) tagBackendReady = false;
        showTagBackendWarning(error);
        return Array.from(selectedTags);
      }
    })();

    try {
      return await currentTagSavePromise;
    } finally {
      currentTagSavePromise = null;
      tagSaveRunning = false;
      if (tagSaveAgain && tagBackendReady) {
        tagSaveAgain = false;
        if (tagDirty && tagFingerprint() !== lastSavedTagFingerprint) setTimeout(() => saveTagsNow(), 0);
      } else {
        tagSaveAgain = false;
      }
    }
  }

  function renderMetadataTags() {
    const host = q("[data-tag-chips]");
    if (!host) return;
    host.textContent = "";

    const tags = Array.from(selectedTags).sort();
    const canEditTags = !noteReadOnly && editorMode === "edit";
    const add = q("[data-tag-add]");

    if (tags.length) {
      const summary = document.createElement("button");
      summary.type = "button";
      summary.className = "catatan-tag-stack-summary";
      summary.disabled = !canEditTags;
      summary.setAttribute("aria-label", `${tags.length} tag dipakai${canEditTags ? ", ketuk untuk mengelola" : ""}`);
      const stackLayers = "<i></i>".repeat(Math.min(tags.length, 3));
      summary.innerHTML = `
        <span class="catatan-tag-stack-visual" aria-hidden="true">${stackLayers}</span>
        <strong>${tags.length} tag</strong>
        ${canEditTags ? '<ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>' : ""}
      `;
      if (canEditTags) summary.addEventListener("click", openTagSheet);
      host.appendChild(summary);
      if (add) add.hidden = true;
    } else if (add) {
      add.hidden = !canEditTags;
      const label = add.querySelector("span");
      if (label) label.textContent = "Tambah tag...";
    }

    const info = q("[data-info-tags]");
    if (info) info.textContent = tags.length ? `${tags.length} tag dipilih` : "Belum ada tag";
  }

  function renderTagPicker() {
    const searchValue = normalizeTag(q("[data-tag-search]")?.value || "");
    const list = q("[data-tag-list]");
    const empty = q("[data-tag-empty]");
    const newInput = q("[data-tag-new-input]");
    const create = q("[data-tag-create]");
    if (!list) return;

    list.textContent = "";
    const all = Array.from(new Set([...availableTags, ...draftTags])).sort();
    const selected = Array.from(draftTags).sort();
    const others = all
      .filter(tag => !draftTags.has(tag))
      .filter(tag => !searchValue || tag.includes(searchValue));

    const heading = (label, count) => {
      const el = document.createElement("div");
      el.className = "catatan-tag-section-title";
      el.innerHTML = `<strong>${label}</strong><span>${count}</span>`;
      list.appendChild(el);
    };

    const option = (tag, isSelected) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `catatan-tag-option${isSelected ? " is-selected" : ""}`;
      button.dataset.tagOption = tag;
      button.innerHTML = `<strong>#${tag}</strong><ion-icon name="${isSelected ? "checkmark-circle" : "ellipse-outline"}" aria-hidden="true"></ion-icon>`;
      button.addEventListener("click", () => {
        if (draftTags.has(tag)) draftTags.delete(tag);
        else draftTags.add(tag);
        renderTagPicker();
      });
      list.appendChild(button);
    };

    heading("Dipilih", selected.length);
    selected.forEach(tag => option(tag, true));

    heading("Tag lainnya", others.length);
    others.forEach(tag => option(tag, false));

    if (empty) {
      empty.hidden = others.length > 0 || !searchValue;
      empty.textContent = "Tidak ada tag lain yang cocok.";
    }

    const newValue = normalizeTag(newInput?.value || "");
    if (create) create.disabled = !newValue;
  }

  async function openTagSheet() {
    if (noteReadOnly || editorMode !== "edit") return;
    draftTags = new Set(selectedTags);
    const search = q("[data-tag-search]");
    const newInput = q("[data-tag-new-input]");
    if (search) search.value = "";
    if (newInput) newInput.value = "";
    openSheet("[data-tag-layer]");
    await loadTagCatalog({ silent: false });
    renderTagPicker();
    setTimeout(() => (availableTags.length ? search : newInput)?.focus(), 80);
  }

  async function openTagManagerFromPicker() {
    if (noteReadOnly || editorMode !== "edit" || !window.CatatanManagement?.openTagManager) return;
    await window.CatatanManagement.openTagManager({
      scope,
      familyId: activeFamilyId || null,
      context: scope === "family" ? "Tag Keluarga" : "Tag Pribadi",
      notify: showToast,
      onChanged: async () => {
        await loadTagCatalog({ silent: false });
        if (noteId) await loadSelectedTags();
        else selectedTags = new Set(Array.from(selectedTags).filter(tag => availableTags.includes(tag)));
        draftTags = new Set(Array.from(draftTags).filter(tag => availableTags.includes(tag)));
        renderMetadataTags();
        renderTagPicker();
      }
    });
  }

  function closeTagSheet(apply = false) {
    if (apply && !noteReadOnly) {
      const next = new Set(draftTags);
      const changed = tagFingerprint(next) !== tagFingerprint(selectedTags);
      selectedTags = next;
      if (changed) tagDirty = true;
      renderMetadataTags();
      if (changed) {
        if (noteId) saveTagsNow();
        else scheduleChecklistAutosave(120);
      }
    }
    setLayer("[data-tag-layer]", false);
  }

  async function createTagFromSearch() {
    const input = q("[data-tag-new-input]");
    const value = normalizeTag(input?.value || "");
    if (!value || noteReadOnly) return;

    const existing = availableTags.find(tag => tag === value);
    let finalValue = existing || value;
    let mayUseTag = true;

    if (!existing && tagBackendReady && window.NotesService?.buatTag) {
      const createButton = q("[data-tag-create]");
      if (createButton) createButton.disabled = true;
      try {
        finalValue = normalizeTag(await window.NotesService.buatTag(scope, activeFamilyId || null, value)) || value;
      } catch (error) {
        console.error("[Checklist Tag Create]", error);
        const missing = window.NotesService?.tagSchemaBelumTerpasang?.(error);
        if (missing) tagBackendReady = false;
        else mayUseTag = false;
        showTagBackendWarning(error);
      }
    }

    if (!mayUseTag) {
      renderTagPicker();
      return;
    }
    if (!availableTags.includes(finalValue)) {
      availableTags.push(finalValue);
      availableTags.sort();
      if (!tagBackendReady) saveLegacyTagCatalog();
    }
    draftTags.add(finalValue);
    if (input) input.value = "";
    renderTagPicker();
    input?.focus();
  }

  function itemElements() {
    return qa("[data-checklist-item]");
  }

  function serializableItems() {
    return itemElements().map((item, index) => ({
      id: clean(item.dataset.itemId),
      text: itemText(item.querySelector("[data-check-text]")?.value),
      completed: item.classList.contains("is-complete"),
      sortOrder: index
    })).filter(item => item.text);
  }

  function updateProgress() {
    const items = serializableItems();
    const done = items.filter(item => item.completed).length;
    const total = items.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const label = q("[data-progress-label]");
    const pct = q("[data-progress-percent]");
    const bar = q("[data-progress-bar]");
    if (label) label.textContent = `${done} dari ${total} selesai`;
    if (pct) pct.textContent = `${percent}%`;
    if (bar) bar.style.width = `${percent}%`;
  }

  function syncViewOnlyItems(view) {
    itemElements().forEach(item => {
      const input = item.querySelector("[data-check-text]");
      const empty = !itemText(input?.value);
      item.classList.toggle("is-view-empty", view && empty);
      item.setAttribute("aria-hidden", view && empty ? "true" : "false");
    });
  }

  function setItemComplete(item, complete) {
    if (!item) return;
    item.classList.toggle("is-complete", complete);
    const toggle = item.querySelector("[data-check-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-checked", complete ? "true" : "false");
      toggle.setAttribute("aria-label", complete ? "Tandai belum selesai" : "Tandai selesai");
      toggle.querySelector("ion-icon")?.setAttribute("name", complete ? "checkmark-circle" : "ellipse-outline");
    }
    updateProgress();
  }

  function focusItem(item, atEnd = true) {
    if (noteReadOnly || editorMode !== "edit") return;
    const input = item?.querySelector("[data-check-text]");
    if (!input) return;
    input.focus();
    if (atEnd) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }

  function removeItem(item, focusNeighbor = true) {
    if (noteReadOnly) return;
    const list = q("[data-checklist-list]");
    if (!item || !list) return;
    const items = itemElements();
    const index = items.indexOf(item);
    const previous = items[index - 1];
    const next = items[index + 1];
    item.remove();

    if (!itemElements().length) {
      const replacement = createItem("");
      list.appendChild(replacement);
      if (focusNeighbor) focusItem(replacement, false);
    } else if (focusNeighbor) {
      focusItem(previous || next, true);
    }
    updateProgress();
    scheduleChecklistAutosave(120);
  }

  function createItem(text = "", complete = false, id = "") {
    itemSequence += 1;
    const item = document.createElement("div");
    item.className = "catatan-checklist-item";
    item.dataset.checklistItem = String(itemSequence);
    if (id) item.dataset.itemId = id;
    item.innerHTML = `
      <button class="catatan-check-toggle" type="button" role="checkbox" aria-checked="false" aria-label="Tandai selesai" data-check-toggle>
        <ion-icon name="ellipse-outline" aria-hidden="true"></ion-icon>
      </button>
      <textarea class="catatan-check-text" rows="1" maxlength="600" placeholder="Tulis item..." data-check-text aria-label="Item checklist"></textarea>
      <button class="catatan-check-remove" type="button" data-check-remove aria-label="Hapus item">
        <ion-icon name="close-outline" aria-hidden="true"></ion-icon>
      </button>`;

    const input = item.querySelector("[data-check-text]");
    const toggle = item.querySelector("[data-check-toggle]");
    const remove = item.querySelector("[data-check-remove]");
    input.value = text;
    resizeItem(input);
    setItemComplete(item, complete);

    input.addEventListener("input", () => {
      resizeItem(input);
      updateProgress();
      scheduleChecklistAutosave();
    });
    input.addEventListener("blur", () => saveChecklistNow());
    input.addEventListener("keydown", event => {
      if (noteReadOnly || editorMode !== "edit") return;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const newItem = createItem("");
        item.insertAdjacentElement("afterend", newItem);
        updateProgress();
        focusItem(newItem, false);
        return;
      }
      if (event.key === "Backspace" && !input.value && itemElements().length > 1) {
        event.preventDefault();
        removeItem(item, true);
      }
    });

    toggle.addEventListener("click", () => {
      if (noteReadOnly) return;
      setItemComplete(item, !item.classList.contains("is-complete"));
      scheduleChecklistAutosave(120);
    });

    remove.addEventListener("click", () => {
      if (noteReadOnly || editorMode !== "edit") return;
      removeItem(item, true);
    });

    return item;
  }

  function addItem(focus = true) {
    if (noteReadOnly || editorMode !== "edit") return;
    const list = q("[data-checklist-list]");
    if (!list) return;
    const item = createItem("");
    list.appendChild(item);
    updateProgress();
    if (focus) focusItem(item, false);
  }

  function seedChecklist() {
    const list = q("[data-checklist-list]");
    if (!list || list.children.length) return;
    list.appendChild(createItem(""));
    updateProgress();
  }

  function renderLoadedItems(items = []) {
    const list = q("[data-checklist-list]");
    if (!list) return;
    list.textContent = "";
    itemSequence = 0;
    (items || []).forEach(item => {
      list.appendChild(createItem(item.text || item.item_text || "", Boolean(item.completed ?? item.is_completed), clean(item.id)));
    });
    if (!list.children.length) list.appendChild(createItem(""));
    itemElements().forEach(item => resizeItem(item.querySelector("[data-check-text]")));
    updateProgress();
  }

  function checklistSnapshot() {
    const items = serializableItems();
    return {
      id: noteId || null,
      familyId: activeFamilyId || null,
      scope,
      visibility,
      title: String(q("[data-note-title]")?.value || "").trim(),
      bodyHtml: "",
      bodyText: items.map(item => item.text).join("\n"),
      folderName,
      cardColor,
      items
    };
  }

  function checklistFingerprint(snapshot = checklistSnapshot()) {
    return JSON.stringify({
      familyId: snapshot.familyId || "",
      scope: snapshot.scope,
      visibility: snapshot.visibility,
      title: snapshot.title,
      folderName: snapshot.folderName || "",
      cardColor: snapshot.cardColor || "default",
      items: snapshot.items.map(item => ({ text: item.text, completed: Boolean(item.completed) }))
    });
  }

  function hasMeaningfulChecklist(snapshot = checklistSnapshot()) {
    return Boolean(snapshot.title || snapshot.items.length);
  }

  function updateNoteUrl() {
    if (!noteId) return;
    const url = new URL(location.href);
    url.searchParams.set("id", noteId);
    url.searchParams.set("scope", scope);
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function showBackendWarning(error) {
    if (backendWarningShown) return;
    backendWarningShown = true;
    if (window.NotesService?.folderSchemaBelumTerpasang?.(error)) {
      showToast("Backend kolaborasi/folder belum aktif — jalankan SQL 004D di Supabase dulu.");
    } else if (window.NotesService?.checklistSchemaBelumTerpasang?.(error)) {
      showToast("Backend Checklist belum aktif — jalankan SQL 004C di Supabase dulu.");
    } else if (window.NotesService?.schemaBelumTerpasang?.(error)) {
      showToast("Backend Catatan belum aktif — jalankan SQL 004A di Supabase dulu.");
    } else {
      showToast(error?.message || "Checklist belum dapat disimpan ke Supabase.");
    }
  }

  async function saveChecklistNow({ announce = false } = {}) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;

    if (!checklistBackendReady || noteReadOnly || hydratingNote || noteDeleting) return null;
    if (saveRunning) {
      saveAgain = true;
      if (currentSavePromise) await currentSavePromise;
      if (noteDirty) return saveChecklistNow({ announce });
      return null;
    }

    const snapshot = checklistSnapshot();
    const fingerprint = checklistFingerprint(snapshot);
    if (!noteDirty && fingerprint === lastSavedFingerprint) {
      if (tagDirty && noteId) await saveTagsNow();
      return null;
    }

    if (!noteId && !hasMeaningfulChecklist(snapshot)) {
      noteDirty = false;
      return null;
    }

    saveRunning = true;
    noteDirty = false;
    q("[data-catatan-checklist]")?.setAttribute("data-save-state", "saving");

    currentSavePromise = (async () => {
      try {
        const wasNewNote = !noteId;
        const saved = await window.NotesService.simpanChecklist(snapshot);
        noteId = clean(saved?.id, noteId);
        noteOwnerId = clean(saved?.created_by, userId);
        noteDeleteAllowed = Boolean(noteId && noteOwnerId === userId);
        renderDeleteAction();
        updateNoteUrl();
        if (wasNewNote) window.CatatanRelated?.refresh?.();
        else window.CatatanRelated?.render?.();

        const savedItems = await window.NotesService.syncChecklistItems(noteId, snapshot.items);
        const currentFingerprint = checklistFingerprint();
        if (currentFingerprint === fingerprint) {
          const visibleItems = itemElements().filter(item => itemText(item.querySelector("[data-check-text]")?.value));
          (savedItems || []).forEach((item, index) => {
            if (visibleItems[index] && item?.id) visibleItems[index].dataset.itemId = item.id;
          });
          lastSavedFingerprint = fingerprint;
          noteDirty = false;
        } else {
          noteDirty = true;
          saveAgain = true;
        }

        q("[data-catatan-checklist]")?.setAttribute("data-save-state", "saved");
        if (tagDirty || (noteId && selectedTags.size && lastSavedTagFingerprint === "[]")) await saveTagsNow();
        if (noteId && pinned && window.NotesService?.setPinCatatan) {
          try { await window.NotesService.setPinCatatan(noteId, true); } catch (error) { console.warn("[Checklist Pin Save]", error); }
        }
        if (noteId && cardColor !== "default" && window.NotesService?.setWarnaKartuCatatan) {
          try { await window.NotesService.setWarnaKartuCatatan(noteId, cardColor); } catch (error) { console.warn("[Checklist Color Save]", error); }
        }
        if (announce && !noteDirty) showToast("Checklist tersimpan.");
        return saved;
      } catch (error) {
        noteDirty = true;
        q("[data-catatan-checklist]")?.setAttribute("data-save-state", "error");
        console.error("[Checklist Save]", error);
        if (window.NotesService?.checklistSchemaBelumTerpasang?.(error)) checklistBackendReady = false;
        showBackendWarning(error);
        return null;
      }
    })();

    try {
      return await currentSavePromise;
    } finally {
      currentSavePromise = null;
      saveRunning = false;
      if (saveAgain) {
        saveAgain = false;
        if (noteDirty) setTimeout(() => saveChecklistNow(), 0);
      }
    }
  }

  function scheduleChecklistAutosave(delay = 700) {
    if (!checklistBackendReady || noteReadOnly || hydratingNote || noteDeleting) return;
    noteDirty = true;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => saveChecklistNow(), delay);
  }

  async function loadChecklistNote() {
    if (!noteId || !window.NotesService) return true;
    hydratingNote = true;
    try {
      const note = await window.NotesService.ambilCatatan(noteId);
      if (!note) {
        noteReadOnly = true;
        setMode("view", false);
        showToast("Checklist tidak ditemukan atau kamu tidak punya akses.");
        return false;
      }
      if (note.note_type !== "checklist") {
        noteReadOnly = true;
        setMode("view", false);
        showToast("Tipe catatan ini dibuka dari editor lain.");
        return false;
      }

      scope = note.scope === "family" ? "family" : "personal";
      visibility = note.visibility === "family-read" ? "family-read" : "private";
      if (note.family_id) activeFamilyId = clean(note.family_id, activeFamilyId);
      folderName = clean(note.folder_name);
      cardColor = window.CatatanManagement?.normalizeCardColor?.(note.card_color) || "default";
      pinned = false;
      try {
        const preferences = await window.NotesService.ambilPreferensiCatatan([noteId]);
        pinned = Boolean(preferences[noteId]?.pinned);
      } catch (prefError) {
        console.warn("[Checklist Preference]", prefError);
        pinned = Boolean(note.pinned);
      }
      noteOwnerId = clean(note.created_by);
      noteReadOnly = Boolean(noteOwnerId && noteOwnerId !== userId && scope !== "family");

      const [items] = await Promise.all([
        window.NotesService.ambilChecklistItems(noteId),
        loadSelectedTags()
      ]);

      const title = q("[data-note-title]");
      if (title) title.value = String(note.title || "");
      renderLoadedItems(items);
      resizeTitle();
      await resolveMemberViewContext();
      applyContext();
      renderCardColorState();
      setMode(noteReadOnly ? "view" : "edit", false);
      await refreshDeletePermission();
      lastSavedFingerprint = checklistFingerprint();
      noteDirty = false;
      return true;
    } catch (error) {
      console.error("[Checklist Load]", error);
      if (window.NotesService?.checklistSchemaBelumTerpasang?.(error)) checklistBackendReady = false;
      showBackendWarning(error);
      return false;
    } finally {
      hydratingNote = false;
    }
  }

  function setMode(mode, announce = true) {
    editorMode = noteReadOnly ? "view" : (mode === "view" ? "view" : "edit");
    const root = q("[data-catatan-checklist]");
    const title = q("[data-note-title]");
    const toggle = q("[data-mode-toggle]");
    const label = q("[data-mode-label]");
    const icon = toggle?.querySelector("ion-icon");
    const visibilityChip = q("[data-visibility-chip]");
    const reminderChip = q("[data-reminder-chip]");
    const view = editorMode === "view";

    root?.classList.toggle("is-view-mode", view);
    root?.classList.toggle("is-readonly", noteReadOnly);
    if (title) title.readOnly = view || noteReadOnly;
    qa("[data-check-text]").forEach(input => { input.readOnly = view || noteReadOnly; });
    qa("[data-check-toggle]").forEach(button => { button.disabled = noteReadOnly; });
    qa("[data-check-remove]").forEach(button => { button.disabled = noteReadOnly; });
    const addItemButton = q("[data-add-item]");
    if (addItemButton) addItemButton.disabled = noteReadOnly;

    syncViewOnlyItems(view);
    updateProgress();
    if (visibilityChip) visibilityChip.disabled = noteReadOnly || view || scope !== "personal";
    if (reminderChip) reminderChip.disabled = noteReadOnly || view;
    if (toggle) {
      toggle.hidden = noteReadOnly;
      toggle.setAttribute("aria-label", view ? "Edit checklist" : "Lihat hasil checklist");
    }
    if (label) label.textContent = view ? "Edit catatan" : "Lihat hasil";
    if (icon) icon.setAttribute("name", view ? "create-outline" : "eye-outline");

    renderMetadataTags();
    applyMemberReadingView();

    if (view) {
      title?.blur();
      qa("[data-check-text]").forEach(input => input.blur());
      if (announce && !noteReadOnly) showToast("Mode Lihat hasil aktif — hanya isi catatan yang ditampilkan.");
    } else if (announce) {
      showToast("Mode Edit aktif — kamu bisa mengubah isi catatan.");
    }
  }

  async function togglePin() {
    if (noteReadOnly) return;
    const previous = pinned;
    pinned = !pinned;
    renderPinState();

    if (!noteId) {
      scheduleChecklistAutosave(120);
      showToast(pinned ? "Checklist akan dipin setelah tersimpan." : "Pin dilepas.");
      return;
    }

    try {
      await window.NotesService.setPinCatatan(noteId, pinned);
      showToast(pinned ? (scope === "family" ? "Checklist dipin untuk kamu." : "Checklist dipin.") : "Pin dilepas.");
    } catch (error) {
      pinned = previous;
      renderPinState();
      console.error("[Checklist Pin]", error);
      if (window.NotesService?.customizationSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004G agar Pin aktif.");
      else showToast(error?.message || "Pin belum dapat diubah.");
    }
  }

  function setupSheets() {
    q("[data-open-info]")?.addEventListener("click", () => {
      if (!noteReadOnly) openSheet("[data-info-layer]");
    });
    q("[data-info-close]")?.addEventListener("click", () => setLayer("[data-info-layer]", false));
    q("[data-visibility-close]")?.addEventListener("click", () => setLayer("[data-visibility-layer]", false));
    q("[data-reminder-close]")?.addEventListener("click", () => setLayer("[data-reminder-layer]", false));
    q("[data-reminder-chip]")?.addEventListener("click", openReminderSheet);
    q("[data-reminder-save]")?.addEventListener("click", saveReminder);
    q("[data-reminder-remove]")?.addEventListener("click", removeReminder);
    q("[data-tag-close]")?.addEventListener("click", () => closeTagSheet(false));
    q("[data-tag-cancel]")?.addEventListener("click", () => closeTagSheet(false));
    q("[data-tag-apply]")?.addEventListener("click", () => closeTagSheet(true));
    q("[data-tag-add]")?.addEventListener("click", openTagSheet);
    q("[data-tag-search]")?.addEventListener("input", renderTagPicker);
    q("[data-tag-new-input]")?.addEventListener("input", renderTagPicker);
    q("[data-tag-create]")?.addEventListener("click", createTagFromSearch);
    q("[data-tag-manage]")?.addEventListener("click", openTagManagerFromPicker);
    q("[data-tag-new-input]")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && normalizeTag(event.currentTarget.value)) {
        event.preventDefault();
        createTagFromSearch();
      }
    });

    qa(".catatan-sheet-layer").forEach(layer => {
      layer.addEventListener("click", event => {
        if (event.target !== layer) return;
        if (layer.matches("[data-tag-layer]")) closeTagSheet(false);
        else layer.hidden = true;
      });
    });

    q("[data-visibility-chip]")?.addEventListener("click", () => {
      if (!noteReadOnly && scope === "personal" && editorMode === "edit") openSheet("[data-visibility-layer]");
    });

    qa("[data-set-visibility]").forEach(button => {
      button.addEventListener("click", () => {
        if (noteReadOnly) return;
        const value = String(button.dataset.setVisibility || "private").replace("_", "-");
        visibility = value === "family-read" ? "family-read" : "private";
        renderVisibility();
        setLayer("[data-visibility-layer]", false);
        scheduleChecklistAutosave(120);
      });
    });

    qa("[data-info-action]").forEach(button => {
      button.addEventListener("click", () => {
        if (noteReadOnly) return;
        const action = button.dataset.infoAction;
        if (action === "delete") {
          deleteCurrentNote();
          return;
        }
        if (action === "pin") {
          togglePin();
          return;
        }
        if (action === "color") {
          setLayer("[data-info-layer]", false);
          changeCardColor();
          return;
        }
        if (action === "folder") {
          setLayer("[data-info-layer]", false);
          changeFolder();
          return;
        }
        if (action === "visibility" && scope === "personal") {
          setLayer("[data-info-layer]", false);
          if (editorMode === "edit") openSheet("[data-visibility-layer]");
          else showToast("Masuk ke Edit catatan untuk mengubah visibilitas.");
          return;
        }
        if (action === "tag") {
          setLayer("[data-info-layer]", false);
          if (editorMode === "edit") openTagSheet();
          else showToast("Masuk ke Edit catatan untuk mengubah tag.");
          return;
        }
        if (action === "reminder") {
          setLayer("[data-info-layer]", false);
          openReminderSheet();
          return;
        }
        if (action === "related") {
          setLayer("[data-info-layer]", false);
          window.CatatanRelated?.open?.();
          return;
        }
        if (action === "promote") {
          showToast("Pemindahan permanen ke Catatan Keluarga akan aktif bersama backend Folder/Move berikutnya.");
          return;
        }
        const names = {
          related: "Relasi Catatan"
        };
        showToast(`${names[action] || "Fitur"} akan aktif pada tahap backend berikutnya.`);
      });
    });
  }

  function setupSensitiveNotice() {
    q("[data-sensitive-continue]")?.addEventListener("click", () => {
      if (q("[data-sensitive-never]")?.checked) {
        try { localStorage.setItem(warningStorageKey(), "hidden"); } catch {}
      }
      setLayer("[data-sensitive-layer]", false);
      if (!noteReadOnly && editorMode === "edit") q("[data-note-title]")?.focus();
    });
  }

  function maybeShowSensitiveNotice() {
    if (noteReadOnly) return;
    let hidden = false;
    try { hidden = localStorage.getItem(warningStorageKey()) === "hidden"; } catch {}
    if (!hidden) setLayer("[data-sensitive-layer]", true);
  }

  function setupKeyboardOffset() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--catatan-keyboard-offset", `${keyboard}px`);
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    update();
  }

  function setupChecklist() {
    seedChecklist();
    q("[data-add-item]")?.addEventListener("click", () => addItem(true));
    q("[data-note-title]")?.addEventListener("input", () => {
      resizeTitle();
      scheduleChecklistAutosave();
    });
    q("[data-note-title]")?.addEventListener("blur", () => saveChecklistNow());
    resizeTitle();
    q("[data-mode-toggle]")?.addEventListener("click", () => setMode(editorMode === "edit" ? "view" : "edit", true));

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveChecklistNow();
    });
    window.addEventListener("pagehide", () => { saveChecklistNow(); });

    q("[data-editor-back]")?.addEventListener("click", async event => {
      if (noteDeleting || !checklistBackendReady || noteReadOnly || (!noteDirty && !autosaveTimer && !tagDirty && !tagSaveRunning)) return;
      event.preventDefault();
      const href = event.currentTarget.href;
      await saveChecklistNow();
      if (tagDirty && noteId) await saveTagsNow();
      location.href = href;
    });

    setupSheets();
    setupSensitiveNotice();
    setupKeyboardOffset();
    setMode("edit", false);
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    scope = clean(params.get("scope"), "personal").toLowerCase();
    folderName = clean(params.get("folder"));
    noteId = clean(params.get("id"));
    sourceContext = clean(params.get("from")).toLowerCase();
    memberSourceId = clean(params.get("member"));
    if (sourceContext !== "member") {
      sourceContext = "";
      memberSourceId = "";
    }
    if (!["family", "personal"].includes(scope)) scope = "personal";
    if (scope === "family") visibility = "family-read";

    setupChecklist();
    applyContext();
    renderReminder();

    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }

    try {
      const user = await AuthService.ambilUserAktif();
      if (!user) return;
      userId = clean(user.id, "guest");

      try {
        const family = await AuthRouter.ambilFamilyAktif();
        activeFamilyId = clean(family?.id);
      } catch (familyError) {
        console.warn("[Checklist Family Context]", familyError);
        activeFamilyId = "";
      }

      checklistBackendReady = Boolean(
        window.NotesService?.simpanChecklist &&
        window.NotesService?.ambilCatatan &&
        window.NotesService?.ambilChecklistItems &&
        window.NotesService?.syncChecklistItems
      );
      tagBackendReady = Boolean(
        window.NotesService?.ambilTagCatalog &&
        window.NotesService?.buatTag &&
        window.NotesService?.ambilTagCatatan &&
        window.NotesService?.syncTagCatatan
      );

      if (noteId && checklistBackendReady) await loadChecklistNote();

      window.CatatanRelated?.init?.({
        getContext: () => ({
          noteId,
          userId,
          scope,
          folderName,
          canManage: !noteReadOnly && checklistBackendReady,
          isReminder: false
        }),
        ensureSaved: async () => {
          await saveChecklistNow();
          return noteId;
        },
        showToast
      });
      window.CatatanRelated?.refresh?.();

      await loadTagCatalog();
      renderMetadataTags();
      maybeShowSensitiveNotice();
    } catch (error) {
      console.error("[Catatan Checklist]", error);
      loadLegacyTagCatalog();
      renderMetadataTags();
      maybeShowSensitiveNotice();
    } finally {
      q("[data-catatan-checklist]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
