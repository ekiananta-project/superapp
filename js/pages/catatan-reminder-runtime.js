// RuangKitha v2.0.0a46
// Legacy compatibility shim: per-module Catatan polling is intentionally retired.
// Calendar Event Projection + Notification Scheduler are now the single reminder pipeline.
(() => {
  "use strict";
  async function sync() {
    try {
      if (window.AUTH_READY) {
        const allowed = await window.AUTH_READY;
        if (allowed === false) return;
      }
      await window.RuangKithaNotifications?.syncInbox?.(24 * 30);
    } catch (error) {
      console.debug?.("[Catatan reminder compatibility sync]", error);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, { once: true });
  else sync();
})();
