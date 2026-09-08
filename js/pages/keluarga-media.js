(() => {
  "use strict";

  const familyPhotoButton = document.querySelector("[data-family-photo-preview]");
  const familyPhotoVisual = document.querySelector("[data-family-photo-visual]");
  const familyPhotoEdit = document.querySelector("[data-family-photo-edit]");
  const familyPhotoInput = document.querySelector("[data-family-photo-input]");

  const previewLayer = document.querySelector("[data-media-preview]");
  const previewImage = document.querySelector("[data-media-preview-image]");
  const previewFallback = document.querySelector("[data-media-preview-fallback]");
  const previewTitle = document.querySelector("[data-media-preview-title]");
  const previewSubtitle = document.querySelector("[data-media-preview-subtitle]");
  const familyOwnerActions = document.querySelector("[data-family-photo-owner-actions]");
  const familyPhotoChange = document.querySelector("[data-family-photo-change]");
  const familyPhotoDelete = document.querySelector("[data-family-photo-delete]");

  if (!familyPhotoButton || !familyPhotoVisual || !previewLayer) return;

  const MAX_SOURCE = 12 * 1024 * 1024;
  const OUTPUT_SIZE = 1024;

  let family = null;
  let user = null;
  let members = [];
  let familyPhotoUrl = "";
  let previewMode = "";
  let busy = false;

  const clean = value => String(value || "").trim();

  function isOwner() {
    return family?.membership?.role === "owner";
  }

  function showNotice(text, type = "info") {
    const notice = document.querySelector("[data-notifikasi-keluarga]");
    if (!notice) {
      if (type === "error") alert(text);
      return;
    }

    notice.textContent = text;
    notice.dataset.tipe = type;
    notice.hidden = false;
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => {
      notice.hidden = true;
    }, 3500);
  }

  function renderFamilyPhoto() {
    familyPhotoVisual.replaceChildren();

    if (familyPhotoUrl) {
      const img = document.createElement("img");
      img.src = familyPhotoUrl;
      img.alt = `Foto ${family?.name || "Ruang Keluarga"}`;
      img.className = "foto-keluarga-gambar";
      img.loading = "eager";
      familyPhotoVisual.appendChild(img);
      familyPhotoButton.disabled = false;
      familyPhotoButton.setAttribute("aria-label", "Lihat foto Ruang Keluarga");
    } else {
      const icon = document.createElement("ion-icon");
      icon.setAttribute("name", "people-outline");
      icon.setAttribute("aria-hidden", "true");
      familyPhotoVisual.appendChild(icon);
      familyPhotoButton.disabled = !isOwner();
      familyPhotoButton.setAttribute(
        "aria-label",
        isOwner() ? "Tambahkan foto Ruang Keluarga" : "Ruang Keluarga belum memiliki foto"
      );
    }

    if (familyPhotoEdit) {
      familyPhotoEdit.hidden = !isOwner();
    }
  }

  async function loadFamilyPhoto({ force = false } = {}) {
    const path = clean(family?.family_photo_path);

    if (!path) {
      familyPhotoUrl = "";
      renderFamilyPhoto();
      return;
    }

    try {
      familyPhotoUrl = await FamilyService.ambilUrlFotoKeluarga(path, { force });
    } catch (error) {
      console.warn("[Family photo signed URL]", error);
      familyPhotoUrl = "";
    }

    renderFamilyPhoto();
  }

  function openPreview({ mode, url = "", title = "", subtitle = "" }) {
    previewMode = mode;
    previewTitle.textContent = title;
    previewSubtitle.textContent = subtitle || "";
    previewSubtitle.hidden = !subtitle;

    if (url) {
      previewImage.src = url;
      previewImage.alt = title;
      previewImage.hidden = false;
      previewFallback.hidden = true;
    } else {
      previewImage.removeAttribute("src");
      previewImage.hidden = true;
      previewFallback.hidden = false;
    }

    familyOwnerActions.hidden = !(mode === "family" && isOwner());
    familyPhotoDelete.hidden = !(mode === "family" && isOwner() && family?.family_photo_path);

    previewLayer.hidden = false;
    document.body.classList.add("media-preview-open");
  }

  function closePreview() {
    if (busy) return;
    previewLayer.hidden = true;
    document.body.classList.remove("media-preview-open");
    previewMode = "";
  }

  function decorateMemberAvatars() {
    document.querySelectorAll(".avatar-anggota").forEach(avatar => {
      const img = avatar.querySelector("img");
      const card = avatar.closest(".kartu-anggota");
      const name = clean(card?.querySelector(".info-anggota strong")?.textContent) || "Anggota";
      const relationship = clean(card?.querySelector(".label-hubungan-anggota")?.textContent);

      avatar.classList.toggle("avatar-anggota-previewable", Boolean(img?.src));

      if (!img?.src) {
        avatar.removeAttribute("role");
        avatar.removeAttribute("tabindex");
        avatar.removeAttribute("aria-label");
        return;
      }

      avatar.setAttribute("role", "button");
      avatar.setAttribute("tabindex", "0");
      avatar.setAttribute("aria-label", `Lihat foto profil ${name}`);
      avatar.dataset.previewMemberName = name;
      avatar.dataset.previewMemberRelationship = relationship;
      avatar.dataset.previewMemberUrl = img.src;
    });
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

  async function toFamilyPhotoBlob(file) {
    const image = await decodeImage(file);
    const width = image.width || image.naturalWidth;
    const height = image.height || image.naturalHeight;
    const side = Math.min(width, height);
    const sx = (width - side) / 2;
    const sy = (height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#0B0D0C";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(image, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    if (typeof image.close === "function") image.close();

    const webp = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/webp", 0.84)
    );

    if (webp) {
      return { blob: webp, extension: "webp", contentType: "image/webp" };
    }

    const jpeg = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg", 0.86)
    );

    if (!jpeg) throw new Error("Foto gagal dikompresi.");
    return { blob: jpeg, extension: "jpg", contentType: "image/jpeg" };
  }

  async function uploadPhoto(file) {
    if (!family || !isOwner() || !file || busy) return;

    if (!String(file.type || "").startsWith("image/")) {
      showNotice("Pilih file gambar dari galeri atau kamera.", "error");
      return;
    }

    if (file.size > MAX_SOURCE) {
      showNotice("Ukuran foto maksimal 12 MB.", "error");
      return;
    }

    busy = true;
    const editHtml = familyPhotoEdit?.innerHTML || "";
    const changeHtml = familyPhotoChange?.innerHTML || "";

    if (familyPhotoEdit) {
      familyPhotoEdit.disabled = true;
      familyPhotoEdit.innerHTML = '<ion-icon name="sync-outline"></ion-icon>';
    }
    if (familyPhotoChange) {
      familyPhotoChange.disabled = true;
      familyPhotoChange.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Memproses...';
    }

    try {
      const output = await toFamilyPhotoBlob(file);
      const result = await FamilyService.simpanFotoKeluarga({
        familyId: family.id,
        blob: output.blob,
        extension: output.extension,
        contentType: output.contentType,
        currentPath: family.family_photo_path || null
      });

      family.family_photo_path = result.path;
      familyPhotoUrl = result.url;
      renderFamilyPhoto();

      if (previewMode === "family") {
        openPreview({
          mode: "family",
          url: familyPhotoUrl,
          title: family.name || "Ruang Keluarga",
          subtitle: "Foto Ruang Keluarga"
        });
      }

      showNotice("Foto Ruang Keluarga diperbarui.", "success");
    } catch (error) {
      console.error("[Family photo upload]", error);
      showNotice(error?.message || "Foto Ruang Keluarga gagal disimpan.", "error");
    } finally {
      busy = false;
      if (familyPhotoEdit) {
        familyPhotoEdit.disabled = false;
        familyPhotoEdit.innerHTML = editHtml;
      }
      if (familyPhotoChange) {
        familyPhotoChange.disabled = false;
        familyPhotoChange.innerHTML = changeHtml;
      }
      if (familyPhotoInput) familyPhotoInput.value = "";
    }
  }

  async function deleteFamilyPhoto() {
    if (!family || !isOwner() || !family.family_photo_path || busy) return;

    const ok = confirm("Hapus foto Ruang Keluarga? Anggota akan kembali melihat ikon default.");
    if (!ok) return;

    busy = true;
    familyPhotoDelete.disabled = true;
    const html = familyPhotoDelete.innerHTML;
    familyPhotoDelete.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Menghapus...';

    try {
      await FamilyService.hapusFotoKeluarga(family.id, family.family_photo_path);
      family.family_photo_path = null;
      familyPhotoUrl = "";
      renderFamilyPhoto();
      busy = false;
      closePreview();
      showNotice("Foto Ruang Keluarga dihapus.", "success");
    } catch (error) {
      console.error("[Family photo delete]", error);
      showNotice(error?.message || "Foto Ruang Keluarga gagal dihapus.", "error");
    } finally {
      busy = false;
      familyPhotoDelete.disabled = false;
      familyPhotoDelete.innerHTML = html;
    }
  }

  async function applyCoreState(state) {
    family = state?.family || null;
    user = state?.user || null;
    members = Array.isArray(state?.anggota) ? state.anggota : [];

    renderFamilyPhoto();
    decorateMemberAvatars();
    await loadFamilyPhoto();
  }

  familyPhotoButton.addEventListener("click", () => {
    if (!familyPhotoUrl) {
      if (isOwner()) familyPhotoInput?.click();
      return;
    }

    openPreview({
      mode: "family",
      url: familyPhotoUrl,
      title: family?.name || "Ruang Keluarga",
      subtitle: "Foto Ruang Keluarga"
    });
  });

  familyPhotoEdit?.addEventListener("click", event => {
    event.stopPropagation();
    if (isOwner() && !busy) familyPhotoInput?.click();
  });

  familyPhotoChange?.addEventListener("click", () => {
    if (isOwner() && !busy) familyPhotoInput?.click();
  });

  familyPhotoDelete?.addEventListener("click", deleteFamilyPhoto);

  familyPhotoInput?.addEventListener("change", () => {
    uploadPhoto(familyPhotoInput.files?.[0]);
  });

  document.querySelectorAll("[data-media-preview-close]").forEach(button => {
    button.addEventListener("click", closePreview);
  });

  previewLayer.addEventListener("click", event => {
    if (event.target === previewLayer) closePreview();
  });

  document.addEventListener("click", event => {
    const avatar = event.target.closest?.(".avatar-anggota-previewable");
    if (!avatar) return;

    openPreview({
      mode: "member",
      url: avatar.dataset.previewMemberUrl || avatar.querySelector("img")?.src || "",
      title: avatar.dataset.previewMemberName || "Anggota",
      subtitle: avatar.dataset.previewMemberRelationship || "Anggota Ruang Keluarga"
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !previewLayer.hidden) {
      closePreview();
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && document.activeElement?.classList?.contains("avatar-anggota-previewable")) {
      event.preventDefault();
      document.activeElement.click();
    }
  });

  const observer = new MutationObserver(() => decorateMemberAvatars());
  const memberRoot = document.querySelector("[data-daftar-anggota]");
  if (memberRoot) observer.observe(memberRoot, { childList: true, subtree: true });

  window.addEventListener("family-core-ready", event => {
    applyCoreState(event.detail).catch(error => {
      console.warn("[Family media init]", error);
    });
  });

  if (window.FAMILY_CORE_STATE) {
    applyCoreState(window.FAMILY_CORE_STATE).catch(error => {
      console.warn("[Family media initial state]", error);
    });
  }
})();
