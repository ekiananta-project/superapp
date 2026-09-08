(() => {
  "use strict";

  const client = window.supabaseClient;
  const input = document.querySelector("[data-input-foto]");
  const pilih = document.querySelector("[data-pilih-foto]");
  const hapus = document.querySelector("[data-hapus-foto]");
  const notice = document.querySelector("[data-notifikasi]");
  const previewTrigger = document.querySelector("[data-avatar-preview-trigger]");
  const previewLayer = document.querySelector("[data-profile-photo-preview]");
  const previewImage = document.querySelector("[data-profile-photo-preview-image]");
  const previewName = document.querySelector("[data-profile-photo-preview-name]");
  const previewClose = document.querySelector("[data-profile-photo-preview-close]");

  if (!client || !input || !pilih || !hapus) return;

  const BUCKET = "profile-avatars";
  const MAX_SOURCE = 12 * 1024 * 1024;
  const SIZE = 512;
  let currentPath = null;
  let currentUrl = "";
  let currentName = "Pengguna";
  let timer = null;

  function show(text, type = "info") {
    if (!notice) {
      if (type === "error") alert(text);
      return;
    }
    clearTimeout(timer);
    notice.textContent = text;
    notice.dataset.tipe = type;
    notice.hidden = false;
    timer = setTimeout(() => { notice.hidden = true; }, 3500);
  }

  async function userAktif() {
    if (window.AUTH_READY) {
      const ok = await window.AUTH_READY;
      if (ok === false) throw new Error("Session login tidak tersedia.");
    }
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error("User belum login.");
    return data.user;
  }

  function publicUrl(path, version = "") {
    if (!path) return "";
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    const url = data?.publicUrl || "";
    if (!url) return "";
    const token = String(version || Date.now()).trim();
    return `${url}?v=${encodeURIComponent(token)}`;
  }

  async function decodeImage(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (_) {}
    }

    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Format foto tidak didukung perangkat ini."));
      };
      img.src = url;
    });
  }

  async function toAvatarBlob(file) {
    const image = await decodeImage(file);
    const w = image.width || image.naturalWidth;
    const h = image.height || image.naturalHeight;
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = (h - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#0B0D0C";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(image, sx, sy, side, side, 0, 0, SIZE, SIZE);

    if (typeof image.close === "function") image.close();

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/webp", 0.84)
    );

    if (blob) return { blob, ext: "webp", contentType: "image/webp" };

    const jpeg = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg", 0.86)
    );
    if (!jpeg) throw new Error("Foto gagal dikompresi.");
    return { blob: jpeg, ext: "jpg", contentType: "image/jpeg" };
  }

  function syncPreviewTrigger() {
    if (!previewTrigger) return;

    const canPreview = Boolean(currentUrl);
    previewTrigger.classList.toggle("avatar-profil-previewable", canPreview);

    if (canPreview) {
      previewTrigger.setAttribute("role", "button");
      previewTrigger.setAttribute("tabindex", "0");
      previewTrigger.setAttribute("aria-label", `Lihat foto profil ${currentName}`);
    } else {
      previewTrigger.removeAttribute("role");
      previewTrigger.removeAttribute("tabindex");
      previewTrigger.removeAttribute("aria-label");
    }
  }

  function applyAvatar(url, name = "Pengguna") {
    currentUrl = String(url || "");
    currentName = String(name || "Pengguna").trim() || "Pengguna";

    document.querySelectorAll("[data-avatar-pengguna]").forEach(el => {
      el.classList.add("avatar-pengguna");
      el.replaceChildren();
      if (currentUrl) {
        const img = document.createElement("img");
        img.className = "avatar-pengguna-gambar";
        img.src = currentUrl;
        img.alt = `Foto profil ${currentName}`;
        el.appendChild(img);
      } else {
        const icon = document.createElement("ion-icon");
        icon.className = "avatar-pengguna-icon";
        icon.setAttribute("name", "person-outline");
        icon.setAttribute("aria-hidden", "true");
        el.appendChild(icon);
      }
    });

    syncPreviewTrigger();
  }

  function openPreview() {
    if (!currentUrl || !previewLayer || !previewImage) return;
    previewImage.src = currentUrl;
    previewImage.alt = `Foto profil ${currentName}`;
    if (previewName) previewName.textContent = currentName;
    previewLayer.hidden = false;
    document.body.classList.add("profile-photo-preview-open");
  }

  function closePreview() {
    if (!previewLayer) return;
    previewLayer.hidden = true;
    document.body.classList.remove("profile-photo-preview-open");
    if (previewImage) previewImage.removeAttribute("src");
  }

  function profileResult(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  async function load() {
    try {
      const user = await userAktif();
      const { data: profile, error } = await client
        .from("profiles")
        .select("display_name,avatar_path,updated_at")
        .eq("id", user.id)
        .single();
      if (error) throw error;

      currentPath = profile?.avatar_path || null;
      hapus.hidden = !currentPath;
      applyAvatar(publicUrl(currentPath, profile?.updated_at), profile?.display_name || "Pengguna");
    } catch (error) {
      console.error("[Avatar load]", error);
    }
  }

  async function upload(file) {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      show("Pilih file gambar dari galeri atau kamera.", "error");
      return;
    }
    if (file.size > MAX_SOURCE) {
      show("Ukuran foto maksimal 12 MB.", "error");
      return;
    }

    pilih.disabled = true;
    pilih.textContent = "Memproses foto...";

    try {
      const user = await userAktif();
      const output = await toAvatarBlob(file);
      const previousPath = currentPath;
      const version = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const path = `${user.id}/avatar-${version}.${output.ext}`;

      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(path, output.blob, {
          upsert: false,
          contentType: output.contentType,
          cacheControl: "3600"
        });
      if (uploadError) throw uploadError;

      const changedAt = new Date().toISOString();
      const { data: profileRaw, error: profileError } = await client.rpc(
        "profile_set_avatar_path",
        { p_path: path }
      );

      if (profileError) {
        await client.storage.from(BUCKET).remove([path]).catch(() => {});
        throw profileError;
      }

      const profile = profileResult(profileRaw);
      if (!profile?.avatar_path) {
        await client.storage.from(BUCKET).remove([path]).catch(() => {});
        throw new Error("Backend belum mengembalikan avatar_path terbaru.");
      }

      currentPath = profile.avatar_path;
      hapus.hidden = false;
      const url = publicUrl(currentPath, profile.updated_at || changedAt);
      applyAvatar(url, profile.display_name || currentName || "Pengguna");

      if (previousPath && previousPath !== currentPath) {
        client.storage.from(BUCKET).remove([previousPath]).catch(error => {
          console.warn("[Avatar old object cleanup]", error);
        });
      }

      window.dispatchEvent(new CustomEvent("profil-pengguna-berubah", {
        detail: {
          avatar_path: currentPath,
          avatar_url: url,
          updated_at: profile.updated_at || changedAt
        }
      }));
      show("Foto profil diperbarui.", "success");
    } catch (error) {
      console.error("[Avatar upload]", error);
      show(error?.message || "Foto profil gagal disimpan.", "error");
    } finally {
      pilih.disabled = false;
      pilih.innerHTML = '<ion-icon name="camera-outline"></ion-icon> Ubah Foto';
      input.value = "";
    }
  }

  pilih.addEventListener("click", () => input.click());
  input.addEventListener("change", () => upload(input.files?.[0]));

  hapus.addEventListener("click", async () => {
    if (!currentPath) return;
    if (!confirm("Hapus foto profil?")) return;

    hapus.disabled = true;
    try {
      await userAktif();
      const path = currentPath;
      const changedAt = new Date().toISOString();

      const { data: profileRaw, error: profileError } = await client.rpc(
        "profile_set_avatar_path",
        { p_path: null }
      );
      if (profileError) throw profileError;

      const profile = profileResult(profileRaw);
      currentPath = null;
      hapus.hidden = true;
      closePreview();
      applyAvatar("", profile?.display_name || currentName || "Pengguna");

      client.storage.from(BUCKET).remove([path]).catch(error => {
        console.warn("[Avatar deleted object cleanup]", error);
      });

      window.dispatchEvent(new CustomEvent("profil-pengguna-berubah", {
        detail: {
          avatar_path: null,
          avatar_url: "",
          updated_at: profile?.updated_at || changedAt
        }
      }));
      show("Foto profil dihapus.", "success");
    } catch (error) {
      console.error("[Avatar delete]", error);
      show(error?.message || "Foto profil gagal dihapus.", "error");
    } finally {
      hapus.disabled = false;
    }
  });

  previewTrigger?.addEventListener("click", openPreview);
  previewTrigger?.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && currentUrl) {
      event.preventDefault();
      openPreview();
    }
  });
  previewClose?.addEventListener("click", closePreview);
  previewLayer?.addEventListener("click", event => {
    if (event.target === previewLayer) closePreview();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && previewLayer && !previewLayer.hidden) {
      closePreview();
    }
  });

  window.addEventListener("profil-pengguna-berubah", event => {
    const nama = String(event.detail?.display_name || "").trim();
    if (!nama) return;
    currentName = nama;
    if (previewName) previewName.textContent = currentName;
    syncPreviewTrigger();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
