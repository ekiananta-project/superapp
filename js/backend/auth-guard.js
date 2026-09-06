(() => {
  "use strict";

  const mode = document.documentElement.dataset.authGuard || "login";

  window.AUTH_READY = (async () => {
    try {
      if (!window.AuthRouter) {
        throw new Error("AuthRouter belum tersedia.");
      }

      if (mode === "finance") {
        return await AuthRouter.wajibFinance();
      }

      if (mode === "family") {
        return await AuthRouter.wajibFamily();
      }

      return await AuthRouter.wajibLogin();
    } catch (error) {
      console.error("[Auth Guard]", error);
      return false;
    }
  })();
})();
