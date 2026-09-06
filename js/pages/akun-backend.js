(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const root = document.querySelector("[data-daftar-akun]");
  if (!root) return;

  const GRUP = [
    { kind: "expense", label: "Pengeluaran", icon: "arrow-up-circle-outline" },
    { kind: "income", label: "Pemasukan", icon: "arrow-down-circle-outline" }
  ];

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

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

  async function ambilFamilyAktif() {
    const session = await AuthService.ambilSession();
    if (!session) {
      throw new Error("Belum ada session Supabase. Login melalui login.html.");
    }

    const families = await FamilyService.ambilKeluargaSaya();
    if (!families.length) {
      throw new Error("Akun ini belum tergabung ke keluarga backend.");
    }

    const pref = bacaPreferensi();
    const family = families.find(item => item.id === pref.familyAktif) || families[0];

    if (family.id !== pref.familyAktif) {
      simpanPreferensi({ familyAktif: family.id });
    }

    return family;
  }

  function kartuAkun(item) {
    const link = document.createElement("a");
    link.className = "kartu-list akun-kartu";
    link.href = `akun-form.html?id=${encodeURIComponent(item.id)}`;
    link.innerHTML = `
      <span class="ikon-bulat akun-ikon-berwarna" style="--akun-warna:${escapeHTML(item.color || "#E58A2B")}">
        <ion-icon name="${escapeHTML(item.icon_value || "ellipse-outline")}"></ion-icon>
      </span>
      <span class="kartu-list-info">
        <strong>${escapeHTML(item.name)}</strong>
        <span>${item.kind === "income" ? "Pemasukan" : "Pengeluaran"}</span>
      </span>
      <ion-icon name="chevron-forward-outline"></ion-icon>`;
    return link;
  }

  function render(akun) {
    root.innerHTML = "";

    if (!akun.length) {
      root.innerHTML = `
        <div class="kosong-data akun-kosong-semua">
          <ion-icon name="pricetags-outline"></ion-icon>
          <span>Belum ada akun keuangan pada keluarga ini.</span>
          <a class="tombol-utama" href="akun-form.html">Buat Akun Pertama</a>
        </div>`;
      return;
    }

    GRUP.forEach(grup => {
      const items = akun.filter(item => item.kind === grup.kind);

      const section = document.createElement("section");
      section.className = "akun-grup";

      const heading = document.createElement("div");
      heading.className = "akun-grup-heading";
      heading.innerHTML = `
        <h2 class="judul-grup">
          <ion-icon name="${grup.icon}" aria-hidden="true"></ion-icon>
          ${grup.label}
        </h2>
        <span class="akun-jumlah">${items.length}</span>`;
      section.appendChild(heading);

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "akun-grup-kosong";
        empty.textContent = `Belum ada akun ${grup.label.toLowerCase()}.`;
        section.appendChild(empty);
      } else {
        const list = document.createElement("div");
        list.className = "daftar-kartu akun-daftar";
        items.forEach(item => list.appendChild(kartuAkun(item)));
        section.appendChild(list);
      }

      root.appendChild(section);
    });
  }

  async function init() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    try {
      const family = await ambilFamilyAktif();
      const akun = await FinanceService.ambilAkun(family.id);
      render(akun);
    } catch (error) {
      console.error("[Akun Backend]", error);
      root.innerHTML = `
        <div class="kosong-data akun-backend-error">
          <ion-icon name="cloud-offline-outline"></ion-icon>
          <span>${escapeHTML(error?.message || "Akun backend belum dapat dimuat.")}</span>
        </div>`;
    }
  }

  init();
})();
