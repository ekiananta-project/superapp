(() => {
  "use strict";

  function init() {
    const layer = document.querySelector("[data-avatar-preview-layer]");
    if (!layer) return;
    const image = layer.querySelector("[data-avatar-preview-image]");
    const fallback = layer.querySelector("[data-avatar-preview-fallback]");
    const name = layer.querySelector("[data-avatar-preview-name]");
    const closeButtons = layer.querySelectorAll("[data-avatar-preview-close]");
    let lastTrigger = null;

    function close() {
      layer.hidden = true;
      document.body.classList.remove("is-avatar-preview-open");
      lastTrigger?.focus?.();
      lastTrigger = null;
    }

    function open(trigger) {
      lastTrigger = trigger;
      const sourceImage = trigger.querySelector("img");
      const selector = trigger.dataset.avatarPreviewNameTarget || "";
      const nameSource = selector ? document.querySelector(selector) : null;
      if (name) name.textContent = (nameSource?.textContent || "Pengguna").trim() || "Pengguna";

      if (sourceImage?.currentSrc || sourceImage?.src) {
        image.src = sourceImage.currentSrc || sourceImage.src;
        image.hidden = false;
        fallback.hidden = true;
      } else {
        image.removeAttribute("src");
        image.hidden = true;
        fallback.hidden = false;
      }

      layer.hidden = false;
      document.body.classList.add("is-avatar-preview-open");
      layer.querySelector("[data-avatar-preview-close]")?.focus();
    }

    document.querySelectorAll("[data-avatar-preview-trigger]").forEach(trigger => {
      trigger.addEventListener("click", event => {
        event.preventDefault();
        open(trigger);
      });
    });

    closeButtons.forEach(button => button.addEventListener("click", close));
    layer.addEventListener("click", event => { if (event.target === layer) close(); });
    document.addEventListener("keydown", event => {
      if (!layer.hidden && event.key === "Escape") close();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
