(() => {
  "use strict";

  const nama =
    document.querySelector(
      "[data-nama-perangkat]"
    );

  const detail =
    document.querySelector(
      "[data-detail-perangkat]"
    );

  const ikon =
    document.querySelector(
      "[data-ikon-perangkat]"
    );

  if (!nama || !detail || !ikon) {
    return;
  }

  function deteksiBrowser() {
    const ua = navigator.userAgent;

    if (/Edg\//.test(ua)) return "Microsoft Edge";
    if (/Chrome\//.test(ua)) return "Google Chrome";
    if (/Firefox\//.test(ua)) return "Mozilla Firefox";
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";

    return "Browser";
  }

  function deteksiPerangkat() {
    const ua = navigator.userAgent;

    if (/Android/i.test(ua)) {
      return {
        nama: "Android",
        ikon: "phone-portrait-outline"
      };
    }

    if (/iPhone|iPad|iPod/i.test(ua)) {
      return {
        nama: "iPhone / iPad",
        ikon: "phone-portrait-outline"
      };
    }

    if (/Windows/i.test(ua)) {
      return {
        nama: "Windows",
        ikon: "desktop-outline"
      };
    }

    if (/Macintosh|Mac OS X/i.test(ua)) {
      return {
        nama: "Mac",
        ikon: "desktop-outline"
      };
    }

    return {
      nama: "Perangkat ini",
      ikon: "hardware-chip-outline"
    };
  }

  const perangkat =
    deteksiPerangkat();

  const browser =
    deteksiBrowser();

  nama.textContent =
    perangkat.nama;

  detail.textContent =
    browser;

  ikon.setAttribute(
    "name",
    perangkat.ikon
  );

  /* BACKEND HOOK NANTI
     -------------------
     Endpoint/service sesi akan menggantikan empty state dengan:
     - session_id
     - device_name
     - browser
     - last_active_at
     - current_session

     Tombol "Cabut Sesi" akan mengirim session_id ke backend.
     Jangan implementasikan revoke palsu di localStorage karena
     itu tidak mengamankan perangkat lain sungguhan. */
})();
