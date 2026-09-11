// RuangKitha v2.0.0a46e — delivered-push unread badge for Calendar header.
(() => {
  "use strict";
  const badge = () => document.querySelector("[data-notification-badge]");

  async function refresh() {
    const service = window.RuangKithaNotifications;
    const el = badge();
    if (!service || !el) return;
    try {
      await service.syncInbox(24 * 30);
      const count = await service.unreadCount();
      el.hidden = count <= 0;
      el.textContent = count > 99 ? "99+" : String(count);
      el.setAttribute("aria-label", `${count} notifikasi belum dibaca`);
    } catch (error) {
      console.debug?.("[Notification badge]", error);
      el.hidden = true;
    }
  }

  async function init() {
    try {
      if (window.AUTH_READY) {
        const allowed = await window.AUTH_READY;
        if (allowed === false) return;
      }
      await window.RuangKithaNotifications?.heartbeat?.();
      await refresh();
    } catch {}
  }

  window.addEventListener("ruangkitha:notification-read", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
