(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;

  function clean(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
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
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = false;
  }

  function closeCreateSheet() {
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = true;
  }

  function filterPreview() {
    const input = q("#catatan-family-search");
    const needle = clean(input?.value).toLocaleLowerCase("id-ID");
    const items = qa("[data-preview-item]");
    let visibleNotes = 0;

    items.forEach(item => {
      const haystack = clean(item.dataset.searchText).toLocaleLowerCase("id-ID");
      const visible = !needle || haystack.includes(needle);
      item.hidden = !visible;
      if (visible && item.classList.contains("catatan-note-card")) visibleNotes += 1;
    });

    const empty = q("[data-search-empty]");
    if (empty) empty.hidden = !needle || visibleNotes > 0;
  }

  function setupInteractions() {
    q("[data-add-folder]")?.addEventListener("click", () => {
      showToast("Tambah Folder akan aktif saat backend Catatan dibangun.");
    });

    qa("[data-preview-item]").forEach(item => {
      item.addEventListener("click", () => {
        if (item.classList.contains("catatan-folder-card")) {
          const folder = clean(item.dataset.folderName || item.querySelector("strong")?.textContent);
          if (folder) {
            location.href = `catatan-folder.html?scope=family&folder=${encodeURIComponent(folder)}`;
            return;
          }
        }
        showToast("Editor Catatan akan aktif pada tahap berikutnya.");
      });
    });

    const search = q("#catatan-family-search");
    search?.addEventListener("input", filterPreview);

    q("[data-create-note]")?.addEventListener("click", openCreateSheet);
    q("[data-create-close]")?.addEventListener("click", closeCreateSheet);
    q("[data-create-layer]")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeCreateSheet();
    });

    qa("[data-create-type]").forEach(button => {
      button.addEventListener("click", () => {
        const type = button.dataset.createType || "Catatan";
        closeCreateSheet();
        showToast(`${type} Keluarga akan aktif saat editor Catatan dibangun.`);
      });
    });

    qa("[data-nav-placeholder]").forEach(button => {
      button.addEventListener("click", () => {
        showToast(`${button.dataset.navPlaceholder} akan aktif bersama data Catatan.`);
      });
    });
  }

  async function init() {
    setupInteractions();

    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }

    try {
      const family = await AuthRouter.ambilFamilyAktif();
      if (!family) return;
    } catch (error) {
      console.error("[Catatan Family]", error);
    } finally {
      q("[data-catatan-family]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
