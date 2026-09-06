(() => {
  "use strict";

  const client = window.supabaseClient;
  if (!client) return;

  const BUCKET = "profile-avatars";
  let syncInFlight = null;
  let lastUserId = null;
  let retryTimer = null;

  function clean(value) {
    const name = String(value ?? "").trim().replace(/\s+/g, " ");
    return ["", "undefined", "null", "[object object]"]
      .includes(name.toLowerCase()) ? "" : name;
  }

  function avatarPublicUrl(path) {
    if (!path) return "";
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    const raw = data?.publicUrl || "";
    if (!raw) return "";
    const joiner = raw.includes("?") ? "&" : "?";
    return `${raw}${joiner}v=${Date.now()}`;
  }

  function fallbackAvatar(el) {
    if (!el) return;
    el.classList.add("avatar-pengguna");
    el.replaceChildren();
    const icon = document.createElement("ion-icon");
    icon.className = "avatar-pengguna-icon";
    icon.setAttribute("name", "person-outline");
    icon.setAttribute("aria-hidden", "true");
    el.appendChild(icon);
  }

  function renderAvatar(path, displayName) {
    const el = document.querySelector("[data-avatar-pengguna]");
    if (!el) return;

    const url = avatarPublicUrl(path);
    if (!url) {
      fallbackAvatar(el);
      return;
    }

    el.classList.add("avatar-pengguna");
    el.replaceChildren();

    const img = document.createElement("img");
    img.className = "avatar-pengguna-gambar";
    img.alt = `Foto profil ${displayName || "Pengguna"}`;
    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
    img.addEventListener("error", () => fallbackAvatar(el), { once: true });
    el.appendChild(img);
  }

  function renderProfile(profile, user) {
    const displayName =
      clean(profile?.display_name) ||
      clean(user?.user_metadata?.display_name) ||
      "Pengguna";

    const nameTarget = document.querySelector("[data-nama-pengguna]");
    if (nameTarget) nameTarget.textContent = displayName;

    renderAvatar(profile?.avatar_path || null, displayName);
  }

  async function sync({ retry = true } = {}) {
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
      try {
        if (window.AUTH_READY) {
          const ok = await window.AUTH_READY;
          if (ok === false) return false;
        }

        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;

        const user = authData?.user;
        if (!user) return false;
        lastUserId = user.id;

        const { data: profile, error } = await client
          .from("profiles")
          .select("display_name,avatar_path")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        renderProfile(profile || {}, user);

        // Sinkronkan cache komponen avatar lain bila tersedia.
        if (window.AvatarAplikasi?.loadBackend) {
          window.AvatarAplikasi.loadBackend({ force: true }).catch(() => {});
        }

        return true;
      } catch (error) {
        console.warn("[Home Profile Sync V3]", error);
        if (retry) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => sync({ retry: false }), 900);
        }
        return false;
      } finally {
        syncInFlight = null;
      }
    })();

    return syncInFlight;
  }

  document.addEventListener("DOMContentLoaded", () => sync());
  window.addEventListener("pageshow", () => sync());
  window.addEventListener("focus", () => sync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sync();
  });

  window.addEventListener("profil-pengguna-berubah", event => {
    const detail = event?.detail || {};
    const target = document.querySelector("[data-nama-pengguna]");
    const displayName = clean(detail.display_name);
    if (target && displayName) target.textContent = displayName;

    if (detail.avatar_path !== undefined) {
      renderAvatar(detail.avatar_path, displayName || target?.textContent || "Pengguna");
    } else {
      sync();
    }
  });
})();
