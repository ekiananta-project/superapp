(() => {
  "use strict";

  const KUNCI_PENGATURAN =
    "keuangan_pengaturan_v1";

  const DEFAULT_PREFERENSI = {
    dompetAktif: "",
    jenisAktif: "pengeluaran",
    periodeAktif: "month",
    familyAktif: ""
  };


  const AVATAR_BUCKET = "profile-avatars";
  let firstHydrationDone = false;
  let lastProfileRefreshAt = 0;
  let profileRefreshPromise = null;
  let currentProfile = {};

  function rootHome() {
    return document.querySelector("[data-home-root]");
  }

  function cleanName(value) {
    const name = String(value ?? "").trim().replace(/\s+/g, " ");
    if (["", "undefined", "null", "[object object]"].includes(name.toLowerCase())) {
      return "";
    }
    return name;
  }

  function avatarPublicUrl(path, updatedAt) {
    if (!path || !window.supabaseClient) return "";
    const { data } = window.supabaseClient.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(path);
    const raw = data?.publicUrl || "";
    if (!raw) return "";
    const version = updatedAt ? encodeURIComponent(String(updatedAt)) : "1";
    return `${raw}${raw.includes("?") ? "&" : "?"}v=${version}`;
  }

  function renderHomeAvatar(profile) {
    const el = document.querySelector("[data-avatar-pengguna]");
    if (!el) return;

    const displayName = cleanName(profile?.display_name) || "Pengguna";
    const url = avatarPublicUrl(profile?.avatar_path, profile?.updated_at);

    el.classList.add("avatar-pengguna", "home-hydrate-avatar");
    el.classList.remove("is-avatar-ready");
    el.classList.add("is-avatar-loading");
    el.replaceChildren();

    const ready = () => {
      el.classList.remove("is-avatar-loading");
      el.classList.add("is-avatar-ready");
    };

    if (!url) {
      const icon = document.createElement("ion-icon");
      icon.className = "avatar-pengguna-icon";
      icon.setAttribute("name", "person-outline");
      icon.setAttribute("aria-hidden", "true");
      el.appendChild(icon);
      ready();
      return;
    }

    const img = document.createElement("img");
    img.className = "avatar-pengguna-gambar";
    img.alt = `Foto profil ${displayName}`;
    img.decoding = "async";
    img.loading = "eager";
    img.addEventListener("load", ready, { once: true });
    img.addEventListener("error", () => {
      el.replaceChildren();
      const icon = document.createElement("ion-icon");
      icon.className = "avatar-pengguna-icon";
      icon.setAttribute("name", "person-outline");
      icon.setAttribute("aria-hidden", "true");
      el.appendChild(icon);
      ready();
    }, { once: true });
    img.src = url;
    el.appendChild(img);

    if (img.complete && img.naturalWidth > 0) ready();
  }

  function renderProfileHome(profile) {
    currentProfile = { ...currentProfile, ...(profile || {}) };
    const nameTarget = document.querySelector("[data-nama-pengguna]");
    const displayName = cleanName(currentProfile?.display_name) || "Pengguna";
    if (nameTarget) nameTarget.textContent = displayName;
    renderHomeAvatar(currentProfile);
  }

  function panelSkeleton() {
    return `
      <div class="home-skeleton-transactions" aria-hidden="true">
        <span class="home-skeleton-line home-skeleton-date"></span>
        <span class="home-skeleton-transaction"></span>
        <span class="home-skeleton-transaction"></span>
        <span class="home-skeleton-line home-skeleton-date short"></span>
        <span class="home-skeleton-transaction"></span>
      </div>`;
  }

  function setPrimaryReady() {
    const root = rootHome();
    if (!root) return;
    requestAnimationFrame(() => {
      root.classList.remove("home-hydrating");
      root.classList.add("home-primary-ready");
    });
  }

  function setAllReady() {
    const root = rootHome();
    const panel = document.querySelector("[data-home-transaksi]");
    root?.classList.remove("home-hydrating");
    root?.classList.add("home-primary-ready", "home-ready");
    root?.setAttribute("aria-busy", "false");
    panel?.classList.remove("home-panel-loading");
    panel?.setAttribute("aria-busy", "false");
    firstHydrationDone = true;
  }


  const LABEL_PERIODE = {
    week: "Week",
    month: "Month",
    year: "Year",
    all: "Semua"
  };

  function rupiah(angka) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(Number(angka || 0));
  }

  function tanggalID(teks) {
    if (!teks) return "-";

    const [y, m, d] =
      teks.split("-").map(Number);

    return new Date(
      y,
      m - 1,
      d
    ).toLocaleDateString(
      "id-ID",
      {
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    );
  }

  function bacaPreferensi() {
    try {
      const isi = JSON.parse(
        localStorage.getItem(
          KUNCI_PENGATURAN
        ) || "{}"
      );

      return {
        ...DEFAULT_PREFERENSI,
        ...isi
      };
    } catch {
      return {
        ...DEFAULT_PREFERENSI
      };
    }
  }

  function simpanPreferensi(data) {
    const lama = bacaPreferensi();

    localStorage.setItem(
      KUNCI_PENGATURAN,
      JSON.stringify({
        ...lama,
        ...data
      })
    );
  }

  function bukaSheet(id) {
    const el =
      document.getElementById(id);

    if (el) el.hidden = false;
  }

  function tutupSheet(id) {
    const el =
      document.getElementById(id);

    if (el) el.hidden = true;
  }

  function tanggalLokal(date) {
    const y = date.getFullYear();
    const m = String(
      date.getMonth() + 1
    ).padStart(2, "0");
    const d = String(
      date.getDate()
    ).padStart(2, "0");

    return `${y}-${m}-${d}`;
  }

  function rentangPeriode(mode) {
    if (mode === "all") {
      return {
        startDate: null,
        endDate: null
      };
    }

    const sekarang = new Date();
    let awal;
    let akhir;

    if (mode === "week") {
      awal = new Date(sekarang);
      const hari =
        (awal.getDay() + 6) % 7;

      awal.setDate(
        awal.getDate() - hari
      );

      akhir = new Date(awal);
      akhir.setDate(
        akhir.getDate() + 6
      );
    } else if (mode === "year") {
      awal = new Date(
        sekarang.getFullYear(),
        0,
        1
      );

      akhir = new Date(
        sekarang.getFullYear(),
        11,
        31
      );
    } else {
      awal = new Date(
        sekarang.getFullYear(),
        sekarang.getMonth(),
        1
      );

      akhir = new Date(
        sekarang.getFullYear(),
        sekarang.getMonth() + 1,
        0
      );
    }

    return {
      startDate:
        tanggalLokal(awal),
      endDate:
        tanggalLokal(akhir)
    };
  }

  function tampilLoading() {
    const panel = document.querySelector("[data-home-transaksi]");
    const root = rootHome();

    if (panel) {
      panel.classList.add("home-panel-loading");
      panel.setAttribute("aria-busy", "true");
      panel.innerHTML = panelSkeleton();
    }

    if (!firstHydrationDone) {
      root?.classList.add("home-hydrating");
      root?.classList.remove("home-primary-ready", "home-ready");
      root?.setAttribute("aria-busy", "true");
    }
  }

  function tampilError(error) {
    console.error(
      "[Home Backend]",
      error
    );

    const panel =
      document.querySelector(
        "[data-home-transaksi]"
      );

    if (!panel) return;

    panel.innerHTML = "";

    const box =
      document.createElement("div");

    box.className = "kosong-data";

    const icon =
      document.createElement("ion-icon");

    icon.setAttribute(
      "name",
      "cloud-offline-outline"
    );

    const teks =
      document.createElement("span");

    teks.textContent =
      error?.message ||
      "Data backend belum dapat dimuat.";

    box.append(icon, teks);
    panel.appendChild(box);
    setAllReady();
  }

  function filterTransaksiHome(transaksi, jenisAktif) {
    return transaksi.filter(item => {
      if (jenisAktif === "pemasukan") {
        return (
          item.kind === "income" ||
          (
            item.kind === "transfer" &&
            Number(item.amount_delta || 0) > 0
          )
        );
      }

      return (
        item.kind === "expense" ||
        (
          item.kind === "transfer" &&
          Number(item.amount_delta || 0) < 0
        )
      );
    });
  }

  function infoTransfer(item) {
    const delta = Number(item.amount_delta || 0);
    const keluar = delta < 0;
    const fee = Number(item.transfer_fee || 0);
    const mode = item.transfer_fee_mode || null;

    const lawanEntry =
      (item.entries || []).find(
        entry => entry.wallet_id !== item.wallet_id
      );

    const namaLawan =
      lawanEntry?.wallet?.name || "Dompet lain";

    const totalKeluar =
      Number(item.amount || 0) +
      (mode === "added" ? fee : 0);

    const diterima =
      Number(item.amount || 0) -
      (mode === "deducted" ? fee : 0);

    return {
      keluar,
      nama:
        keluar
          ? `Transfer ke ${namaLawan}`
          : `Transfer dari ${namaLawan}`,
      ikon: "swap-horizontal-outline",
      nominal: rupiah(item.amount),
      meta:
        fee > 0
          ? (
              keluar
                ? `Biaya admin ${rupiah(fee)} • Total keluar ${rupiah(totalKeluar)}`
                : `Biaya admin ${rupiah(fee)} • Diterima ${rupiah(diterima)}`
            )
          : "Transfer antar dompet"
    };
  }

  function renderTransaksi({
    transaksi,
    akun,
    jenisAktif,
    namaDompet
  }) {
    const panel =
      document.querySelector(
        "[data-home-transaksi]"
      );

    panel.innerHTML = "";

    if (!transaksi.length) {
      panel.innerHTML = `
        <div class="kosong-data">
          <ion-icon name="receipt-outline"></ion-icon>
          Belum ada transaksi ${jenisAktif}
          untuk ${namaDompet} pada periode ini.
        </div>`;
      return;
    }

    const akunMap = new Map(
      akun.map(item => [
        item.id,
        item
      ])
    );

    let tanggalSebelumnya = "";

    transaksi.forEach(item => {
      if (
        tanggalSebelumnya !==
        item.occurred_on
      ) {
        const h2 =
          document.createElement("h2");

        h2.textContent =
          tanggalID(item.occurred_on);

        panel.appendChild(h2);

        tanggalSebelumnya =
          item.occurred_on;
      }

      const transfer =
        item.kind === "transfer";

      const akunItem =
        akunMap.get(item.account_id);

      const transferInfo =
        transfer
          ? infoTransfer(item)
          : null;

      const btn =
        document.createElement("button");

      btn.className = "transaksi";
      btn.type = "button";

      const ikonWrap =
        document.createElement("span");

      const tampakMasuk =
        item.kind === "income" ||
        (
          transfer &&
          Number(item.amount_delta || 0) > 0
        );

      ikonWrap.className =
        "transaksi-ikon" +
        (tampakMasuk
          ? " pemasukan"
          : "");

      const ikon =
        document.createElement("ion-icon");

      ikon.setAttribute(
        "name",
        transfer
          ? transferInfo.ikon
          : (
              akunItem?.icon_value ||
              "ellipse-outline"
            )
      );

      ikonWrap.appendChild(ikon);

      const info =
        document.createElement("span");

      info.className =
        "transaksi-info";

      const nama =
        document.createElement("strong");

      nama.textContent =
        transfer
          ? transferInfo.nama
          : (akunItem?.name || "Akun");

      const nominal =
        document.createElement("span");

      nominal.textContent =
        transfer
          ? transferInfo.nominal
          : rupiah(item.amount);

      info.append(nama, nominal);

      if (transfer) {
        const meta =
          document.createElement("span");

        meta.textContent =
          transferInfo.meta;

        info.appendChild(meta);
      }

      const chevron =
        document.createElement("ion-icon");

      chevron.className =
        "transaksi-chevron";

      chevron.setAttribute(
        "name",
        "chevron-forward-outline"
      );

      btn.append(
        ikonWrap,
        info,
        chevron
      );

      btn.onclick = () => {
        location.href =
          `detail-transaksi.html?id=${encodeURIComponent(item.id)}`;
      };

      panel.appendChild(btn);
    });
  }

  function renderSheetDompet({
    dompet,
    dompetAktif
  }) {
    const root =
      document.querySelector(
        "[data-sheet-dompet-list]"
      );

    if (!root) return;

    root.innerHTML = "";

    dompet.forEach(item => {
      const btn =
        document.createElement("button");

      btn.className =
        "pilihan-sheet";

      const ikon =
        document.createElement("ion-icon");

      ikon.setAttribute(
        "name",
        item.icon_value ||
          "wallet-outline"
      );

      const info =
        document.createElement("span");

      const nama =
        document.createElement("strong");

      nama.textContent = item.name;

      const br =
        document.createElement("br");

      const saldo =
        document.createElement("small");

      saldo.textContent =
        rupiah(item.current_balance);

      info.append(
        nama,
        br,
        saldo
      );

      btn.append(ikon, info);

      if (
        item.wallet_id ===
        dompetAktif?.wallet_id
      ) {
        const cek =
          document.createElement(
            "ion-icon"
          );

        cek.className = "cek";
        cek.setAttribute(
          "name",
          "checkmark-circle"
        );

        btn.appendChild(cek);
      }

      btn.onclick = () => {
        simpanPreferensi({
          dompetAktif:
            item.wallet_id
        });

        tutupSheet(
          "sheet-dompet"
        );

        renderHomeBackend();
      };

      root.appendChild(btn);
    });
  }

  function pasangKontrol(preferensi) {
    document
      .querySelectorAll(
        "[data-jenis]"
      )
      .forEach(btn => {
        btn.classList.toggle(
          "is-aktif",
          btn.dataset.jenis ===
            preferensi.jenisAktif
        );

        btn.onclick = () => {
          simpanPreferensi({
            jenisAktif:
              btn.dataset.jenis
          });

          renderHomeBackend();
        };
      });

    const label =
      document.querySelector(
        "[data-label-periode]"
      );

    if (label) {
      label.textContent =
        LABEL_PERIODE[
          preferensi.periodeAktif
        ] || "Month";
    }

    document
      .querySelectorAll(
        "[data-periode]"
      )
      .forEach(btn => {
        btn.classList.toggle(
          "is-aktif",
          btn.dataset.periode ===
            preferensi.periodeAktif
        );

        btn.onclick = () => {
          simpanPreferensi({
            periodeAktif:
              btn.dataset.periode
          });

          tutupSheet(
            "sheet-periode"
          );

          renderHomeBackend();
        };
      });

    const bukaDompet =
      document.querySelector(
        "[data-buka-dompet]"
      );

    const bukaPeriode =
      document.querySelector(
        "[data-buka-periode]"
      );

    if (bukaDompet) {
      bukaDompet.onclick = () =>
        bukaSheet("sheet-dompet");
    }

    if (bukaPeriode) {
      bukaPeriode.onclick = () =>
        bukaSheet("sheet-periode");
    }
  }

  async function renderHomeBackend() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    const panel =
      document.querySelector(
        "[data-home-transaksi]"
      );

    if (!panel) return;

    tampilLoading();

    try {
      const session =
        await AuthService.ambilSession();

      if (!session) {
        throw new Error(
          "Belum ada session Supabase. Login melalui login.html."
        );
      }

      const preferensi =
        bacaPreferensi();

      const [profile, families] =
        await Promise.all([
          FamilyService.ambilProfilSaya(),
          FamilyService.ambilKeluargaSaya()
        ]);

      if (!families.length) {
        throw new Error(
          "Akun ini belum tergabung ke keluarga backend."
        );
      }

      let family =
        families.find(
          item =>
            item.id ===
            preferensi.familyAktif
        ) || families[0];

      if (
        family.id !==
        preferensi.familyAktif
      ) {
        preferensi.familyAktif =
          family.id;

        simpanPreferensi({
          familyAktif: family.id
        });
      }

      const [dompet, totalRows, akun] =
        await Promise.all([
          FinanceService.ambilSaldoDompet(
            family.id
          ),
          FinanceService.ambilTotalKeluarga(
            family.id
          ),
          FinanceService.ambilAkun(
            family.id
          )
        ]);

      renderProfileHome(profile);

      const mataUang =
        family.default_currency ||
        "IDR";

      const totalFamily =
        totalRows.find(
          row =>
            row.currency_code ===
            mataUang
        );

      const totalEl =
        document.querySelector(
          "[data-total-global]"
        );

      if (totalEl) {
        totalEl.textContent =
          rupiah(
            totalFamily?.total_balance ||
            0
          );
      }

      if (!dompet.length) {
        document.querySelector(
          "[data-dompet-label]"
        ).textContent =
          "Belum ada dompet backend";

        document.querySelector(
          "[data-dompet-saldo]"
        ).textContent = rupiah(0);

        panel.innerHTML = `
          <div class="kosong-data">
            <ion-icon name="wallet-outline"></ion-icon>
            Belum ada dompet pada keluarga backend ini.
          </div>`;

        setPrimaryReady();
        setAllReady();
        return;
      }

      let dompetAktif =
        dompet.find(
          item =>
            item.wallet_id ===
            preferensi.dompetAktif
        ) || dompet[0];

      if (
        dompetAktif.wallet_id !==
        preferensi.dompetAktif
      ) {
        preferensi.dompetAktif =
          dompetAktif.wallet_id;

        simpanPreferensi({
          dompetAktif:
            dompetAktif.wallet_id
        });
      }

      const labelDompet =
        document.querySelector(
          "[data-dompet-label]"
        );

      const saldoDompet =
        document.querySelector(
          "[data-dompet-saldo]"
        );

      const ikonDompet =
        document.querySelector(
          "[data-dompet-ikon]"
        );

      if (labelDompet) {
        labelDompet.textContent =
          `Total Uang ${dompetAktif.name}`;
      }

      if (saldoDompet) {
        saldoDompet.textContent =
          rupiah(
            dompetAktif.current_balance
          );
      }

      if (ikonDompet) {
        ikonDompet.setAttribute(
          "name",
          dompetAktif.icon_value ||
            "wallet-outline"
        );
      }

      const detailNama =
        document.querySelector(
          "[data-detail-dompet-nama]"
        );

      const detailLink =
        document.querySelector(
          "[data-detail-dompet]"
        );

      if (detailNama) {
        detailNama.textContent =
          dompetAktif.name;
      }

      if (detailLink) {
        detailLink.href =
          `dompet-detail.html?id=${encodeURIComponent(dompetAktif.id)}`;

        // Bersihkan handler placeholder lama jika file ini
        // dipakai setelah patch Home sebelumnya.
        detailLink.onclick = null;
      }

      setPrimaryReady();
      pasangKontrol(preferensi);

      renderSheetDompet({
        dompet,
        dompetAktif
      });

      const rentang =
        rentangPeriode(
          preferensi.periodeAktif
        );

      const semuaTransaksiDompet =
        await FinanceService
          .ambilTransaksiDompet({
            familyId: family.id,
            walletId:
              dompetAktif.wallet_id,
            kind: null,
            startDate:
              rentang.startDate,
            endDate:
              rentang.endDate,
            limit: 200
          });

      const transaksi =
        filterTransaksiHome(
          semuaTransaksiDompet,
          preferensi.jenisAktif
        );

      renderTransaksi({
        transaksi,
        akun,
        jenisAktif:
          preferensi.jenisAktif,
        namaDompet:
          dompetAktif.name
      });

      setAllReady();

    } catch (error) {
      tampilError(error);
    }
  }

  async function refreshProfileOnly({ force = false } = {}) {
    if (!firstHydrationDone) return;
    const now = Date.now();
    if (!force && now - lastProfileRefreshAt < 2000) return;
    if (profileRefreshPromise) return profileRefreshPromise;

    lastProfileRefreshAt = now;
    profileRefreshPromise = (async () => {
      try {
        const profile = await FamilyService.ambilProfilSaya();
        renderProfileHome(profile);
      } catch (error) {
        console.warn("[Home profile refresh]", error);
      } finally {
        profileRefreshPromise = null;
      }
    })();
    return profileRefreshPromise;
  }

  document.addEventListener(
    "DOMContentLoaded",
    renderHomeBackend
  );

  /* Browser back-forward cache dapat mengembalikan DOM lama tanpa reload. */
  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      renderHomeBackend();
    } else {
      refreshProfileOnly();
    }
  });

  window.addEventListener("focus", () => refreshProfileOnly());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshProfileOnly();
  });

  window.addEventListener("profil-pengguna-berubah", event => {
    const detail = event?.detail || {};
    if (detail.display_name !== undefined || detail.avatar_path !== undefined) {
      renderProfileHome(detail);
    } else {
      refreshProfileOnly({ force: true });
    }
  });
})();
