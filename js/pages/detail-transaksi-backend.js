(() => {
  "use strict";

  const root = document.querySelector("[data-detail-transaksi]");
  if (!root) return;

  const notifikasi = document.querySelector("[data-notifikasi]");
  const sheetVoid = document.getElementById("sheet-void-transaksi");
  const alasanVoid = document.querySelector("[data-alasan-void]");
  const tombolKonfirmasiVoid = document.querySelector("[data-konfirmasi-void]");

  const params = new URLSearchParams(location.search);
  const transactionId = params.get("id");
  const fromWalletId = params.get("from_wallet") || "";

  let detailAktif = null;
  let sedangVoid = false;

  const LABEL_KIND = {
    expense: "Pengeluaran",
    income: "Pemasukan",
    transfer: "Transfer",
    adjustment: "Penyesuaian Saldo"
  };

  const LABEL_FEE_MODE = {
    added: "Ditambahkan ke nominal",
    deducted: "Dipotong dari nominal transfer"
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
    const [y, m, d] = teks.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function waktuID(teks) {
    if (!teks) return "-";
    return new Date(teks).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function tampilPesan(teks) {
    if (!notifikasi) return;
    notifikasi.textContent = teks;
    notifikasi.hidden = false;
  }

  function sembunyikanPesan() {
    if (notifikasi) notifikasi.hidden = true;
  }

  function escapeHTML(teks) {
    return String(teks ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function namaUtama(detail) {
    if (detail.kind === "transfer") return "Transfer";
    if (detail.kind === "adjustment") return "Penyesuaian Saldo";
    return detail.account?.name || "Transaksi";
  }

  function ikonUtama(detail) {
    if (detail.kind === "transfer") return "swap-horizontal-outline";
    if (detail.kind === "adjustment") return "options-outline";
    return detail.account?.icon_value || "receipt-outline";
  }

  function walletMasukKeluar(detail) {
    const entries = detail.entries || [];

    return {
      sumber: entries.find(item => Number(item.amount_delta) < 0) || null,
      tujuan: entries.find(item => Number(item.amount_delta) > 0) || null,
      pertama: entries[0] || null
    };
  }

  function walletKembali(detail) {
    if (fromWalletId) return fromWalletId;
    const entries = detail?.entries || [];
    return entries.find(item => item?.wallet_id)?.wallet_id || "";
  }

  function hrefDaftarTransaksi(detail) {
    const walletId = walletKembali(detail);
    return walletId
      ? `dompet-detail.html?id=${encodeURIComponent(walletId)}`
      : "dompet-detail.html";
  }

  function syncTombolKembali(detail) {
    const href = hrefDaftarTransaksi(detail);
    const headerBack = document.querySelector("[data-detail-back]");
    if (headerBack) headerBack.href = href;
    return href;
  }

  async function cekBolehKelola(detail) {
    const user = await AuthService.ambilUserAktif();
    if (!user) return false;

    if (detail.created_by === user.id) {
      return true;
    }

    const families = await FamilyService.ambilKeluargaSaya();
    const family = families.find(item => item.id === detail.family_id);

    return family?.membership?.role === "owner";
  }

  function tambahBaris(container, label, nilai) {
    const baris = document.createElement("div");
    baris.className = "detail-baris";

    const span = document.createElement("span");
    span.textContent = label;

    const strong = document.createElement("strong");
    strong.textContent = nilai || "-";

    baris.append(span, strong);
    container.appendChild(baris);
  }

  async function renderDetail(detail) {
    const hrefKembali = syncTombolKembali(detail);
    const bolehKelola = !detail.voided_at && await cekBolehKelola(detail);
    const bolehVoid = bolehKelola;
    const wallet = walletMasukKeluar(detail);

    root.innerHTML = "";

    const utama = document.createElement("section");
    utama.className = "detail-utama";

    const ikonWrap = document.createElement("span");
    ikonWrap.className = "detail-ikon";

    const ikon = document.createElement("ion-icon");
    ikon.setAttribute("name", ikonUtama(detail));
    ikonWrap.appendChild(ikon);

    const judul = document.createElement("h2");
    judul.textContent = namaUtama(detail);

    const nominal = document.createElement("p");
    nominal.className = "detail-nominal" + (detail.kind === "income" ? " pemasukan" : "");
    nominal.textContent = rupiah(detail.amount);

    const status = document.createElement("span");
    status.className = "detail-status" + (detail.voided_at ? " is-void" : "");

    const statusIcon = document.createElement("ion-icon");
    statusIcon.setAttribute("name", detail.voided_at ? "close-circle-outline" : "checkmark-circle-outline");

    const statusText = document.createElement("span");
    statusText.textContent = detail.voided_at ? "Dibatalkan" : "Aktif";

    status.append(statusIcon, statusText);
    utama.append(ikonWrap, judul, nominal, status);

    const list = document.createElement("section");
    list.className = "detail-list";

    tambahBaris(list, "Jenis", LABEL_KIND[detail.kind] || detail.kind);

    if (detail.kind === "transfer") {
      const fee = Number(detail.transfer_fee || 0);
      const keluarSumber = Math.abs(Number(wallet.sumber?.amount_delta || 0));
      const diterimaTujuan = Math.abs(Number(wallet.tujuan?.amount_delta || 0));

      tambahBaris(list, "Dari", wallet.sumber?.wallet?.name || "-");
      tambahBaris(list, "Ke", wallet.tujuan?.wallet?.name || "-");
      tambahBaris(list, "Nominal Transfer", rupiah(detail.amount));
      tambahBaris(list, "Biaya Admin", fee > 0 ? rupiah(fee) : "Gratis");

      if (fee > 0) {
        tambahBaris(
          list,
          "Cara Biaya",
          LABEL_FEE_MODE[detail.transfer_fee_mode] || detail.transfer_fee_mode || "-"
        );
      }

      tambahBaris(list, "Total Keluar", rupiah(keluarSumber));
      tambahBaris(list, "Diterima Tujuan", rupiah(diterimaTujuan));
    } else {
      tambahBaris(list, "Dompet", wallet.pertama?.wallet?.name || "-");
    }

    tambahBaris(list, "Tanggal", tanggalID(detail.occurred_on));
    tambahBaris(list, "Catatan", detail.note || "-");
    tambahBaris(list, "Dicatat oleh", detail.created_by_name || "Pengguna");
    tambahBaris(list, "Dibuat", waktuID(detail.created_at));

    if (detail.updated_by_name || detail.updated_by || detail.last_edited_at) {
      tambahBaris(list, "Diubah oleh", detail.updated_by_name || "Pengguna");
      tambahBaris(list, "Diubah", waktuID(detail.last_edited_at));
    }

    if (detail.voided_at) {
      tambahBaris(list, "Dibatalkan", waktuID(detail.voided_at));
      tambahBaris(list, "Alasan", detail.void_reason || "Tidak ada alasan");
    }

    root.append(utama, list);

    const aksi = document.createElement("section");
    aksi.className = "detail-aksi";

    if (
      bolehKelola &&
      (
        detail.kind === "expense" ||
        detail.kind === "income" ||
        detail.kind === "transfer"
      )
    ) {
      const editLink = document.createElement("a");
      editLink.className = "tombol-utama";
      const walletIdKembali = walletKembali(detail);
      editLink.href =
        `transaksi.html?id=${encodeURIComponent(detail.id)}` +
        (walletIdKembali ? `&from_wallet=${encodeURIComponent(walletIdKembali)}` : "");
      editLink.innerHTML =
        '<ion-icon name="create-outline"></ion-icon><span>Edit Transaksi</span>';
      aksi.appendChild(editLink);
    }

    if (bolehVoid) {
      const voidButton = document.createElement("button");
      voidButton.type = "button";
      voidButton.className = "tombol-bahaya";
      voidButton.innerHTML = '<ion-icon name="close-circle-outline"></ion-icon><span>Batalkan Transaksi</span>';
      voidButton.addEventListener("click", () => {
        sembunyikanPesan();
        if (alasanVoid) alasanVoid.value = "";
        if (sheetVoid) sheetVoid.hidden = false;
      });
      aksi.appendChild(voidButton);
    } else if (!detail.voided_at) {
      const info = document.createElement("p");
      info.className = "detail-catatan-izin";
      info.textContent = "Transaksi hanya dapat dibatalkan oleh pencatatnya atau owner keluarga.";
      aksi.appendChild(info);
    }

    const kembali = document.createElement("a");
    kembali.className = "tombol-sekunder";
    kembali.href = hrefKembali;
    kembali.textContent = "Kembali ke Daftar Transaksi";
    aksi.appendChild(kembali);

    root.appendChild(aksi);
  }

  function tutupVoid() {
    if (sheetVoid) sheetVoid.hidden = true;
  }

  async function muatDetail() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    if (!transactionId) {
      root.innerHTML = '<div class="kosong-data">ID transaksi tidak ditemukan pada URL.</div>';
      return;
    }

    try {
      const session = await AuthService.ambilSession();

      if (!session) {
        throw new Error("Belum ada session Supabase. Login terlebih dahulu.");
      }

      const detail = await FinanceService.ambilDetailTransaksi(transactionId);

      if (!detail) {
        root.innerHTML = '<div class="kosong-data">Transaksi tidak ditemukan atau tidak dapat diakses.</div>';
        return;
      }

      detailAktif = detail;
      await renderDetail(detailAktif);
    } catch (error) {
      console.error("[Detail Transaksi Backend]", error);
      root.innerHTML = "";

      const box = document.createElement("div");
      box.className = "kosong-data";
      box.textContent = error?.message || "Detail transaksi gagal dimuat.";
      root.appendChild(box);
    }
  }

  document.querySelectorAll("[data-batal-void]").forEach(button => {
    button.addEventListener("click", tutupVoid);
  });

  if (sheetVoid) {
    sheetVoid.addEventListener("click", event => {
      if (event.target === sheetVoid) tutupVoid();
    });
  }

  if (tombolKonfirmasiVoid) {
    tombolKonfirmasiVoid.addEventListener("click", async () => {
      if (sedangVoid || !detailAktif?.id) return;

      sedangVoid = true;
      tombolKonfirmasiVoid.disabled = true;
      tombolKonfirmasiVoid.textContent = "Membatalkan...";

      try {
        await FinanceService.voidTransaksi(
          detailAktif.id,
          alasanVoid?.value || null
        );

        // VOID mengubah saldo; jangan biarkan cache dompet lama dipakai.
        window.FinanceCache?.remove("wallets", detailAktif.family_id);

        tutupVoid();
        tampilPesan("Transaksi berhasil dibatalkan. Saldo sudah dihitung ulang oleh database.");
        await muatDetail();
      } catch (error) {
        console.error("[Void Transaksi Backend]", error);
        tutupVoid();
        tampilPesan(error?.message || "Transaksi gagal dibatalkan.");
      } finally {
        sedangVoid = false;
        tombolKonfirmasiVoid.disabled = false;
        tombolKonfirmasiVoid.innerHTML = '<ion-icon name="close-circle-outline"></ion-icon><span>Batalkan Transaksi</span>';
      }
    });
  }

  muatDetail();
})();
