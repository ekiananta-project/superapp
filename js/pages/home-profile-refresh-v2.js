(() => {
  "use strict";

  const client = window.supabaseClient;
  if (!client) return;

  function clean(value) {
    const name = String(value ?? "").trim().replace(/\s+/g, " ");
    return ["", "undefined", "null", "[object object]"]
      .includes(name.toLowerCase()) ? "" : name;
  }

  async function syncName() {
    const target = document.querySelector("[data-nama-pengguna]");
    if (!target) return;

    try {
      if (window.AUTH_READY) {
        const ok = await window.AUTH_READY;
        if (ok === false) return;
      }

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) return;

      const { data: profile, error } = await client
        .from("profiles")
        .select("display_name")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (error) throw error;

      const displayName = clean(profile?.display_name);
      if (displayName) target.textContent = displayName;
    } catch (error) {
      console.warn("[Home Profile Refresh V2]", error);
    }
  }

  document.addEventListener("DOMContentLoaded", syncName);
  window.addEventListener("pageshow", syncName);
  window.addEventListener("focus", syncName);

  window.addEventListener("profil-pengguna-berubah", event => {
    const target = document.querySelector("[data-nama-pengguna]");
    const displayName = clean(event?.detail?.display_name);
    if (target && displayName) target.textContent = displayName;
  });
})();
