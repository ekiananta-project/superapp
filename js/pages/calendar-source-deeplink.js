// RuangKitha v2.0.0a45 — focus Finance bill opened from projected Calendar events.
(() => {
  "use strict";
  const params = new URL(location.href).searchParams;
  const periodId = params.get("period") || "";
  const billId = params.get("bill") || "";
  if (!periodId && !billId) return;
  let done = false;
  let timer = null;

  function safeSelector(value) {
    return window.CSS?.escape ? CSS.escape(value) : String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  function focusTarget() {
    if (done) return true;
    const period = safeSelector(periodId);
    const bill = safeSelector(billId);
    const target =
      (period ? document.querySelector(`[data-bill-period-id="${period}"]`) : null) ||
      (bill ? document.querySelector(`[data-bill-id="${bill}"]`) : null) ||
      (period ? document.querySelector(`[data-bill-edit="${period}"]`)?.closest("article, .bill-card") : null);
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
    timer = setInterval(focusTarget, 200);
    setTimeout(() => clearInterval(timer), 10000);
  }, { once: true });
})();
