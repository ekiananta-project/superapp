// RuangKitha v2.0.0a42c — Info Folder Picker hotfix
(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  let activeMenu = null;
  let confirmResolve = null;
  let colorResolve = null;
  let folderResolve = null;
  let folderPickerResolve = null;
  let tagManagerState = null;
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

  function createPinIndicator(label = "Catatan dipin") {
    const pin = document.createElement("span");
    pin.className = "catatan-note-pin-indicator";
    pin.setAttribute("role", "img");
    pin.setAttribute("aria-label", clean(label, "Catatan dipin"));
    pin.title = clean(label, "Catatan dipin");
    pin.innerHTML = '<ion-icon name="pin" aria-hidden="true"></ion-icon>';
    return pin;
  }

  function renderTagSummary(tags = []) {
    const values = Array.from(new Set((Array.isArray(tags) ? tags : []).map(value => clean(value)).filter(Boolean)));
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

  function settleFolderPicker(value = null) {
    const layer = q("[data-catatan-folder-picker-layer]");
    if (layer) layer.hidden = true;
    const resolver = folderPickerResolve;
    folderPickerResolve = null;
    resolver?.(value);
  }

  function ensureFolderPickerLayer() {
    let layer = q("[data-catatan-folder-picker-layer]");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.className = "catatan-picker-layer";
    layer.dataset.catatanFolderPickerLayer = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="catatan-picker-sheet catatan-folder-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-folder-picker-title">
        <div class="catatan-picker-handle" aria-hidden="true"></div>
        <div class="catatan-picker-header">
          <div><small data-catatan-folder-picker-context>Organisasi</small><h2 id="catatan-folder-picker-title">Pilih folder</h2></div>
          <button type="button" data-catatan-folder-picker-close aria-label="Tutup"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </div>
        <p class="catatan-picker-help">Pindahkan catatan ke folder yang sudah ada, atau kembalikan ke daftar utama.</p>
        <div class="catatan-folder-picker-list" data-catatan-folder-picker-list></div>
        <button class="catatan-folder-picker-create" type="button" data-catatan-folder-picker-create>
          <ion-icon name="add-circle-outline" aria-hidden="true"></ion-icon>
          <span><strong>Buat folder baru</strong><small>Tambahkan folder lalu gunakan untuk catatan ini</small></span>
          <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>
        </button>
      </section>`;
    document.body.appendChild(layer);

    layer.querySelector("[data-catatan-folder-picker-close]")?.addEventListener("click", () => settleFolderPicker(null));
    layer.querySelector("[data-catatan-folder-picker-create]")?.addEventListener("click", () => settleFolderPicker({ create: true }));
    layer.addEventListener("click", event => {
      if (event.target === layer) settleFolderPicker(null);
    });
    return layer;
  }

  function pickFolder(folders = [], { currentName = "", context = "Catatan" } = {}) {
    const layer = ensureFolderPickerLayer();
    if (folderPickerResolve) folderPickerResolve(null);

    const current = clean(currentName);
    const contextEl = layer.querySelector("[data-catatan-folder-picker-context]");
    if (contextEl) contextEl.textContent = clean(context, "Catatan");

    const list = layer.querySelector("[data-catatan-folder-picker-list]");
    if (list) {
      list.textContent = "";
      const normalized = (Array.isArray(folders) ? folders : [])
        .map(item => ({
          id: clean(item?.id),
          name: clean(item?.name),
          noteCount: Math.max(0, Number(item?.noteCount || 0))
        }))
        .filter(item => item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" }));

      if (current && !normalized.some(item => item.name.toLocaleLowerCase("id-ID") === current.toLocaleLowerCase("id-ID"))) {
        normalized.unshift({ id: "", name: current, noteCount: 0 });
      }

      const makeOption = ({ name = "", noteCount = 0 } = {}) => {
        const safeName = clean(name);
        const active = safeName.toLocaleLowerCase("id-ID") === current.toLocaleLowerCase("id-ID");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "catatan-folder-picker-option";
        button.dataset.selected = String(active);

        const iconWrap = document.createElement("span");
        iconWrap.className = "catatan-folder-picker-icon";
        const folderIcon = document.createElement("ion-icon");
        folderIcon.setAttribute("name", safeName ? "folder-outline" : "albums-outline");
        folderIcon.setAttribute("aria-hidden", "true");
        iconWrap.appendChild(folderIcon);

        const copy = document.createElement("span");
        const strong = document.createElement("strong");
        strong.textContent = safeName || "Tanpa folder";
        const small = document.createElement("small");
        small.textContent = safeName ? `${noteCount} catatan` : "Tampilkan di daftar utama";
        copy.append(strong, small);

        const check = document.createElement("ion-icon");
        check.setAttribute("name", active ? "checkmark-circle" : "ellipse-outline");
        check.setAttribute("aria-hidden", "true");

        button.append(iconWrap, copy, check);
        button.addEventListener("click", () => settleFolderPicker({ name: safeName }));
        return button;
      };

      list.appendChild(makeOption({ name: "", noteCount: 0 }));
      normalized.forEach(item => list.appendChild(makeOption(item)));
    }

    layer.hidden = false;
    requestAnimationFrame(() => layer.querySelector('[data-selected="true"]')?.focus());
    return new Promise(resolve => { folderPickerResolve = resolve; });
  }

  function ensureTagManagerLayer() {
    let layer = q("[data-catatan-tag-manager-layer]");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.className = "catatan-picker-layer";
    layer.dataset.catatanTagManagerLayer = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="catatan-picker-sheet catatan-tag-manager-sheet" role="dialog" aria-modal="true" aria-labelledby="catatan-tag-manager-title">
        <div class="catatan-picker-handle" aria-hidden="true"></div>
        <div class="catatan-picker-header">
          <div><small data-catatan-tag-manager-context>Organisasi</small><h2 id="catatan-tag-manager-title">Kelola tag</h2></div>
          <button type="button" data-catatan-tag-manager-close aria-label="Tutup"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </div>
        <p class="catatan-picker-help" data-catatan-tag-manager-help>Rapikan katalog tag tanpa menghapus isi catatan.</p>
        <div class="catatan-tag-manager-toolbar">
          <button type="button" data-catatan-tag-cleanup disabled>
            <ion-icon name="sparkles-outline" aria-hidden="true"></ion-icon>
            <span><strong>Hapus tag tidak terpakai</strong><small data-catatan-tag-cleanup-copy>Tidak ada tag yang perlu dibersihkan</small></span>
          </button>
        </div>
        <div class="catatan-tag-manager-list" data-catatan-tag-manager-list></div>
        <button class="catatan-picker-cancel" type="button" data-catatan-tag-manager-done>Selesai</button>
      </section>`;
    document.body.appendChild(layer);

    const close = () => {
      layer.hidden = true;
      tagManagerState = null;
    };
    layer.querySelector("[data-catatan-tag-manager-close]")?.addEventListener("click", close);
    layer.querySelector("[data-catatan-tag-manager-done]")?.addEventListener("click", close);
    layer.addEventListener("click", event => { if (event.target === layer) close(); });
    layer.querySelector("[data-catatan-tag-cleanup]")?.addEventListener("click", async () => {
      const state = tagManagerState;
      if (!state || state.busy) return;
      const unused = state.items.filter(item => item.usageCount === 0);
      if (!unused.length || !unused.some(item => item.canManage)) return;
      const ok = await confirmDanger({
        title: `Hapus ${unused.length} tag tidak terpakai?`,
        message: "Tag yang tidak dipakai catatan mana pun akan dihapus dari katalog. Isi catatan tidak berubah.",
        confirmLabel: "Hapus tag"
      });
      if (!ok) return;
      state.busy = true;
      try {
        const count = await window.NotesService.hapusTagTidakTerpakai(state.scope, state.familyId || null);
        state.notify?.(count ? `${count} tag tidak terpakai dihapus.` : "Tidak ada tag yang perlu dihapus.");
        await refreshTagManager();
        await state.onChanged?.();
      } catch (error) {
        console.error("[Catatan Tag Cleanup]", error);
        state.notify?.(error?.message || "Tag belum dapat dibersihkan.");
      } finally {
        if (tagManagerState) tagManagerState.busy = false;
      }
    });
    return layer;
  }

  async function refreshTagManager() {
    const state = tagManagerState;
    if (!state) return;
    const layer = ensureTagManagerLayer();
    const list = layer.querySelector("[data-catatan-tag-manager-list]");
    if (!list) return;
    list.innerHTML = '<div class="catatan-tag-manager-loading"><span></span><span></span><span></span></div>';

    try {
      state.items = await window.NotesService.ambilKelolaTagCatalog(state.scope, state.familyId || null);
    } catch (error) {
      console.error("[Catatan Tag Manager Load]", error);
      list.textContent = "";
      const empty = document.createElement("p");
      empty.className = "catatan-tag-manager-empty";
      empty.textContent = window.NotesService?.tagSchemaBelumTerpasang?.(error)
        ? "Jalankan SQL 004K agar Kelola tag aktif."
        : (error?.message || "Katalog tag belum dapat dimuat.");
      list.appendChild(empty);
      return;
    }

    list.textContent = "";
    const used = state.items.filter(item => item.usageCount > 0);
    const unused = state.items.filter(item => item.usageCount === 0);
    const canManage = state.items.some(item => item.canManage);
    const help = layer.querySelector("[data-catatan-tag-manager-help]");
    if (help) {
      help.textContent = state.scope === "family" && state.items.length && !canManage
        ? "Kamu dapat melihat pemakaian Tag Keluarga. Hanya Family Owner yang dapat menghapus tag dari katalog bersama."
        : "Rapikan katalog tag tanpa menghapus isi catatan.";
    }

    const cleanup = layer.querySelector("[data-catatan-tag-cleanup]");
    const cleanupCopy = layer.querySelector("[data-catatan-tag-cleanup-copy]");
    if (cleanup) cleanup.disabled = unused.length === 0 || !canManage;
    if (cleanupCopy) cleanupCopy.textContent = unused.length
      ? `${unused.length} tag · 0 catatan`
      : "Tidak ada tag yang perlu dibersihkan";

    const section = (label, items) => {
      const group = document.createElement("section");
      group.className = "catatan-tag-manager-group";
      const title = document.createElement("div");
      title.className = "catatan-tag-manager-heading";
      const strong = document.createElement("strong");
      strong.textContent = label;
      const count = document.createElement("span");
      count.textContent = String(items.length);
      title.append(strong, count);
      group.appendChild(title);

      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "catatan-tag-manager-empty is-inline";
        empty.textContent = label === "Tidak terpakai" ? "Semua tag sedang dipakai." : "Belum ada tag yang dipakai.";
        group.appendChild(empty);
      }

      items.forEach(item => {
        const row = document.createElement("div");
        row.className = "catatan-tag-manager-row";
        const copy = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = `#${item.name}`;
        const usage = document.createElement("small");
        usage.textContent = item.usageCount === 0 ? "Tidak terpakai" : `${item.usageCount} catatan`;
        copy.append(name, usage);
        row.appendChild(copy);

        if (item.canManage) {
          const del = document.createElement("button");
          del.type = "button";
          del.className = "catatan-tag-manager-delete";
          del.setAttribute("aria-label", `Hapus tag ${item.name}`);
          del.innerHTML = '<ion-icon name="trash-outline" aria-hidden="true"></ion-icon>';
          del.addEventListener("click", async () => {
            if (!tagManagerState || tagManagerState.busy) return;
            const usedCopy = item.usageCount > 0
              ? `#${item.name} dipakai di ${item.usageCount} catatan. Tag akan dilepas dari semua catatan tersebut, tetapi isi catatan tetap aman.`
              : `#${item.name} tidak dipakai catatan mana pun dan akan dihapus dari katalog.`;
            const ok = await confirmDanger({
              title: `Hapus #${item.name}?`,
              message: usedCopy,
              confirmLabel: "Hapus tag"
            });
            if (!ok || !tagManagerState) return;
            tagManagerState.busy = true;
            try {
              const usageCount = await window.NotesService.hapusTagCatalog(item.id);
              tagManagerState.notify?.(usageCount ? `#${item.name} dilepas dari ${usageCount} catatan.` : `#${item.name} dihapus.`);
              await refreshTagManager();
              await tagManagerState?.onChanged?.();
            } catch (error) {
              console.error("[Catatan Tag Delete]", error);
              tagManagerState?.notify?.(error?.message || "Tag belum dapat dihapus.");
            } finally {
              if (tagManagerState) tagManagerState.busy = false;
            }
          });
          row.appendChild(del);
        } else {
          const lock = document.createElement("ion-icon");
          lock.className = "catatan-tag-manager-lock";
          lock.setAttribute("name", "lock-closed-outline");
          lock.setAttribute("aria-label", "Hanya Family Owner yang dapat menghapus tag ini");
          row.appendChild(lock);
        }
        group.appendChild(row);
      });
      list.appendChild(group);
    };

    section("Dipakai", used);
    section("Tidak terpakai", unused);

    if (!state.items.length) {
      const empty = document.createElement("p");
      empty.className = "catatan-tag-manager-empty";
      empty.textContent = "Belum ada tag di katalog ini.";
      list.appendChild(empty);
    }
  }

  async function openTagManager({ scope = "personal", familyId = null, context = "Catatan Pribadi", onChanged = null, notify = null } = {}) {
    if (!window.NotesService?.ambilKelolaTagCatalog) {
      notify?.("Kelola tag belum siap — jalankan SQL 004K terlebih dahulu.");
      return;
    }
    const layer = ensureTagManagerLayer();
    const contextEl = layer.querySelector("[data-catatan-tag-manager-context]");
    if (contextEl) contextEl.textContent = clean(context, "Organisasi");
    tagManagerState = {
      scope: scope === "family" ? "family" : "personal",
      familyId: clean(familyId),
      items: [],
      busy: false,
      onChanged,
      notify
    };
    layer.hidden = false;
    await refreshTagManager();
  }

  document.addEventListener("click", event => {
    if (!activeMenu) return;
    if (event.target.closest?.(".catatan-card-shell.is-menu-open")) return;
    closeActiveMenu();
  });

  window.CatatanManagement = {
    createEmptyState,
    renderTagSummary,
    createPinIndicator,
    normalizeCardColor,
    cardColorLabel,
    applyCardColor,
    sortPinnedFirst,
    pickCardColor,
    askFolderName,
    pickFolder,
    openTagManager,
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
