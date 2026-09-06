(() => {
  "use strict";

  const KUNCI_KELUARGA = "keuangan_keluarga_v1";

  function bacaKeluarga() {
    const isi = localStorage.getItem(KUNCI_KELUARGA);

    if (!isi) return null;

    try {
      return JSON.parse(isi);
    } catch {
      return null;
    }
  }

  function anggotaSaatIni(keluarga = bacaKeluarga()) {
    return (
      keluarga?.anggota?.find(item => item.saatIni) ||
      keluarga?.anggota?.[0] ||
      null
    );
  }

  function inisial(nama) {
    return String(nama || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(kata => kata[0]?.toUpperCase() || "")
      .join("") || "?";
  }

  function fotoValid(foto) {
    return (
      typeof foto === "string" &&
      (
        foto.startsWith("data:image/") ||
        foto.startsWith("https://") ||
        foto.startsWith("http://")
      )
    );
  }

  function render(elemen, anggota, opsi = {}) {
    if (!elemen) return;

    const fallback =
      opsi.fallback ||
      elemen.dataset.avatarFallback ||
      "icon";

    const nama =
      anggota?.nama ||
      "Pengguna";

    elemen.classList.add("avatar-pengguna");
    elemen.replaceChildren();

    if (fotoValid(anggota?.fotoProfil)) {
      const gambar = document.createElement("img");

      gambar.className =
        "avatar-pengguna-gambar";

      gambar.src =
        anggota.fotoProfil;

      gambar.alt =
        `Foto profil ${nama}`;

      elemen.appendChild(gambar);
      return;
    }

    if (fallback === "initials") {
      const teks = document.createElement("span");

      teks.className =
        "avatar-pengguna-inisial";

      teks.textContent =
        inisial(nama);

      teks.setAttribute(
        "aria-label",
        `Avatar ${nama}`
      );

      elemen.appendChild(teks);
      return;
    }

    const ikon =
      document.createElement("ion-icon");

    ikon.className =
      "avatar-pengguna-icon";

    ikon.setAttribute(
      "name",
      "person-outline"
    );

    ikon.setAttribute(
      "aria-hidden",
      "true"
    );

    elemen.appendChild(ikon);
  }

  function renderPenggunaAktif() {
    const keluarga = bacaKeluarga();
    const anggota = anggotaSaatIni(keluarga);

    document
      .querySelectorAll("[data-avatar-pengguna]")
      .forEach(elemen => {
        render(elemen, anggota);
      });

    return anggota;
  }

  window.AvatarAplikasi = {
    bacaKeluarga,
    anggotaSaatIni,
    inisial,
    render,
    renderPenggunaAktif
  };

  document.addEventListener(
    "DOMContentLoaded",
    renderPenggunaAktif
  );

  window.addEventListener(
    "profil-pengguna-berubah",
    renderPenggunaAktif
  );
})();
