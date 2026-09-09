(() => {
  "use strict";

  const form = document.querySelector("[data-form-transaksi]");
  if (!form) return;

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";

  const DEFAULT_PREFERENSI = {
    dompetAktif: "",
    jenisAktif: "pengeluaran",
    periodeAktif: "month",
    familyAktif: ""
  };

  const KIND_DB = {
    pengeluaran: "expense",
    pemasukan: "income",
    transfer: "transfer"
  };

  const KIND_UI = {
    expense: "pengeluaran",
    income: "pemasukan",
    transfer: "transfer"
  };

  const notifikasi = document.querySelector("[data-notifikasi]");
  const judul = document.querySelector("[data-judul-form]");
  const tombolKembali = document.querySelector("[data-kembali-transaksi]");
  const grupAkun = document.querySelector("[data-grup-akun]");
  const grupTujuan = document.querySelector("[data-grup-tujuan]");
  const grupBiayaTransfer = document.querySelector("[data-grup-biaya-transfer]");
  const grupModeBiaya = document.querySelector("[data-grup-mode-biaya]");
  const ringkasanTransfer = document.querySelector("[data-ringkasan-transfer]");
  const labelDompet = document.querySelector("[data-label-dompet]");

  const tanggal = form.elements.tanggal;
  const dompetEl = form.elements.dompet;
  const tujuanEl = form.elements.dompetTujuan;
  const akunEl = form.elements.akun;
  const keterangan = form.elements.keterangan;
  const jumlah = form.elements.jumlah;
  const biayaAdmin = form.elements.biayaAdmin;
  const modeBiaya = form.elements.modeBiaya;
  const tombolSimpan = form.querySelector('[type="submit"]');

  const categoryTrigger = document.querySelector("[data-category-trigger]");
  const categorySelected = document.querySelector("[data-category-selected]");
  const categorySelectedParent = document.querySelector("[data-category-selected-parent]");
  const categoryLayer = document.querySelector("[data-category-layer]");
  const categoryClose = document.querySelector("[data-category-close]");
  const categorySearch = document.querySelector("[data-category-search]");
  const categoryList = document.querySelector("[data-category-list]");
  const expandedCategories = new Set();

  const params = new URLSearchParams(location.search);
  const idEdit = params.get("id");
  const fromWalletId = params.get("from_wallet") || "";

  function hrefDetail(id) {
    return `detail-transaksi.html?id=${encodeURIComponent(id)}` +
      (fromWalletId ? `&from_wallet=${encodeURIComponent(fromWalletId)}` : "");
  }
  const dompetDariURL = params.get("dompet");
  const modeDariURL = params.get("mode");

  let familyAktif = null;
  let detailEdit = null;
  let dompet = [];
  let akun = [];
  let jenisAktif = "pengeluaran";
  let operationId = null;
  let sedangMenyimpan = false;

  function bacaPreferensi() {
    try {
      const isi = JSON.parse(
        localStorage.getItem(KUNCI_PENGATURAN) || "{}"
      );
      return { ...DEFAULT_PREFERENSI, ...isi };
    } catch {
      return { ...DEFAULT_PREFERENSI };
    }
  }

  function simpanPreferensi(data) {
    const lama = bacaPreferensi();
    localStorage.setItem(
      KUNCI_PENGATURAN,
      JSON.stringify({ ...lama, ...data })
    );
  }

  function simpanPreferensiJenis() {
    /* Home hanya punya tab Pengeluaran/Pemasukan.
       Memilih Transfer di form sengaja TIDAK mengubah jenisAktif Home. */
    if (jenisAktif === "pengeluaran" || jenisAktif === "pemasukan") {
      simpanPreferensi({ jenisAktif });
    }
  }

  function tampilPesan(teks) {
    if (!notifikasi) return;
    notifikasi.textContent = teks;
    notifikasi.hidden = false;
  }

  function sembunyikanPesan() {
    if (notifikasi) notifikasi.hidden = true;
  }

  function setFormAktif(aktif) {
    form.querySelectorAll("button,input,select").forEach(el => {
      el.disabled = !aktif;
    });
  }

  function labelSimpan() {
    if (idEdit) return "Simpan Perubahan";
    return jenisAktif === "transfer" ? "Transfer Sekarang" : "Simpan Transaksi";
  }

  function setMenyimpan(aktif) {
    sedangMenyimpan = aktif;
    if (!tombolSimpan) return;
    tombolSimpan.disabled = aktif;
    tombolSimpan.textContent = aktif ? "Menyimpan..." : labelSimpan();
  }

  function angkaDariInput(el) {
    const digit = String(el?.value || "").replace(/\D/g, "");
    if (!digit) return 0;
    const nilai = Number(digit);
    return Number.isSafeInteger(nilai) ? nilai : Number.NaN;
  }

  function formatNominal(nilai) {
    const digit = String(nilai ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (!digit) return "";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(digit));
  }

  function pasangFormatNominal(el, { allowZero = false } = {}) {
    if (!el) return;
    el.addEventListener("input", () => {
      const angka = angkaDariInput(el);
      if (!Number.isFinite(angka)) {
        el.value = "";
        return;
      }
      if (angka === 0 && !allowZero && !String(el.value).replace(/\D/g, "")) {
        el.value = "";
        return;
      }
      el.value = formatNominal(angka);
    });
  }

  function tanggalHariIni() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function rupiah(angka) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(Number(angka || 0));
  }

  function nilaiBiayaAdmin() {
    const nilai = angkaDariInput(biayaAdmin);
    return Number.isSafeInteger(nilai) && nilai >= 0 ? nilai : 0;
  }

  function refreshRingkasanTransfer() {
    if (!ringkasanTransfer) return;

    if (jenisAktif !== "transfer") {
      ringkasanTransfer.hidden = true;
      return;
    }

    const nominal = angkaDariInput(jumlah);
    const fee = nilaiBiayaAdmin();
    const mode = fee > 0 ? modeBiaya?.value : null;
    const sumber = dompetById(dompetEl.value);
    const tujuan = dompetById(tujuanEl?.value);

    if (!Number.isSafeInteger(nominal) || nominal <= 0 || !sumber || !tujuan) {
      ringkasanTransfer.hidden = true;
      return;
    }

    if (mode === "deducted" && fee >= nominal) {
      ringkasanTransfer.textContent =
        "Biaya admin yang dipotong harus lebih kecil dari nominal transfer.";
      ringkasanTransfer.hidden = false;
      return;
    }

    const keluarSumber = mode === "added" ? nominal + fee : nominal;
    const diterimaTujuan = mode === "deducted" ? nominal - fee : nominal;

    ringkasanTransfer.textContent = fee > 0
      ? `${sumber.name} keluar ${rupiah(keluarSumber)} • ${tujuan.name} menerima ${rupiah(diterimaTujuan)} • biaya admin ${rupiah(fee)}`
      : `${sumber.name} keluar ${rupiah(nominal)} • ${tujuan.name} menerima ${rupiah(nominal)} • tanpa biaya admin`;

    ringkasanTransfer.hidden = false;
  }

  function dompetById(id) {
    return dompet.find(item => item.wallet_id === id) || null;
  }

  function isiDompet(nilaiPilihan = "") {
    dompetEl.innerHTML = "";

    dompet.forEach(item => {
      const option = document.createElement("option");
      option.value = item.wallet_id;
      option.textContent = item.name;
      option.selected = item.wallet_id === nilaiPilihan;
      dompetEl.appendChild(option);
    });
  }

  function daftarTujuanValid() {
    const sumber = dompetById(dompetEl.value);
    if (!sumber) return [];

    return dompet.filter(item =>
      item.wallet_id !== sumber.wallet_id &&
      item.currency_code === sumber.currency_code
    );
  }

  function isiTujuan(nilaiPilihan = "") {
    if (!tujuanEl) return;

    const list = daftarTujuanValid();
    tujuanEl.innerHTML = "";

    list.forEach(item => {
      const option = document.createElement("option");
      option.value = item.wallet_id;
      option.textContent = item.name;
      option.selected = item.wallet_id === nilaiPilihan;
      tujuanEl.appendChild(option);
    });

    if (!list.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Tidak ada dompet tujuan yang valid";
      tujuanEl.appendChild(option);
    }
  }

  function escapeHTML(teks) {
    return String(teks ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function kategoriAktif() {
    if (jenisAktif === "transfer") return [];
    const kind = KIND_DB[jenisAktif];
    return akun.filter(item => item.kind === kind && !item.archived_at);
  }

  function urutKategori(list) {
    return [...list].sort((a, b) => {
      const order = Number(a.sort_order || 0) - Number(b.sort_order || 0);
      if (order !== 0) return order;
      return String(a.name || "").localeCompare(String(b.name || ""), "id");
    });
  }

  function kategoriById(id) {
    return akun.find(item => item.id === id) || null;
  }

  function refreshCategoryTrigger() {
    if (!categoryTrigger || !categorySelected) return;

    const selected = kategoriById(akunEl.value);
    if (!selected) {
      categorySelected.textContent = "Pilih kategori";
      if (categorySelectedParent) {
        categorySelectedParent.textContent = "";
        categorySelectedParent.hidden = true;
      }
      return;
    }

    categorySelected.textContent = selected.name || "Kategori";

    if (categorySelectedParent) {
      const parent = selected.parent_id ? kategoriById(selected.parent_id) : null;
      categorySelectedParent.textContent = parent?.name || "";
      categorySelectedParent.hidden = !parent;
    }
  }

  function renderCategoryPicker() {
    if (!categoryList) return;

    const list = kategoriAktif();
    const query = String(categorySearch?.value || "").trim().toLocaleLowerCase("id");
    const parents = urutKategori(list.filter(item => !item.parent_id));
    const selectedId = akunEl.value;

    categoryList.innerHTML = "";

    if (!list.length) {
      categoryList.innerHTML = '<div class="category-picker-empty">Belum ada kategori untuk jenis transaksi ini.</div>';
      return;
    }

    let rendered = 0;

    parents.forEach(parent => {
      const children = urutKategori(list.filter(item => item.parent_id === parent.id));
      const parentMatch = String(parent.name || "").toLocaleLowerCase("id").includes(query);
      const matchingChildren = query
        ? children.filter(child => String(child.name || "").toLocaleLowerCase("id").includes(query))
        : children;

      if (query && !parentMatch && !matchingChildren.length) return;

      const group = document.createElement("section");
      group.className = "category-picker-group";

      const row = document.createElement("div");
      row.className = "category-picker-parent-row";

      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = "category-picker-choice category-picker-parent-choice";
      choice.dataset.categoryId = parent.id;
      choice.innerHTML = `
        <span class="category-picker-icon"><ion-icon name="${escapeHTML(parent.icon_value || "folder-outline")}"></ion-icon></span>
        <span class="category-picker-name">${escapeHTML(parent.name || "Kategori")}</span>
        ${selectedId === parent.id ? '<ion-icon class="category-picker-check" name="checkmark-circle"></ion-icon>' : ""}
      `;
      row.appendChild(choice);

      if (children.length) {
        const expand = document.createElement("button");
        expand.type = "button";
        expand.className = "category-picker-expand";
        expand.dataset.categoryExpand = parent.id;

        const shouldExpand = query
          ? true
          : expandedCategories.has(parent.id);

        expand.setAttribute("aria-expanded", shouldExpand ? "true" : "false");
        expand.setAttribute("aria-label", `${shouldExpand ? "Tutup" : "Buka"} subkategori ${parent.name}`);
        expand.innerHTML = `<span>${children.length}</span><ion-icon name="${shouldExpand ? "chevron-up-outline" : "chevron-down-outline"}"></ion-icon>`;
        row.appendChild(expand);
      }

      group.appendChild(row);

      const shouldShowChildren = children.length && (query || expandedCategories.has(parent.id));
      if (shouldShowChildren) {
        const childWrap = document.createElement("div");
        childWrap.className = "category-picker-children";

        const visibleChildren = query && !parentMatch ? matchingChildren : children;
        visibleChildren.forEach(child => {
          const childButton = document.createElement("button");
          childButton.type = "button";
          childButton.className = "category-picker-choice category-picker-child-choice";
          childButton.dataset.categoryId = child.id;
          childButton.innerHTML = `
            <span class="category-picker-guide" aria-hidden="true">↳</span>
            <span class="category-picker-icon"><ion-icon name="${escapeHTML(child.icon_value || parent.icon_value || "ellipse-outline")}"></ion-icon></span>
            <span class="category-picker-name">${escapeHTML(child.name || "Subkategori")}</span>
            ${selectedId === child.id ? '<ion-icon class="category-picker-check" name="checkmark-circle"></ion-icon>' : ""}
          `;
          childWrap.appendChild(childButton);
        });

        group.appendChild(childWrap);
      }

      categoryList.appendChild(group);
      rendered += 1;
    });

    if (!rendered) {
      categoryList.innerHTML = '<div class="category-picker-empty">Kategori tidak ditemukan.</div>';
    }
  }

  function bukaCategoryPicker() {
    if (!categoryLayer || jenisAktif === "transfer") return;

    expandedCategories.clear();
    const selected = kategoriById(akunEl.value);
    if (selected?.parent_id) expandedCategories.add(selected.parent_id);

    if (categorySearch) categorySearch.value = "";
    renderCategoryPicker();
    categoryLayer.hidden = false;
    document.body.classList.add("category-picker-open");

    requestAnimationFrame(() => categorySearch?.focus());
  }

  function tutupCategoryPicker() {
    if (!categoryLayer) return;
    const wasOpen = !categoryLayer.hidden;
    categoryLayer.hidden = true;
    document.body.classList.remove("category-picker-open");
    if (wasOpen) categoryTrigger?.focus();
  }

  function pilihKategori(id) {
    const selected = kategoriById(id);
    if (!selected || selected.kind !== KIND_DB[jenisAktif] || selected.archived_at) return;

    akunEl.value = selected.id;
    refreshCategoryTrigger();
    tutupCategoryPicker();
    sembunyikanPesan();
  }

  function isiAkun(nilaiPilihan = "") {
    akunEl.innerHTML = "";
    if (jenisAktif === "transfer") {
      refreshCategoryTrigger();
      return;
    }

    const list = kategoriAktif();

    urutKategori(list).forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      option.selected = item.id === nilaiPilihan;
      akunEl.appendChild(option);
    });

    if (!list.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = jenisAktif === "pengeluaran"
        ? "Belum ada kategori pengeluaran"
        : "Belum ada kategori pemasukan";
      akunEl.appendChild(option);
    } else if (nilaiPilihan && list.some(item => item.id === nilaiPilihan)) {
      akunEl.value = nilaiPilihan;
    } else {
      akunEl.value = "";
    }

    refreshCategoryTrigger();
  }

  function renderJenis() {
    pasangFormatNominal(jumlah);
  pasangFormatNominal(biayaAdmin, { allowZero: true });

  document.querySelectorAll("[data-form-jenis]").forEach(btn => {
      btn.classList.toggle(
        "is-aktif",
        btn.dataset.formJenis === jenisAktif
      );
    });
  }

  function renderMode(nilaiAkun = "", nilaiTujuan = "") {
    const transfer = jenisAktif === "transfer";

    if (grupAkun) grupAkun.hidden = transfer;
    if (grupTujuan) grupTujuan.hidden = !transfer;
    if (grupBiayaTransfer) grupBiayaTransfer.hidden = !transfer;
    if (grupModeBiaya) grupModeBiaya.hidden = !transfer;
    if (ringkasanTransfer) ringkasanTransfer.hidden = !transfer;
    if (labelDompet) labelDompet.textContent = transfer ? "Dompet Sumber" : "Dompet";

    // Kategori divalidasi oleh JS karena native select disembunyikan oleh custom picker.
    akunEl.required = false;
    if (tujuanEl) tujuanEl.required = transfer;
    if (transfer) tutupCategoryPicker();

    if (transfer) {
      isiTujuan(nilaiTujuan);
      keterangan.placeholder = "Contoh: Pindah saldo ke DANA";
    } else {
      isiAkun(nilaiAkun);
      keterangan.placeholder = "Contoh: Makan siang";
    }

    if (tombolSimpan) tombolSimpan.textContent = labelSimpan();
    refreshRingkasanTransfer();
  }

  function pilihJenis(jenis) {
    if (!KIND_DB[jenis]) return;

    jenisAktif = jenis;
    simpanPreferensiJenis();
    renderJenis();
    renderMode();
    sembunyikanPesan();

    if (jenisAktif === "transfer" && dompet.length < 2) {
      tampilPesan("Transfer membutuhkan minimal dua dompet aktif.");
    }
  }

  async function dapatKeluargaAktif() {
    const preferensi = bacaPreferensi();
    const families = await FamilyService.ambilKeluargaSaya();

    if (!families.length) {
      throw new Error("Akun ini belum tergabung ke ruang keluarga.");
    }

    const family = families.find(item => item.id === preferensi.familyAktif) || families[0];

    if (family.id !== preferensi.familyAktif) {
      simpanPreferensi({ familyAktif: family.id });
    }

    return family;
  }

  async function dapatKeluargaEdit(detail) {
    const families = await FamilyService.ambilKeluargaSaya();
    const family = families.find(item => item.id === detail.family_id);

    if (!family) {
      throw new Error("Ruang keluarga transaksi tidak dapat diakses oleh akun ini.");
    }

    return family;
  }

  async function cekBolehEdit(detail, family) {
    const user = await AuthService.ambilUserAktif();
    if (!user) return false;

    return (
      detail.created_by === user.id ||
      family?.membership?.role === "owner"
    );
  }

  function walletTransaksi(detail) {
    if (detail.kind === "expense" || detail.kind === "income") {
      return detail.entries?.[0]?.wallet_id || "";
    }

    if (detail.kind === "transfer") {
      return detail.entries?.find(item => Number(item.amount_delta) < 0)?.wallet_id || "";
    }

    return "";
  }

  function walletTujuanTransaksi(detail) {
    if (detail.kind !== "transfer") return "";
    return detail.entries?.find(item => Number(item.amount_delta) > 0)?.wallet_id || "";
  }

  async function muatCreate() {
    familyAktif = await dapatKeluargaAktif();

    const sessionNow = await AuthService.ambilSession();
    const cachedWallets = window.FinanceCache?.read("wallets", familyAktif.id, sessionNow?.user?.id);
    const cachedCategories = window.FinanceCache?.read("categories", familyAktif.id, sessionNow?.user?.id);

    [dompet, akun] = await Promise.all([
      cachedWallets ? Promise.resolve(cachedWallets) : FinanceService.ambilSaldoDompet(familyAktif.id),
      cachedCategories ? Promise.resolve(cachedCategories) : FinanceService.ambilAkun(familyAktif.id)
    ]);

    if (!dompet.length) {
      throw new Error("Belum ada dompet backend. Buat dompet terlebih dahulu.");
    }

    const preferensi = bacaPreferensi();

    jenisAktif = modeDariURL === "transfer"
      ? "transfer"
      : (KIND_DB[preferensi.jenisAktif] && preferensi.jenisAktif !== "transfer"
          ? preferensi.jenisAktif
          : "pengeluaran");

    const dompetAwal =
      dompet.find(item => item.wallet_id === dompetDariURL)?.wallet_id ||
      dompet.find(item => item.wallet_id === preferensi.dompetAktif)?.wallet_id ||
      dompet[0].wallet_id;

    tanggal.value = tanggalHariIni();
    if (biayaAdmin) biayaAdmin.value = "0";
    if (modeBiaya) modeBiaya.value = "added";
    isiDompet(dompetAwal);
    renderJenis();
    renderMode();

    simpanPreferensi({
      familyAktif: familyAktif.id,
      dompetAktif: dompetAwal
    });
    simpanPreferensiJenis();

    if (judul) judul.textContent = "Tambah Transaksi";
    document.title = "Tambah Transaksi";
    if (tombolKembali) tombolKembali.href = "finance.html";
    if (tombolSimpan) tombolSimpan.textContent = labelSimpan();

    if (jenisAktif === "transfer" && dompet.length < 2) {
      tampilPesan("Transfer membutuhkan minimal dua dompet aktif.");
    }
  }

  async function muatEdit() {
    detailEdit = await FinanceService.ambilDetailTransaksi(idEdit);

    if (!detailEdit) {
      throw new Error("Transaksi tidak ditemukan atau tidak dapat diakses.");
    }

    if (detailEdit.voided_at) {
      throw new Error("Transaksi yang sudah dibatalkan tidak dapat diedit.");
    }

    if (!["expense", "income", "transfer"].includes(detailEdit.kind)) {
      throw new Error("Form edit belum mendukung transaksi adjustment.");
    }

    familyAktif = await dapatKeluargaEdit(detailEdit);

    const bolehEdit = await cekBolehEdit(detailEdit, familyAktif);
    if (!bolehEdit) {
      throw new Error("Hanya pencatat transaksi atau owner keluarga yang dapat mengedit transaksi ini.");
    }

    const sessionNow = await AuthService.ambilSession();
    const cachedWallets = window.FinanceCache?.read("wallets", familyAktif.id, sessionNow?.user?.id);
    const cachedCategories = window.FinanceCache?.read("categories", familyAktif.id, sessionNow?.user?.id);

    [dompet, akun] = await Promise.all([
      cachedWallets ? Promise.resolve(cachedWallets) : FinanceService.ambilSaldoDompet(familyAktif.id),
      cachedCategories ? Promise.resolve(cachedCategories) : FinanceService.ambilAkun(familyAktif.id)
    ]);

    if (!dompet.length) {
      throw new Error("Tidak ada dompet aktif yang dapat dipakai untuk mengedit transaksi.");
    }

    jenisAktif = KIND_UI[detailEdit.kind];

    const walletId = walletTransaksi(detailEdit);
    const destinationWalletId = walletTujuanTransaksi(detailEdit);

    if (!dompet.some(item => item.wallet_id === walletId)) {
      throw new Error("Dompet sumber transaksi sudah diarsipkan atau tidak tersedia.");
    }

    if (
      detailEdit.kind === "transfer" &&
      !dompet.some(item => item.wallet_id === destinationWalletId)
    ) {
      throw new Error("Dompet tujuan transaksi sudah diarsipkan atau tidak tersedia.");
    }

    if (
      detailEdit.kind !== "transfer" &&
      !akun.some(item => item.id === detailEdit.account_id)
    ) {
      throw new Error("Kategori transaksi sudah diarsipkan atau tidak tersedia.");
    }

    tanggal.value = detailEdit.occurred_on;
    keterangan.value = detailEdit.note || "";
    jumlah.value = formatNominal(detailEdit.amount);
    if (biayaAdmin) biayaAdmin.value = formatNominal(detailEdit.transfer_fee || 0) || "0";
    if (modeBiaya) modeBiaya.value = detailEdit.transfer_fee_mode || "added";

    isiDompet(walletId);
    renderJenis();
    renderMode(detailEdit.account_id || "", destinationWalletId);

    simpanPreferensi({
      familyAktif: familyAktif.id,
      dompetAktif: walletId
    });
    simpanPreferensiJenis();

    if (judul) judul.textContent = "Edit Transaksi";
    document.title = "Edit Transaksi";
    if (tombolKembali) {
      tombolKembali.href = hrefDetail(idEdit);
    }
    if (tombolSimpan) tombolSimpan.textContent = labelSimpan();
  }

  async function muatForm() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    setFormAktif(false);
    tampilPesan(
      idEdit
        ? "Mengambil transaksi dari backend..."
        : "Mengambil dompet dan kategori..."
    );

    try {
      const session = await AuthService.ambilSession();
      if (!session) {
        throw new Error("Belum ada session Supabase. Login terlebih dahulu.");
      }

      if (idEdit) await muatEdit();
      else await muatCreate();

      setFormAktif(true);
      if (!(jenisAktif === "transfer" && dompet.length < 2)) {
        sembunyikanPesan();
      }
    } catch (error) {
      console.error("[Transaksi Backend]", error);
      tampilPesan(error?.message || "Form transaksi belum dapat dimuat.");
      setFormAktif(false);

      if (idEdit && tombolKembali) {
        tombolKembali.href = hrefDetail(idEdit);
      }
    }
  }

  pasangFormatNominal(jumlah);
  pasangFormatNominal(biayaAdmin, { allowZero: true });

  document.querySelectorAll("[data-form-jenis]").forEach(btn => {
    btn.addEventListener("click", () => pilihJenis(btn.dataset.formJenis));
  });

  dompetEl.addEventListener("change", () => {
    simpanPreferensi({ dompetAktif: dompetEl.value });

    if (jenisAktif === "transfer") {
      const lama = tujuanEl?.value || "";
      isiTujuan(lama);
      refreshRingkasanTransfer();
    }
  });

  if (tujuanEl) {
    tujuanEl.addEventListener("change", refreshRingkasanTransfer);
  }

  jumlah.addEventListener("input", refreshRingkasanTransfer);

  if (biayaAdmin) {
    biayaAdmin.addEventListener("input", refreshRingkasanTransfer);
  }

  if (modeBiaya) {
    modeBiaya.addEventListener("change", refreshRingkasanTransfer);
  }

  categoryTrigger?.addEventListener("click", bukaCategoryPicker);
  categoryClose?.addEventListener("click", tutupCategoryPicker);
  categorySearch?.addEventListener("input", renderCategoryPicker);

  categoryLayer?.addEventListener("click", event => {
    if (event.target === categoryLayer) tutupCategoryPicker();
  });

  categoryList?.addEventListener("click", event => {
    const expand = event.target.closest("[data-category-expand]");
    if (expand) {
      const id = expand.dataset.categoryExpand;
      if (expandedCategories.has(id)) expandedCategories.delete(id);
      else expandedCategories.add(id);
      renderCategoryPicker();
      return;
    }

    const choice = event.target.closest("[data-category-id]");
    if (choice) pilihKategori(choice.dataset.categoryId);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && categoryLayer && !categoryLayer.hidden) {
      tutupCategoryPicker();
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sedangMenyimpan) return;

    sembunyikanPesan();

    const nilai = angkaDariInput(jumlah);
    const kind = KIND_DB[jenisAktif];
    const isTransfer = kind === "transfer";
    const transferFee = isTransfer ? angkaDariInput(biayaAdmin) : 0;
    const transferFeeMode = isTransfer && transferFee > 0
      ? modeBiaya?.value
      : null;

    if (
      !familyAktif?.id ||
      !tanggal.value ||
      !dompetEl.value ||
      !Number.isSafeInteger(nilai) ||
      nilai <= 0
    ) {
      tampilPesan("Lengkapi tanggal, dompet, dan nominal dengan benar.");
      return;
    }

    let accountId = null;
    let destinationWalletId = null;

    if (isTransfer) {
      if (!tujuanEl?.value) {
        tampilPesan("Pilih dompet tujuan transfer.");
        return;
      }

      if (tujuanEl.value === dompetEl.value) {
        tampilPesan("Dompet sumber dan tujuan harus berbeda.");
        return;
      }

      const sumber = dompetById(dompetEl.value);
      const tujuan = dompetById(tujuanEl.value);

      if (!sumber || !tujuan || sumber.currency_code !== tujuan.currency_code) {
        tampilPesan("Transfer hanya dapat dilakukan antar-dompet dengan mata uang yang sama.");
        return;
      }

      if (!Number.isSafeInteger(transferFee) || transferFee < 0) {
        tampilPesan("Biaya admin harus berupa angka bulat 0 atau lebih.");
        return;
      }

      if (transferFee > 0 && !["added", "deducted"].includes(transferFeeMode)) {
        tampilPesan("Pilih cara biaya admin transfer.");
        return;
      }

      if (transferFeeMode === "deducted" && transferFee >= nilai) {
        tampilPesan("Biaya admin yang dipotong harus lebih kecil dari nominal transfer.");
        return;
      }

      destinationWalletId = tujuanEl.value;
    } else {
      if (!akunEl.value) {
        tampilPesan("Pilih kategori transaksi.");
        return;
      }

      const akunDipilih = akun.find(item => item.id === akunEl.value);

      if (!akunDipilih || akunDipilih.kind !== kind) {
        tampilPesan("Kategori tidak sesuai dengan jenis transaksi.");
        return;
      }

      accountId = akunEl.value;
    }

    setMenyimpan(true);

    try {
      const payload = {
        familyId: familyAktif.id,
        kind,
        amount: nilai,
        occurredOn: tanggal.value,
        walletId: dompetEl.value,
        accountId,
        destinationWalletId,
        transferFee,
        transferFeeMode,
        note: keterangan.value.trim() || null
      };

      let hasil;

      if (idEdit) {
        hasil = await FinanceService.updateTransaksi({
          transactionId: idEdit,
          kind: payload.kind,
          amount: payload.amount,
          occurredOn: payload.occurredOn,
          walletId: payload.walletId,
          accountId: payload.accountId,
          destinationWalletId: payload.destinationWalletId,
          transferFee: payload.transferFee,
          transferFeeMode: payload.transferFeeMode,
          note: payload.note
        });
      } else {
        if (!operationId) {
          operationId = FinanceService.operationIdBaru();
        }

        if (isTransfer) {
          hasil = await FinanceService.transfer({
            familyId: payload.familyId,
            amount: payload.amount,
            occurredOn: payload.occurredOn,
            sourceWalletId: payload.walletId,
            destinationWalletId: payload.destinationWalletId,
            transferFee: payload.transferFee,
            transferFeeMode: payload.transferFeeMode,
            note: payload.note,
            operationId
          });
        } else {
          const createPayload = {
            familyId: payload.familyId,
            amount: payload.amount,
            occurredOn: payload.occurredOn,
            walletId: payload.walletId,
            accountId: payload.accountId,
            note: payload.note,
            operationId
          };

          hasil = jenisAktif === "pengeluaran"
            ? await FinanceService.buatPengeluaran(createPayload)
            : await FinanceService.buatPemasukan(createPayload);
        }
      }

      simpanPreferensi({
        familyAktif: familyAktif.id,
        dompetAktif: dompetEl.value
      });
      simpanPreferensiJenis();

      // Saldo dompet berubah setelah CREATE/EDIT transaksi.
      window.FinanceCache?.remove("wallets", familyAktif.id);

      if (!idEdit) operationId = null;

      console.info(
        idEdit ? "[Transaksi Backend] diperbarui" : "[Transaksi Backend] tersimpan",
        hasil
      );

      tampilPesan(
        idEdit
          ? "Perubahan transaksi berhasil disimpan. Ledger dan saldo sudah dihitung ulang oleh database."
          : isTransfer
            ? (payload.transferFee > 0
                ? `Transfer berhasil dengan biaya admin ${rupiah(payload.transferFee)}. Saldo sudah dihitung oleh database.`
                : "Transfer berhasil. Saldo kedua dompet sudah dihitung oleh database.")
            : "Transaksi berhasil disimpan ke Supabase."
      );

      const transactionId = idEdit || hasil?.transactionId || hasil;

      setTimeout(() => {
        if (isTransfer && transactionId) {
          location.href = hrefDetail(transactionId);
          return;
        }

        location.href = idEdit
          ? hrefDetail(idEdit)
          : "finance.html";
      }, 450);
    } catch (error) {
      console.error(
        idEdit ? "[Transaksi Backend] edit gagal" : "[Transaksi Backend] simpan gagal",
        error
      );

      tampilPesan(
        error?.message ||
        (idEdit ? "Perubahan transaksi gagal disimpan." : "Transaksi gagal disimpan.")
      );

      setMenyimpan(false);
    }
  });

  muatForm();
})();
