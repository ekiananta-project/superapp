(() => {
  "use strict";

  const target = document.querySelector("[data-today-lottie]");
  if (!target) return;
  const wrap = target.closest(".today-lottie-wrap");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  async function start() {
    if (!window.lottie?.loadAnimation) return;

    try {
      const response = await fetch("assets/lottie/today-family.json", { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const animationData = await response.json();

      const animation = window.lottie.loadAnimation({
        container: target,
        renderer: "svg",
        loop: !reducedMotion,
        autoplay: !reducedMotion,
        animationData,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" }
      });

      animation.setSpeed?.(0.65);
      animation.addEventListener?.("DOMLoaded", () => {
        wrap?.classList.add("is-lottie-ready");
        if (reducedMotion) animation.goToAndStop?.(90, true);
      });
    } catch (error) {
      console.warn("[RuangKitha] Lottie Hari Ini gagal dimuat; fallback dipakai.", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
