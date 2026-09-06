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

  function simpanTujuanSekarang() {
    const file = location.pathname.split("/").pop() || "index.html";
    if (["login.html", "daftar.html"].includes(file)) return;

    const tujuan = `${file}${location.search || ""}${location.hash || ""}`;
    sessionStorage.setItem(KUNCI_RETURN_TO, tujuan);
  }

  function ambilReturnTo() {
    const tujuan = sessionStorage.getItem(KUNCI_RETURN_TO) || "";
    sessionStorage.removeItem(KUNCI_RETURN_TO);

    if (!tujuan) return "";
    if (/^(https?:|\/\/|javascript:)/i.test(tujuan)) return "";
    if (tujuan.includes("..")) return "";
    if (["login.html", "daftar.html", "keluarga-awal.html"].some(x => tujuan.startsWith(x))) {
      return "";
    }

    return tujuan;
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

  async function cekStatusAplikasi() {
    const session = await AuthService.ambilSession();

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

    const wallets = await FinanceService.ambilSaldoDompet(family.id);

    if (!wallets.length) {
      return {
        session,
        family,
        wallets: [],
        state: "needs-wallet",
        destination: "dompet-form.html?setup=awal"
      };
    }

    return {
      session,
      family,
      wallets,
      state: "ready",
      destination: "index.html"
    };
  }

  async function tujuanSetelahLogin({ pakaiReturnTo = true } = {}) {
    const status = await cekStatusAplikasi();

    if (status.state !== "ready") {
      return status.destination;
    }

    const returnTo = pakaiReturnTo ? ambilReturnTo() : "";
    return returnTo || "index.html";
  }

  async function redirectSetelahLogin(options = {}) {
    const tujuan = await tujuanSetelahLogin(options);
    location.replace(tujuan);
    return tujuan;
  }

  async function redirectJikaSudahLogin() {
    const session = await AuthService.ambilSession();
    if (!session) return false;

    await redirectSetelahLogin({ pakaiReturnTo: false });
    return true;
  }

  async function wajibLogin() {
    const session = await AuthService.ambilSession();
    if (session) return true;

    simpanTujuanSekarang();
    location.replace("login.html");
    return false;
  }

  async function wajibFamily() {
    if (!(await wajibLogin())) return false;

    const family = await ambilFamilyAktif();
    if (family) return true;

    location.replace("keluarga-awal.html");
    return false;
  }

  async function wajibFinance() {
    if (!(await wajibFamily())) return false;

    const family = await ambilFamilyAktif();
    const wallets = await FinanceService.ambilSaldoDompet(family.id);

    if (wallets.length) return true;

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
