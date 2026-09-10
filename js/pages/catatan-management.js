(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  let activeMenu = null;
  let confirmResolve = null;
  let colorResolve = null;
  let folderResolve = null;
  let themeObserver = null;

  function clean(value, fallback = "") {
    const text = String(value ?? "").trim().replace(/\s+/g, " ");
    return text || fallback;
  }

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function lottieSrc(kind, theme = currentTheme()) {
    const safeKind = kind === "folders" ? "folders" : "notes";
    return `assets/lottie/catatan-empty-${safeKind}-${theme}.lottie`;
  }

  function syncEmptyLottieTheme() {
    document.querySelectorAll("dotlottie-player[data-catatan-empty-lottie]").forEach(player => {
      const kind = player.dataset.catatanEmptyLottie === "folders" ? "folders" : "notes";
      const next = lottieSrc(kind);
      if (player.getAttribute("src") !== next) player.setAttribute("src", next);
    });
  }

  function ensureThemeObserver() {
    if (themeObserver) return;
    themeObserver = new MutationObserver(syncEmptyLottieTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function createEmptyState(kind, { title, message, actionLabel = "", onAction = null } = {}) {
    ensureThemeObserver();
    const root = document.createElement("div");
    root.className = "catatan-rich-empty";
    root.dataset.emptyKind = kind === "folders" ? "folders" : "notes";

    const visual = document.createElement("div");
    visual.className = "catatan-rich-empty-visual";
    const player = document.createElement("dotlottie-player");
    player.dataset.catatanEmptyLottie = root.dataset.emptyKind;
    player.setAttribute("src", lottieSrc(root.dataset.emptyKind));
    player.setAttribute("background", "transparent");
    player.setAttribute("speed", "1");
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      player.setAttribute("loop", "true");
      player.setAttribute("autoplay", "");
    }
    player.setAttribute("aria-hidden", "true");
    visual.appendChild(player);

    const strong = document.createElement("strong");
    strong.textContent = clean(title, root.dataset.emptyKind === "folders" ? "Belum ada folder" : "Belum ada catatan");
    const span = document.createElement("span");
    span.textContent = clean(message, root.dataset.emptyKind === "folders"
      ? "Folder yang kamu buat akan tampil di sini."
      : "Catatan yang kamu buat akan tampil di sini.");

    root.append(visual, strong, span);

    if (actionLabel && typeof onAction === "function") {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "catatan-rich-empty-action";
      action.textContent = actionLabel;
      action.addEventListener("click", onAction);
      root.appendChild(action);
    }
    return root;
  }

  function renderTagSummary(tags = []) {
    const values = Array.from(new Set((Array.isArray(tags) ? tags : []).map(clean).filter(Boolean)));
    if (!values.length) return null;
    const wrap = document.createElement("span");
    wrap.className = "catatan-note-tags catatan-note-tags-compact";
    values.slice(0, 2).forEach(tag => {
      const chip = document.createElement("em");
      chip.textContent = `#${String(tag).replace(/^#+/, "")}`;
      wrap.appendChild(chip);
    });
    if (values.length > 2) {
      const more = document.createElement("em");
      more.className = "is-count";
      more.textContent = `+${values.length - 2}`;
      more.setAttribute("aria-label", `${values.length - 2} tag lainnya`);
      wrap.appendChild(more);
    }
    wrap.title = values.map(tag => `#${String(tag).replace(/^#+/, "")}`).join(" · ");
    return wrap;
  }

  function closeActiveMenu() {
    if (!activeMenu) return;
    const shell = activeMenu.closest(".catatan-card-shell");
    activeMenu.hidden = true;
    shell?.classList.remove("is-menu-open");
    shell?.querySelector(".catatan-card-overflow")?.setAttribute("aria-expanded", "false");
    activeMenu = null;
  }

  function createCardShell(card, {
    actions = null,
    canDelete = false,
    deleteLabel = "Hapus catatan",
    menuLabel = "Menu catatan",
    onDelete = null
  } = {}) {
    const shell = document.createElement("div");
    shell.className = "catatan-card-shell";
    if (card?.dataset?.previewItem !== undefined) shell.dataset.previewItem = "";
    if (card?.dataset?.searchText) shell.dataset.searchText = card.dataset.searchText;
    if (card?.dataset?.noteId) shell.dataset.noteId = card.dataset.noteId;
    if (card?.dataset?.folderName) shell.dataset.folderName = card.dataset.folderName;
    card.removeAttribute?.("data-preview-item");
    card.removeAttribute?.("data-search-text");
    shell.appendChild(card);

    let menuActions = Array.isArray(actions) ? actions.filter(item => item && typeof item.onSelect === "function") : [];
    if (!menuActions.length && canDelete && typeof onDelete === "function") {
      menuActions = [{
        label: clean(deleteLabel, "Hapus"),
        icon: "trash-outline",
        tone: "danger",
        onSelect: onDelete
      }];
    }
    if (!menuActions.length) return shell;

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "catatan-card-overflow";
    menuButton.setAttribute("aria-label", menuLabel);
    menuButton.setAttribute("aria-haspopup", "menu");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.innerHTML = '<ion-icon name="ellipsis-horizontal" aria-hidden="true"></ion-icon>';

    const menu = document.createElement("div");
    menu.className = "catatan-card-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;

    menuActions.forEach(action => {
      const item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      if (action.tone === "danger") item.classList.add("is-danger");
      else if (action.tone === "archive") item.classList.add("is-archive");
      else if (action.tone === "restore") item.classList.add("is-restore");
      const icon = clean(action.icon, action.tone === "danger" ? "trash-outline" : "archive-outline");
      item.innerHTML = `<ion-icon name="${icon}" aria-hidden="true"></ion-icon><span>${clean(action.label, "Pilih")}</span>`;
      item.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        closeActiveMenu();
        await action.onSelect();
      });
      menu.appendChild(item);
    });

    shell.classList.add("has-overflow");
    shell.append(menuButton, menu);

    menuButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const opening = menu.hidden;
      closeActiveMenu();
      menu.hidden = !opening;
      menuButton.setAttribute("aria-expanded", String(opening));
      shell.classList.toggle("is-menu-open", opening);
      if (opening) activeMenu = menu;
    });

    return shell;
  }

  function attachSelectionControl(shell, { selectable = true, label = "Pilih catatan", onToggle = null } = {}) {
    if (!shell) return null;
    shell.dataset.noteSelectable = String(Boolean(selectable));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catatan-card-select";
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<ion-icon name="ellipse-outline" aria-hidden="true"></ion-icon>';
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectable) return;
      onToggle?.();
    });
    shell.appendChild(button);
    return button;
  }

  function setSelectionState(shell, selected) {
    if (!shell) return;
    const active = Boolean(selected);
    shell.classList.toggle("is-selected", active);
    const button = shell.querySelector(".catatan-card-select");
    button?.setAttribute("aria-pressed", String(active));
    const icon = button?.querySelector("ion-icon");
    if (icon) icon.setAttribute("name", active ? "checkmark" : "ellipse-outline");
  }

  function ensureConfirmLayer() {
    let layer = q("[data-catatan-confirm-layer]");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.className = "catatan-confirm-layer";
    layer.dataset.catatanConfirmLayer = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="catatan-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="catatan-confirm-title" aria-describedby="catatan-confirm-message" data-catatan-confirm-dialog>
        <span class="catatan-confirm-icon" data-catatan-confirm-icon><ion-icon name="trash-outline" aria-hidden="true"></ion-icon></span>
        <h2 id="catatan-confirm-title" data-catatan-confirm-title>Konfirmasi</h2>
        <p id="catatan-confirm-message" data-catatan-confirm-message>Pastikan tindakan ini memang kamu inginkan.</p>
        <div class="catatan-confirm-actions">
          <button type="button" class="is-secondary" data-catatan-confirm-cancel>Batal</button>
          <button type="button" data-catatan-confirm-ok>OK</button>
        </div>
      </section>`;
    document.body.appendChild(layer);

    const finish = value => {
      layer.hidden = true;
      const resolver = confirmResolve;
      confirmResolve = null;
      resolver?.(value);
    };
    layer.querySelector("[data-catatan-confirm-cancel]")?.addEventListener("click", () => finish(false));
    layer.querySelector("[data-catatan-confirm-ok]")?.addEventListener("click", () => finish(true));
    layer.addEventListener("click", event => {
      if (event.target === layer) finish(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !layer.hidden) finish(false);
    });
    return layer;
  }

  function confirmAction({
    title = "Konfirmasi",
    message = "Pastikan tindakan ini memang kamu inginkan.",
    confirmLabel = "OK",
    tone = "default",
    icon = "checkmark-circle-outline"
  } = {}) {
    const layer = ensureConfirmLayer();
    if (confirmResolve) confirmResolve(false);
    layer.querySelector("[data-catatan-confirm-title]").textContent = title;
    layer.querySelector("[data-catatan-confirm-message]").textContent = message;
    const dialog = layer.querySelector("[data-catatan-confirm-dialog]");
    const iconWrap = layer.querySelector("[data-catatan-confirm-icon]");
    const iconEl = iconWrap?.querySelector("ion-icon");
    if (dialog) dialog.dataset.tone = tone;
    if (iconEl) iconEl.setAttribute("name", icon);
    const ok = layer.querySelector("[data-catatan-confirm-ok]");
    if (ok) {
      ok.textContent = confirmLabel;
      ok.className = tone === "danger" ? "is-danger" : (tone === "archive" ? "is-archive" : "is-primary");
    }
    layer.hidden = false;
    requestAnimationFrame(() => layer.querySelector("[data-catatan-confirm-cancel]")?.focus());
    return new Promise(resolve => { confirmResolve = resolve; });
  }

  function confirmDanger({ title = "Hapus?", message = "Tindakan ini tidak dapat dibatalkan.", confirmLabel = "Hapus" } = {}) {
    return confirmAction({ title, message, confirmLabel, tone: "danger", icon: "trash-outline" });
  }

  function confirmArchive({ title = "Arsipkan?", message = "Catatan akan dipindahkan ke Arsip dan dapat dipulihkan.", confirmLabel = "Arsipkan" } = {}) {
    return confirmAction({ title, message, confirmLabel, tone: "archive", icon: "archive-outline" });
  }


  const CARD_COLORS = [
    { key: "default", label: "Default" },
    { key: "sage", label: "Sage" },
    { key: "sand", label: "Sand" },
    { key: "sky", label: "Sky" },
    { key: "rose", label: "Rose" },
    { key: "lavender", label: "Lavender" }
  ];

  function normalizeCardColor(value) {
    const key = String(value || "default").toLowerCase();
    return CARD_COLORS.some(item => item.key === key) ? key : "default";
  }

  function cardColorLabel(value) {
    const key = normalizeCardColor(value);
    return CARD_COLORS.find(item => item.key === key)?.label || "Default";
  }

  function applyCardColor(card, color) {
    if (!card) return;
    card.dataset.cardColor = normalizeCardColor(color);
  }

  function sortPinnedFirst(notes = []) {
    return [...(Array.isArray(notes) ? notes : [])].sort((a, b) => {
      const pinDelta = Number(Boolean(b?._pinned)) - Number(Boolean(a?._pinned));
      if (pinDelta) return pinDelta;
      const bTime = Date.parse(b?.updated_at || b?.created_at || 0) || 0;
      const aTime = Date.parse(a?.updated_at || a?.created_at || 0) || 0;
      return bTime - aTime;
    });
  }

  function ensureColorLayer() {
    let layer = q("[data-catatan-color-layer]");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.className = "catatan-picker-layer";
    layer.dataset.catatanColorLayer = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="catatan-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-color-title">
        <div class="catatan-picker-handle" aria-hidden="true"></div>
        <div class="catatan-picker-header">
          <div><small>Tampilan kartu</small><h2 id="catatan-color-title">Warna Catatan</h2></div>
          <button type="button" data-catatan-color-close aria-label="Tutup"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </div>
        <p class="catatan-picker-help">Warna hanya diterapkan pada kartu catatan, bukan halaman editor.</p>
        <div class="catatan-color-grid" data-catatan-color-grid></div>
        <button class="catatan-picker-cancel" type="button" data-catatan-color-cancel>Batal</button>
      </section>`;
    document.body.appendChild(layer);

    const finish = value => {
      layer.hidden = true;
      const resolver = colorResolve;
      colorResolve = null;
      resolver?.(value);
    };
    layer.querySelector("[data-catatan-color-close]")?.addEventListener("click", () => finish(null));
    layer.querySelector("[data-catatan-color-cancel]")?.addEventListener("click", () => finish(null));
    layer.addEventListener("click", event => { if (event.target === layer) finish(null); });
    return layer;
  }

  function pickCardColor(current = "default", { title = "Warna Catatan" } = {}) {
    const layer = ensureColorLayer();
    if (colorResolve) colorResolve(null);
    const heading = layer.querySelector("#catatan-color-title");
    if (heading) heading.textContent = clean(title, "Warna Catatan");
    const selected = normalizeCardColor(current);
    const grid = layer.querySelector("[data-catatan-color-grid]");
    if (grid) {
      grid.textContent = "";
      CARD_COLORS.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "catatan-color-option";
        button.dataset.color = item.key;
        button.dataset.selected = String(item.key === selected);
        button.innerHTML = `<span class="catatan-color-swatch" data-card-color="${item.key}" aria-hidden="true"></span><strong>${item.label}</strong><ion-icon name="${item.key === selected ? "checkmark-circle" : "ellipse-outline"}" aria-hidden="true"></ion-icon>`;
        button.addEventListener("click", () => {
          layer.hidden = true;
          const resolver = colorResolve;
          colorResolve = null;
          resolver?.(item.key);
        });
        grid.appendChild(button);
      });
    }
    layer.hidden = false;
    requestAnimationFrame(() => grid?.querySelector('[data-selected="true"]')?.focus());
    return new Promise(resolve => { colorResolve = resolve; });
  }

  function ensureFolderLayer() {
    let layer = q("[data-catatan-folder-create-layer]");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.className = "catatan-picker-layer";
    layer.dataset.catatanFolderCreateLayer = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="catatan-picker-sheet catatan-folder-create-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-folder-create-title">
        <div class="catatan-picker-handle" aria-hidden="true"></div>
        <div class="catatan-picker-header">
          <div><small data-catatan-folder-context>Organisasi</small><h2 id="catatan-folder-create-title">Buat folder</h2></div>
          <button type="button" data-catatan-folder-close aria-label="Tutup"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </div>
        <label class="catatan-folder-name-field">
          <span>Nama folder</span>
          <input type="text" maxlength="80" autocomplete="off" placeholder="Contoh: Rumah" data-catatan-folder-input>
          <small data-catatan-folder-error hidden></small>
        </label>
        <div class="catatan-folder-create-actions">
          <button class="is-secondary" type="button" data-catatan-folder-cancel>Batal</button>
          <button class="is-primary" type="button" data-catatan-folder-submit>Buat folder</button>
        </div>
      </section>`;
    document.body.appendChild(layer);

    const input = layer.querySelector("[data-catatan-folder-input]");
    const error = layer.querySelector("[data-catatan-folder-error]");
    const finish = value => {
      layer.hidden = true;
      const resolver = folderResolve;
      folderResolve = null;
      resolver?.(value);
    };
    const submit = () => {
      const value = clean(input?.value);
      if (!value) {
        if (error) { error.hidden = false; error.textContent = "Nama folder wajib diisi."; }
        input?.focus();
        return;
      }
      finish(value.slice(0, 80));
    };
    layer.querySelector("[data-catatan-folder-close]")?.addEventListener("click", () => finish(null));
    layer.querySelector("[data-catatan-folder-cancel]")?.addEventListener("click", () => finish(null));
    layer.querySelector("[data-catatan-folder-submit]")?.addEventListener("click", submit);
    input?.addEventListener("input", () => { if (error) error.hidden = true; });
    input?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); submit(); } });
    layer.addEventListener("click", event => { if (event.target === layer) finish(null); });
    return layer;
  }

  function askFolderName({ context = "Catatan", initial = "" } = {}) {
    const layer = ensureFolderLayer();
    if (folderResolve) folderResolve(null);
    const input = layer.querySelector("[data-catatan-folder-input]");
    const contextEl = layer.querySelector("[data-catatan-folder-context]");
    const error = layer.querySelector("[data-catatan-folder-error]");
    if (contextEl) contextEl.textContent = clean(context, "Catatan");
    if (input) input.value = clean(initial);
    if (error) { error.hidden = true; error.textContent = ""; }
    layer.hidden = false;
    requestAnimationFrame(() => { input?.focus(); input?.select(); });
    return new Promise(resolve => { folderResolve = resolve; });
  }

  document.addEventListener("click", event => {
    if (!activeMenu) return;
    if (event.target.closest?.(".catatan-card-shell.is-menu-open")) return;
    closeActiveMenu();
  });

  window.CatatanManagement = {
    createEmptyState,
    renderTagSummary,
    normalizeCardColor,
    cardColorLabel,
    applyCardColor,
    sortPinnedFirst,
    pickCardColor,
    askFolderName,
    createCardShell,
    attachSelectionControl,
    setSelectionState,
    confirmAction,
    confirmDanger,
    confirmArchive,
    closeActiveMenu,
    syncEmptyLottieTheme
  };
})();
