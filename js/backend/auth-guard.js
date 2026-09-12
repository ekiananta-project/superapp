(() => {
  "use strict";

  const mode = document.documentElement.dataset.authGuard || "login";
  const client = window.supabaseClient;

  // Protected pages remain cloaked until the server-validated auth guard resolves.
  const cloak = document.getElementById("ruangkitha-auth-cloak") || document.createElement("style");
  if (!cloak.id) cloak.id = "ruangkitha-auth-cloak";
  cloak.textContent = "html[data-auth-guard] body{visibility:hidden!important}";
  if (!cloak.isConnected) (document.head || document.documentElement).appendChild(cloak);

  function reveal() {
    document.getElementById("ruangkitha-auth-cloak")?.remove();
  }

  function lockRuntime(reason) {
    try { window.RuangKithaTrustedDevice?.lockAll?.(reason); } catch {}
  }

  function loginUrl() {
    try {
      const url = new URL("login.html", location.href);
      return url.href;
    } catch {
      return "login.html";
    }
  }

  function redirectToLogin(reason = "auth-invalid") {
    lockRuntime(reason);
    location.replace(loginUrl());
  }

  function failClosed(error) {
    lockRuntime("auth-guard-failed");
    window.RuangKithaSecurityLog?.error?.("[Auth guard] verifikasi sesi gagal", error);

    // Replace, don't merely reveal, the protected page. No protected shell is
    // exposed when Auth is unreachable or validation fails unexpectedly.
    const main = document.createElement("main");
    main.setAttribute("role", "alert");
    main.style.cssText = [
      "min-height:100dvh", "display:grid", "place-items:center", "padding:24px",
      "box-sizing:border-box", "background:var(--bg,#0B0D0C)", "color:var(--text,#F1EADF)",
      "font-family:Manrope,system-ui,sans-serif"
    ].join(";");

    const card = document.createElement("section");
    card.style.cssText = [
      "width:min(100%,430px)", "padding:22px", "border-radius:24px",
      "background:var(--card,#171D19)", "box-shadow:0 20px 52px rgba(0,0,0,.25)",
      "border:1px solid rgba(127,165,142,.16)"
    ].join(";");

    const title = document.createElement("h1");
    title.textContent = "Sesi belum dapat diverifikasi";
    title.style.cssText = "margin:0 0 8px;font-size:20px;line-height:1.25";
    const copy = document.createElement("p");
    copy.textContent = "RuangKitha menutup halaman ini sampai sesi login dapat diverifikasi kembali. Periksa koneksi lalu coba lagi.";
    copy.style.cssText = "margin:0;color:var(--muted,#B9C2BC);font-size:13px;line-height:1.6";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:10px;margin-top:18px;flex-wrap:wrap";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Coba lagi";
    retry.style.cssText = "border:0;border-radius:999px;padding:11px 16px;font:700 13px Manrope,system-ui,sans-serif;background:#7FA58E;color:#101612;cursor:pointer";
    retry.addEventListener("click", () => location.reload());
    const login = document.createElement("button");
    login.type = "button";
    login.textContent = "Kembali ke Login";
    login.style.cssText = "border:1px solid rgba(127,165,142,.3);border-radius:999px;padding:11px 16px;font:700 13px Manrope,system-ui,sans-serif;background:transparent;color:inherit;cursor:pointer";
    login.addEventListener("click", () => redirectToLogin("auth-guard-login"));
    actions.append(retry, login);
    card.append(title, copy, actions);
    main.appendChild(card);
    document.body.replaceChildren(main);
    document.documentElement.dataset.authGuardState = "failed-closed";
    reveal();
  }

  // A real Supabase SIGNED_OUT event must immediately discard any runtime
  // Master Key references before navigation leaves the protected page.
  try {
    client?.auth?.onAuthStateChange?.((event, session) => {
      if (event === "SIGNED_OUT" || (event === "USER_DELETED" && !session)) {
        redirectToLogin("auth-signed-out");
      }
    });
  } catch {}

  window.AUTH_READY = (async () => {
    try {
      let allowed;
      if (mode === "finance") allowed = await AuthRouter.wajibFinance();
      else if (mode === "family") allowed = await AuthRouter.wajibFamily();
      else allowed = await AuthRouter.wajibLogin();

      if (allowed !== false) {
        document.documentElement.dataset.authGuardState = "verified";
        reveal();
      }
      return allowed;
    } catch (error) {
      failClosed(error);
      return false;
    }
  })();
})();
