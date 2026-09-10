(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  let activeMenu = null;
  let confirmResolve = null;
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

  document.addEventListener("click", event => {
    if (!activeMenu) return;
    if (event.target.closest?.(".catatan-card-shell.is-menu-open")) return;
    closeActiveMenu();
  });

  window.CatatanManagement = {
    createEmptyState,
    renderTagSummary,
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
