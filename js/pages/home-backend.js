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
    const panel =
      document.querySelector(
        "[data-home-transaksi]"
      );

    if (panel) {
      panel.innerHTML = `
        <div class="kosong-data">
          <ion-icon name="cloud-download-outline"></ion-icon>
          Mengambil data keluarga...
        </div>`;
    }

    const total =
      document.querySelector(
        "[data-total-global]"
      );

    const saldo =
      document.querySelector(
        "[data-dompet-saldo]"
      );

    if (total) total.textContent = "...";
    if (saldo) saldo.textContent = "...";
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

      const namaEl =
        document.querySelector(
          "[data-nama-pengguna]"
        );

      if (namaEl) {
        namaEl.textContent =
          profile.display_name ||
          "Pengguna";
      }

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

    } catch (error) {
      tampilError(error);
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    renderHomeBackend
  );

  /*
   * Browser back-forward cache dapat mengembalikan DOM lama tanpa reload.
   * Saat Home dipulihkan dari bfcache, baca ulang profile dari Supabase agar
   * perubahan display_name di Pengaturan langsung terlihat.
   */
  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      renderHomeBackend();
    }
  });
})();
