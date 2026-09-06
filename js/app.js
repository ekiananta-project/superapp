(() => {
  "use strict";

  const KUNCI = {
    dompet: "keuangan_dompet_v1",
    akun: "keuangan_akun_v1",
    transaksi: "keuangan_transaksi_v1",
    pengaturan: "keuangan_pengaturan_v1",
    keluarga: "keuangan_keluarga_v1",
    setupKeluarga: "keuangan_setup_keluarga_v1",
    tema: "keuangan_tema_v1"
  };

  const seed = {
    /* User baru benar-benar mulai tanpa dompet. */
    dompet: [],

    /* Akun starter bukan data transaksi contoh.
       User tetap bisa edit / hapus / tambah akun sendiri. */
    akun: [
      { id: "a1", nama: "Makan", jenis: "pengeluaran", ikon: "fast-food-outline" },
      { id: "a2", nama: "Bensin", jenis: "pengeluaran", ikon: "car-sport-outline" },
      { id: "a3", nama: "Cemilan", jenis: "pengeluaran", ikon: "ice-cream-outline" },
      { id: "a4", nama: "Belanja", jenis: "pengeluaran", ikon: "bag-handle-outline" },
      { id: "a5", nama: "Tagihan", jenis: "pengeluaran", ikon: "receipt-outline" },
      { id: "a6", nama: "Gaji", jenis: "pemasukan", ikon: "briefcase-outline" },
      { id: "a7", nama: "Freelance", jenis: "pemasukan", ikon: "laptop-outline" },
      { id: "a8", nama: "Bonus", jenis: "pemasukan", ikon: "gift-outline" }
    ],

    /* Tidak ada transaksi contoh pada instalasi pertama. */
    transaksi: [],

    pengaturan: {
      /* Nama tidak boleh di-hardcode.
         Pada first run, nama akan diisi dari onboarding keluarga. */
      nama: "",
      mataUang: "IDR",
      dompetAktif: "",
      jenisAktif: "pengeluaran",
      periodeAktif: "month"
    },

    /* Keluarga tidak dibuat otomatis.
       User harus memilih: Buat Keluarga Baru atau Gabung Keluarga. */
    keluarga: null
  };

  function baca(kunci, nilaiAwal) {
    const isi = localStorage.getItem(kunci);
    if (!isi) {
      localStorage.setItem(kunci, JSON.stringify(nilaiAwal));
      return structuredClone(nilaiAwal);
    }
    try { return JSON.parse(isi); }
    catch {
      localStorage.setItem(kunci, JSON.stringify(nilaiAwal));
      return structuredClone(nilaiAwal);
    }
  }

  function simpan(kunci, data) {
    localStorage.setItem(kunci, JSON.stringify(data));
  }

  function bacaOpsional(kunci) {
    const isi = localStorage.getItem(kunci);
    if (!isi) return null;

    try {
      return JSON.parse(isi);
    } catch {
      return null;
    }
  }

  function setupKeluargaSelesai() {
    const setup = bacaOpsional(KUNCI.setupKeluarga);
    const keluarga = bacaOpsional(KUNCI.keluarga);

    return Boolean(
      setup?.selesai === true &&
      keluarga?.id
    );
  }

  function dataAplikasi() {
    return {
      dompet: baca(KUNCI.dompet, seed.dompet),
      akun: baca(KUNCI.akun, seed.akun),
      transaksi: baca(KUNCI.transaksi, seed.transaksi),
      pengaturan: baca(KUNCI.pengaturan, seed.pengaturan),
      keluarga: bacaOpsional(KUNCI.keluarga)
    };
  }

  function hapusSemuaData() {
    Object.values(KUNCI).forEach(k => localStorage.removeItem(k));

    /* Kembali ke Home. Karena setup keluarga ikut terhapus,
       aplikasi akan kembali ke onboarding keluarga paling awal. */
    location.href = "index.html";
  }

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
      day: "numeric", month: "long", year: "numeric"
    });
  }

  function idBaru(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function queryId() {
    return new URLSearchParams(location.search).get("id");
  }

  function cari(data, id) {
    return data.find(item => item.id === id);
  }

  function anggotaSaatIni(keluarga) {
    return keluarga?.anggota?.find(item => item.saatIni) ||
           keluarga?.anggota?.[0] ||
           null;
  }

  function sinkronNamaAnggotaAktif() {
    const pengaturan = bacaOpsional(KUNCI.pengaturan);
    const keluarga = bacaOpsional(KUNCI.keluarga);

    if (!pengaturan?.nama || !keluarga?.anggota?.length) {
      return;
    }

    const namaPengaturan = String(pengaturan.nama).trim();
    const anggotaAktif = anggotaSaatIni(keluarga);

    if (!anggotaAktif || !namaPengaturan) {
      return;
    }

    const namaAnggota = String(anggotaAktif.nama || "").trim();

    /* Migration untuk data lama:
       jika nama anggota masih placeholder "Pengguna",
       pakai nama profil/pengaturan yang sebenarnya. */
    if (
      !namaAnggota ||
      namaAnggota.toLowerCase() === "pengguna"
    ) {
      anggotaAktif.nama = namaPengaturan;
      simpan(KUNCI.keluarga, keluarga);
    }
  }

  function tampilPesan(teks) {
    const elemen = document.querySelector("[data-notifikasi]");
    if (!elemen) return alert(teks);
    elemen.textContent = teks;
    elemen.hidden = false;
    setTimeout(() => elemen.hidden = true, 2800);
  }

  function bukaSheet(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  }

  function tutupSheet(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  function pasangTutupSheet() {
    document.querySelectorAll("[data-sheet-close]").forEach(btn => {
      btn.addEventListener("click", () => tutupSheet(btn.dataset.sheetClose));
    });
    document.querySelectorAll(".lapisan").forEach(layer => {
      layer.addEventListener("click", e => {
        if (e.target === layer) layer.hidden = true;
      });
    });
  }

  function parseTanggal(teks) {
    const [y, m, d] = teks.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function transaksiTerfilter(daftar, jenis, periode) {
    let hasil = daftar.filter(t => t.jenis === jenis);
    if (!hasil.length || periode === "all") return hasil;

    const terbaru = hasil
      .map(t => parseTanggal(t.tanggal))
      .sort((a, b) => b - a)[0];

    return hasil.filter(t => {
      const d = parseTanggal(t.tanggal);

      if (periode === "month") {
        return d.getMonth() === terbaru.getMonth() &&
               d.getFullYear() === terbaru.getFullYear();
      }

      if (periode === "year") {
        return d.getFullYear() === terbaru.getFullYear();
      }

      if (periode === "week") {
        const awal = new Date(terbaru);
        const hari = (awal.getDay() + 6) % 7;
        awal.setDate(awal.getDate() - hari);
        awal.setHours(0,0,0,0);

        const akhir = new Date(awal);
        akhir.setDate(akhir.getDate() + 6);
        akhir.setHours(23,59,59,999);

        return d >= awal && d <= akhir;
      }

      return true;
    });
  }

  function renderHome() {
    const panel = document.querySelector("[data-home-transaksi]");
    if (!panel) return;

    let { dompet, akun, transaksi, pengaturan, keluarga } = dataAplikasi();

    /* FIRST RUN GUARD
       Home tidak boleh dipakai sebelum minimal ada satu dompet. */
    if (dompet.length === 0) {
      location.replace("dompet-form.html?setup=awal");
      return;
    }

    const anggotaAktifHome =
      anggotaSaatIni(keluarga);

    document
      .querySelector("[data-nama-pengguna]")
      .textContent =
        anggotaAktifHome?.nama ||
        pengaturan.nama ||
        "Pengguna";

    const total = dompet.reduce((sum, d) => sum + Number(d.saldo), 0);
    document.querySelector("[data-total-global]").textContent = rupiah(total);

    let dompetAktif = cari(dompet, pengaturan.dompetAktif) || dompet[0];
    pengaturan.dompetAktif = dompetAktif?.id || "";
    simpan(KUNCI.pengaturan, pengaturan);

    document.querySelector("[data-dompet-label]").textContent =
      dompetAktif ? `Total Uang ${dompetAktif.nama}` : "Belum ada dompet";
    document.querySelector("[data-dompet-saldo]").textContent =
      dompetAktif ? rupiah(dompetAktif.saldo) : rupiah(0);

    const ikonDompet = document.querySelector("[data-dompet-ikon]");
    if (ikonDompet && dompetAktif) {
      ikonDompet.setAttribute("name", dompetAktif.ikon);
    }

    /* Tombol detail berada TERPISAH dari kartu pemilih dompet.
       Jadi satu elemen = satu fungsi:
       - kartu dompet -> ganti dompet
       - tombol detail -> analisis dompet aktif */
    const linkDetailDompet =
      document.querySelector("[data-detail-dompet]");

    const namaDetailDompet =
      document.querySelector("[data-detail-dompet-nama]");

    if (linkDetailDompet && dompetAktif) {
      linkDetailDompet.href =
        `dompet-detail.html?id=${encodeURIComponent(dompetAktif.id)}`;

      if (namaDetailDompet) {
        namaDetailDompet.textContent = dompetAktif.nama;
      }
    }

    const tabs = document.querySelectorAll("[data-jenis]");
    tabs.forEach(btn => {
      btn.classList.toggle("is-aktif", btn.dataset.jenis === pengaturan.jenisAktif);
      btn.onclick = () => {
        pengaturan.jenisAktif = btn.dataset.jenis;
        simpan(KUNCI.pengaturan, pengaturan);
        renderHome();
      };
    });

    const labelPeriode = {
      month: "Month",
      week: "Week",
      year: "Year",
      all: "Semua"
    };
    document.querySelector("[data-label-periode]").textContent =
      labelPeriode[pengaturan.periodeAktif] || "Month";

    /* HOME sekarang selalu mengikuti dompet aktif.
       Transaksi dompet lain tidak boleh ikut tampil. */
    const transaksiDompetAktif = transaksi.filter(
      t => t.dompetId === dompetAktif?.id
    );

    let filtered = transaksiTerfilter(
      transaksiDompetAktif,
      pengaturan.jenisAktif,
      pengaturan.periodeAktif
    ).sort((a,b) => parseTanggal(b.tanggal) - parseTanggal(a.tanggal));

    panel.innerHTML = "";
    if (!filtered.length) {
      panel.innerHTML = `
        <div class="kosong-data">
          <ion-icon name="receipt-outline"></ion-icon>
          Belum ada transaksi ${pengaturan.jenisAktif}
          untuk ${dompetAktif?.nama || "dompet ini"} pada periode ini.
        </div>`;
    } else {
      let tanggalSebelumnya = "";
      filtered.forEach(t => {
        if (tanggalSebelumnya !== t.tanggal) {
          const h2 = document.createElement("h2");
          h2.textContent = tanggalID(t.tanggal);
          panel.appendChild(h2);
          tanggalSebelumnya = t.tanggal;
        }

        const akunT = cari(akun, t.akunId);
        const btn = document.createElement("button");
        btn.className = "transaksi";
        btn.type = "button";
        btn.innerHTML = `
          <span class="transaksi-ikon ${t.jenis === "pemasukan" ? "pemasukan" : ""}">
            <ion-icon name="${akunT?.ikon || "ellipse-outline"}"></ion-icon>
          </span>
          <span class="transaksi-info">
            <strong>${akunT?.nama || "Akun"}</strong>
            <span>${rupiah(t.jumlah)}</span>
          </span>
          <ion-icon class="transaksi-chevron" name="chevron-forward-outline"></ion-icon>`;
        btn.onclick = () => location.href = `detail-transaksi.html?id=${encodeURIComponent(t.id)}`;
        panel.appendChild(btn);
      });
    }

    const isiDompet = document.querySelector("[data-sheet-dompet-list]");
    if (isiDompet) {
      isiDompet.innerHTML = "";
      dompet.forEach(d => {
        const btn = document.createElement("button");
        btn.className = "pilihan-sheet";
        btn.innerHTML = `
          <ion-icon name="${d.ikon}"></ion-icon>
          <span><strong>${d.nama}</strong><br><small>${rupiah(d.saldo)}</small></span>
          ${d.id === dompetAktif?.id ? '<ion-icon class="cek" name="checkmark-circle"></ion-icon>' : ""}`;
        btn.onclick = () => {
          pengaturan.dompetAktif = d.id;
          simpan(KUNCI.pengaturan, pengaturan);
          tutupSheet("sheet-dompet");
          renderHome();
        };
        isiDompet.appendChild(btn);
      });
    }

    document.querySelector("[data-buka-dompet]").onclick = () => bukaSheet("sheet-dompet");
    document.querySelector("[data-buka-periode]").onclick = () => bukaSheet("sheet-periode");

    document.querySelectorAll("[data-periode]").forEach(btn => {
      btn.classList.toggle("is-aktif", btn.dataset.periode === pengaturan.periodeAktif);
      btn.onclick = () => {
        pengaturan.periodeAktif = btn.dataset.periode;
        simpan(KUNCI.pengaturan, pengaturan);
        tutupSheet("sheet-periode");
        renderHome();
      };
    });
  }

  function isiSelectDompet(select, dompet, nilai = "") {
    select.innerHTML = dompet.map(d =>
      `<option value="${d.id}" ${d.id === nilai ? "selected" : ""}>${d.nama}</option>`
    ).join("");
  }

  function isiSelectAkun(select, akun, jenis, nilai = "") {
    const list = akun.filter(a => a.jenis === jenis);
    select.innerHTML = list.map(a =>
      `<option value="${a.id}" ${a.id === nilai ? "selected" : ""}>${a.nama}</option>`
    ).join("");
  }

  function renderFormTransaksi() {
    const form = document.querySelector("[data-form-transaksi]");
    if (!form) return;

    let { dompet, akun, transaksi, pengaturan, keluarga } = dataAplikasi();

    /* Transaksi membutuhkan sumber dana.
       Jika belum ada dompet, arahkan ke onboarding dompet. */
    if (dompet.length === 0) {
      location.replace("dompet-form.html?setup=awal");
      return;
    }

    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const lama = id ? cari(transaksi, id) : null;

    /* Jika form dibuka dari Detail Dompet:
       transaksi.html?dompet=<ID>
       maka dompet tersebut otomatis menjadi pilihan awal. */
    const dompetDariURL = params.get("dompet");

    const dompetAwalDariURL =
      dompet.some(item => item.id === dompetDariURL)
        ? dompetDariURL
        : "";

    const state = {
      jenis: lama?.jenis || pengaturan.jenisAktif || "pengeluaran"
    };

    const tanggal = form.elements.tanggal;
    const dompetEl = form.elements.dompet;
    const akunEl = form.elements.akun;
    const keterangan = form.elements.keterangan;
    const jumlah = form.elements.jumlah;
    const judul = document.querySelector("[data-judul-form]");

    if (!dompet.length) {
      tampilPesan("Buat dompet terlebih dahulu.");
    }
    if (!akun.some(a => a.jenis === state.jenis)) {
      tampilPesan("Belum ada akun untuk jenis transaksi ini.");
    }

    judul.textContent = lama ? "Edit Transaksi" : "Tambah Transaksi";
    tanggal.value = lama?.tanggal || new Date().toISOString().slice(0,10);
    keterangan.value = lama?.keterangan || "";
    jumlah.value = lama?.jumlah || "";

    function refreshPilihan() {
      document.querySelectorAll("[data-form-jenis]").forEach(btn => {
        btn.classList.toggle("is-aktif", btn.dataset.formJenis === state.jenis);
      });
      isiSelectDompet(
        dompetEl,
        dompet,
        lama?.dompetId ||
          dompetAwalDariURL ||
          pengaturan.dompetAktif
      );

      isiSelectAkun(
        akunEl,
        akun,
        state.jenis,
        lama?.akunId || ""
      );
    }

    document.querySelectorAll("[data-form-jenis]").forEach(btn => {
      btn.onclick = () => {
        state.jenis = btn.dataset.formJenis;
        isiSelectAkun(akunEl, akun, state.jenis);
        document.querySelectorAll("[data-form-jenis]").forEach(x =>
          x.classList.toggle("is-aktif", x === btn)
        );
      };
    });

    refreshPilihan();

    form.onsubmit = e => {
      e.preventDefault();

      const nilai = Number(jumlah.value);
      if (!tanggal.value || !dompetEl.value || !akunEl.value || nilai <= 0) {
        return tampilPesan("Lengkapi tanggal, dompet, akun, dan nominal.");
      }

      const pencatat = anggotaSaatIni(keluarga);

      const nilaiBaru = {
        id: lama?.id || idBaru("t"),
        jenis: state.jenis,
        tanggal: tanggal.value,
        dompetId: dompetEl.value,
        akunId: akunEl.value,
        keterangan: keterangan.value.trim(),
        jumlah: nilai,

        /* Identitas pencatat disimpan sejak sekarang.
           Saat backend masuk nanti, nilai ini akan berasal dari user login. */
        dibuatOleh: lama?.dibuatOleh || pencatat?.id || ""
      };

      if (lama) {
        const dompetLama = cari(dompet, lama.dompetId);
        if (dompetLama) {
          dompetLama.saldo += lama.jenis === "pengeluaran" ? lama.jumlah : -lama.jumlah;
        }
        transaksi = transaksi.map(t => t.id === lama.id ? nilaiBaru : t);
      } else {
        transaksi.push(nilaiBaru);
      }

      const dompetBaru = cari(dompet, nilaiBaru.dompetId);
      if (dompetBaru) {
        dompetBaru.saldo += nilaiBaru.jenis === "pengeluaran" ? -nilaiBaru.jumlah : nilaiBaru.jumlah;
      }

      simpan(KUNCI.dompet, dompet);
      simpan(KUNCI.transaksi, transaksi);
      location.href = `detail-transaksi.html?id=${encodeURIComponent(nilaiBaru.id)}`;
    };
  }

  function renderDetailTransaksi() {
    const root = document.querySelector("[data-detail-transaksi]");
    if (!root) return;

    let { dompet, akun, transaksi, pengaturan, keluarga } = dataAplikasi();
    const id = queryId();
    const t = cari(transaksi, id);

    if (!t) {
      root.innerHTML = `<div class="kosong-data">Transaksi tidak ditemukan.</div>`;
      return;
    }

    const d = cari(dompet, t.dompetId);
    const a = cari(akun, t.akunId);
    const tanda = t.jenis === "pengeluaran" ? "− " : "+ ";

    const anggotaPencatat =
      keluarga?.anggota?.find(item => item.id === t.dibuatOleh);

    /* Fallback untuk transaksi lama yang dibuat sebelum fitur keluarga ada. */
    const namaPencatat =
      anggotaPencatat?.nama ||
      pengaturan?.nama ||
      "Pengguna";

    root.innerHTML = `
      <div class="detail-utama">
        <div class="detail-ikon"><ion-icon name="${a?.ikon || "ellipse-outline"}"></ion-icon></div>
        <h2>${a?.nama || "Akun"}</h2>
        <p class="detail-nominal ${t.jenis === "pemasukan" ? "pemasukan" : ""}">${tanda}${rupiah(t.jumlah)}</p>
      </div>

      <div class="detail-list">
        <div class="detail-baris"><span>Tanggal</span><strong>${tanggalID(t.tanggal)}</strong></div>
        <div class="detail-baris"><span>Dompet</span><strong>${d?.nama || "-"}</strong></div>
        <div class="detail-baris"><span>Akun</span><strong>${a?.nama || "-"}</strong></div>
        <div class="detail-baris"><span>Dicatat oleh</span><strong>${namaPencatat}</strong></div>
        <div class="detail-baris"><span>Keterangan</span><strong>${t.keterangan || "-"}</strong></div>
      </div>

      <div class="baris-tombol" style="margin-top:16px">
        <a class="tombol-sekunder" href="transaksi.html?id=${encodeURIComponent(t.id)}">
          <ion-icon name="create-outline"></ion-icon> Edit
        </a>
        <button class="tombol-bahaya" type="button" data-hapus-transaksi>
          <ion-icon name="trash-outline"></ion-icon> Hapus
        </button>
      </div>`;

    root.querySelector("[data-hapus-transaksi]").onclick = () => {
      if (!confirm("Hapus transaksi ini?")) return;

      const wallet = cari(dompet, t.dompetId);
      if (wallet) {
        wallet.saldo += t.jenis === "pengeluaran" ? t.jumlah : -t.jumlah;
      }

      transaksi = transaksi.filter(x => x.id !== t.id);
      simpan(KUNCI.dompet, dompet);
      simpan(KUNCI.transaksi, transaksi);
      location.href = "index.html";
    };
  }

  function renderDompet() {
    const list = document.querySelector("[data-daftar-dompet]");
    if (!list) return;

    const { dompet } = dataAplikasi();
    list.innerHTML = "";

    if (!dompet.length) {
      list.innerHTML = `<div class="kosong-data"><ion-icon name="wallet-outline"></ion-icon>Belum ada dompet.</div>`;
      return;
    }

    dompet.forEach(d => {
      const a = document.createElement("a");
      a.href = `dompet-form.html?id=${encodeURIComponent(d.id)}`;
      a.className = "kartu-list";
      a.innerHTML = `
        <span class="ikon-bulat"><ion-icon name="${d.ikon}"></ion-icon></span>
        <span class="kartu-list-info"><strong>${d.nama}</strong><span>${d.jenis}</span></span>
        <span class="kartu-list-nilai">${rupiah(d.saldo)}</span>
        <ion-icon name="chevron-forward-outline"></ion-icon>`;
      list.appendChild(a);
    });
  }

  function renderFormDompet() {
    const form = document.querySelector("[data-form-dompet]");
    if (!form) return;

    let { dompet, transaksi, pengaturan } = dataAplikasi();

    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const lama = id ? cari(dompet, id) : null;

    /* setup=awal hanya berlaku saat membuat dompet baru. */
    const setupAwal =
      params.get("setup") === "awal" &&
      !lama;

    /* Kalau setup lama terbuka lagi padahal sudah ada dompet,
       tidak perlu mengulang onboarding. */
    if (setupAwal && dompet.length > 0) {
      location.replace("index.html");
      return;
    }

    const judul = document.querySelector("[data-judul-form]");
    const intro = document.querySelector("[data-setup-dompet]");
    const tombolKembali = document.querySelector("[data-kembali-dompet]");
    const tombolSimpan = document.querySelector("[data-simpan-dompet]");
    const labelSaldo = document.querySelector("[data-label-saldo]");

    if (setupAwal) {
      judul.textContent = "Siapkan Dompet Pertamamu";

      if (intro) intro.hidden = false;
      if (tombolKembali) tombolKembali.hidden = true;
      if (tombolSimpan) {
        tombolSimpan.textContent = "Mulai Menggunakan Aplikasi";
      }
      if (labelSaldo) {
        labelSaldo.textContent = "Saldo Awal";
      }
    } else {
      judul.textContent =
        lama ? "Edit Dompet" : "Tambah Dompet";
    }

    if (lama) {
      form.elements.nama.value = lama.nama;
      form.elements.jenis.value = lama.jenis;
      form.elements.saldo.value = lama.saldo;
      form.elements.ikon.value = lama.ikon;

      document.querySelector("[data-hapus-dompet]").hidden = false;
    }

    form.onsubmit = e => {
      e.preventDefault();

      const item = {
        id: lama?.id || idBaru("d"),
        nama: form.elements.nama.value.trim(),
        jenis: form.elements.jenis.value,
        saldo: Number(form.elements.saldo.value || 0),
        ikon: form.elements.ikon.value
      };

      if (!item.nama) {
        return tampilPesan("Nama dompet wajib diisi.");
      }

      if (lama) {
        dompet = dompet.map(d =>
          d.id === lama.id ? item : d
        );
      } else {
        dompet.push(item);
      }

      /* Dompet pertama otomatis menjadi dompet aktif. */
      if (!pengaturan.dompetAktif) {
        pengaturan.dompetAktif = item.id;
      }

      simpan(KUNCI.dompet, dompet);
      simpan(KUNCI.pengaturan, pengaturan);

      location.href =
        setupAwal ? "index.html" : "dompet.html";
    };

    const hapus =
      document.querySelector("[data-hapus-dompet]");

    if (hapus) {
      hapus.onclick = () => {
        if (!lama) return;

        if (
          transaksi.some(t => t.dompetId === lama.id)
        ) {
          return tampilPesan(
            "Dompet masih dipakai transaksi dan belum bisa dihapus."
          );
        }

        if (!confirm(`Hapus dompet ${lama.nama}?`)) {
          return;
        }

        dompet = dompet.filter(
          d => d.id !== lama.id
        );

        if (
          pengaturan.dompetAktif === lama.id
        ) {
          pengaturan.dompetAktif =
            dompet[0]?.id || "";
        }

        simpan(KUNCI.dompet, dompet);
        simpan(KUNCI.pengaturan, pengaturan);

        /* Kalau dompet terakhir dihapus, masuk setup lagi. */
        location.href =
          dompet.length === 0
            ? "dompet-form.html?setup=awal"
            : "dompet.html";
      };
    }
  }

  function renderAkun() {
    const root = document.querySelector("[data-daftar-akun]");
    if (!root) return;

    const { akun } = dataAplikasi();
    root.innerHTML = "";

    ["pengeluaran", "pemasukan"].forEach(jenis => {
      const judul = document.createElement("h2");
      judul.className = "judul-grup";
      judul.textContent = jenis;
      root.appendChild(judul);

      const list = akun.filter(a => a.jenis === jenis);
      list.forEach(a => {
        const link = document.createElement("a");
        link.className = "kartu-list";
        link.href = `akun-form.html?id=${encodeURIComponent(a.id)}`;
        link.innerHTML = `
          <span class="ikon-bulat"><ion-icon name="${a.ikon}"></ion-icon></span>
          <span class="kartu-list-info"><strong>${a.nama}</strong><span>${jenis}</span></span>
          <ion-icon name="chevron-forward-outline"></ion-icon>`;
        root.appendChild(link);
      });
    });
  }

  function renderFormAkun() {
    const form = document.querySelector("[data-form-akun]");
    if (!form) return;

    let { akun, transaksi } = dataAplikasi();
    const id = queryId();
    const lama = id ? cari(akun, id) : null;

    document.querySelector("[data-judul-form]").textContent =
      lama ? "Edit Akun" : "Tambah Akun";

    if (lama) {
      form.elements.nama.value = lama.nama;
      form.elements.jenis.value = lama.jenis;
      form.elements.ikon.value = lama.ikon;
      document.querySelector("[data-hapus-akun]").hidden = false;
    }

    form.onsubmit = e => {
      e.preventDefault();

      const item = {
        id: lama?.id || idBaru("a"),
        nama: form.elements.nama.value.trim(),
        jenis: form.elements.jenis.value,
        ikon: form.elements.ikon.value
      };

      if (!item.nama) return tampilPesan("Nama akun wajib diisi.");

      if (lama) akun = akun.map(a => a.id === lama.id ? item : a);
      else akun.push(item);

      simpan(KUNCI.akun, akun);
      location.href = "akun.html";
    };

    const hapus = document.querySelector("[data-hapus-akun]");
    if (hapus) hapus.onclick = () => {
      if (!lama) return;
      if (transaksi.some(t => t.akunId === lama.id)) {
        return tampilPesan("Akun masih dipakai transaksi dan belum bisa dihapus.");
      }
      if (!confirm(`Hapus akun ${lama.nama}?`)) return;

      akun = akun.filter(a => a.id !== lama.id);
      simpan(KUNCI.akun, akun);
      location.href = "akun.html";
    };
  }

  function renderPengaturan() {
    const form = document.querySelector("[data-form-pengaturan]");
    if (!form || window.AUTH_BACKEND_MODE === true) return;

    let { pengaturan } = dataAplikasi();
    form.elements.nama.value = pengaturan.nama;

    form.onsubmit = e => {
      e.preventDefault();

      const namaBaru =
        form.elements.nama.value.trim();

      if (!namaBaru) {
        return tampilPesan("Nama pengguna wajib diisi.");
      }

      /* Baca ulang data TERBARU saat tombol Simpan Profil diklik.
         Ini penting karena foto profil bisa berubah setelah halaman dibuka.
         Kalau kita memakai object keluarga lama dari saat page load,
         foto yang baru di-upload akan tertimpa dan hilang. */
      const dataTerbaru = dataAplikasi();
      pengaturan = dataTerbaru.pengaturan;

      const keluargaTerbaru =
        dataTerbaru.keluarga;

      pengaturan.nama = namaBaru;

      /* Nama profil lokal dan nama anggota aktif dibuat tetap sinkron,
         tanpa menimpa fotoProfil atau data anggota terbaru lainnya. */
      const anggotaAktif =
        anggotaSaatIni(keluargaTerbaru);

      if (anggotaAktif) {
        anggotaAktif.nama =
          pengaturan.nama;
      }

      simpan(
        KUNCI.pengaturan,
        pengaturan
      );

      if (keluargaTerbaru) {
        simpan(
          KUNCI.keluarga,
          keluargaTerbaru
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          "profil-pengguna-berubah"
        )
      );

      tampilPesan("Profil disimpan.");
    };

    const tombolResetLokal = document.querySelector("[data-hapus-semua-data]");
    if (tombolResetLokal) tombolResetLokal.onclick = () => {
      const setuju = confirm(
        window.AUTH_BACKEND_MODE === true
          ? "Reset data lokal pada perangkat ini? Data Supabase (dompet, akun, transaksi, dan keluarga backend) TIDAK dihapus."
          : "Hapus SEMUA dompet, akun, transaksi, keluarga, pengaturan, dan preferensi tampilan? Data ini tidak bisa dikembalikan."
      );

      if (setuju) {
        hapusSemuaData();
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    /* Home yang sudah memakai Supabase tidak lagi bergantung pada
       setup keluarga localStorage. Halaman lain untuk sementara
       masih memakai guard lama sampai dimigrasikan satu per satu. */
    const homeBackendAktif =
      window.HOME_BACKEND_MODE === true &&
      Boolean(document.querySelector("[data-home-transaksi]"));

    const authBackendAktif =
      window.AUTH_BACKEND_MODE === true;

    /* Guard localStorage hanya dipakai halaman legacy yang belum
       masuk Auth/Supabase. Halaman production memakai auth-guard.js. */
    if (!homeBackendAktif && !authBackendAktif && !setupKeluargaSelesai()) {
      location.replace("keluarga-awal.html");
      return;
    }

    /* Migration nama lama hanya relevan untuk localStorage murni. */
    if (!homeBackendAktif && !authBackendAktif) {
      sinkronNamaAnggotaAktif();
    }

    pasangTutupSheet();

    /* Home backend dirender oleh js/pages/home-backend.js. */
    if (!homeBackendAktif) {
      renderHome();
    }

    renderFormTransaksi();
    renderDetailTransaksi();
    renderDompet();
    renderFormDompet();
    renderAkun();
    renderFormAkun();
    renderPengaturan();
  });
})();
