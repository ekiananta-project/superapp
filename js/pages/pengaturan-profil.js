(() => {
  "use strict";

  const KUNCI_KELUARGA =
    "keuangan_keluarga_v1";

  const MAX_FILE_ASLI =
    10 * 1024 * 1024;

  const UKURAN_AVATAR =
    256;

  const inputFoto =
    document.querySelector("[data-input-foto]");

  const tombolPilih =
    document.querySelector("[data-pilih-foto]");

  const tombolHapus =
    document.querySelector("[data-hapus-foto]");

  const previewNama =
    document.querySelector("[data-nama-profil-preview]");

  const form =
    document.querySelector("[data-form-pengaturan]");

  if (
    !inputFoto ||
    !tombolPilih ||
    !tombolHapus ||
    !previewNama ||
    !form
  ) {
    return;
  }

  function bacaKeluarga() {
    try {
      return JSON.parse(
        localStorage.getItem(KUNCI_KELUARGA)
      );
    } catch {
      return null;
    }
  }

  function simpanKeluarga(keluarga) {
    localStorage.setItem(
      KUNCI_KELUARGA,
      JSON.stringify(keluarga)
    );
  }

  function anggotaSaatIni(keluarga) {
    return (
      keluarga?.anggota?.find(
        item => item.saatIni
      ) ||
      keluarga?.anggota?.[0] ||
      null
    );
  }

  function tampilPesan(teks) {
    const elemen =
      document.querySelector(
        "[data-notifikasi]"
      );

    if (!elemen) {
      alert(teks);
      return;
    }

    elemen.textContent = teks;
    elemen.hidden = false;

    setTimeout(() => {
      elemen.hidden = true;
    }, 3000);
  }

  function renderProfil() {
    const keluarga = bacaKeluarga();
    const anggota =
      anggotaSaatIni(keluarga);

    previewNama.textContent =
      anggota?.nama ||
      form.elements.nama.value ||
      "Pengguna";

    tombolHapus.hidden =
      !anggota?.fotoProfil;

    if (window.AvatarAplikasi) {
      window.AvatarAplikasi
        .renderPenggunaAktif();
    }
  }

  function bacaGambar(file) {
    return new Promise(
      (resolve, reject) => {
        const url =
          URL.createObjectURL(file);

        const gambar =
          new Image();

        gambar.onload = () => {
          URL.revokeObjectURL(url);
          resolve(gambar);
        };

        gambar.onerror = () => {
          URL.revokeObjectURL(url);
          reject(
            new Error(
              "Gambar tidak dapat dibaca."
            )
          );
        };

        gambar.src = url;
      }
    );
  }

  function cropKeAvatar(gambar) {
    const canvas =
      document.createElement("canvas");

    canvas.width = UKURAN_AVATAR;
    canvas.height = UKURAN_AVATAR;

    const ctx =
      canvas.getContext("2d");

    const sumber =
      Math.min(
        gambar.naturalWidth,
        gambar.naturalHeight
      );

    const sx =
      (gambar.naturalWidth - sumber) / 2;

    const sy =
      (gambar.naturalHeight - sumber) / 2;

    ctx.drawImage(
      gambar,
      sx,
      sy,
      sumber,
      sumber,
      0,
      0,
      UKURAN_AVATAR,
      UKURAN_AVATAR
    );

    /* WebP ringan untuk preview lokal.
       Jika browser tidak mendukung WebP, canvas dapat fallback.
       Bila hasil masih terlalu besar, coba JPEG. */
    let hasil =
      canvas.toDataURL(
        "image/webp",
        0.82
      );

    if (
      hasil.length > 400000 ||
      !hasil.startsWith("data:image/")
    ) {
      hasil =
        canvas.toDataURL(
          "image/jpeg",
          0.82
        );
    }

    return hasil;
  }

  async function simpanFoto(file) {
    if (!file) return;

    if (
      !String(file.type)
        .startsWith("image/")
    ) {
      return tampilPesan(
        "File harus berupa gambar."
      );
    }

    if (file.size > MAX_FILE_ASLI) {
      return tampilPesan(
        "Ukuran foto maksimal 10 MB."
      );
    }

    tombolPilih.disabled = true;
    tombolPilih.textContent =
      "Memproses foto...";

    try {
      const gambar =
        await bacaGambar(file);

      const fotoProfil =
        cropKeAvatar(gambar);

      const keluarga =
        bacaKeluarga();

      const anggota =
        anggotaSaatIni(keluarga);

      if (!anggota) {
        throw new Error(
          "Profil anggota tidak ditemukan."
        );
      }

      anggota.fotoProfil =
        fotoProfil;

      simpanKeluarga(keluarga);

      window.dispatchEvent(
        new CustomEvent(
          "profil-pengguna-berubah"
        )
      );

      renderProfil();

      tampilPesan(
        "Foto profil diperbarui."
      );
    } catch (error) {
      console.error(error);

      tampilPesan(
        error?.name === "QuotaExceededError"
          ? "Penyimpanan browser penuh. Coba foto lain yang lebih kecil."
          : "Foto belum berhasil diproses."
      );
    } finally {
      tombolPilih.disabled = false;

      tombolPilih.innerHTML = `
        <ion-icon name="camera-outline"></ion-icon>
        Ubah Foto
      `;

      inputFoto.value = "";
    }
  }

  tombolPilih.addEventListener(
    "click",
    () => {
      inputFoto.click();
    }
  );

  inputFoto.addEventListener(
    "change",
    () => {
      simpanFoto(
        inputFoto.files?.[0]
      );
    }
  );

  tombolHapus.addEventListener(
    "click",
    () => {
      const keluarga =
        bacaKeluarga();

      const anggota =
        anggotaSaatIni(keluarga);

      if (!anggota?.fotoProfil) {
        return;
      }

      anggota.fotoProfil = "";

      simpanKeluarga(keluarga);

      window.dispatchEvent(
        new CustomEvent(
          "profil-pengguna-berubah"
        )
      );

      renderProfil();

      tampilPesan(
        "Foto profil dihapus."
      );
    }
  );

  /* Nama disimpan oleh app.js.
     Setelah event submit selesai, refresh preview profil. */
  form.addEventListener(
    "submit",
    () => {
      setTimeout(() => {
        renderProfil();

        window.dispatchEvent(
          new CustomEvent(
            "profil-pengguna-berubah"
          )
        );
      }, 0);
    }
  );

  renderProfil();
})();
