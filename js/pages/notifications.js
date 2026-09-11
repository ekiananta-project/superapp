// RuangKitha v2.0.0a46d — Notification Center UX polish + clearer reminder cards.
(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  let filter = "all";
  let rows = [];
  let busy = false;

  function localDateLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const delta = Math.round((target - today) / 86400000);
    if (delta === 0) return "Hari ini";
    if (delta === -1) return "Kemarin";
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: date.getFullYear() === now.getFullYear() ? undefined : "numeric"
    }).format(date);
  }

  function timeLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date).replace(".", ":");
  }

  function iconFor(row) {
    if (row.source_module === "finance") return "wallet-outline";
    if (row.source_module === "notes") return "alarm-outline";
    if (row.source_module === "calendar") return "calendar-clear-outline";
    return "notifications-outline";
  }

  function moduleLabel(row) {
    if (row.source_module === "finance") return "Keuangan";
    if (row.source_module === "notes") return "Catatan";
    if (row.source_module === "calendar") return "Kalender";
    return "RuangKitha";
  }

  function presentation(row) {
    const rule = String(row?.rule_key || "");
    if (rule === "finance:h1") {
      return { body: "Jatuh tempo besok.", urgency: "Besok" };
    }
    if (rule === "finance:h0") {
      return { body: "Jatuh tempo hari ini.", urgency: "Hari ini" };
    }
    if (rule === "notes:at" || row?.source_module === "notes") {
      return { body: "Waktunya membuka reminder ini.", urgency: "Sekarang" };
    }
    return {
      body: String(row?.body || "Buka agenda terkait."),
      urgency: "Pengingat"
    };
  }

  function setStatus(text, tone = "neutral") {
    const status = q("[data-notification-page-status]");
    if (!status) return;
    status.textContent = text || "";
    status.dataset.tone = tone;
    status.hidden = !text;
  }

  function renderHealth(health) {
    const root = q("[data-device-health]");
    if (!root) return;
    const icon = q("[data-device-health-icon]");
    const title = q("[data-device-health-title]");
    const body = q("[data-device-health-body]");
    const meta = q("[data-device-health-meta]");
    const activate = q("[data-device-activate]");
    const test = q("[data-device-test]");
    const disable = q("[data-device-disable]");
    const help = q("[data-device-help]");
    const confirm = q("[data-device-test-confirm]");
    const missing = q("[data-device-test-missing]");

    root.dataset.state = health?.state || "inactive";
    activate.hidden = true;
    test.hidden = true;
    disable.hidden = true;
    help.hidden = true;
    confirm.hidden = true;
    missing.hidden = true;
    if (meta) meta.replaceChildren();

    const addMeta = (label, tone = "neutral") => {
      if (!meta || !label) return;
      const chip = document.createElement("span");
      chip.className = `device-health-chip is-${tone}`;
      chip.textContent = label;
      meta.appendChild(chip);
    };

    if (health?.state === "active") {
      icon?.setAttribute("name", "checkmark-circle-outline");
      const label = health?.device?.device_label || "Perangkat ini";
      addMeta(label, "device");
      addMeta(health.verified ? "Terverifikasi" : "Perlu tes", health.verified ? "success" : "warning");
      if (title) title.textContent = health.verified ? "Siap mengingatkan" : "Aktif di perangkat ini";
      if (body) body.textContent = health.verified
        ? "Push sudah diuji dan terlihat di perangkat ini. Kalender dan Hari Ini tetap menjadi sumber pengingat utama."
        : "Izin dan subscription sudah aktif. Kirim tes singkat untuk memastikan banner benar-benar terlihat.";
      test.hidden = false;
      disable.hidden = false;
      return;
    }

    if (health?.state === "blocked") {
      icon?.setAttribute("name", "notifications-off-outline");
      addMeta("Izin diblokir", "danger");
      if (title) title.textContent = "Notifikasi diblokir";
      if (body) body.textContent = "Ubah izin notifikasi pada browser atau sistem, lalu kembali ke halaman ini. Reminder tetap tersimpan di Kalender dan Hari Ini.";
      help.hidden = false;
      return;
    }

    if (health?.state === "install-required") {
      icon?.setAttribute("name", "phone-portrait-outline");
      addMeta("iPhone / iPad", "device");
      if (title) title.textContent = "Tambahkan ke Layar Utama";
      if (body) body.textContent = "Web Push iPhone/iPad digunakan dari RuangKitha yang dipasang ke Home Screen. Setelah itu buka dari ikon aplikasi dan aktifkan notifikasi.";
      help.hidden = false;
      return;
    }

    if (health?.state === "repair") {
      icon?.setAttribute("name", "refresh-circle-outline");
      addMeta("Perlu diperbaiki", "warning");
      if (title) title.textContent = "Perlu diaktifkan ulang";
      if (body) body.textContent = "Izin browser masih ada, tetapi subscription push perangkat ini tidak aktif. Aktifkan ulang untuk memperbaikinya.";
      activate.hidden = false;
      activate.textContent = "Aktifkan ulang";
      return;
    }

    if (health?.state === "unsupported") {
      icon?.setAttribute("name", "alert-circle-outline");
      addMeta("Tidak didukung", "danger");
      if (title) title.textContent = "Web Push belum tersedia";
      if (body) body.textContent = "Perangkat atau browser ini belum mendukung jalur push RuangKitha. Reminder tetap aman di Kalender dan Hari Ini.";
      help.hidden = false;
      return;
    }

    icon?.setAttribute("name", "notifications-outline");
    addMeta("Belum aktif", "warning");
    if (title) title.textContent = "Aktifkan pengingat perangkat";
    if (body) body.textContent = "Izinkan RuangKitha mengirim banner saat reminder tiba. Izin browser hanya diminta setelah tombol di bawah ditekan.";
    activate.hidden = false;
    activate.textContent = "Aktifkan notifikasi";
  }

  function renderList() {
    const root = q("[data-notification-list]");
    if (!root) return;
    root.replaceChildren();

    const visible = filter === "unread" ? rows.filter(row => !row.read_at) : rows;
    const empty = q("[data-notification-empty]");
    if (empty) empty.hidden = visible.length > 0;
    if (!visible.length) return;

    let group = "";
    visible.forEach(row => {
      const label = localDateLabel(row.scheduled_for);
      if (label !== group) {
        group = label;
        const heading = document.createElement("h3");
        heading.className = "notification-group-title";
        heading.textContent = label;
        root.appendChild(heading);
      }

      const view = presentation(row);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `notification-item is-${row.source_module || "calendar"}${row.read_at ? " is-read" : " is-unread"}`;
      button.setAttribute("aria-label", `${row.title || "Pengingat"}, ${moduleLabel(row)}, ${timeLabel(row.scheduled_for)}`);

      const icon = document.createElement("span");
      icon.className = "notification-item-icon";
      icon.innerHTML = `<ion-icon name="${iconFor(row)}"></ion-icon>`;

      const copy = document.createElement("span");
      copy.className = "notification-item-copy";

      const meta = document.createElement("span");
      meta.className = "notification-item-meta";

      const module = document.createElement("small");
      module.className = "notification-source-pill";
      module.textContent = moduleLabel(row);
      meta.appendChild(module);

      const time = document.createElement("small");
      time.className = "notification-time";
      time.textContent = timeLabel(row.scheduled_for);
      meta.appendChild(time);

      if (!row.read_at) {
        const fresh = document.createElement("small");
        fresh.className = "notification-new-pill";
        fresh.textContent = "Baru";
        meta.appendChild(fresh);
      }

      const title = document.createElement("strong");
      title.textContent = row.title || "Pengingat RuangKitha";

      const body = document.createElement("span");
      body.className = "notification-item-body";
      body.textContent = view.body;

      copy.append(meta, title, body);

      const side = document.createElement("span");
      side.className = "notification-item-side";
      side.innerHTML = `<span class="notification-urgency">${view.urgency}</span><ion-icon class="notification-item-chevron" name="chevron-forward-outline"></ion-icon>`;

      button.append(icon, copy, side);
      button.addEventListener("click", () => window.RuangKithaNotifications.openItem(row));
      root.appendChild(button);
    });
  }

  async function refreshInbox() {
    const service = window.RuangKithaNotifications;
    if (!service) return;
    try {
      await service.syncInbox(24 * 30);
      rows = await service.listInbox({ limit: 120 });
      renderList();
      const unread = rows.filter(row => !row.read_at).length;
      const markAll = q("[data-mark-all-read]");
      if (markAll) markAll.hidden = unread === 0;
      const summary = q("[data-notification-summary]");
      if (summary) summary.textContent = unread
        ? `${unread} pemberitahuan belum dibaca`
        : (rows.length ? "Semua pemberitahuan sudah dibaca" : "Belum ada pemberitahuan");
    } catch (error) {
      console.error("[Notification inbox]", error);
      setStatus(error?.message || "Notifikasi belum dapat dimuat.", "error");
    }
  }

  async function refreshHealth() {
    try {
      const health = await window.RuangKithaNotifications.getHealth();
      renderHealth(health);
      return health;
    } catch (error) {
      console.warn("[Notification health]", error);
      renderHealth({ state: "unsupported" });
      return null;
    }
  }

  async function withBusy(fn) {
    if (busy) return;
    busy = true;
    document.documentElement.dataset.notificationBusy = "true";
    try { await fn(); }
    finally {
      busy = false;
      delete document.documentElement.dataset.notificationBusy;
    }
  }

  function setup() {
    q("[data-device-activate]")?.addEventListener("click", () => withBusy(async () => {
      setStatus("Mengaktifkan notifikasi perangkat…");
      try {
        const health = await window.RuangKithaNotifications.activate();
        renderHealth(health);
        setStatus("Notifikasi aktif. Kirim tes singkat untuk memastikan banner benar-benar sampai.", "success");
      } catch (error) {
        setStatus(error?.message || "Notifikasi belum dapat diaktifkan.", "error");
        await refreshHealth();
      }
    }));

    q("[data-device-test]")?.addEventListener("click", () => withBusy(async () => {
      setStatus("Mengirim notifikasi percobaan…");
      try {
        await window.RuangKithaNotifications.testPush();
        setStatus("Tes dikirim. Apakah banner terlihat di perangkat ini?", "success");
        const confirm = q("[data-device-test-confirm]");
        const missing = q("[data-device-test-missing]");
        if (confirm) confirm.hidden = false;
        if (missing) missing.hidden = false;
      } catch (error) {
        setStatus(error?.message || "Tes push gagal dikirim.", "error");
      }
    }));

    q("[data-device-test-confirm]")?.addEventListener("click", () => withBusy(async () => {
      try {
        await window.RuangKithaNotifications.confirmTestSeen();
        setStatus("Perangkat terverifikasi. RuangKitha tahu banner tes benar-benar terlihat di perangkat ini.", "success");
        await refreshHealth();
      } catch (error) {
        setStatus(error?.message || "Status verifikasi belum dapat disimpan.", "error");
      }
    }));

    q("[data-device-test-missing]")?.addEventListener("click", () => {
      setStatus("Banner belum terlihat. Periksa Mode Fokus/Do Not Disturb, izin notifikasi sistem, dan izin situs/browser, lalu kirim tes lagi.", "error");
      const help = q("[data-device-help-copy]");
      if (help) help.hidden = false;
    });

    q("[data-device-disable]")?.addEventListener("click", () => withBusy(async () => {
      setStatus("Menonaktifkan perangkat ini…");
      try {
        await window.RuangKithaNotifications.deactivate();
        setStatus("Push dinonaktifkan pada perangkat ini. Reminder tetap tersimpan di Kalender dan Hari Ini.", "success");
        await refreshHealth();
      } catch (error) {
        setStatus(error?.message || "Perangkat belum dapat dinonaktifkan.", "error");
      }
    }));

    q("[data-device-help]")?.addEventListener("click", () => {
      q("[data-device-help-copy]")?.toggleAttribute("hidden");
    });

    document.querySelectorAll("[data-notification-filter]").forEach(button => {
      button.addEventListener("click", () => {
        filter = button.dataset.notificationFilter || "all";
        document.querySelectorAll("[data-notification-filter]").forEach(item => item.classList.toggle("is-active", item === button));
        renderList();
      });
    });

    q("[data-mark-all-read]")?.addEventListener("click", () => withBusy(async () => {
      try {
        await window.RuangKithaNotifications.markAllRead();
        rows = rows.map(row => ({ ...row, read_at: row.read_at || new Date().toISOString() }));
        renderList();
        q("[data-mark-all-read]").hidden = true;
        const summary = q("[data-notification-summary]");
        if (summary) summary.textContent = "Semua pemberitahuan sudah dibaca";
      } catch (error) {
        setStatus(error?.message || "Belum dapat menandai semua sebagai dibaca.", "error");
      }
    }));
  }

  async function init() {
    setup();
    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }
    try { await window.RuangKithaNotifications.heartbeat(); } catch {}
    await Promise.all([refreshHealth(), refreshInbox()]);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) Promise.all([refreshHealth(), refreshInbox()]);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
