(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const KUNCI_RETURN_TO = "keuangan_auth_return_to_v1";

  function bacaPreferensi() {
    try {
      return JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}");
    } catch {
      return {};
    }
  }

  function simpanPreferensi(data) {
    const lama = bacaPreferensi();
    localStorage.setItem(
      KUNCI_PENGATURAN,
      JSON.stringify({ ...lama, ...data })
    );
  }

  function bersihkanReturnTo() {
    try { sessionStorage.removeItem(KUNCI_RETURN_TO); } catch {}
  }

  function simpanTujuanSekarang() {
    const file = location.pathname.split("/").pop() || "index.html";
    if (["login.html", "daftar.html", "keluarga-awal.html"].includes(file)) return;
    const tujuan = `${file}${location.search || ""}${location.hash || ""}`;
    try { sessionStorage.setItem(KUNCI_RETURN_TO, tujuan); } catch {}
  }

  async function ambilFamilyAktif() {
    const families = await FamilyService.ambilKeluargaSaya();
    if (!families.length) return null;
    const pref = bacaPreferensi();
    const family = families.find(item => item.id === pref.familyAktif) || families[0];

    if (family.id !== pref.familyAktif) {
      simpanPreferensi({ familyAktif: family.id });
    }
    return family;
  }

  /*
   * v2.0.0a8 — Global RuangKitha readiness no longer depends on Finance.
   * A user who already has a family is ready for the global Home even when
   * that family has zero wallets. Wallet onboarding belongs to wajibFinance().
   */
  async function cekStatusAplikasi() {
    const session = await AuthService.validasiSessionAktif();
    if (!session) {
      return {
        session: null,
        family: null,
        wallets: [],
        state: "guest",
        destination: "login.html"
      };
    }

    const family = await ambilFamilyAktif();
    if (!family) {
      return {
        session,
        family: null,
        wallets: [],
        state: "needs-family",
        destination: "keluarga-awal.html"
      };
    }

    return {
      session,
      family,
      wallets: [],
      state: "ready",
      destination: "index.html"
    };
  }

  async function tujuanSetelahLogin() {
    const status = await cekStatusAplikasi();
    /* Jangan hidupkan kembali halaman protected lama setelah logout/login. */
    bersihkanReturnTo();
    return status.destination || "index.html";
  }

  async function redirectSetelahLogin() {
    const tujuan = await tujuanSetelahLogin();
    location.replace(tujuan);
    return tujuan;
  }

  async function redirectJikaSudahLogin() {
    const session = await AuthService.validasiSessionAktif();
    if (!session) return false;
    await redirectSetelahLogin();
    return true;
  }

  async function wajibLogin() {
    const session = await AuthService.validasiSessionAktif();
    if (session) return true;
    simpanTujuanSekarang();
    location.replace("login.html");
    return false;
  }

  async function wajibFamily() {
    if (!(await wajibLogin())) return false;
    const family = await ambilFamilyAktif();
    if (family) return true;
    bersihkanReturnTo();
    location.replace("keluarga-awal.html");
    return false;
  }

  async function wajibFinance() {
    if (!(await wajibFamily())) return false;
    const family = await ambilFamilyAktif();
    const wallets = await FinanceService.ambilSaldoDompet(family.id);
    if (wallets.length) return true;

    /* Finance alone owns first-wallet onboarding. */
    location.replace("dompet-form.html?setup=awal");
    return false;
  }

  window.AuthRouter = {
    cekStatusAplikasi,
    ambilFamilyAktif,
    tujuanSetelahLogin,
    redirectSetelahLogin,
    redirectJikaSudahLogin,
    wajibLogin,
    wajibFamily,
    wajibFinance
  };
})();
