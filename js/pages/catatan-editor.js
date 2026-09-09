(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));

  let scope = "personal";
  let folderName = "";
  let visibility = "private";
  let pinned = false;
  let savedRange = null;
  let linkSelectedText = "";
  let userId = "guest";
  let toastTimer = null;
  let editorMode = "edit";
  let availableTags = [];
  let selectedTags = new Set();
  let draftTags = new Set();
  let reminderDate = "";
  let reminderTime = "";
  let reminderPreset = false;

  function clean(value, fallback = "") {
    const text = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!text || ["undefined", "null", "[object object]"].includes(text.toLowerCase())) return fallback;
    return text;
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
    try {
      const value = String(document.queryCommandValue("hiliteColor") || "").trim().toLowerCase();
      return Boolean(value && !["transparent", "rgba(0, 0, 0, 0)", "rgb(0, 0, 0)", "#000000"].includes(value));
    } catch {
      return false;
    }
  }

  function refreshFormatState() {
    if (editorMode !== "edit" || !selectionNode()) return;
    const block = currentBlock();
    qa("[data-format-block]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.formatBlock === block);
    });
    ["bold", "italic", "underline", "strikeThrough"].forEach(command => {
      let active = false;
      try { active = document.queryCommandState(command); } catch {}
      q(`[data-format-command="${command}"]`)?.classList.toggle("is-active", active);
    });
    const highlighted = selectionHasHighlight();
    q("[data-format-highlight]")?.classList.toggle("is-active", highlighted);
    q('[data-tool="highlight"]')?.classList.toggle("is-active", highlighted);
    const label = q("[data-highlight-label]");
    const state = q("[data-highlight-state]");
    if (label) label.textContent = highlighted ? "Hapus highlight" : "Highlight";
    if (state) state.textContent = highlighted ? "Aktif · ketuk untuk hapus" : "Tidak aktif";
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
    } catch {
      showToast("Format blok ini belum didukung di perangkat ini.");
    }
  }

  function toggleHighlight() {
    if (editorMode !== "edit") return;
    restoreSelection();
    const active = selectionHasHighlight();
    try {
      document.execCommand("hiliteColor", false, active ? "transparent" : "#fff1a8");
      saveSelection();
      refreshFormatState();
    } catch {
      try {
        document.execCommand("backColor", false, active ? "transparent" : "#fff1a8");
        saveSelection();
        refreshFormatState();
      } catch {
        showToast("Highlight belum didukung di perangkat ini.");
      }
    }
  }

  function clearFormatting() {
    if (editorMode !== "edit") return;
    restoreSelection();
    try {
      document.execCommand("removeFormat", false, null);
      document.execCommand("formatBlock", false, "p");
      document.execCommand("hiliteColor", false, "transparent");
      saveSelection();
      refreshFormatState();
    } catch {
      showToast("Format belum dapat dibersihkan di perangkat ini.");
    }
  }

  function resizeTitle() {
    const input = q("[data-note-title]");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 116)}px`;
  }

  function editorBackUrl() {
    if (folderName) {
      return `catatan-folder.html?scope=${encodeURIComponent(scope)}&folder=${encodeURIComponent(folderName)}`;
    }
    return scope === "family" ? "catatan-keluarga.html" : "catatan-pribadi.html";
  }

  function applyContext() {
    const areaLabel = q("[data-area-label]");
    const areaChip = q("[data-area-chip]");
    const areaIcon = areaChip?.querySelector("ion-icon");
    const visibilityChip = q("[data-visibility-chip]");
    const visibilityRow = q("[data-visibility-row]");
    const promoteRow = q("[data-promote-row]");
    const folderChip = q("[data-folder-chip]");
    const folderLabel = q("[data-folder-label]");
    const infoFolder = q("[data-info-folder]");
    const back = q("[data-editor-back]");

    if (back) back.href = editorBackUrl();

    if (scope === "family") {
      if (areaLabel) areaLabel.textContent = "Catatan Keluarga";
      if (areaIcon) areaIcon.setAttribute("name", "people-outline");
      if (visibilityChip) visibilityChip.hidden = true;
      if (visibilityRow) visibilityRow.hidden = true;
      if (promoteRow) promoteRow.hidden = true;
    } else {
      if (areaLabel) areaLabel.textContent = "Pribadi";
      if (areaIcon) areaIcon.setAttribute("name", "person-outline");
      if (visibilityChip) visibilityChip.hidden = false;
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
    openSheet("[data-reminder-layer]", true);
  }

  function saveReminder() {
    const date = clean(q("[data-reminder-date]")?.value);
    const time = clean(q("[data-reminder-time]")?.value);
    if (!date || !time) {
      showToast("Pilih tanggal dan waktu reminder dulu.");
      return;
    }
    reminderDate = date;
    reminderTime = time;
    reminderPreset = true;
    renderReminder();
    setLayer("[data-reminder-layer]", false);
    showToast("Reminder disimpan di catatan.");
  }

  function removeReminder() {
    reminderDate = "";
    reminderTime = "";
    renderReminder();
    setLayer("[data-reminder-layer]", false);
    showToast(reminderPreset ? "Jadwal reminder dihapus." : "Reminder dihapus.");
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
  }

  function togglePin() {
    pinned = !pinned;
    q("[data-pin-switch]")?.classList.toggle("is-on", pinned);
    const state = q("[data-pin-state]");
    if (state) state.textContent = pinned ? "Dipin" : "Tidak dipin";
  }

  function warningStorageKey() {
    return `ruangkitha_catatan_sensitive_notice_v1:${userId}`;
  }


  function tagCatalogStorageKey() {
    return `ruangkitha_catatan_tag_catalog_preview_v1:${userId}:${scope}`;
  }

  function loadTagCatalog() {
    try {
      const parsed = JSON.parse(localStorage.getItem(tagCatalogStorageKey()) || "[]");
      if (Array.isArray(parsed)) {
        availableTags = Array.from(new Set(parsed.map(normalizeTag).filter(Boolean))).sort();
      }
    } catch {
      availableTags = [];
    }
  }

  function saveTagCatalog() {
    try { localStorage.setItem(tagCatalogStorageKey(), JSON.stringify(availableTags)); } catch {}
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

    Array.from(selectedTags).sort().forEach(tag => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "catatan-context-chip is-tag";
      button.dataset.tagChip = tag;
      button.disabled = editorMode !== "edit";
      button.innerHTML = `<span>#${tag}</span>`;
      button.addEventListener("click", openTagSheet);
      host.appendChild(button);
    });

    const add = q("[data-tag-add]");
    if (add) add.hidden = editorMode !== "edit";

    const info = q("[data-info-tags]");
    if (info) {
      const tags = Array.from(selectedTags).sort();
      info.textContent = tags.length ? tags.map(tag => `#${tag}`).join(" · ") : "Belum ada tag";
    }
  }

  function renderTagPicker() {
    const searchValue = normalizeTag(q("[data-tag-search]")?.value || "");
    const list = q("[data-tag-list]");
    const empty = q("[data-tag-empty]");
    const create = q("[data-tag-create]");
    const createLabel = q("[data-tag-create-label]");
    if (!list) return;

    list.textContent = "";
    const source = availableTags.filter(tag => !searchValue || tag.includes(searchValue));

    source.forEach(tag => {
      const selected = draftTags.has(tag);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `catatan-tag-option${selected ? " is-selected" : ""}`;
      button.dataset.tagOption = tag;
      button.innerHTML = `<strong>#${tag}</strong><ion-icon name="${selected ? "checkmark-circle" : "ellipse-outline"}" aria-hidden="true"></ion-icon>`;
      button.addEventListener("click", () => {
        if (draftTags.has(tag)) draftTags.delete(tag);
        else draftTags.add(tag);
        renderTagPicker();
      });
      list.appendChild(button);
    });

    if (empty) empty.hidden = source.length > 0;

    const exactExists = searchValue && availableTags.includes(searchValue);
    if (create) create.hidden = !searchValue || exactExists;
    if (createLabel && searchValue && !exactExists) createLabel.textContent = `Tambah tag baru “#${searchValue}”`;
  }

  function openTagSheet() {
    if (editorMode !== "edit") return;
    draftTags = new Set(selectedTags);
    const search = q("[data-tag-search]");
    if (search) search.value = "";
    renderTagPicker();
    openSheet("[data-tag-layer]", true);
    setTimeout(() => search?.focus(), 80);
  }

  function closeTagSheet(apply = false) {
    if (apply) {
      selectedTags = new Set(draftTags);
      renderMetadataTags();
    }
    setLayer("[data-tag-layer]", false);
  }

  function createTagFromSearch() {
    const value = normalizeTag(q("[data-tag-search]")?.value || "");
    if (!value) return;
    if (!availableTags.includes(value)) {
      availableTags.push(value);
      availableTags.sort();
      saveTagCatalog();
    }
    draftTags.add(value);
    const search = q("[data-tag-search]");
    if (search) search.value = "";
    renderTagPicker();
  }

  function setMode(mode, announce = true) {
    editorMode = mode === "view" ? "view" : "edit";
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
    if (title) title.readOnly = view;
    if (editor) editor.contentEditable = view ? "false" : "true";
    if (toolbar) toolbar.hidden = view;
    if (visibilityChip) visibilityChip.disabled = view || scope !== "personal";
    if (reminderChip) reminderChip.disabled = view;
    if (toggle) toggle.setAttribute("aria-label", view ? "Edit catatan" : "Lihat hasil catatan");
    if (label) label.textContent = view ? "Edit catatan" : "Lihat hasil";
    if (icon) icon.setAttribute("name", view ? "create-outline" : "eye-outline");

    renderMetadataTags();

    if (view) {
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
    q("[data-visibility-close]")?.addEventListener("click", () => setLayer("[data-visibility-layer]", false));
    q("[data-link-close]")?.addEventListener("click", () => setLayer("[data-link-layer]", false));
    q("[data-reminder-close]")?.addEventListener("click", () => setLayer("[data-reminder-layer]", false));
    q("[data-reminder-chip]")?.addEventListener("click", openReminderSheet);
    q("[data-reminder-save]")?.addEventListener("click", saveReminder);
    q("[data-reminder-remove]")?.addEventListener("click", removeReminder);
    q("[data-tag-close]")?.addEventListener("click", () => closeTagSheet(false));
    q("[data-tag-cancel]")?.addEventListener("click", () => closeTagSheet(false));
    q("[data-tag-apply]")?.addEventListener("click", () => closeTagSheet(true));
    q("[data-tag-add]")?.addEventListener("click", openTagSheet);
    q("[data-tag-search]")?.addEventListener("input", renderTagPicker);
    q("[data-tag-create]")?.addEventListener("click", createTagFromSearch);
    q("[data-tag-search]")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !q("[data-tag-create]")?.hidden) {
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
      if (scope === "personal" && editorMode === "edit") openSheet("[data-visibility-layer]", true);
    });

    qa("[data-set-visibility]").forEach(button => {
      button.addEventListener("click", () => {
        visibility = button.dataset.setVisibility || "private";
        renderVisibility();
        setLayer("[data-visibility-layer]", false);
      });
    });

    qa("[data-info-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.infoAction;
        if (action === "pin") {
          togglePin();
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
        if (action === "promote") {
          showToast("Pemindahan permanen ke Catatan Keluarga akan aktif bersama backend Catatan.");
          return;
        }
        const names = {
          folder: "Pemilihan Folder",
          color: "Warna Catatan",
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
    editor?.addEventListener("input", refreshFormatState);
    editor?.addEventListener("click", event => {
      const anchor = event.target.closest?.("a");
      if (!anchor) return;
      if (editorMode === "edit") {
        event.preventDefault();
        showToast("Tautan bisa dibuka dari Lihat hasil.");
      }
    });

    q('[data-tool="format"]')?.addEventListener("click", () => {
      refreshFormatState();
      openSheet("[data-format-layer]", true);
    });
    q('[data-tool="more"]')?.addEventListener("click", () => {
      refreshFormatState();
      openSheet("[data-format-layer]", true);
    });
    q('[data-tool="check"]')?.addEventListener("click", () => execute("insertText", "☐ "));
    q('[data-tool="list"]')?.addEventListener("click", () => execute("insertUnorderedList"));
    q('[data-tool="highlight"]')?.addEventListener("click", toggleHighlight);
    q('[data-tool="link"]')?.addEventListener("click", () => {
      saveSelection();
      linkSelectedText = clean(savedRange?.toString?.() || "");

      const textInput = q("[data-link-text]");
      const urlInput = q("[data-link-url]");
      const helper = q("[data-link-text-help]");

      if (textInput) textInput.value = linkSelectedText;
      if (urlInput) urlInput.value = "";
      if (helper) {
        helper.textContent = linkSelectedText
          ? "Teks yang dipilih sudah digunakan sebagai teks tautan. Kamu tetap bisa mengubahnya."
          : "Opsional. Jika kosong, alamat tautan akan ditampilkan.";
      }

      openSheet("[data-link-layer]", false);
      setTimeout(() => (linkSelectedText ? urlInput : textInput)?.focus(), 80);
    });

    qa("[data-format-block]").forEach(button => {
      button.addEventListener("click", () => {
        setLayer("[data-format-layer]", false);
        setBlockStyle(button.dataset.formatBlock || "p");
      });
    });

    qa("[data-format-command]").forEach(button => {
      button.addEventListener("click", () => {
        const command = button.dataset.formatCommand;
        const value = button.dataset.formatValue || null;
        setLayer("[data-format-layer]", false);
        execute(command, value);
      });
    });

    q("[data-format-highlight]")?.addEventListener("click", () => {
      setLayer("[data-format-layer]", false);
      toggleHighlight();
    });
    q("[data-format-clear]")?.addEventListener("click", () => {
      setLayer("[data-format-layer]", false);
      clearFormatting();
    });

    q("[data-format-font]")?.addEventListener("click", () => showToast("Pilihan font akan ditambahkan setelah gaya editor dikunci."));

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
      restoreSelection();

      const editorEl = q("[data-note-content]");
      const selection = window.getSelection?.();
      const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
      if (!editorEl || !selection || !range || !editorEl.contains(range.commonAncestorContainer)) {
        showToast("Pilih posisi tautan di catatan lalu coba lagi.");
        return;
      }

      const selectedText = clean(range.toString()) || linkSelectedText;
      const visibleText = alias || selectedText || url;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = visibleText;

      try {
        range.deleteContents();
        range.insertNode(anchor);
        range.setStartAfter(anchor);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        savedRange = range.cloneRange();
        linkSelectedText = "";
        refreshFormatState();
      } catch {
        showToast("Tautan belum dapat ditambahkan di posisi ini.");
      }
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
    q("[data-note-title]")?.addEventListener("input", resizeTitle);
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
    reminderPreset = clean(params.get("type")).toLowerCase() === "reminder";
    if (!["family", "personal"].includes(scope)) scope = "personal";

    if (reminderPreset) {
      document.title = "Reminder · RuangKitha";
      const title = q("[data-note-title]");
      if (title) {
        title.placeholder = "Judul reminder...";
        title.setAttribute("aria-label", "Judul reminder");
      }
    }

    setupEditor();
    applyContext();
    renderReminder();

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
      userId = clean(user.id, "guest");
      loadTagCatalog();
      renderMetadataTags();
      maybeShowSensitiveNotice();
    } catch (error) {
      console.error("[Catatan Editor]", error);
      loadTagCatalog();
      renderMetadataTags();
      maybeShowSensitiveNotice();
    } finally {
      q("[data-catatan-editor]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
