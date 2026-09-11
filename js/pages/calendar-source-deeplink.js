// RuangKitha v2.0.0a44 — focus the Finance object opened from Kalender.
(() => {
  "use strict";
  const periodId = new URL(location.href).searchParams.get("period");
  if (!periodId) return;
  let done = false;
  let timer = null;

  function focusTarget() {
    if (done) return true;
    const escaped = window.CSS?.escape ? CSS.escape(periodId) : periodId.replace(/[^a-zA-Z0-9_-]/g, "");
    const target = document.querySelector(`[data-bill-period-id="${escaped}"]`) || document.querySelector(`[data-bill-edit="${escaped}"]`)?.closest("article, .bill-card");
    if (!target) return false;
    done = true;
    clearInterval(timer);
    target.classList.add("calendar-deeplink-target");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => target.classList.remove("calendar-deeplink-target"), 4200);
    return true;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (focusTarget()) return;
    timer = setInterval(focusTarget, 250);
    setTimeout(() => clearInterval(timer), 10000);
  }, { once: true });
})();
