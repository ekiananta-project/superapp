(() => {
  "use strict";

  const client = window.supabaseClient;
  const form = document.querySelector("[data-form-pengaturan]");
  const preview = document.querySelector("[data-nama-profil-preview]");
  const notice = document.querySelector("[data-notifikasi]");

  if (!client || !form?.elements?.nama) {
    console.error("[Profile V2] Supabase/form tidak tersedia.");
    return;
  }

  const input = form.elements.nama;
  const submit = form.querySelector('[type="submit"]');
  let noticeTimer = null;
  let loadingPromise = null;

  function clean(value) {
    const name = String(value ?? "").trim().replace(/\s+/g, " ");
    const invalid = ["", "undefined", "null", "[object object]"];
    return invalid.includes(name.toLowerCase()) ? "" : name;
  }

  function show(text, type = "info") {
    if (!notice) {
      if (type === "error") console.error("[Profile V2]", text);
      return;
    }

    clearTimeout(noticeTimer);
    notice.textContent = text;
    notice.dataset.tipe = type;
    notice.hidden = false;

    noticeTimer = setTimeout(() => {
      notice.hidden = true;
    }, 3500);
  }

  function mirrorLegacy(displayName) {
    // Hanya mirror kompatibilitas. BUKAN sumber kebenaran.
    try {
      const key = "keuangan_pengaturan_v1";
      const data = JSON.parse(localStorage.getItem(key) || "{}");
      data.nama = displayName;
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn("[Profile V2] Legacy mirror gagal", error);
    }
  }

  function applyName(value) {
    const displayName = clean(value);
    if (!displayName) return false;

    input.value = displayName;
    if (preview) preview.textContent = displayName;
    mirrorLegacy(displayName);

    window.dispatchEvent(
      new CustomEvent("profil-pengguna-berubah", {
        detail: { display_name: displayName }
      })
    );

    return true;
  }

  async function waitAuth() {
    if (window.AUTH_READY) {
      const ok = await window.AUTH_READY;
      if (ok === false) throw new Error("Session login tidak tersedia.");
    }

    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error("User belum login.");
    return data.user;
  }

  async function readProfile() {
    const user = await waitAuth();

    const { data: profile, error } = await client
      .from("profiles")
      .select("id,display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    let displayName = clean(profile?.display_name);

    // Repair hanya bila row/nama lama kosong atau invalid.
    if (!displayName) {
      const fallback =
        clean(user.user_metadata?.display_name) ||
        clean(String(user.email || "").split("@")[0]);

      if (!fallback) {
        throw new Error("profiles.display_name masih kosong.");
      }

      if (profile?.id) {
        const { data: repaired, error: repairError } = await client
          .from("profiles")
          .update({ display_name: fallback })
          .eq("id", user.id)
          .select("id,display_name")
          .single();

        if (repairError) throw repairError;
        displayName = clean(repaired?.display_name);
      } else {
        const { data: inserted, error: insertError } = await client
          .from("profiles")
          .insert({ id: user.id, display_name: fallback })
          .select("id,display_name")
          .single();

        if (insertError) throw insertError;
        displayName = clean(inserted?.display_name);
      }
    }

    if (!applyName(displayName)) {
      throw new Error("Nama profil Supabase tidak valid.");
    }

    return displayName;
  }

  async function loadProfile({ silent = false } = {}) {
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      try {
        return await readProfile();
      } catch (error) {
        console.error("[Profile V2 - Load]", error);
        if (!silent) {
          show(error?.message || "Nama profil gagal dimuat dari Supabase.", "error");
        }
        throw error;
      } finally {
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }

  async function saveProfile(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const displayName = clean(input.value);
    if (displayName.length < 2) {
      show("Nama pengguna minimal 2 karakter.", "error");
      return;
    }

    if (submit) submit.disabled = true;

    try {
      const user = await waitAuth();

      // profiles.display_name = SINGLE SOURCE OF TRUTH
      const { data: profile, error } = await client
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", user.id)
        .select("id,display_name")
        .maybeSingle();

      if (error) throw error;
      if (!profile) {
        throw new Error("Profil Supabase tidak ditemukan untuk akun ini.");
      }

      const savedName = clean(profile.display_name);
      if (!savedName) {
        throw new Error("Supabase mengembalikan nama profil kosong.");
      }

      // Auth metadata hanya mirror; kegagalan di sini tidak membatalkan profile.
      try {
        const { error: authError } = await client.auth.updateUser({
          data: {
            ...(user.user_metadata || {}),
            display_name: savedName
          }
        });
        if (authError) console.warn("[Profile V2 - Auth mirror]", authError);
      } catch (errorMirror) {
        console.warn("[Profile V2 - Auth mirror]", errorMirror);
      }

      applyName(savedName);
      show("Nama profil disimpan.", "success");
    } catch (error) {
      console.error("[Profile V2 - Save]", error);
      show(error?.message || "Nama profil gagal disimpan.", "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  /*
   * Dipasang SEKARANG dalam capture phase, sebelum handler legacy app.js
   * mendapat kesempatan memproses submit.
   */
  form.addEventListener("submit", saveProfile, true);

  /* Jika app.js menaruh onsubmit legacy, matikan setelah DOM ready. */
  function neutralizeLegacy() {
    form.onsubmit = null;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      neutralizeLegacy();
      loadProfile().catch(() => {});
      setTimeout(neutralizeLegacy, 0);
    }, { once: true });
  } else {
    neutralizeLegacy();
    loadProfile().catch(() => {});
    setTimeout(neutralizeLegacy, 0);
  }

  // Kembali dari Home/bfcache tetap baca ulang langsung dari Supabase.
  window.addEventListener("pageshow", () => {
    loadProfile({ silent: true }).catch(() => {});
  });
})();
