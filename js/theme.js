(() => {
  "use strict";

  const KUNCI_TEMA = "keuangan_tema_v1";
  const PILIHAN_VALID = new Set(["system", "light", "dark"]);
  const mediaGelap = window.matchMedia("(prefers-color-scheme: dark)");

  function ambilPreferensi() {
    const tersimpan = localStorage.getItem(KUNCI_TEMA);

    return PILIHAN_VALID.has(tersimpan)
      ? tersimpan
      : "system";
  }

  function temaAktual(preferensi = ambilPreferensi()) {
    if (preferensi === "system") {
      return mediaGelap.matches ? "dark" : "light";
    }

    return preferensi;
  }

  function terapkan(preferensi = ambilPreferensi()) {
    const aktual = temaAktual(preferensi);
    const root = document.documentElement;

    root.dataset.theme = aktual;
    root.dataset.themePreference = preferensi;
    root.style.colorScheme = aktual;

    return aktual;
  }

  function setPreferensi(preferensi) {
    if (!PILIHAN_VALID.has(preferensi)) {
      return;
    }

    localStorage.setItem(
      KUNCI_TEMA,
      preferensi
    );

    const aktual = terapkan(preferensi);

    window.dispatchEvent(
      new CustomEvent("tema-aplikasi-berubah", {
        detail: {
          preferensi,
          aktual
        }
      })
    );
  }

  function saatSistemBerubah() {
    if (ambilPreferensi() === "system") {
      terapkan("system");
    }
  }

  if (typeof mediaGelap.addEventListener === "function") {
    mediaGelap.addEventListener(
      "change",
      saatSistemBerubah
    );
  } else if (typeof mediaGelap.addListener === "function") {
    mediaGelap.addListener(
      saatSistemBerubah
    );
  }

  window.TemaAplikasi = {
    ambilPreferensi,
    temaAktual,
    terapkan,
    setPreferensi
  };

  /* Jalankan SEBELUM CSS/layout halaman selesai dirender. */
  terapkan();
})();
