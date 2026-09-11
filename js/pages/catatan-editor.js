// RuangKitha v2.0.0a42f — Private Link Palette Lottie Patch
(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));

  let scope = "personal";
  let folderName = "";
  let visibility = "private";
  let pinned = false;
  let cardColor = "default";
  let savedRange = null;
  let linkSelectedText = "";
  let highlightTypingMode = false;
  let activeLinkAnchor = null;
  let privateLinkReturnFocus = null;
  let privateLinkChecking = false;
  let userId = "guest";
  let toastTimer = null;
  let editorMode = "edit";
  let availableTags = [];
  let selectedTags = new Set();
  let draftTags = new Set();
  let tagBackendReady = false;
  let tagDirty = false;
  let tagSaveRunning = false;
  let tagSaveAgain = false;
  let currentTagSavePromise = null;
  let lastSavedTagFingerprint = "[]";
  let tagBackendWarningShown = false;
  let reminderDate = "";
  let reminderTime = "";
  let reminderPreset = false;
  let familyReminderEnabled = false;
  let reminderRecurrence = "none";
  let reminderRecipients = new Set();
  let reminderRecipientDraft = new Set();
  let reminderMembers = [];
  let reminderRecipientsDirty = false;
  let reminderRecipientSaveRunning = false;
  let currentReminderRecipientSavePromise = null;

  // v2.0.0a38 — editor foundation + inline navigation/formatting; backend note core began at a29.
  let noteId = "";
  let activeFamilyId = "";
  let noteOwnerId = "";
  let noteReadOnly = false;
  let noteDeleteAllowed = false;
  let noteDeleting = false;
  let sourceContext = "";
  let memberSourceId = "";
  let memberViewName = "";
  let noteBackendReady = false;
  let hydratingNote = false;
  let noteDirty = false;
  let autosaveTimer = null;
  let saveRunning = false;
  let saveAgain = false;
  let currentSavePromise = null;
  let backendWarningShown = false;
  let lastSavedFingerprint = "";

  function clean(value, fallback = "") {
    const text = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!text || ["undefined", "null", "[object object]"].includes(text.toLowerCase())) return fallback;
    return text;
  }

  function sanitizeNoteHtml(value) {
    const raw = String(value ?? "");
    if (!raw) return "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${raw}</body>`, "text/html");
    const allowed = new Set([
      "P", "DIV", "H2", "H3", "BLOCKQUOTE", "UL", "OL", "LI", "BR", "HR",
      "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "A"
    ]);
    const dropEntirely = new Set([
      "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH",
      "FORM", "INPUT", "TEXTAREA", "BUTTON", "SELECT", "OPTION", "LINK", "META"
    ]);
    const textColors = new Set(["default", "green", "blue", "rose", "amber", "purple"]);
    const fontTokens = new Set(["default", "serif", "mono", "system"]);

    function safeHref(rawHref) {
      const href = String(rawHref || "").trim();
      if (!href) return null;
      try {
        const url = new URL(href, location.href);
        if (!["http:", "https:"].includes(url.protocol)) return null;
        const sameOrigin = url.origin === location.origin;
        const internalNote = sameOrigin && /\/catatan-(?:editor|checklist)\.html$/i.test(url.pathname) && Boolean(url.searchParams.get("id"));
        return {
          href: internalNote ? `${url.pathname.split("/").pop()}${url.search}${url.hash}` : url.href,
          internalNote
        };
      } catch {
        return null;
      }
    }

    function cleanNode(node) {
      Array.from(node.children || []).forEach(cleanNode);
      if (node === doc.body) return;
      const tag = String(node.tagName || "").toUpperCase();

      if (dropEntirely.has(tag)) {
        node.remove();
        return;
      }

      if (!allowed.has(tag)) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }

      const link = tag === "A" ? safeHref(node.getAttribute("href")) : null;
      const background = tag === "SPAN" ? String(node.style?.backgroundColor || "").trim() : "";
      const textColor = tag === "SPAN" && textColors.has(node.dataset?.textColor || "") ? node.dataset.textColor : "";
      const fontToken = tag === "SPAN" && fontTokens.has(node.dataset?.fontToken || "") ? node.dataset.fontToken : "";
      const inlineTask = tag === "SPAN" && ["0", "1"].includes(node.dataset?.inlineTask || "") ? node.dataset.inlineTask : "";
      const inlineCheckbox = tag === "SPAN" && node.hasAttribute("data-inline-checkbox");
      const inlineTaskText = tag === "SPAN" && node.hasAttribute("data-inline-task-text");

      Array.from(node.attributes || []).forEach(attr => node.removeAttribute(attr.name));

      if (tag === "A" && link) {
        node.setAttribute("href", link.href);
        if (link.internalNote) {
          node.setAttribute("data-rk-internal-link", "note");
        } else {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        }
      } else if (tag === "A") {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }

      if (tag === "SPAN") {
        if (background && !/url\s*\(/i.test(background)) node.style.backgroundColor = background;
        if (textColor) node.dataset.textColor = textColor;
        if (fontToken) node.dataset.fontToken = fontToken;
        if (inlineTask !== "") node.dataset.inlineTask = inlineTask;
        if (inlineCheckbox) {
          node.dataset.inlineCheckbox = "";
          node.setAttribute("contenteditable", "false");
          node.setAttribute("role", "checkbox");
          node.setAttribute("tabindex", "0");
        }
        if (inlineTaskText) node.dataset.inlineTaskText = "";
      }
    }

    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  function basicBackendMode() {
    return Boolean(window.NotesService) && noteBackendReady;
  }

  function noteSnapshot() {
    const title = String(q("[data-note-title]")?.value || "").trim();
    const editor = q("[data-note-content]");
    const bodyHtml = sanitizeNoteHtml(editor?.innerHTML || "");
    const bodyText = String(editor?.innerText || "").trim();
    const snapshot = {
      id: noteId || null,
      familyId: activeFamilyId || null,
      scope,
      visibility,
      title,
      bodyHtml,
      bodyText,
      folderName,
      cardColor
    };
    if (reminderPreset) {
      snapshot.reminderAt = reminderDate && reminderTime
        ? new Date(`${reminderDate}T${reminderTime}:00`).toISOString()
        : null;
      snapshot.reminderTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      snapshot.reminderRecurrence = reminderRecurrence || "none";
    }
    return snapshot;
  }

  function noteFingerprint(snapshot = noteSnapshot()) {
    return JSON.stringify({
      familyId: snapshot.familyId || "",
      scope: snapshot.scope,
      visibility: snapshot.visibility,
      title: snapshot.title,
      bodyHtml: snapshot.bodyHtml,
      bodyText: snapshot.bodyText,
      folderName: snapshot.folderName || "",
      cardColor: snapshot.cardColor || "default",
      reminderAt: snapshot.reminderAt || "",
      reminderTimezone: snapshot.reminderTimezone || "",
      reminderRecurrence: snapshot.reminderRecurrence || "none"
    });
  }

  function hasMeaningfulBasicNote(snapshot = noteSnapshot()) {
    return Boolean(snapshot.title || snapshot.bodyText || (reminderPreset && snapshot.reminderAt));
  }

  function updateNoteUrl() {
    if (!noteId) return;
    const url = new URL(location.href);
    url.searchParams.set("id", noteId);
    url.searchParams.set("scope", scope);
    if (reminderPreset) url.searchParams.set("type", "reminder");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function applyDocumentTypeCopy() {
    if (!reminderPreset) return;
    document.title = "Reminder · RuangKitha";
    const title = q("[data-note-title]");
    const content = q("[data-note-content]");
    if (title) {
      title.placeholder = "Judul reminder...";
      title.setAttribute("aria-label", "Judul reminder");
    }
    if (content) content.dataset.placeholder = "Tulis catatan reminder...";
    const infoTitle = document.getElementById("catatan-info-title");
    if (infoTitle) infoTitle.textContent = "Info Reminder";
    const linkHelp = q("[data-link-note-help]");
    if (linkHelp) linkHelp.textContent = "Hubungkan teks ke Catatan, Checklist, atau Reminder yang sudah ada.";
  }

  function showBackendWarning(error) {
    if (backendWarningShown) return;
    backendWarningShown = true;
    if (reminderPreset && window.NotesService?.reminderSchemaBelumTerpasang?.(error)) {
      showToast("Backend Reminder belum aktif — jalankan SQL 004J di Supabase dulu.");
    } else if (window.NotesService?.folderSchemaBelumTerpasang?.(error)) {
      showToast("Backend kolaborasi/folder belum aktif — jalankan SQL 004D di Supabase dulu.");
    } else if (window.NotesService?.schemaBelumTerpasang?.(error)) {
      showToast("Backend Catatan belum aktif — jalankan SQL 004A di Supabase dulu.");
    } else {
      showToast(error?.message || "Catatan belum dapat disimpan ke Supabase.");
    }
  }

  async function saveBasicNoteNow({ announce = false } = {}) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;

    if (!basicBackendMode() || noteReadOnly || hydratingNote || noteDeleting) return null;
    if (saveRunning) {
      saveAgain = true;
      if (currentSavePromise) await currentSavePromise;
      if (noteDirty) return saveBasicNoteNow({ announce });
      return null;
    }

    const snapshot = noteSnapshot();
    const fingerprint = noteFingerprint(snapshot);
    if (!noteDirty && fingerprint === lastSavedFingerprint) {
      if (tagDirty && noteId) await saveTagsNow();
      if (reminderPreset && reminderRecipientsDirty && noteId) await saveReminderRecipientsNow();
      return null;
    }

    if (!noteId && !hasMeaningfulBasicNote(snapshot)) {
      noteDirty = false;
      return null;
    }

    saveRunning = true;
    noteDirty = false;
    q("[data-catatan-editor]")?.setAttribute("data-save-state", "saving");

    currentSavePromise = (async () => {
      try {
        const wasNewNote = !noteId;
        const saved = reminderPreset
          ? await window.NotesService.simpanReminder(snapshot)
          : await window.NotesService.simpanBasic(snapshot);
        noteId = clean(saved?.id, noteId);
        noteOwnerId = clean(saved?.created_by, userId);
        noteDeleteAllowed = Boolean(noteId && noteOwnerId === userId);
        renderDeleteAction();
        updateNoteUrl();
        if (wasNewNote) window.CatatanRelated?.refresh?.();
        else window.CatatanRelated?.render?.();
        lastSavedFingerprint = fingerprint;
        q("[data-catatan-editor]")?.setAttribute("data-save-state", "saved");
        if (tagDirty || (noteId && selectedTags.size && lastSavedTagFingerprint === "[]")) {
          await saveTagsNow();
        }
        if (reminderPreset && noteId && reminderRecipientsDirty) {
          await saveReminderRecipientsNow();
        }
        if (noteId && pinned && window.NotesService?.setPinCatatan) {
          try { await window.NotesService.setPinCatatan(noteId, true); } catch (error) { console.warn("[Catatan Pin Save]", error); }
        }
        if (noteId && cardColor !== "default" && window.NotesService?.setWarnaKartuCatatan) {
          try { await window.NotesService.setWarnaKartuCatatan(noteId, cardColor); } catch (error) { console.warn("[Catatan Color Save]", error); }
        }
        if (announce) showToast(reminderPreset ? "Reminder tersimpan." : "Catatan tersimpan.");
        return saved;
      } catch (error) {
        noteDirty = true;
        q("[data-catatan-editor]")?.setAttribute("data-save-state", "error");
        console.error(reminderPreset ? "[Catatan Reminder Save]" : "[Catatan Basic Save]", error);
        if (reminderPreset && window.NotesService?.reminderSchemaBelumTerpasang?.(error)) noteBackendReady = false;
        else if (window.NotesService?.schemaBelumTerpasang?.(error)) noteBackendReady = false;
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
        if (noteDirty) setTimeout(() => saveBasicNoteNow(), 0);
      }
    }
  }

  function scheduleBasicAutosave(delay = 700) {
    if (!basicBackendMode() || noteReadOnly || hydratingNote || noteDeleting) return;
    noteDirty = true;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => saveBasicNoteNow(), delay);
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
    const next = await window.CatatanManagement?.pickCardColor?.(cardColor, { title: reminderPreset ? "Warna Reminder" : "Warna Catatan" });
    if (!next) return;
    const previous = cardColor;
    cardColor = next;
    renderCardColorState();

    if (!noteId) {
      await saveBasicNoteNow();
      if (!noteId) {
        showToast("Warna akan diterapkan setelah catatan mulai ditulis.");
        return;
      }
    }

    try {
      await window.NotesService.setWarnaKartuCatatan(noteId, cardColor);
      showToast("Warna kartu diperbarui.");
    } catch (error) {
      cardColor = previous;
      renderCardColorState();
      console.error("[Catatan Editor Color]", error);
      if (window.NotesService?.customizationSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004G agar Warna Catatan aktif.");
      else showToast(error?.message || "Warna catatan belum dapat diubah.");
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
      console.error(reminderPreset ? "[Reminder Folder Catalog]" : "[Catatan Folder Catalog]", error);
      if (window.NotesService?.folderSchemaBelumTerpasang?.(error)) showToast("Backend Folder belum aktif — jalankan SQL 004D di Supabase dulu.");
      else showToast(error?.message || "Folder belum dapat dimuat.");
      return;
    }

    const typeLabel = reminderPreset ? "Reminder" : "Catatan";
    let choice = await window.CatatanManagement.pickFolder(folders, {
      currentName: folderName,
      context: `${typeLabel} ${scope === "family" ? "Keluarga" : "Pribadi"}`
    });
    if (!choice) return;

    if (choice.create) {
      const requested = await window.CatatanManagement.askFolderName({
        context: `${typeLabel} ${scope === "family" ? "Keluarga" : "Pribadi"}`
      });
      if (!requested) return;
      try {
        const created = await window.NotesService.buatFolder(scope, activeFamilyId || null, requested);
        choice = { name: clean(created?.name, requested) };
      } catch (error) {
        console.error(reminderPreset ? "[Reminder Create Folder]" : "[Catatan Create Folder]", error);
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

    const saved = await saveBasicNoteNow();
    const saveState = q("[data-catatan-editor]")?.getAttribute("data-save-state");
    if (hadPersistedNote && !saved && saveState === "error") {
      folderName = previous;
      applyContext();
      return;
    }

    if (!noteId) {
      showToast(folderName
        ? `Folder “${folderName}” akan diterapkan setelah ${reminderPreset ? "reminder dijadwalkan atau diisi" : "catatan mulai ditulis"}.`
        : `${reminderPreset ? "Reminder" : "Catatan"} akan disimpan tanpa folder setelah mulai diisi.`);
      return;
    }
    invalidateFolderCaches(previous, folderName);
    showToast(folderName
      ? `Dipindahkan ke folder “${folderName}”.`
      : `${reminderPreset ? "Reminder" : "Catatan"} dikeluarkan dari folder.`);
  }

  async function loadBasicNote() {
    if (!noteId || !window.NotesService) return true;

    hydratingNote = true;
    try {
      const note = await window.NotesService.ambilCatatan(noteId);
      if (!note) {
        noteReadOnly = true;
        setMode("view", false);
        showToast("Catatan tidak ditemukan atau kamu tidak punya akses.");
        return false;
      }
      const loadedType = String(note.note_type || "basic").toLowerCase();
      if (loadedType === "checklist") {
        location.replace(`catatan-checklist.html?scope=${encodeURIComponent(note.scope === "family" ? "family" : "personal")}&id=${encodeURIComponent(noteId)}`);
        return false;
      }
      if (!["basic", "reminder"].includes(loadedType)) {
        noteReadOnly = true;
        setMode("view", false);
        showToast("Tipe catatan ini belum dapat dibuka di editor ini.");
        return false;
      }
      reminderPreset = loadedType === "reminder";
      applyDocumentTypeCopy();

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
        console.warn("[Catatan Editor Preference]", prefError);
        pinned = Boolean(note.pinned);
      }
      noteOwnerId = clean(note.created_by);
      noteReadOnly = Boolean(noteOwnerId && noteOwnerId !== userId && scope !== "family");

      if (reminderPreset) {
        if (scope === "family") await loadReminderMembers();
        reminderRecurrence = normalizeReminderRecurrence(note.reminder_recurrence);
        if (note.reminder_at) {
          const due = new Date(note.reminder_at);
          if (!Number.isNaN(due.getTime())) {
            reminderDate = localDateString(due);
            reminderTime = `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
          }
        } else {
          reminderDate = "";
          reminderTime = "";
        }
        await loadReminderRecipients();
      }

      await loadSelectedTags();

      const title = q("[data-note-title]");
      const editor = q("[data-note-content]");
      if (title) title.value = String(note.title || "");
      if (editor) {
        const safeHtml = sanitizeNoteHtml(note.body_html || "");
        if (safeHtml) editor.innerHTML = safeHtml;
        else editor.textContent = String(note.body_text || "");
      }
      normalizeInlineTasks();

      resizeTitle();
      renderPinState();
      renderCardColorState();
      renderReminder();
      await resolveMemberViewContext();
      applyContext();
      if (!(sourceContext === "member" && noteReadOnly)) renderVisibility();
      setMode(noteReadOnly ? "view" : "edit", false);
      await refreshDeletePermission();
      lastSavedFingerprint = noteFingerprint();
      noteDirty = false;
      return true;
    } catch (error) {
      console.error(reminderPreset ? "[Catatan Reminder Load]" : "[Catatan Basic Load]", error);
      if (reminderPreset && window.NotesService?.reminderSchemaBelumTerpasang?.(error)) noteBackendReady = false;
      else if (window.NotesService?.schemaBelumTerpasang?.(error)) noteBackendReady = false;
      showBackendWarning(error);
      return false;
    } finally {
      hydratingNote = false;
    }
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
      console.warn("[Catatan Archive Permission]", error);
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
        ? `${reminderPreset ? "Reminder" : "Catatan"} Keluarga ini akan dipindahkan ke Arsip untuk seluruh anggota dan dapat dipulihkan nanti.`
        : `${reminderPreset ? "Reminder" : "Catatan"} ini akan dipindahkan ke Arsip dan dapat dipulihkan nanti.`,
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
      console.error("[Catatan Archive]", error);
      if (window.NotesService?.lifecycleSchemaBelumTerpasang?.(error)) showToast("Backend Arsip belum aktif — jalankan SQL 004F di Supabase dulu.");
      else showToast(error?.message || "Catatan belum dapat diarsipkan.");
    }
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

  function openSheet(selector, preserve = false) {
    if (preserve) saveSelection();
    q("[data-note-content]")?.blur();
    q("[data-note-title]")?.blur();
    setLayer(selector, true);
  }

  function saveSelection() {
    const editor = q("[data-note-content]");
    const selection = window.getSelection?.();
    if (!editor || !selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
  }

  function restoreSelection() {
    const editor = q("[data-note-content]");
    if (!editor || editorMode !== "edit") return;
    editor.focus({ preventScroll: true });
    if (!savedRange) return;
    const selection = window.getSelection?.();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }

  function execute(command, value = null) {
    if (editorMode !== "edit") return;
    restoreSelection();
    try {
      document.execCommand(command, false, value);
      saveSelection();
      refreshFormatState();
      scheduleBasicAutosave();
    } catch {
      showToast("Format ini belum didukung di perangkat ini.");
    }
  }

  function selectionNode() {
    const editor = q("[data-note-content]");
    const selection = window.getSelection?.();
    if (!editor || !selection || !selection.rangeCount) return null;
    let node = selection.anchorNode;
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    return node && editor.contains(node) ? node : null;
  }

  function currentBlock() {
    const editor = q("[data-note-content]");
    let node = selectionNode();
    while (node && node !== editor) {
      const tag = String(node.tagName || "").toLowerCase();
      if (["h2", "h3", "blockquote", "p"].includes(tag)) return tag;
      node = node.parentElement;
    }
    return "p";
  }

  function selectionHasHighlight() {
    const editor = q("[data-note-content]");
    let node = selectionNode();
    while (node && node !== editor) {
      const inline = String(node.style?.backgroundColor || "").trim().toLowerCase();
      if (inline && inline !== "transparent" && inline !== "rgba(0, 0, 0, 0)") return true;
      node = node.parentElement;
    }
    return false;
  }

  function selectionToken(attribute) {
    const editor = q("[data-note-content]");
    let node = selectionNode();
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute?.(attribute)) return clean(node.getAttribute(attribute));
      node = node.parentElement;
    }
    return "default";
  }

  const TEXT_COLOR_LABELS = {
    default: "Default",
    green: "Hijau",
    blue: "Biru",
    rose: "Rose",
    amber: "Amber",
    purple: "Ungu"
  };
  const FONT_LABELS = { default: "Default", serif: "Serif", mono: "Mono", system: "Sistem" };

  function refreshFormatState() {
    if (editorMode !== "edit") return;
    if (selectionNode()) {
      const block = currentBlock();
      qa("[data-format-block]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.formatBlock === block);
      });
      ["bold", "italic", "underline", "strikeThrough"].forEach(command => {
        let active = false;
        try { active = document.queryCommandState(command); } catch {}
        q(`[data-format-command="${command}"]`)?.classList.toggle("is-active", active);
      });

      const textColor = selectionToken("data-text-color");
      const fontToken = selectionToken("data-font-token");
      const colorLabel = q("[data-format-color-label]");
      const fontLabel = q("[data-format-font-label]");
      if (colorLabel) colorLabel.textContent = TEXT_COLOR_LABELS[textColor] || "Default";
      if (fontLabel) fontLabel.textContent = FONT_LABELS[fontToken] || "Default";
      qa("[data-text-color]").forEach(button => button.classList.toggle("is-active", button.dataset.textColor === textColor));
      qa("[data-font-token]").forEach(button => button.classList.toggle("is-active", button.dataset.fontToken === fontToken));
    }

    const highlightButton = q('[data-tool="highlight"]');
    highlightButton?.classList.toggle("is-active", highlightTypingMode);
    highlightButton?.setAttribute("aria-pressed", highlightTypingMode ? "true" : "false");
  }

  function setBlockStyle(tag) {
    if (editorMode !== "edit") return;
    restoreSelection();
    const active = currentBlock();
    const target = active === tag && tag !== "p" ? "p" : tag;
    try {
      document.execCommand("formatBlock", false, target);
      saveSelection();
      refreshFormatState();
      scheduleBasicAutosave();
    } catch {
      showToast("Format blok ini belum didukung di perangkat ini.");
    }
  }

  function clearHighlightTypingState({ keepSelection = true } = {}) {
    if (editorMode !== "edit") return;
    if (keepSelection) restoreSelection();
    try { document.execCommand("hiliteColor", false, "transparent"); }
    catch {
      try { document.execCommand("backColor", false, "transparent"); } catch {}
    }
  }

  function collapseSavedSelectionToEnd() {
    const editor = q("[data-note-content]");
    const selection = window.getSelection?.();
    if (!editor || !selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange = range.cloneRange();
  }

  function toggleHighlight() {
    if (editorMode !== "edit") return;
    restoreSelection();
    const editor = q("[data-note-content]");
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!editor || !range || !editor.contains(range.commonAncestorContainer)) return;

    try {
      if (!range.collapsed) {
        if (selectionHasHighlight() && !highlightTypingMode) {
          document.execCommand("hiliteColor", false, "transparent");
          highlightTypingMode = false;
          saveSelection();
        } else {
          document.execCommand("hiliteColor", false, "#fff1a8");
          collapseSavedSelectionToEnd();
          highlightTypingMode = true;
        }
      } else if (highlightTypingMode) {
        clearHighlightTypingState({ keepSelection: false });
        highlightTypingMode = false;
        saveSelection();
      } else {
        document.execCommand("hiliteColor", false, "#fff1a8");
        highlightTypingMode = true;
        saveSelection();
      }
      refreshFormatState();
      scheduleBasicAutosave();
    } catch {
      try {
        document.execCommand("backColor", false, highlightTypingMode ? "transparent" : "#fff1a8");
        highlightTypingMode = !highlightTypingMode;
        saveSelection();
        refreshFormatState();
      } catch {
        showToast("Highlight belum didukung di perangkat ini.");
      }
    }
  }

  function selectedTextNodes(range, root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue?.length) continue;
      try {
        if (range.intersectsNode(node)) nodes.push(node);
      } catch {}
    }
    return nodes;
  }

  function applyInlineToken(attribute, token) {
    if (editorMode !== "edit") return false;
    restoreSelection();
    const editor = q("[data-note-content]");
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!editor || !range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
      showToast("Blok teks yang ingin diformat dulu.");
      return false;
    }

    const originalStart = range.startContainer;
    const originalEnd = range.endContainer;
    const originalStartOffset = range.startOffset;
    const originalEndOffset = range.endOffset;
    const nodes = selectedTextNodes(range, editor);
    const wrapped = [];

    nodes.forEach(node => {
      let start = node === originalStart ? originalStartOffset : 0;
      let end = node === originalEnd ? originalEndOffset : node.nodeValue.length;
      start = Math.max(0, Math.min(start, node.nodeValue.length));
      end = Math.max(start, Math.min(end, node.nodeValue.length));
      if (start === end) return;

      if (end < node.nodeValue.length) node.splitText(end);
      const selected = start > 0 ? node.splitText(start) : node;
      const span = document.createElement("span");
      span.setAttribute(attribute, token);
      selected.replaceWith(span);
      span.appendChild(selected);
      wrapped.push({ span, text: selected });
    });

    if (!wrapped.length) return false;
    const newRange = document.createRange();
    newRange.setStart(wrapped[0].text, 0);
    const last = wrapped[wrapped.length - 1].text;
    newRange.setEnd(last, last.nodeValue.length);
    selection.removeAllRanges();
    selection.addRange(newRange);
    savedRange = newRange.cloneRange();
    scheduleBasicAutosave(120);
    refreshFormatState();
    return true;
  }

  function clearCustomInlineTokensInSelection() {
    const editor = q("[data-note-content]");
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : savedRange;
    if (!editor || !range) return;
    qa('[data-note-content] span[data-text-color], [data-note-content] span[data-font-token]').forEach(span => {
      if (!editor.contains(span)) return;
      let intersects = false;
      try { intersects = range.intersectsNode(span); } catch {}
      if (!intersects) return;
      span.removeAttribute("data-text-color");
      span.removeAttribute("data-font-token");
      if (!span.attributes.length) span.replaceWith(...span.childNodes);
    });
  }

  function clearFormatting() {
    if (editorMode !== "edit") return;
    restoreSelection();
    try {
      document.execCommand("removeFormat", false, null);
      document.execCommand("formatBlock", false, "p");
      document.execCommand("hiliteColor", false, "transparent");
      highlightTypingMode = false;
      clearCustomInlineTokensInSelection();
      saveSelection();
      refreshFormatState();
      scheduleBasicAutosave();
    } catch {
      showToast("Format belum dapat dibersihkan di perangkat ini.");
    }
  }

  function buildInlineTask(checked = false, content = null) {
    const task = document.createElement("span");
    task.dataset.inlineTask = checked ? "1" : "0";
    const box = document.createElement("span");
    box.dataset.inlineCheckbox = "";
    box.contentEditable = "false";
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", checked ? "true" : "false");
    box.setAttribute("tabindex", "0");
    box.textContent = checked ? "☑" : "☐";
    const text = document.createElement("span");
    text.dataset.inlineTaskText = "";
    if (content instanceof DocumentFragment) text.appendChild(content);
    else if (content instanceof Node) text.appendChild(content);
    else if (content != null) text.textContent = String(content);
    task.append(box, document.createTextNode(" "), text);
    return { task, box, text };
  }

  function migrateLegacyInlineCheckboxes(editor) {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest?.("[data-inline-task]")) continue;
      if (/^\s*[☐☑]\s+\S/.test(node.nodeValue || "")) nodes.push(node);
    }
    nodes.forEach(textNode => {
      const match = String(textNode.nodeValue || "").match(/^\s*([☐☑])\s+([\s\S]+)$/);
      if (!match) return;
      const { task } = buildInlineTask(match[1] === "☑", match[2]);
      textNode.replaceWith(task);
    });
  }

  function normalizeInlineTasks() {
    const editor = q("[data-note-content]");
    if (!editor) return;
    migrateLegacyInlineCheckboxes(editor);
    editor.querySelectorAll("[data-inline-task]").forEach(task => {
      const checked = task.getAttribute("data-inline-task") === "1";
      const box = task.querySelector("[data-inline-checkbox]");
      if (box) {
        box.textContent = checked ? "☑" : "☐";
        box.setAttribute("aria-checked", checked ? "true" : "false");
        box.setAttribute("role", "checkbox");
        box.setAttribute("contenteditable", "false");
        box.setAttribute("tabindex", "0");
      }
    });
  }

  function insertInlineChecklist() {
    if (editorMode !== "edit") return;
    restoreSelection();
    const editor = q("[data-note-content]");
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!editor || !range || !editor.contains(range.commonAncestorContainer)) return;

    const selectedFragment = range.extractContents();
    const { task, text } = buildInlineTask(false, selectedFragment.childNodes.length ? selectedFragment : null);
    const br = document.createElement("br");
    range.insertNode(br);
    range.insertNode(task);

    const next = document.createRange();
    if (text.childNodes.length) {
      next.selectNodeContents(text);
      next.collapse(false);
    } else {
      next.setStart(text, 0);
      next.collapse(true);
    }
    selection.removeAllRanges();
    selection.addRange(next);
    savedRange = next.cloneRange();
    normalizeInlineTasks();
    scheduleBasicAutosave(120);
  }

  function toggleInlineTask(task) {
    if (!task || noteReadOnly) return;
    const checked = task.getAttribute("data-inline-task") === "1";
    task.setAttribute("data-inline-task", checked ? "0" : "1");
    normalizeInlineTasks();
    scheduleBasicAutosave(120);
  }

  function internalLinkHref(note) {
    return window.CatatanRelated?.hrefFor?.(note) || "";
  }

  function currentThemeName() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function privateLinkLottieSrc(theme = currentThemeName()) {
    return theme === "dark"
      ? "assets/lottie/catatan-private-lock-dark.lottie"
      : "assets/lottie/catatan-private-lock-light.lottie";
  }

  function syncPrivateLinkLottie(player) {
    if (!player) return;
    const nextSrc = privateLinkLottieSrc();
    if (player.getAttribute("src") !== nextSrc) player.setAttribute("src", nextSrc);
  }

  function internalTargetId(anchor) {
    if (!anchor?.hasAttribute?.("data-rk-internal-link")) return "";
    try {
      const url = new URL(anchor.getAttribute("href") || "", location.href);
      return clean(url.searchParams.get("id"));
    } catch {
      return "";
    }
  }

  function ensurePrivateLinkLayer() {
    let layer = q("[data-private-link-layer]");
    if (layer) return layer;

    layer = document.createElement("div");
    layer.className = "catatan-private-link-layer";
    layer.dataset.privateLinkLayer = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="catatan-private-link-dialog" role="dialog" aria-modal="true" aria-labelledby="catatan-private-link-title" aria-describedby="catatan-private-link-copy">
        <div class="catatan-private-link-visual" aria-hidden="true">
          <dotlottie-player
            src="assets/lottie/catatan-private-lock-light.lottie"
            background="transparent"
            speed="1"
            loop
            autoplay></dotlottie-player>
        </div>
        <h2 id="catatan-private-link-title">Catatan ini bersifat pribadi</h2>
        <p id="catatan-private-link-copy">Pemilik catatan membatasi akses hanya untuk dirinya, jadi kamu belum bisa membuka catatan ini.</p>
        <button class="catatan-private-link-ok" type="button" data-private-link-ok>Oke</button>
      </section>`;

    const player = layer.querySelector("dotlottie-player");
    const themeObserver = new MutationObserver(() => syncPrivateLinkLottie(player));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const close = () => {
      if (layer.hidden) return;
      layer.hidden = true;
      document.documentElement.classList.remove("catatan-modal-open");
      const focus = privateLinkReturnFocus;
      privateLinkReturnFocus = null;
      if (focus?.isConnected && typeof focus.focus === "function") {
        requestAnimationFrame(() => focus.focus({ preventScroll: true }));
      }
    };

    layer.querySelector("[data-private-link-ok]")?.addEventListener("click", close);
    layer.addEventListener("click", event => {
      if (event.target === layer) close();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !layer.hidden) {
        event.preventDefault();
        close();
      }
    });

    document.body.appendChild(layer);
    return layer;
  }

  function showPrivateLinkNotice(anchor = null) {
    const layer = ensurePrivateLinkLayer();
    privateLinkReturnFocus = anchor instanceof HTMLElement ? anchor : document.activeElement;
    layer.hidden = false;
    document.documentElement.classList.add("catatan-modal-open");

    const player = layer.querySelector("dotlottie-player");
    syncPrivateLinkLottie(player);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) {
      player?.removeAttribute("loop");
      player?.removeAttribute("autoplay");
    } else {
      player?.setAttribute("loop", "");
      player?.setAttribute("autoplay", "");
      try { player?.play?.(); } catch {}
    }

    requestAnimationFrame(() => layer.querySelector("[data-private-link-ok]")?.focus());
  }

  async function openInternalNoteLink(anchor) {
    if (!anchor || privateLinkChecking) return false;
    const href = anchor.getAttribute("href") || "";
    const targetId = internalTargetId(anchor);
    if (!href || !targetId) return false;

    privateLinkChecking = true;
    anchor.setAttribute("aria-busy", "true");
    try {
      let status = "denied";

      if (window.NotesService?.cekAksesTautanCatatan && noteId) {
        try {
          status = await window.NotesService.cekAksesTautanCatatan(noteId, targetId);
        } catch (error) {
          if (!window.NotesService?.linkAccessSchemaBelumTerpasang?.(error)) throw error;

          // Compatibility fallback while 004L is being deployed: RLS remains
          // the authority. A target hidden by RLS is treated as private and
          // the reader stays on the source note.
          const target = await window.NotesService.ambilCatatan(targetId);
          status = target ? "allowed" : "private";
        }
      } else if (window.NotesService?.ambilCatatan) {
        const target = await window.NotesService.ambilCatatan(targetId);
        status = target ? "allowed" : "private";
      }

      if (status === "allowed") {
        location.href = href;
        return true;
      }
      if (status === "private") {
        showPrivateLinkNotice(anchor);
        return false;
      }
      if (status === "archived") {
        showToast("Catatan tujuan sedang berada di Arsip.");
        return false;
      }

      showToast("Catatan tujuan tidak tersedia atau aksesnya sudah berubah.");
      return false;
    } catch (error) {
      console.warn("[Catatan Internal Link Access]", error);
      showToast("Tautan belum dapat diperiksa. Coba lagi sebentar.");
      return false;
    } finally {
      privateLinkChecking = false;
      anchor.removeAttribute("aria-busy");
    }
  }

  function hasAnotherInlineLinkTo(targetId, exceptAnchor = null) {
    if (!targetId) return false;
    return qa('[data-note-content] a[data-rk-internal-link="note"]').some(anchor => {
      if (anchor === exceptAnchor) return false;
      return internalTargetId(anchor) === targetId;
    });
  }

  function insertAnchorAtSavedRange({ href, label = "", internal = false } = {}) {
    if (!href || editorMode !== "edit") return false;
    restoreSelection();
    const editor = q("[data-note-content]");
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!editor || !range || !editor.contains(range.commonAncestorContainer)) {
      showToast("Pilih posisi tautan di catatan lalu coba lagi.");
      return false;
    }

    const selectedText = clean(range.toString()) || linkSelectedText;
    const visibleText = clean(label) || selectedText || href;
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = visibleText;
    if (internal) anchor.dataset.rkInternalLink = "note";
    else {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }

    try {
      range.deleteContents();
      range.insertNode(anchor);
      range.setStartAfter(anchor);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
      linkSelectedText = "";
      scheduleBasicAutosave(120);
      refreshFormatState();
      return true;
    } catch {
      showToast("Tautan belum dapat ditambahkan di posisi ini.");
      return false;
    }
  }

  function prepareWebLinkSheet(anchor = null) {
    const textInput = q("[data-link-text]");
    const urlInput = q("[data-link-url]");
    const helper = q("[data-link-text-help]");
    const apply = q("[data-link-apply]");
    if (anchor) {
      linkSelectedText = clean(anchor.textContent);
      if (textInput) textInput.value = linkSelectedText;
      if (urlInput) urlInput.value = anchor.getAttribute("href") || "";
      if (helper) helper.textContent = "Ubah teks atau alamat tautan lalu simpan.";
      if (apply) apply.textContent = "Simpan perubahan";
    } else {
      if (textInput) textInput.value = linkSelectedText;
      if (urlInput) urlInput.value = "";
      if (helper) helper.textContent = linkSelectedText
        ? "Teks yang dipilih sudah digunakan sebagai teks tautan. Kamu tetap bisa mengubahnya."
        : "Opsional. Jika kosong, alamat tautan akan ditampilkan.";
      if (apply) apply.textContent = "Tambahkan tautan";
    }
  }

  function openLinkChooser() {
    saveSelection();
    linkSelectedText = clean(savedRange?.toString?.() || "");
    const preview = q("[data-link-selection-preview]");
    const noteChoice = q('[data-link-choice="note"]');
    const noteHelp = q("[data-link-note-help]");
    if (preview) {
      preview.hidden = !linkSelectedText;
      preview.textContent = linkSelectedText ? `Teks dipilih: “${linkSelectedText}”` : "";
    }
    if (noteChoice) noteChoice.disabled = !linkSelectedText;
    if (noteHelp) noteHelp.textContent = linkSelectedText
      ? "Pilih satu Catatan, Checklist, atau Reminder sebagai tujuan teks ini."
      : "Blok teks di catatan dulu untuk membuat tautan antarcatatan.";
    openSheet("[data-link-choice-layer]", false);
  }

  function openLinkAction(anchor) {
    activeLinkAnchor = anchor || null;
    if (!activeLinkAnchor) return;
    setLayer("[data-link-action-layer]", true);
  }

  function resizeTitle() {
    const input = q("[data-note-title]");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 116)}px`;
  }

  async function resolveMemberViewContext() {
    if (sourceContext !== "member" || !noteReadOnly || !noteOwnerId) return;

    // Jangan percaya member id dari URL jika tidak sama dengan pemilik record.
    if (!memberSourceId || memberSourceId !== noteOwnerId) {
      memberSourceId = noteOwnerId;
    }

    memberViewName = "Anggota";
    if (!activeFamilyId || !window.FamilyService?.ambilAnggotaKeluarga) return;

    try {
      const members = await FamilyService.ambilAnggotaKeluarga(activeFamilyId);
      const owner = (members || []).find(item => item?.user_id === noteOwnerId);
      memberViewName = clean(owner?.profile?.display_name, "Anggota");
    } catch (error) {
      console.warn("[Catatan Member View Context]", error);
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

  function applyMemberReadOnlyHeaderFlow(memberReadOnly) {
    const header = q(".catatan-editor-header");
    const readNav = q("[data-member-readonly-nav]");
    const readBack = q("[data-member-readonly-back]");

    if (header) {
      if (memberReadOnly) {
        header.setAttribute("data-member-readonly-header", "");
        header.hidden = true;
        header.style.setProperty("display", "none", "important");
      } else {
        header.removeAttribute("data-member-readonly-header");
        header.hidden = false;
        header.style.removeProperty("display");
      }
    }

    if (readNav) readNav.hidden = !memberReadOnly;
    if (readBack && memberReadOnly) readBack.href = editorBackUrl();
  }

  function applyContext() {
    const root = q("[data-catatan-editor]");
    const memberReadOnly = sourceContext === "member" && noteReadOnly;
    root?.classList.toggle("is-member-readonly", memberReadOnly);
    root?.classList.toggle("is-family-scope", scope === "family");
    const modeArea = q("[data-mode-area]");
    if (modeArea) modeArea.textContent = scope === "family" ? "Area Keluarga" : "Area Pribadi";
    const memberReadContext = q("[data-member-readonly-context]");
    if (memberReadContext && memberReadOnly) {
      memberReadContext.textContent = `Area Pribadi · Milik ${memberViewName || "anggota"}`;
    }
    applyMemberReadOnlyHeaderFlow(memberReadOnly);
    renderDeleteAction();

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

    if (back) back.href = editorBackUrl();
    const memberReadBack = q("[data-member-readonly-back]");
    if (memberReadBack) memberReadBack.href = editorBackUrl();

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

    renderMetadataTags();
    renderReminderDedicated();
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function reminderLabel() {
    if (!reminderDate || !reminderTime) return reminderPreset ? "Atur reminder" : "";
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

  function normalizeReminderRecurrence(value) {
    const recurrence = String(value || "none").toLowerCase();
    return ["none", "daily", "weekly", "monthly", "yearly"].includes(recurrence) ? recurrence : "none";
  }

  function reminderRecurrenceLabel(value = reminderRecurrence) {
    return ({
      none: "Tidak berulang",
      daily: "Setiap hari",
      weekly: "Setiap minggu",
      monthly: "Setiap bulan",
      yearly: "Setiap tahun"
    })[normalizeReminderRecurrence(value)] || "Tidak berulang";
  }

  function reminderMemberName(member) {
    return clean(member?.profile?.display_name || member?.display_name, "Anggota");
  }

  function reminderEligibleMembers() {
    const creatorId = clean(noteOwnerId || userId);
    return (reminderMembers || []).filter(member => {
      const id = clean(member?.user_id);
      return id && id !== creatorId;
    });
  }

  async function loadReminderMembers() {
    if (scope !== "family" || !activeFamilyId || !window.FamilyService?.ambilAnggotaKeluarga) {
      reminderMembers = [];
      return reminderMembers;
    }
    try {
      const members = await FamilyService.ambilAnggotaKeluarga(activeFamilyId);
      reminderMembers = (members || []).filter(member => member?.user_id && (!member?.status || member.status === "active"));
    } catch (error) {
      console.warn("[Reminder Members]", error);
      reminderMembers = [];
    }
    return reminderMembers;
  }

  async function loadReminderRecipients() {
    reminderRecipients = new Set();
    reminderRecipientsDirty = false;
    if (!reminderPreset || !noteId || !window.NotesService?.ambilReminderRecipients) {
      familyReminderEnabled = false;
      return;
    }
    try {
      const ids = await window.NotesService.ambilReminderRecipients(noteId);
      reminderRecipients = new Set((ids || []).map(id => clean(id)).filter(Boolean));
      familyReminderEnabled = reminderRecipients.size > 0;
    } catch (error) {
      console.warn("[Reminder Recipients Load]", error);
      if (window.NotesService?.reminderSchemaBelumTerpasang?.(error)) showBackendWarning(error);
    }
  }

  async function saveReminderRecipientsNow() {
    if (!reminderPreset || !noteId || noteReadOnly || !window.NotesService?.syncReminderRecipients) return 0;
    if (!reminderRecipientsDirty && scope === "family") return reminderRecipients.size;
    if (reminderRecipientSaveRunning) {
      if (currentReminderRecipientSavePromise) await currentReminderRecipientSavePromise;
      return reminderRecipients.size;
    }
    reminderRecipientSaveRunning = true;
    const requested = scope === "family" ? Array.from(reminderRecipients) : [];
    currentReminderRecipientSavePromise = (async () => {
      try {
        const count = await window.NotesService.syncReminderRecipients(noteId, requested);
        reminderRecipientsDirty = false;
        familyReminderEnabled = scope === "family" && count > 0;
        renderReminderDedicated();
        return count;
      } catch (error) {
        reminderRecipientsDirty = true;
        console.error("[Reminder Recipients Save]", error);
        if (window.NotesService?.reminderSchemaBelumTerpasang?.(error)) showBackendWarning(error);
        else showToast(error?.message || "Penerima reminder belum dapat disimpan.");
        return reminderRecipients.size;
      }
    })();
    try {
      return await currentReminderRecipientSavePromise;
    } finally {
      currentReminderRecipientSavePromise = null;
      reminderRecipientSaveRunning = false;
    }
  }

  function renderReminderRecipientPicker() {
    const list = q("[data-reminder-recipient-list]");
    const empty = q("[data-reminder-recipient-empty]");
    const allButton = q("[data-reminder-recipient-all]");
    const allCheck = q("[data-reminder-recipient-all-check]");
    const allCopy = q("[data-reminder-recipient-all-copy]");
    if (!list) return;
    list.replaceChildren();
    const eligible = reminderEligibleMembers();
    const eligibleIds = eligible.map(member => clean(member.user_id));
    const allSelected = eligibleIds.length > 0 && eligibleIds.every(id => reminderRecipientDraft.has(id));
    if (allButton) {
      allButton.disabled = eligibleIds.length === 0;
      allButton.classList.toggle("is-selected", allSelected);
    }
    if (allCheck) allCheck.setAttribute("name", allSelected ? "checkmark-circle" : "ellipse-outline");
    if (allCopy) allCopy.textContent = eligibleIds.length ? `${eligibleIds.length} anggota lain` : "Tidak ada anggota lain";

    eligible.forEach(member => {
      const id = clean(member.user_id);
      const selected = reminderRecipientDraft.has(id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = `catatan-reminder-recipient-row${selected ? " is-selected" : ""}`;
      row.dataset.reminderRecipientId = id;
      row.innerHTML = `
        <span class="catatan-info-icon"><ion-icon name="person-outline" aria-hidden="true"></ion-icon></span>
        <span><strong></strong><small>Anggota keluarga</small></span>
        <ion-icon name="${selected ? "checkmark-circle" : "ellipse-outline"}" aria-hidden="true"></ion-icon>
      `;
      row.querySelector("strong").textContent = reminderMemberName(member);
      row.addEventListener("click", () => {
        if (reminderRecipientDraft.has(id)) reminderRecipientDraft.delete(id);
        else reminderRecipientDraft.add(id);
        renderReminderRecipientPicker();
      });
      list.appendChild(row);
    });
    if (empty) empty.hidden = eligible.length !== 0;
  }

  async function openReminderRecipientSheet() {
    if (!reminderPreset || scope !== "family") return;
    if (noteReadOnly) {
      showToast("Reminder ini hanya bisa dibaca.");
      return;
    }
    await loadReminderMembers();
    reminderRecipientDraft = new Set(reminderRecipients);
    renderReminderRecipientPicker();
    openSheet("[data-reminder-recipient-layer]", true);
  }

  function closeReminderRecipientSheet(apply = false) {
    if (apply) {
      reminderRecipients = new Set(reminderRecipientDraft);
      reminderRecipientsDirty = true;
      familyReminderEnabled = reminderRecipients.size > 0;
      renderReminderDedicated();
      if (noteId) saveReminderRecipientsNow();
      else if (hasMeaningfulBasicNote()) scheduleBasicAutosave(120);
      else showToast("Penerima akan tersimpan setelah reminder mulai diisi.");
    }
    setLayer("[data-reminder-recipient-layer]", false);
  }

  function renderReminder() {
    const hasReminder = Boolean(reminderDate && reminderTime);
    const chip = q("[data-reminder-chip]");
    const chipLabel = q("[data-reminder-chip-label]");
    const info = q("[data-info-reminder]");
    const remove = q("[data-reminder-remove]");
    const label = reminderLabel();

    if (chip) chip.hidden = !(hasReminder || reminderPreset);
    if (chipLabel) chipLabel.textContent = hasReminder ? label : "Atur reminder";
    if (info) info.textContent = hasReminder ? label : "Belum diatur";
    if (remove) remove.hidden = !hasReminder;
    renderReminderDedicated();
  }

  function renderReminderDedicated() {
    if (!reminderPreset) return;

    const familyScope = scope === "family";
    const visibilityValue = q("[data-reminder-visibility-value]");
    const visibilityArea = q("[data-reminder-visibility-area]");
    const visibilityCard = q("[data-reminder-visibility-card]");
    const visibilityIcon = visibilityCard?.querySelector(".catatan-reminder-editor-icon ion-icon");
    const scheduleValue = q("[data-reminder-schedule-value]");
    const familyCard = q("[data-reminder-family-card]");
    const familyState = q("[data-reminder-family-state]");
    const familyIcon = q("[data-reminder-family-icon]");
    const tagCard = q("[data-reminder-tag-card]");
    const scheduleCard = q("[data-reminder-schedule-card]");

    if (visibilityValue) {
      visibilityValue.textContent = familyScope
        ? "Keluarga"
        : (visibility === "family-read" ? "Keluarga dapat melihat" : "Hanya Saya");
    }
    if (visibilityArea) visibilityArea.textContent = familyScope ? "Area Keluarga" : "Area Pribadi";
    if (visibilityIcon) {
      visibilityIcon.setAttribute("name", familyScope
        ? "people-outline"
        : (visibility === "family-read" ? "eye-outline" : "lock-closed-outline"));
    }
    if (visibilityCard) visibilityCard.disabled = Boolean(noteReadOnly);
    if (scheduleCard) scheduleCard.disabled = Boolean(noteReadOnly);
    if (tagCard) tagCard.disabled = Boolean(noteReadOnly);

    if (scheduleValue) {
      const schedule = reminderDate && reminderTime ? reminderLabel() : "Atur tanggal & waktu";
      scheduleValue.textContent = reminderRecurrence === "none" ? schedule : `${schedule} · ${reminderRecurrenceLabel()}`;
    }

    const eligibleIds = reminderEligibleMembers().map(member => clean(member?.user_id)).filter(Boolean);
    const recipientCount = eligibleIds.filter(id => reminderRecipients.has(id)).length;
    const allSelected = eligibleIds.length > 0 && eligibleIds.every(id => reminderRecipients.has(id));
    familyReminderEnabled = familyScope && recipientCount > 0;
    if (familyCard) {
      familyCard.classList.toggle("is-locked", !familyScope);
      familyCard.classList.toggle("is-on", familyScope && recipientCount > 0);
      familyCard.disabled = Boolean(noteReadOnly);
      familyCard.setAttribute("aria-label", familyScope
        ? `Ingatkan keluarga: ${allSelected ? "semua anggota" : recipientCount ? `${recipientCount} anggota dipilih` : "hanya pembuat"}`
        : "Ingatkan keluarga tersedia setelah reminder dipindahkan ke Area Keluarga");
    }
    if (familyState) {
      familyState.textContent = !familyScope
        ? "Hanya di Area Keluarga"
        : (allSelected ? "Semua anggota" : recipientCount ? `${recipientCount} anggota dipilih` : "Hanya pembuat");
    }
    if (familyIcon) {
      familyIcon.setAttribute("name", !familyScope
        ? "lock-closed-outline"
        : (recipientCount ? "checkmark-circle" : "notifications-outline"));
    }
  }

  function showFamilyPushPrompt() {
    const prompt = q("[data-reminder-family-prompt]");
    if (!prompt) return;
    prompt.hidden = false;
    requestAnimationFrame(() => prompt.classList.add("is-visible"));
  }

  function hideFamilyPushPrompt() {
    const prompt = q("[data-reminder-family-prompt]");
    if (!prompt) return;
    prompt.classList.remove("is-visible");
    setTimeout(() => { prompt.hidden = true; }, 150);
  }

  function updateReminderUrlScope() {
    const url = new URL(location.href);
    url.searchParams.set("scope", scope);
    url.searchParams.set("type", "reminder");
    if (!folderName) url.searchParams.delete("folder");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function pushReminderToFamily() {
    if (scope === "family" || noteReadOnly) return;
    scope = "family";
    visibility = "family-read";
    folderName = "";
    reminderRecipients = new Set();
    reminderRecipientsDirty = true;
    familyReminderEnabled = false;
    hideFamilyPushPrompt();
    updateReminderUrlScope();
    applyContext();
    renderVisibility();
    renderReminderDedicated();
    await loadReminderMembers();
    loadTagCatalog().then(() => renderMetadataTags());
    scheduleBasicAutosave(120);
    showToast("Reminder dipindahkan ke Area Keluarga. Pilih siapa yang ingin ikut diingatkan.");
    setTimeout(() => openReminderRecipientSheet(), 180);
  }

  function openReminderSheet() {
    if (editorMode !== "edit") {
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
    const recurrence = q("[data-reminder-recurrence]");
    if (recurrence) recurrence.value = normalizeReminderRecurrence(reminderRecurrence);
    openSheet("[data-reminder-layer]", true);
  }

  async function saveReminder() {
    const date = clean(q("[data-reminder-date]")?.value);
    const time = clean(q("[data-reminder-time]")?.value);
    if (!date || !time) {
      showToast("Pilih tanggal dan waktu reminder dulu.");
      return;
    }
    reminderDate = date;
    reminderTime = time;
    reminderRecurrence = normalizeReminderRecurrence(q("[data-reminder-recurrence]")?.value);
    reminderPreset = true;
    renderReminder();
    setLayer("[data-reminder-layer]", false);
    scheduleBasicAutosave(0);
    await saveBasicNoteNow({ announce: true });
  }

  async function removeReminder() {
    reminderDate = "";
    reminderTime = "";
    reminderRecurrence = "none";
    renderReminder();
    setLayer("[data-reminder-layer]", false);
    scheduleBasicAutosave(0);
    await saveBasicNoteNow();
    showToast("Jadwal reminder dihapus.");
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
      const active = el.dataset.visibilityCheck === visibility;
      el.setAttribute("name", active ? "checkmark-circle" : "ellipse-outline");
    });
    renderReminderDedicated();
  }

  async function togglePin() {
    if (noteReadOnly) return;
    const previous = pinned;
    pinned = !pinned;
    renderPinState();

    if (!noteId) {
      scheduleBasicAutosave(120);
      showToast(pinned ? "Catatan akan dipin setelah tersimpan." : "Pin dilepas.");
      return;
    }

    try {
      await window.NotesService.setPinCatatan(noteId, pinned);
      showToast(pinned ? (scope === "family" ? "Catatan dipin untuk kamu." : "Catatan dipin.") : "Pin dilepas.");
    } catch (error) {
      pinned = previous;
      renderPinState();
      console.error("[Catatan Editor Pin]", error);
      if (window.NotesService?.customizationSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004G agar Pin aktif.");
      else showToast(error?.message || "Pin belum dapat diubah.");
    }
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
      console.error("[Catatan Tag Catalog]", error);
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
      console.error("[Catatan Note Tags Load]", error);
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

        // Jangan menimpa pilihan user jika ia mengubah tag saat request sebelumnya masih jalan.
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
        console.error("[Catatan Note Tags Save]", error);
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
        if (tagDirty && tagFingerprint() !== lastSavedTagFingerprint) {
          setTimeout(() => saveTagsNow(), 0);
        }
      } else {
        tagSaveAgain = false;
      }
    }
  }

  function maybeShowSensitiveNotice() {
    let hidden = false;
    try { hidden = localStorage.getItem(warningStorageKey()) === "hidden"; } catch {}
    if (!hidden) setLayer("[data-sensitive-layer]", true);
  }

  function renderMetadataTags() {
    const host = q("[data-tag-chips]");
    if (!host) return;
    host.textContent = "";

    const tags = Array.from(selectedTags).sort();
    const canEditTags = editorMode === "edit" && !noteReadOnly;
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

    const reminderTagSummary = q("[data-reminder-tag-summary]");
    if (reminderTagSummary) {
      reminderTagSummary.textContent = tags.length ? `${tags.length} tag` : "Tambah tag...";
    }
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
    if (editorMode !== "edit") return;
    draftTags = new Set(selectedTags);
    const search = q("[data-tag-search]");
    const newInput = q("[data-tag-new-input]");
    if (search) search.value = "";
    if (newInput) newInput.value = "";
    openSheet("[data-tag-layer]", true);
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
    if (apply) {
      const before = tagFingerprint(selectedTags);
      selectedTags = new Set(Array.from(draftTags).map(normalizeTag).filter(Boolean));
      renderMetadataTags();
      if (tagFingerprint() !== before && !noteReadOnly) {
        tagDirty = true;
        if (noteId) {
          saveTagsNow();
        } else if (hasMeaningfulBasicNote()) {
          scheduleBasicAutosave(120);
        }
      }
    }
    setLayer("[data-tag-layer]", false);
  }

  async function createTagFromSearch() {
    const input = q("[data-tag-new-input]");
    const value = normalizeTag(input?.value || "");
    if (!value || noteReadOnly) return;

    // Existing tag tidak diduplikasi; langsung pilih dan pindahkan ke Dipilih.
    const existing = availableTags.find(tag => tag === value);
    let finalValue = existing || value;
    let mayUseTag = true;

    if (!existing && tagBackendReady && window.NotesService?.buatTag) {
      const createButton = q("[data-tag-create]");
      if (createButton) createButton.disabled = true;
      try {
        finalValue = normalizeTag(await window.NotesService.buatTag(scope, activeFamilyId || null, value)) || value;
      } catch (error) {
        console.error("[Catatan Tag Create]", error);
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

  function setMode(mode, announce = true) {
    editorMode = noteReadOnly ? "view" : (reminderPreset ? "edit" : (mode === "view" ? "view" : "edit"));
    const root = q("[data-catatan-editor]");
    const title = q("[data-note-title]");
    const editor = q("[data-note-content]");
    const toolbar = q("[data-editor-toolbar]");
    const toggle = q("[data-mode-toggle]");
    const label = q("[data-mode-label]");
    const icon = toggle?.querySelector("ion-icon");
    const visibilityChip = q("[data-visibility-chip]");
    const reminderChip = q("[data-reminder-chip]");

    const view = editorMode === "view";
    root?.classList.toggle("is-view-mode", view);
    root?.classList.toggle("is-reminder-editor", reminderPreset);
    q("[data-reminder-dedicated]")?.toggleAttribute("hidden", !reminderPreset);
    q("[data-reminder-note-label]")?.toggleAttribute("hidden", !reminderPreset);
    if (toggle) toggle.hidden = reminderPreset || noteReadOnly;
    if (title) title.readOnly = view;
    if (editor) editor.contentEditable = view ? "false" : "true";
    if (toolbar) toolbar.hidden = view || reminderPreset;
    if (visibilityChip) visibilityChip.disabled = view || scope !== "personal";
    if (reminderChip) reminderChip.disabled = view;
    if (toggle) toggle.setAttribute("aria-label", view ? "Edit catatan" : "Lihat hasil catatan");
    if (label) label.textContent = view ? "Edit catatan" : "Lihat hasil";
    if (icon) icon.setAttribute("name", view ? "create-outline" : "eye-outline");

    renderMetadataTags();

    if (view) {
      highlightTypingMode = false;
      q('[data-tool="highlight"]')?.classList.remove("is-active");
      q('[data-tool="highlight"]')?.setAttribute("aria-pressed", "false");
      saveBasicNoteNow();
      title?.blur();
      editor?.blur();
      window.getSelection?.()?.removeAllRanges?.();
      if (announce) showToast("Mode Lihat hasil aktif — hanya isi catatan yang ditampilkan.");
    } else if (announce) {
      showToast("Mode Edit aktif — kamu bisa mengubah isi catatan.");
    }
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

  function setupSheets() {
    q("[data-open-info]")?.addEventListener("click", () => openSheet("[data-info-layer]", true));
    q("[data-info-close]")?.addEventListener("click", () => setLayer("[data-info-layer]", false));
    q("[data-format-close]")?.addEventListener("click", () => setLayer("[data-format-layer]", false));
    q("[data-format-done]")?.addEventListener("click", () => setLayer("[data-format-layer]", false));
    q("[data-visibility-close]")?.addEventListener("click", () => setLayer("[data-visibility-layer]", false));
    q("[data-link-choice-close]")?.addEventListener("click", () => setLayer("[data-link-choice-layer]", false));
    q("[data-link-close]")?.addEventListener("click", () => setLayer("[data-link-layer]", false));
    q("[data-link-action-close]")?.addEventListener("click", () => { setLayer("[data-link-action-layer]", false); activeLinkAnchor = null; });
    q("[data-reminder-close]")?.addEventListener("click", () => setLayer("[data-reminder-layer]", false));
    q("[data-reminder-chip]")?.addEventListener("click", openReminderSheet);
    q("[data-reminder-save]")?.addEventListener("click", saveReminder);
    q("[data-reminder-remove]")?.addEventListener("click", removeReminder);
    q("[data-reminder-schedule-card]")?.addEventListener("click", openReminderSheet);
    q("[data-reminder-tag-card]")?.addEventListener("click", openTagSheet);
    q("[data-reminder-visibility-card]")?.addEventListener("click", () => {
      if (!reminderPreset || noteReadOnly) return;
      if (scope === "personal") openSheet("[data-visibility-layer]", true);
      else showToast("Reminder ini berada di Area Keluarga.");
    });
    q("[data-reminder-family-card]")?.addEventListener("click", () => {
      if (!reminderPreset || noteReadOnly) return;
      if (scope !== "family") {
        showFamilyPushPrompt();
        return;
      }
      openReminderRecipientSheet();
    });
    q("[data-reminder-recipient-close]")?.addEventListener("click", () => closeReminderRecipientSheet(false));
    q("[data-reminder-recipient-cancel]")?.addEventListener("click", () => closeReminderRecipientSheet(false));
    q("[data-reminder-recipient-apply]")?.addEventListener("click", () => closeReminderRecipientSheet(true));
    q("[data-reminder-recipient-all]")?.addEventListener("click", () => {
      const ids = reminderEligibleMembers().map(member => clean(member.user_id)).filter(Boolean);
      const allSelected = ids.length > 0 && ids.every(id => reminderRecipientDraft.has(id));
      ids.forEach(id => allSelected ? reminderRecipientDraft.delete(id) : reminderRecipientDraft.add(id));
      renderReminderRecipientPicker();
    });
    q("[data-reminder-family-cancel]")?.addEventListener("click", hideFamilyPushPrompt);
    q("[data-reminder-family-push]")?.addEventListener("click", pushReminderToFamily);
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
        else if (layer.matches("[data-reminder-recipient-layer]")) closeReminderRecipientSheet(false);
        else layer.hidden = true;
      });
    });

    q("[data-visibility-chip]")?.addEventListener("click", () => {
      if (scope === "personal" && editorMode === "edit") openSheet("[data-visibility-layer]", true);
    });

    qa("[data-set-visibility]").forEach(button => {
      button.addEventListener("click", () => {
        visibility = button.dataset.setVisibility || "private";
        renderVisibility();
        setLayer("[data-visibility-layer]", false);
        scheduleBasicAutosave(120);
      });
    });

    qa("[data-info-action]").forEach(button => {
      button.addEventListener("click", () => {
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
          if (editorMode === "edit") openSheet("[data-visibility-layer]", true);
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
          setLayer("[data-info-layer]", false);
          if (reminderPreset && scope === "personal") showFamilyPushPrompt();
          else showToast("Pemindahan permanen ke Catatan Keluarga akan aktif bersama backend Catatan.");
          return;
        }
        const names = {
          reminder: "Reminder",
          related: "Catatan Terkait"
        };
        showToast(`${names[action] || "Fitur"} akan aktif bersama backend Catatan.`);
      });
    });
  }

  function setupToolbar() {
    const editor = q("[data-note-content]");

    document.addEventListener("selectionchange", () => {
      if (editorMode !== "edit" || !selectionNode()) return;
      saveSelection();
      refreshFormatState();
    });
    editor?.addEventListener("keyup", () => { saveSelection(); refreshFormatState(); });
    editor?.addEventListener("mouseup", () => { saveSelection(); refreshFormatState(); });
    editor?.addEventListener("input", () => { normalizeInlineTasks(); refreshFormatState(); });
    editor?.addEventListener("beforeinput", () => {
      // Browser contenteditable dapat mewariskan highlight dari karakter di
      // sebelah caret. Saat mode highlight OFF, paksa insertion state normal.
      if (!highlightTypingMode) clearHighlightTypingState({ keepSelection: false });
    });

    editor?.addEventListener("click", event => {
      const checkbox = event.target.closest?.("[data-inline-checkbox]");
      if (checkbox) {
        event.preventDefault();
        event.stopPropagation();
        toggleInlineTask(checkbox.closest("[data-inline-task]"));
        return;
      }

      const anchor = event.target.closest?.("a");
      if (!anchor) return;

      if (anchor.hasAttribute("data-rk-internal-link")) {
        event.preventDefault();
        event.stopPropagation();
        if (editorMode === "edit") {
          saveSelection();
          openLinkAction(anchor);
        } else {
          openInternalNoteLink(anchor);
        }
        return;
      }

      if (editorMode === "edit") {
        event.preventDefault();
        saveSelection();
        openLinkAction(anchor);
      }
    });

    editor?.addEventListener("keydown", event => {
      const checkbox = event.target.closest?.("[data-inline-checkbox]");
      if (!checkbox || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      toggleInlineTask(checkbox.closest("[data-inline-task]"));
    });

    q('[data-tool="format"]')?.addEventListener("click", () => {
      refreshFormatState();
      openSheet("[data-format-layer]", true);
    });
    q('[data-tool="more"]')?.addEventListener("click", () => {
      refreshFormatState();
      openSheet("[data-format-layer]", true);
    });
    q('[data-tool="check"]')?.addEventListener("click", insertInlineChecklist);
    q('[data-tool="list"]')?.addEventListener("click", () => execute("insertUnorderedList"));
    q('[data-tool="highlight"]')?.addEventListener("click", toggleHighlight);
    q('[data-tool="link"]')?.addEventListener("click", openLinkChooser);

    qa("[data-format-block]").forEach(button => {
      button.addEventListener("click", () => {
        setBlockStyle(button.dataset.formatBlock || "p");
      });
    });

    qa("[data-format-command]").forEach(button => {
      button.addEventListener("click", () => {
        const command = button.dataset.formatCommand;
        const value = button.dataset.formatValue || null;
        execute(command, value);
      });
    });

    q("[data-format-clear]")?.addEventListener("click", clearFormatting);

    q("[data-format-color]")?.addEventListener("click", () => {
      const panel = q("[data-format-color-panel]");
      const fontPanel = q("[data-format-font-panel]");
      if (fontPanel) fontPanel.hidden = true;
      if (panel) panel.hidden = !panel.hidden;
      refreshFormatState();
    });
    q("[data-format-font]")?.addEventListener("click", () => {
      const panel = q("[data-format-font-panel]");
      const colorPanel = q("[data-format-color-panel]");
      if (colorPanel) colorPanel.hidden = true;
      if (panel) panel.hidden = !panel.hidden;
      refreshFormatState();
    });

    qa("[data-text-color]").forEach(button => {
      button.addEventListener("click", () => {
        const token = button.dataset.textColor || "default";
        if (applyInlineToken("data-text-color", token)) {
          const panel = q("[data-format-color-panel]");
          if (panel) panel.hidden = true;
          const label = q("[data-format-color-label]");
          if (label) label.textContent = TEXT_COLOR_LABELS[token] || "Default";
        }
      });
    });

    qa("[data-font-token]").forEach(button => {
      button.addEventListener("click", () => {
        const token = button.dataset.fontToken || "default";
        if (applyInlineToken("data-font-token", token)) {
          const panel = q("[data-format-font-panel]");
          if (panel) panel.hidden = true;
          const label = q("[data-format-font-label]");
          if (label) label.textContent = FONT_LABELS[token] || "Default";
        }
      });
    });

    qa("[data-link-choice]").forEach(button => {
      button.addEventListener("click", () => {
        const type = button.dataset.linkChoice;
        if (type === "note") {
          if (!linkSelectedText) {
            showToast("Blok teks yang ingin ditautkan ke catatan dulu.");
            return;
          }
          setLayer("[data-link-choice-layer]", false);
          window.CatatanRelated?.openSingle?.({
            onSelect: note => {
              const href = internalLinkHref(note);
              if (!href) {
                showToast("Tujuan catatan belum dapat dibuka.");
                return;
              }
              insertAnchorAtSavedRange({ href, label: linkSelectedText, internal: true });
            }
          });
          return;
        }

        setLayer("[data-link-choice-layer]", false);
        activeLinkAnchor = null;
        prepareWebLinkSheet(null);
        openSheet("[data-link-layer]", false);
        setTimeout(() => (linkSelectedText ? q("[data-link-url]") : q("[data-link-text]"))?.focus(), 80);
      });
    });

    q("[data-link-apply]")?.addEventListener("click", () => {
      const rawUrl = clean(q("[data-link-url]")?.value);
      const alias = clean(q("[data-link-text]")?.value);
      if (!rawUrl) {
        showToast("Masukkan alamat tautan dulu.");
        return;
      }

      let url = rawUrl;
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
      if (!/^https?:\/\//i.test(url)) {
        showToast("Gunakan tautan http atau https.");
        return;
      }

      setLayer("[data-link-layer]", false);
      if (activeLinkAnchor && document.contains(activeLinkAnchor)) {
        activeLinkAnchor.href = url;
        activeLinkAnchor.target = "_blank";
        activeLinkAnchor.rel = "noopener noreferrer";
        activeLinkAnchor.removeAttribute("data-rk-internal-link");
        if (alias) activeLinkAnchor.textContent = alias;
        activeLinkAnchor = null;
        scheduleBasicAutosave(120);
        showToast("Tautan diperbarui.");
        return;
      }
      insertAnchorAtSavedRange({ href: url, label: alias, internal: false });
    });

    qa("[data-link-action]").forEach(button => {
      button.addEventListener("click", async () => {
        const action = button.dataset.linkAction;
        const anchor = activeLinkAnchor;
        if (!anchor) return;
        if (action === "open") {
          const href = anchor.getAttribute("href");
          const internal = anchor.hasAttribute("data-rk-internal-link");
          setLayer("[data-link-action-layer]", false);
          activeLinkAnchor = null;
          if (!href) return;
          if (internal) await openInternalNoteLink(anchor);
          else window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        if (action === "remove") {
          const oldTargetId = internalTargetId(anchor);
          anchor.replaceWith(document.createTextNode(anchor.textContent || ""));
          setLayer("[data-link-action-layer]", false);
          activeLinkAnchor = null;
          scheduleBasicAutosave(120);
          if (oldTargetId && !hasAnotherInlineLinkTo(oldTargetId)) {
            window.CatatanRelated?.unlinkTarget?.(oldTargetId);
          }
          showToast("Tautan dihapus. Teks tetap dipertahankan.");
          return;
        }
        if (action === "change") {
          setLayer("[data-link-action-layer]", false);
          const internal = anchor.hasAttribute("data-rk-internal-link");
          linkSelectedText = clean(anchor.textContent);
          if (internal) {
            const changingAnchor = anchor;
            const oldTargetId = internalTargetId(changingAnchor);
            window.CatatanRelated?.openSingle?.({
              currentTargetId: oldTargetId,
              onSelect: note => {
                const href = internalLinkHref(note);
                if (!href || !document.contains(changingAnchor)) return;
                const newTargetId = clean(note?.id);
                changingAnchor.href = href;
                changingAnchor.dataset.rkInternalLink = "note";
                changingAnchor.removeAttribute("target");
                changingAnchor.removeAttribute("rel");
                scheduleBasicAutosave(120);
                if (oldTargetId && oldTargetId !== newTargetId && !hasAnotherInlineLinkTo(oldTargetId, changingAnchor)) {
                  window.CatatanRelated?.unlinkTarget?.(oldTargetId);
                }
                activeLinkAnchor = null;
                showToast("Tujuan catatan diperbarui.");
              }
            });
          } else {
            prepareWebLinkSheet(anchor);
            openSheet("[data-link-layer]", false);
            setTimeout(() => q("[data-link-url]")?.focus(), 80);
          }
        }
      });
    });
  }

  function setupSensitiveNotice() {
    q("[data-sensitive-continue]")?.addEventListener("click", () => {
      if (q("[data-sensitive-never]")?.checked) {
        try { localStorage.setItem(warningStorageKey(), "hidden"); } catch {}
      }
      setLayer("[data-sensitive-layer]", false);
      if (editorMode === "edit") q("[data-note-title]")?.focus();
    });
  }

  function setupModeToggle() {
    q("[data-mode-toggle]")?.addEventListener("click", () => {
      setMode(editorMode === "edit" ? "view" : "edit", true);
    });
  }

  function setupEditor() {
    q("[data-note-title]")?.addEventListener("input", () => {
      resizeTitle();
      scheduleBasicAutosave();
    });
    q("[data-note-content]")?.addEventListener("input", () => scheduleBasicAutosave());
    q("[data-note-title]")?.addEventListener("blur", () => saveBasicNoteNow());
    q("[data-note-content]")?.addEventListener("blur", () => saveBasicNoteNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveBasicNoteNow();
    });
    window.addEventListener("pagehide", () => { saveBasicNoteNow(); });
    q("[data-editor-back]")?.addEventListener("click", async event => {
      const cleanState = !noteDirty && !autosaveTimer && !tagDirty && !tagSaveRunning && !reminderRecipientsDirty && !reminderRecipientSaveRunning;
      if (noteDeleting || !basicBackendMode() || noteReadOnly || cleanState) return;
      event.preventDefault();
      const href = event.currentTarget.href;
      await saveBasicNoteNow();
      if (tagDirty && noteId) await saveTagsNow();
      if (reminderPreset && reminderRecipientsDirty && noteId) await saveReminderRecipientsNow();
      location.href = href;
    });
    resizeTitle();
    setupSheets();
    setupToolbar();
    setupSensitiveNotice();
    setupModeToggle();
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
    reminderPreset = clean(params.get("type")).toLowerCase() === "reminder";
    cardColor = window.CatatanManagement?.normalizeCardColor?.(params.get("color")) || "default";
    if (!["family", "personal"].includes(scope)) scope = "personal";
    if (scope === "family") visibility = "family-read";

    if (reminderPreset) {
      if (scope === "family") visibility = "family-read";
      applyDocumentTypeCopy();
    }

    setupEditor();
    applyContext();
    renderCardColorState();
    renderReminder();

    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }

    try {
      const user = await AuthService.ambilUserAktif();
      if (!user) return;
      userId = clean(user.id, "guest");

      // Area Pribadi private tetap dapat bekerja walau user belum punya family.
      // Family baru wajib ketika scope/visibility memang membutuhkan family_id.
      try {
        const family = await AuthRouter.ambilFamilyAktif();
        activeFamilyId = clean(family?.id);
      } catch (familyError) {
        console.warn("[Catatan Editor Family Context]", familyError);
        activeFamilyId = "";
      }

      noteBackendReady = Boolean(window.NotesService);
      tagBackendReady = Boolean(
        window.NotesService?.ambilTagCatalog &&
        window.NotesService?.buatTag &&
        window.NotesService?.ambilTagCatatan &&
        window.NotesService?.syncTagCatatan
      );

      if (noteId && noteBackendReady) {
        await loadBasicNote();
      }
      if (reminderPreset && scope === "family") {
        await loadReminderMembers();
        renderReminderDedicated();
      }

      window.CatatanRelated?.init?.({
        getContext: () => ({
          noteId,
          userId,
          scope,
          folderName,
          visibility,
          canManage: !noteReadOnly && noteBackendReady,
          isReminder: reminderPreset
        }),
        ensureSaved: async () => {
          await saveBasicNoteNow();
          return noteId;
        },
        showToast
      });
      window.CatatanRelated?.refresh?.();

      await loadTagCatalog();
      renderMetadataTags();
      maybeShowSensitiveNotice();
    } catch (error) {
      console.error("[Catatan Editor]", error);
      loadLegacyTagCatalog();
      renderMetadataTags();
      maybeShowSensitiveNotice();
    } finally {
      q("[data-catatan-editor]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
