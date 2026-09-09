(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let createScope = null;
  let memberName = "Anggota";

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

  function setCreateStep(step) {
    qa("[data-create-step]").forEach(el => { el.hidden = el.dataset.createStep !== step; });
    const title = q("[data-create-title]");
    if (title) title.textContent = step === "scope" ? "Pilih ruang catatan" : "Pilih jenis catatan";
  }

  function openCreateSheet() {
    createScope = null;
    setCreateStep("scope");
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = false;
  }

  function closeCreateSheet() {
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = true;
    createScope = null;
  }

  function filterPreview() {
    const input = q("#catatan-member-search");
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

  function applyMemberName(name) {
    memberName = clean(name, "Anggota");
    const title = q("[data-member-page-title]");
    const titleName = q("[data-member-page-name]");
    const search = q("#catatan-member-search");
    const empty = q("[data-member-empty-copy]");
    if (titleName) titleName.textContent = memberName;
    if (title) title.setAttribute("aria-label", `Catatan anggota ${memberName}`);
    if (search) {
      search.placeholder = `Cari di Catatan ${memberName}...`;
      search.setAttribute("aria-label", `Cari di Catatan ${memberName}`);
    }
    if (empty) empty.textContent = `Coba kata kunci lain di Catatan ${memberName}.`;
    document.title = `Catatan ${memberName} · RuangKitha`;
  }

  function setupInteractions() {
    qa("[data-preview-item]").forEach(item => {
      item.addEventListener("click", () => {
        showToast(item.classList.contains("catatan-folder-card")
          ? `Folder ${memberName} dibuka dalam mode hanya baca.`
          : `Catatan ${memberName} dibuka dalam mode hanya baca.`);
      });
    });

    q("#catatan-member-search")?.addEventListener("input", filterPreview);
    q("[data-create-note]")?.addEventListener("click", openCreateSheet);
    q("[data-create-close]")?.addEventListener("click", closeCreateSheet);
    q("[data-create-layer]")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeCreateSheet();
    });

    qa("[data-create-scope]").forEach(button => {
      button.addEventListener("click", () => {
        createScope = button.dataset.createScope;
        setCreateStep("type");
      });
    });

    qa("[data-create-type]").forEach(button => {
      button.addEventListener("click", () => {
        const scopeLabel = createScope === "family" ? "Catatan Keluarga" : "Catatan Pribadi";
        const type = button.dataset.createType || "Catatan";
        closeCreateSheet();
        showToast(`${type} di ${scopeLabel} akan aktif saat editor Catatan dibangun.`);
      });
    });

    qa("[data-nav-placeholder]").forEach(button => {
      button.addEventListener("click", () => showToast(`${button.dataset.navPlaceholder} akan aktif bersama data Catatan.`));
    });
  }

  async function init() {
    setupInteractions();

    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }

    try {
      const memberId = clean(new URLSearchParams(location.search).get("member"));
      const [user, family] = await Promise.all([
        AuthService.ambilUserAktif(),
        AuthRouter.ambilFamilyAktif()
      ]);
      if (!user || !family) return;

      if (!memberId) {
        location.replace("catatan.html");
        return;
      }
      if (memberId === user.id) {
        location.replace("catatan-pribadi.html");
        return;
      }

      const members = await FamilyService.ambilAnggotaKeluarga(family.id);
      const member = (members || []).find(item => item?.user_id === memberId);
      if (!member) {
        location.replace("catatan.html");
        return;
      }

      applyMemberName(member?.profile?.display_name);
    } catch (error) {
      console.error("[Catatan Member]", error);
      showToast("Ruang catatan anggota tidak dapat dimuat.");
    } finally {
      q("[data-catatan-member]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
