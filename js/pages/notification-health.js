// RuangKitha v2.0.0a46 — contextual notification health banner.
(() => {
  "use strict";

  const q = selector => document.querySelector(selector);

  function setBanner({ title, body, icon = "notifications-outline", action = "Periksa", tone = "warn" }) {
    const root = q("[data-notification-health-banner]");
    if (!root) return;
    root.hidden = false;
    root.dataset.tone = tone;
    q("[data-notification-health-icon]")?.setAttribute("name", icon);
    const titleEl = q("[data-notification-health-title]");
    const bodyEl = q("[data-notification-health-body]");
    const actionEl = q("[data-notification-health-action]");
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;
    if (actionEl) actionEl.textContent = action;
  }

  async function init() {
    const root = q("[data-notification-health-banner]");
    const service = window.RuangKithaNotifications;
    if (!root || !service) return;

    q("[data-notification-health-action]")?.addEventListener("click", () => {
      location.href = "notifikasi.html";
    });

    try {
      if (window.AUTH_READY) {
        const allowed = await window.AUTH_READY;
        if (allowed === false) return;
      }
      const relevant = await service.hasRelevantUpcoming();
      if (!relevant) {
        root.hidden = true;
        return;
      }
      const health = await service.heartbeat();
      if (health.state === "active") {
        if (health.verified) {
          root.hidden = true;
          return;
        }
        setBanner({
          title: "Notifikasi aktif, tapi belum dites",
          body: "Lakukan satu tes singkat supaya kamu tahu banner benar-benar muncul di perangkat ini.",
          icon: "checkmark-circle-outline",
          action: "Tes sekarang",
          tone: "info"
        });
        return;
      }
      if (health.state === "blocked") {
        setBanner({
          title: "Notifikasi diblokir di perangkat ini",
          body: "Agenda tetap aman di Kalender dan Agenda Dekat, tetapi RuangKitha belum bisa mengingatkan dari luar aplikasi.",
          icon: "notifications-off-outline",
          action: "Periksa"
        });
      } else if (health.state === "install-required") {
        setBanner({
          title: "Aktifkan pengingat di iPhone/iPad",
          body: "Tambahkan RuangKitha ke Layar Utama lalu aktifkan notifikasi agar pengingat dapat muncul dari luar aplikasi.",
          icon: "phone-portrait-outline",
          action: "Lihat cara"
        });
      } else if (health.state === "repair") {
        setBanner({
          title: "Notifikasi perlu diaktifkan ulang",
          body: "Perangkat ini sudah punya izin, tetapi jalur push tidak lagi aktif. Kalender dan Agenda Dekat tetap aman.",
          icon: "refresh-circle-outline",
          action: "Perbaiki"
        });
      } else if (health.state === "unsupported") {
        setBanner({
          title: "Pengingat perangkat belum tersedia",
          body: "Browser/perangkat ini belum bisa menerima Web Push. Gunakan Kalender dan Agenda Dekat sebagai pengingat utama.",
          icon: "alert-circle-outline",
          action: "Detail"
        });
      } else {
        setBanner({
          title: "Aktifkan pengingat perangkat",
          body: "Agenda tetap tersimpan di Kalender dan Agenda Dekat. Aktifkan notifikasi agar RuangKitha juga bisa mengingatkan dari luar aplikasi.",
          icon: "notifications-outline",
          action: "Aktifkan"
        });
      }
    } catch (error) {
      console.debug?.("[Notification health banner]", error);
      root.hidden = true;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
