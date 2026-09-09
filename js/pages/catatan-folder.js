(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let scope = "";
  let folderName = "Folder";
  let memberName = "Anggota";
  let memberId = "";
  let createScope = null;

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
    if (title) title.textContent = step === "scope" ? "Pilih ruang catatan" : "Apa yang ingin dibuat?";
  }

  function openCreateSheet() {
    createScope = null;
    setCreateStep(scope === "member" ? "scope" : "type");
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = false;
  }

  function closeCreateSheet() {
    const layer = q("[data-create-layer]");
    if (layer) layer.hidden = true;
    createScope = null;
  }

  function filterPreview() {
    const input = q("#catatan-folder-search");
    const needle = clean(input?.value).toLocaleLowerCase("id-ID");
    const items = qa("[data-folder-note]");
    let visible = 0;

    items.forEach(item => {
      const haystack = clean(item.dataset.searchText).toLocaleLowerCase("id-ID");
      const show = !needle || haystack.includes(needle);
      item.hidden = !show;
      if (show) visible += 1;
    });

    const empty = q("[data-search-empty]");
    if (empty) empty.hidden = !needle || visible > 0;
  }

  function applyBaseContext() {
    const title = q("[data-folder-area-title]");
    const back = q("[data-folder-back]");
    const folder = q("[data-folder-name]");
    const search = q("#catatan-folder-search");
    const empty = q("[data-folder-empty-copy]");
    const context = q("[data-create-context]");

    if (folder) folder.textContent = folderName;
    if (search) {
      search.placeholder = `Cari di folder ${folderName}...`;
      search.setAttribute("aria-label", `Cari di folder ${folderName}`);
    }
    if (empty) empty.textContent = `Coba kata kunci lain di folder ${folderName}.`;
    if (context) context.textContent = `Folder ${folderName}`;

    if (scope === "family") {
      if (title) title.textContent = "Catatan Keluarga";
      if (back) back.href = "catatan-keluarga.html";
      document.title = `${folderName} · Catatan Keluarga · RuangKitha`;
    } else if (scope === "personal") {
      if (title) title.textContent = "Catatan Pribadi";
      if (back) back.href = "catatan-pribadi.html";
      document.title = `${folderName} · Catatan Pribadi · RuangKitha`;
      const access = qa("[data-folder-access]");
      access.forEach((el, index) => {
        el.textContent = index % 2 === 0 ? "Hanya Saya" : "Keluarga dapat melihat";
        el.classList.add("catatan-note-access");
      });
    }
  }

  function applyMemberContext(name) {
    memberName = clean(name, "Anggota");
    const title = q("[data-folder-area-title]");
    const memberWrap = q("[data-folder-member-container]");
    const member = q("[data-folder-member-name]");
    const back = q("[data-folder-back]");
    const context = q("[data-create-context]");

    if (title) title.textContent = "Catatan";
    if (memberWrap) memberWrap.hidden = false;
    if (member) member.textContent = memberName;
    if (back) back.href = `catatan-anggota.html?member=${encodeURIComponent(memberId)}`;
    if (context) context.textContent = `Melihat folder ${folderName}`;

    qa("[data-folder-access]").forEach(el => {
      el.textContent = "Keluarga dapat melihat · Hanya baca";
      el.classList.add("catatan-note-access");
    });

    document.title = `${folderName} · Catatan ${memberName} · RuangKitha`;
  }

  function setupInteractions() {
    q("#catatan-folder-search")?.addEventListener("input", filterPreview);

    qa("[data-folder-note]").forEach(item => {
      item.addEventListener("click", () => {
        showToast(scope === "member"
          ? `Catatan ${memberName} dibuka dalam mode hanya baca.`
          : "Editor Catatan akan aktif pada tahap berikutnya.");
      });
    });

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
        const type = button.dataset.createType || "Catatan";
        if (scope === "member") {
          const destination = createScope === "family" ? "Catatan Keluarga" : "Catatan Pribadi";
          closeCreateSheet();
          if (type === "Catatan Biasa") {
            location.href = `catatan-editor.html?scope=${encodeURIComponent(createScope || "personal")}`;
            return;
          }
          if (type === "Checklist") {
            location.href = `catatan-checklist.html?scope=${encodeURIComponent(createScope || "personal")}`;
            return;
          }
          showToast(`${type} di ${destination} akan aktif pada tahap berikutnya.`);
          return;
        }
        closeCreateSheet();
        if (type === "Catatan Biasa") {
          location.href = `catatan-editor.html?scope=${encodeURIComponent(scope)}&folder=${encodeURIComponent(folderName)}`;
          return;
        }
        if (type === "Checklist") {
          location.href = `catatan-checklist.html?scope=${encodeURIComponent(scope)}&folder=${encodeURIComponent(folderName)}`;
          return;
        }
        showToast(`${type} akan dibuat langsung di folder ${folderName} pada tahap berikutnya.`);
      });
    });

    qa("[data-nav-placeholder]").forEach(button => {
      button.addEventListener("click", () => showToast(`${button.dataset.navPlaceholder} akan aktif bersama data Catatan.`));
    });
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    scope = clean(params.get("scope")).toLowerCase();
    folderName = clean(params.get("folder"), "Folder");
    memberId = clean(params.get("member"));

    if (!["family", "personal", "member"].includes(scope) || !clean(params.get("folder"))) {
      location.replace("catatan.html");
      return;
    }

    setupInteractions();
    applyBaseContext();

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

      if (scope === "member") {
        if (!memberId) {
          location.replace("catatan.html");
          return;
        }
        if (memberId === user.id) {
          location.replace(`catatan-folder.html?scope=personal&folder=${encodeURIComponent(folderName)}`);
          return;
        }

        const members = await FamilyService.ambilAnggotaKeluarga(family.id);
        const member = (members || []).find(item => item?.user_id === memberId);
        if (!member) {
          location.replace("catatan.html");
          return;
        }
        applyMemberContext(member?.profile?.display_name);
      }
    } catch (error) {
      console.error("[Catatan Folder]", error);
      showToast("Folder Catatan tidak dapat dimuat.");
    } finally {
      q("[data-catatan-folder]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
