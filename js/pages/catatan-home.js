(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let createScope = null;

  function clean(value, fallback = "") {
    const text = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!text || ["undefined", "null", "[object object]"].includes(text.toLowerCase())) return fallback;
    return text;
  }

  function initials(name) {
    const parts = clean(name, "A").split(" ").filter(Boolean);
    if (!parts.length) return "A";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
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

  function setupInteractions() {
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
        if (type === "Catatan Biasa") {
          location.href = `catatan-editor.html?scope=${encodeURIComponent(createScope || "personal")}`;
          return;
        }
        if (type === "Checklist") {
          location.href = `catatan-checklist.html?scope=${encodeURIComponent(createScope || "personal")}`;
          return;
        }
        showToast(`${type} di ${scopeLabel} akan aktif pada tahap berikutnya.`);
      });
    });

    qa("[data-open-scope]").forEach(button => {
      button.addEventListener("click", () => {
        if (button.dataset.openScope === "family") {
          location.href = "catatan-keluarga.html";
          return;
        }
        if (button.dataset.openScope === "personal") {
          location.href = "catatan-pribadi.html";
          return;
        }
      });
    });

    qa("[data-nav-placeholder]").forEach(button => {
      button.addEventListener("click", () => showToast(`${button.dataset.navPlaceholder} akan aktif bersama data Catatan.`));
    });

    const search = q("#catatan-global-search");
    search?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (clean(search.value)) showToast("Pencarian global akan aktif setelah backend Catatan tersedia.");
    });
  }

  function renderMembers(members, userId) {
    const section = q("[data-member-section]");
    const root = q("[data-member-list]");
    if (!section || !root) return;

    const others = (members || []).filter(item => item?.user_id && item.user_id !== userId);
    root.replaceChildren();

    if (!others.length) {
      section.hidden = true;
      return;
    }

    others.forEach(item => {
      const name = clean(item?.profile?.display_name, "Anggota");
      const card = document.createElement("button");
      card.type = "button";
      card.className = "catatan-member-card";
      card.dataset.memberId = item.user_id;

      const avatar = document.createElement("span");
      avatar.className = "catatan-member-avatar";
      avatar.textContent = initials(name);
      avatar.setAttribute("aria-hidden", "true");

      const copy = document.createElement("span");
      copy.className = "catatan-member-copy";
      const title = document.createElement("strong");
      title.textContent = `Catatan ${name}`;
      const meta = document.createElement("small");
      meta.textContent = `Ruang pribadi ${name}`;
      copy.append(title, meta);

      const chevron = document.createElement("ion-icon");
      chevron.setAttribute("name", "chevron-forward-outline");
      chevron.setAttribute("aria-hidden", "true");

      card.append(avatar, copy, chevron);
      card.addEventListener("click", () => {
        location.href = `catatan-anggota.html?member=${encodeURIComponent(item.user_id)}`;
      });
      root.appendChild(card);
    });

    section.hidden = false;
  }

  async function init() {
    setupInteractions();

    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }

    try {
      const [user, profile, family] = await Promise.all([
        AuthService.ambilUserAktif(),
        FamilyService.ambilProfilSaya(),
        AuthRouter.ambilFamilyAktif()
      ]);

      if (!user || !family) return;

      const familyName = clean(family.name, "keluarga");
      const personalName = clean(profile?.display_name, "kamu");
      const familyMeta = q("[data-family-note-meta]");
      const personalMeta = q("[data-personal-note-meta]");
      if (familyMeta) familyMeta.textContent = `Ruang bersama ${familyName}`;
      if (personalMeta) personalMeta.textContent = `Ruang pribadi ${personalName}`;

      try {
        const members = await FamilyService.ambilAnggotaKeluarga(family.id);
        renderMembers(members, user.id);
      } catch (error) {
        console.warn("[Catatan Home members]", error);
        renderMembers([], user.id);
      }
    } catch (error) {
      console.error("[Catatan Home]", error);
    } finally {
      q("[data-catatan-home]")?.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
