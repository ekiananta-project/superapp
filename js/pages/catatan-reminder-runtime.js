(() => {
  "use strict";

  let polling = false;
  let timer = null;
  let toastTimer = null;

  function showToast(message) {
    const el = document.querySelector("[data-catatan-toast]");
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = String(message || "");
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  function reminderHref(row) {
    const params = new URLSearchParams();
    params.set("scope", String(row?.scope || "personal") === "family" ? "family" : "personal");
    params.set("id", String(row?.note_id || ""));
    params.set("type", "reminder");
    return `catatan-editor.html?${params.toString()}`;
  }

  function deliver(row) {
    const title = String(row?.title || "Pengingat RuangKitha").trim() || "Pengingat RuangKitha";
    const body = String(row?.body_text || "Waktunya membuka reminder ini.").trim().slice(0, 240);
    showToast(`⏰ ${title}`);
    document.dispatchEvent(new CustomEvent("ruangkitha:reminder-due", { detail: row }));

    if ("Notification" in window && Notification.permission === "granted") {
      const url = new URL(reminderHref(row), location.href).href;
      const options = {
        body,
        tag: `ruangkitha-reminder-${row.note_id}-${row.occurrence_at || row.reminder_at || "due"}`,
        renotify: false,
        data: { url }
      };
      (async () => {
        try {
          if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.ready;
            if (registration?.showNotification) {
              await registration.showNotification(title, options);
              return;
            }
          }
          const notification = new Notification(title, options);
          notification.onclick = () => {
            window.focus?.();
            location.href = reminderHref(row);
            notification.close();
          };
        } catch (error) {
          console.warn("[Reminder Notification]", error);
        }
      })();
    }
  }

  async function poll() {
    if (polling || document.visibilityState === "prerender" || !window.NotesService?.claimDueReminders) return;
    polling = true;
    try {
      const rows = await window.NotesService.claimDueReminders(20);
      (rows || []).forEach(deliver);
    } catch (error) {
      if (!window.NotesService?.reminderSchemaBelumTerpasang?.(error)) {
        console.warn("[Reminder Runtime]", error);
      }
    } finally {
      polling = false;
    }
  }

  async function start() {
    try {
      if (window.AUTH_READY) {
        const allowed = await window.AUTH_READY;
        if (allowed === false) return;
      }
    } catch {
      return;
    }
    setTimeout(poll, 1200);
    timer = setInterval(poll, 60_000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") poll();
    });
    window.addEventListener("pagehide", () => {
      if (timer) clearInterval(timer);
    }, { once: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
