(() => {
  "use strict";

  const BUCKET = "profile-avatars";
  let profileCache = null;
  let loadPromise = null;

  function inisial(nama) {
    return String(nama || "?")
      .trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(kata => kata[0]?.toUpperCase() || "").join("") || "?";
  }

  function publicUrl(path) {
    if (!path || !window.supabaseClient) return "";
    const { data } = window.supabaseClient.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || "";
  }

  function render(elemen, profile = profileCache, opsi = {}) {
    if (!elemen) return;
    const fallback = opsi.fallback || elemen.dataset.avatarFallback || "icon";
    const nama = profile?.display_name || profile?.nama || "Pengguna";
    const foto = profile?.avatar_url || publicUrl(profile?.avatar_path) || profile?.fotoProfil || "";

    elemen.classList.add("avatar-pengguna");
    elemen.replaceChildren();

    if (foto) {
      const img = document.createElement("img");
      img.className = "avatar-pengguna-gambar";
      img.src = foto;
      img.alt = `Foto profil ${nama}`;
      elemen.appendChild(img);
      return;
    }

    if (fallback === "initials") {
      const span = document.createElement("span");
      span.className = "avatar-pengguna-inisial";
      span.textContent = inisial(nama);
      span.setAttribute("aria-label", `Avatar ${nama}`);
      elemen.appendChild(span);
      return;
    }

    const icon = document.createElement("ion-icon");
    icon.className = "avatar-pengguna-icon";
    icon.setAttribute("name", "person-outline");
    icon.setAttribute("aria-hidden", "true");
    elemen.appendChild(icon);
  }

  function renderSemua(profile = profileCache) {
    document.querySelectorAll("[data-avatar-pengguna]").forEach(el => render(el, profile));
  }

  async function loadBackend({ force = false } = {}) {
    if (!window.supabaseClient) {
      renderSemua();
      return null;
    }
    if (loadPromise && !force) return loadPromise;

    loadPromise = (async () => {
      try {
        if (window.AUTH_READY) {
          const ok = await window.AUTH_READY;
          if (ok === false) return null;
        }
        const { data: authData } = await window.supabaseClient.auth.getUser();
        const user = authData?.user;
        if (!user) return null;

        const { data, error } = await window.supabaseClient
          .from("profiles")
          .select("display_name,avatar_path")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;

        profileCache = data || { display_name: user.user_metadata?.display_name || "Pengguna", avatar_path: null };
        renderSemua(profileCache);
        return profileCache;
      } catch (error) {
        console.warn("[Avatar backend]", error);
        renderSemua(profileCache);
        return null;
      } finally {
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  window.AvatarAplikasi = {
    inisial,
    render,
    renderPenggunaAktif: () => renderSemua(profileCache),
    loadBackend
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => loadBackend(), { once: true });
  } else {
    loadBackend();
  }

  window.addEventListener("profil-pengguna-berubah", event => {
    const detail = event?.detail || {};
    if (detail.avatar_path !== undefined || detail.avatar_url !== undefined || detail.display_name !== undefined) {
      profileCache = { ...(profileCache || {}), ...detail };
      renderSemua(profileCache);
    } else {
      loadBackend({ force: true });
    }
  });

  window.addEventListener("pageshow", () => loadBackend({ force: true }));
})();
