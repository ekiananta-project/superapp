(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let scope = "personal";
  let folderName = "";
  let visibility = "private";
  let pinned = false;
  let savedRange = null;
  let userId = "guest";
  let toastTimer = null;

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
    if (!editor) return;
    editor.focus({ preventScroll: true });
    if (!savedRange) return;
    const selection = window.getSelection?.();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }

  function execute(command, value = null) {
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
    if (!selectionNode()) return;
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

  function maybeShowSensitiveNotice() {
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

  function setupSheets() {
    q("[data-open-info]")?.addEventListener("click", () => openSheet("[data-info-layer]", true));
    q("[data-info-close]")?.addEventListener("click", () => setLayer("[data-info-layer]", false));
    q("[data-format-close]")?.addEventListener("click", () => setLayer("[data-format-layer]", false));
    q("[data-visibility-close]")?.addEventListener("click", () => setLayer("[data-visibility-layer]", false));
    q("[data-link-close]")?.addEventListener("click", () => setLayer("[data-link-layer]", false));

    qa(".catatan-sheet-layer").forEach(layer => {
      layer.addEventListener("click", event => {
        if (event.target === layer) layer.hidden = true;
      });
    });

    q("[data-visibility-chip]")?.addEventListener("click", () => {
      if (scope === "personal") openSheet("[data-visibility-layer]", true);
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
          openSheet("[data-visibility-layer]", true);
          return;
        }
        if (action === "promote") {
          showToast("Pemindahan permanen ke Catatan Keluarga akan aktif bersama backend Catatan.");
          return;
        }
        const names = {
          folder: "Pemilihan Folder",
          tag: "Tag",
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
      if (!selectionNode()) return;
      saveSelection();
      refreshFormatState();
    });
    editor?.addEventListener("keyup", () => { saveSelection(); refreshFormatState(); });
    editor?.addEventListener("mouseup", () => { saveSelection(); refreshFormatState(); });
    editor?.addEventListener("input", refreshFormatState);

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
      const input = q("[data-link-url]");
      if (input) input.value = "";
      openSheet("[data-link-layer]", false);
      setTimeout(() => input?.focus(), 80);
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
      const selection = window.getSelection?.();
      const hasText = selection && !selection.isCollapsed;
      if (hasText) {
        execute("createLink", url);
      } else {
        execute("insertHTML", `<a href="${url.replace(/\"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">${url.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</a>`);
      }
    });
  }

  function setupSensitiveNotice() {
    q("[data-sensitive-continue]")?.addEventListener("click", () => {
      if (q("[data-sensitive-never]")?.checked) {
        try { localStorage.setItem(warningStorageKey(), "hidden"); } catch {}
      }
      setLayer("[data-sensitive-layer]", false);
      q("[data-note-title]")?.focus();
    });
  }

  function setupEditor() {
    q("[data-note-title]")?.addEventListener("input", resizeTitle);
    resizeTitle();
    setupSheets();
    setupToolbar();
    setupSensitiveNotice();
    setupKeyboardOffset();
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    scope = clean(params.get("scope"), "personal").toLowerCase();
    folderName = clean(params.get("folder"));
    if (!['family', 'personal'].includes(scope)) scope = "personal";

    setupEditor();
    applyContext();

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
      maybeShowSensitiveNotice();
    } catch (error) {
      console.error("[Catatan Editor]", error);
      maybeShowSensitiveNotice();
    } finally {
      q("[data-catatan-editor]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
