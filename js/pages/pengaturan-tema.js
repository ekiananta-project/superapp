(() => {
  "use strict";

  const api = window.TemaAplikasi;

  if (!api) return;

  const tombolBuka =
    document.querySelector("[data-buka-tema]");

  const labelTema =
    document.querySelector("[data-label-tema]");

  const sheet =
    document.getElementById("sheet-tema");

  if (!tombolBuka || !labelTema || !sheet) {
    return;
  }

  const label = {
    system: "Ikuti Perangkat",
    light: "Terang",
    dark: "Gelap"
  };

  function renderPilihan() {
    const aktif = api.ambilPreferensi();

    labelTema.textContent =
      label[aktif] || label.system;

    document
      .querySelectorAll("[data-tema-pilihan]")
      .forEach(tombol => {
        const dipilih =
          tombol.dataset.temaPilihan === aktif;

        tombol.classList.toggle(
          "is-aktif",
          dipilih
        );

        const cek =
          tombol.querySelector(
            "[data-tema-cek]"
          );

        if (cek) {
          cek.hidden = !dipilih;
        }
      });
  }

  tombolBuka.addEventListener("click", () => {
    renderPilihan();
    sheet.hidden = false;
  });

  document
    .querySelector("[data-tutup-tema]")
    .addEventListener("click", () => {
      sheet.hidden = true;
    });

  sheet.addEventListener("click", event => {
    if (event.target === sheet) {
      sheet.hidden = true;
    }
  });

  document
    .querySelectorAll("[data-tema-pilihan]")
    .forEach(tombol => {
      tombol.addEventListener("click", () => {
        api.setPreferensi(
          tombol.dataset.temaPilihan
        );

        renderPilihan();
        sheet.hidden = true;
      });
    });

  window.addEventListener(
    "tema-aplikasi-berubah",
    renderPilihan
  );

  renderPilihan();
})();
