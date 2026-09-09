(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));

  let scope = "personal";
  let folderName = "";
  let visibility = "private";
  let pinned = false;
  let userId = "guest";
  let toastTimer = null;
  let editorMode = "edit";
  let availableTags = [];
  let selectedTags = new Set();
  let draftTags = new Set();
  let itemSequence = 0;
  let reminderDate = "";
  let reminderTime = "";

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

  function editorBackUrl() {
    if (folderName) {
      return `catatan-folder.html?scope=${encodeURIComponent(scope)}&folder=${encodeURIComponent(folderName)}`;
    }
    return scope === "family" ? "catatan-keluarga.html" : "catatan-pribadi.html";
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
    openSheet("[data-reminder-layer]");
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
    renderReminder();
    setLayer("[data-reminder-layer]", false);
    showToast("Reminder disimpan di checklist.");
  }

  function removeReminder() {
    reminderDate = "";
    reminderTime = "";
    renderReminder();
    setLayer("[data-reminder-layer]", false);
    showToast("Reminder dihapus dari checklist.");
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
    renderReminder();
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
      availableTags = Array.isArray(parsed)
        ? Array.from(new Set(parsed.map(normalizeTag).filter(Boolean))).sort()
        : [];
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
    openSheet("[data-tag-layer]");
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

  function itemElements() {
    return qa("[data-checklist-item]");
  }

  function updateProgress() {
    const items = itemElements().filter(item => clean(item.querySelector("[data-check-text]")?.value));
    const done = items.filter(item => item.classList.contains("is-complete")).length;
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
      const empty = !clean(input?.value);
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
    if (editorMode !== "edit") return;
    const input = item?.querySelector("[data-check-text]");
    if (!input) return;
    input.focus();
    if (atEnd) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }

  function removeItem(item, focusNeighbor = true) {
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
  }

  function createItem(text = "", complete = false) {
    itemSequence += 1;
    const item = document.createElement("div");
    item.className = "catatan-checklist-item";
    item.dataset.checklistItem = String(itemSequence);
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
    });
    input.addEventListener("keydown", event => {
      if (editorMode !== "edit") return;
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
      setItemComplete(item, !item.classList.contains("is-complete"));
    });

    remove.addEventListener("click", () => {
      if (editorMode !== "edit") return;
      removeItem(item, true);
    });

    return item;
  }

  function addItem(focus = true) {
    if (editorMode !== "edit") return;
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

  function setMode(mode, announce = true) {
    editorMode = mode === "view" ? "view" : "edit";
    const root = q("[data-catatan-checklist]");
    const title = q("[data-note-title]");
    const toggle = q("[data-mode-toggle]");
    const label = q("[data-mode-label]");
    const icon = toggle?.querySelector("ion-icon");
    const visibilityChip = q("[data-visibility-chip]");
    const reminderChip = q("[data-reminder-chip]");
    const view = editorMode === "view";

    root?.classList.toggle("is-view-mode", view);
    if (title) title.readOnly = view;
    qa("[data-check-text]").forEach(input => { input.readOnly = view; });
    syncViewOnlyItems(view);
    updateProgress();
    if (visibilityChip) visibilityChip.disabled = view || scope !== "personal";
    if (reminderChip) reminderChip.disabled = view;
    if (toggle) toggle.setAttribute("aria-label", view ? "Edit checklist" : "Lihat hasil checklist");
    if (label) label.textContent = view ? "Edit catatan" : "Lihat hasil";
    if (icon) icon.setAttribute("name", view ? "create-outline" : "eye-outline");

    renderMetadataTags();

    if (view) {
      title?.blur();
      qa("[data-check-text]").forEach(input => input.blur());
      if (announce) showToast("Mode Lihat hasil aktif — hanya isi catatan yang ditampilkan.");
    } else if (announce) {
      showToast("Mode Edit aktif — kamu bisa mengubah isi catatan.");
    }
  }

  function setupSheets() {
    q("[data-open-info]")?.addEventListener("click", () => openSheet("[data-info-layer]"));
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
      if (scope === "personal" && editorMode === "edit") openSheet("[data-visibility-layer]");
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

  function setupSensitiveNotice() {
    q("[data-sensitive-continue]")?.addEventListener("click", () => {
      if (q("[data-sensitive-never]")?.checked) {
        try { localStorage.setItem(warningStorageKey(), "hidden"); } catch {}
      }
      setLayer("[data-sensitive-layer]", false);
      if (editorMode === "edit") q("[data-note-title]")?.focus();
    });
  }

  function setupChecklist() {
    seedChecklist();
    q("[data-add-item]")?.addEventListener("click", () => addItem(true));
    q("[data-note-title]")?.addEventListener("input", resizeTitle);
    resizeTitle();
    q("[data-mode-toggle]")?.addEventListener("click", () => setMode(editorMode === "edit" ? "view" : "edit", true));
    setupSheets();
    setupSensitiveNotice();
    setMode("edit", false);
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    scope = clean(params.get("scope"), "personal").toLowerCase();
    folderName = clean(params.get("folder"));
    if (!["family", "personal"].includes(scope)) scope = "personal";

    setupChecklist();
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
      console.error("[Catatan Checklist]", error);
      loadTagCatalog();
      renderMetadataTags();
      maybeShowSensitiveNotice();
    } finally {
      q("[data-catatan-checklist]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
