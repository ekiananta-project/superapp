(() => {
  "use strict";

  const mode = document.documentElement.dataset.authGuard || "login";

  /* Protected pages stay visually cloaked until their guard is resolved. This
     prevents direct URL navigation after logout from exposing usable Finance/
     family UI for a moment before redirect. */
  const cloak = document.getElementById("ruangkitha-auth-cloak") || document.createElement("style");
  if (!cloak.id) cloak.id = "ruangkitha-auth-cloak";
  cloak.textContent = "html[data-auth-guard] body{visibility:hidden!important}";
  if (!cloak.isConnected) (document.head || document.documentElement).appendChild(cloak);

  function reveal() {
    document.getElementById("ruangkitha-auth-cloak")?.remove();
  }

  window.AUTH_READY = (async () => {
    try {
      let allowed;
      if (mode === "finance") allowed = await AuthRouter.wajibFinance();
      else if (mode === "family") allowed = await AuthRouter.wajibFamily();
      else allowed = await AuthRouter.wajibLogin();

      if (allowed !== false) reveal();
      return allowed;
    } catch (error) {
      reveal();
      throw error;
    }
  })();
})();
