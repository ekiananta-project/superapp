(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const form = document.querySelector("[data-form-akun]");
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const categoryId = params.get("id");

  const judul = document.querySelector("[data-judul-form]");
  const simpan = document.querySelector("[data-simpan-akun]");
  const hapus = document.querySelector("[data-hapus-akun]");
  const bantuanJenis = document.querySelector("[data-bantuan-jenis]");
  const bantuanParent = document.querySelector("[data-bantuan-parent]");
  const notif = document.querySelector("[data-notifikasi]");
  const parentEl = form.elements.parentKategori;
  const visualInherit = document.querySelector("[data-visual-inherit]");
  const visualBadge = document.querySelector(".akun-visual-badge");
  const visualPickers = Array.from(document.querySelectorAll(".akun-picker-block"));

  let familyAktif = null;
  let userAktif = null;
  let categoryAktif = null;
  let semuaKategori = [];
  let bolehKelola = true;
  let sedangProses = false;

  const KIND_DB = { pengeluaran: "expense", pemasukan: "income" };
  const KIND_UI = { expense: "pengeluaran", income: "pemasukan" };

  function bacaPreferensi() {
    try { return JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}"); }
    catch { return {}; }
  }

  function simpanPreferensi(data) {
    const lama = bacaPreferensi();
    localStorage.setItem(KUNCI_PENGATURAN, JSON.stringify({ ...lama, ...data }));
  }

  function tampilPesan(message, tipe = "error") {
    if (!notif) return;
    notif.hidden = false;
    notif.textContent = message;
    notif.dataset.tipe = tipe;
  }

  function bersihkanPesan() {
    if (!notif) return;
    notif.hidden = true;
    notif.textContent = "";
  }

  function setFormDisabled(disabled) {
    Array.from(form.elements).forEach(el => { el.disabled = disabled; });
  }

  function setVisual(iconValue, colorValue) {
    const icon = iconValue || "ellipse-outline";
    const color = colorValue || "#E58A2B";
    if (form.elements.ikon) form.elements.ikon.value = icon;
    if (form.elements.warna) form.elements.warna.value = color;
    window.AccountVisualPicker?.setSelection(icon, color);
  }

  function kindAktif() {
    return categoryAktif?.kind || KIND_DB[form.elements.jenis.value] || "expense";
  }

  function rootCategories(kind) {
    return semuaKategori
      .filter(item => !item.archived_at && item.kind === kind && !item.parent_id && item.id !== categoryAktif?.id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }

  function renderParentOptions(selected = "") {
    const kind = kindAktif();
    const roots = rootCategories(kind);
    parentEl.innerHTML = '<option value="">Tidak ada — jadikan kategori utama</option>';

    roots.forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      option.selected = item.id === selected;
      parentEl.appendChild(option);
    });

    const punyaChild = categoryAktif && semuaKategori.some(item => item.parent_id === categoryAktif.id);
    if (punyaChild) {
      parentEl.value = "";
      parentEl.disabled = true;
      if (bantuanParent) bantuanParent.textContent = "Kategori ini memiliki subkategori sehingga tetap menjadi kategori utama.";
    } else if (bantuanParent) {
      bantuanParent.textContent = "Pilih kategori induk jika ingin membuat subkategori. Maksimal dua tingkat.";
    }
  }

  function applyParentVisual() {
    const parent = semuaKategori.find(item => item.id === parentEl.value) || null;
    const inherited = Boolean(parent);

    if (inherited) setVisual(parent.icon_value, parent.color);
    if (visualInherit) visualInherit.hidden = !inherited;
    if (visualBadge) visualBadge.textContent = inherited ? "Ikuti induk" : "Personal";
    visualPickers.forEach(el => { el.hidden = inherited; });
  }

  async function ambilFamily() {
    const session = await AuthService.ambilSession();
    if (!session) throw new Error("Belum ada session. Silakan login kembali.");
    userAktif = session.user || await AuthService.ambilUserAktif();

    const families = await FamilyService.ambilKeluargaSaya();
    if (!families.length) throw new Error("Akun ini belum tergabung ke ruang keluarga.");

    const pref = bacaPreferensi();
    const family = families.find(item => item.id === pref.familyAktif) || families[0];
    simpanPreferensi({ familyAktif: family.id });
    return family;
  }

  function cekBolehKelola(category, family) {
    if (!category) return true;
    return Boolean(family?.membership?.role === "owner" || (userAktif?.id && category.created_by === userAktif.id));
  }

  function isiFormBaru() {
    judul.textContent = "Tambah Kategori";
    hapus.hidden = true;
    simpan.querySelector("span") ? simpan.querySelector("span").textContent = "Simpan Kategori" : simpan.textContent = "Simpan Kategori";
    bantuanJenis.textContent = "Pilih apakah kategori ini dipakai untuk pengeluaran atau pemasukan.";
    renderParentOptions("");
    setVisual(form.elements.ikon.value || "fast-food-outline", form.elements.warna?.value || "#E58A2B");
    applyParentVisual();
  }

  function isiFormEdit(category) {
    judul.textContent = "Edit Kategori";
    simpan.querySelector("span") ? simpan.querySelector("span").textContent = "Simpan Perubahan" : simpan.textContent = "Simpan Perubahan";
    hapus.hidden = false;

    form.elements.nama.value = category.name || "";
    form.elements.jenis.value = KIND_UI[category.kind] || "pengeluaran";
    setVisual(category.icon_value || "ellipse-outline", category.color || "#E58A2B");

    form.elements.jenis.disabled = true;
    bantuanJenis.textContent = "Jenis kategori dikunci setelah dibuat agar transaksi lama tidak berubah makna.";
    renderParentOptions(category.parent_id || "");
    parentEl.value = category.parent_id || "";
    applyParentVisual();
  }

  async function init() {
    if (window.AUTH_READY) {
      const ok = await window.AUTH_READY;
      if (ok === false) return;
    }

    try {
      setFormDisabled(true);
      familyAktif = await ambilFamily();

      const cached = window.FinanceCache?.read("categories", familyAktif.id, userAktif?.id);
      semuaKategori = cached || await FinanceService.ambilAkun(familyAktif.id);
      if (!cached) window.FinanceCache?.write("categories", familyAktif.id, semuaKategori, userAktif?.id);

      if (categoryId) {
        categoryAktif = semuaKategori.find(item => item.id === categoryId) || null;
        if (!categoryAktif) throw new Error("Kategori tidak ditemukan atau sudah diarsipkan.");
        bolehKelola = cekBolehKelola(categoryAktif, familyAktif);
        isiFormEdit(categoryAktif);
      } else {
        isiFormBaru();
      }

      setFormDisabled(false);
      if (categoryAktif) form.elements.jenis.disabled = true;
      const punyaChild = categoryAktif && semuaKategori.some(item => item.parent_id === categoryAktif.id);
      if (punyaChild) parentEl.disabled = true;

      if (!bolehKelola) {
        setFormDisabled(true);
        simpan.hidden = true;
        hapus.hidden = true;
        tampilPesan("Mode baca: hanya pembuat kategori atau pemilik ruang keluarga yang dapat mengubah kategori ini.", "info");
      }
    } catch (error) {
      console.error("[Kategori Form Backend]", error);
      tampilPesan(error?.message || "Form kategori belum dapat dimuat.");
      setFormDisabled(true);
    }
  }

  form.elements.jenis.addEventListener("change", () => {
    if (categoryAktif) return;
    renderParentOptions("");
    applyParentVisual();
  });

  parentEl.addEventListener("change", applyParentVisual);

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sedangProses || !familyAktif || !bolehKelola) return;
    bersihkanPesan();

    const name = form.elements.nama.value.trim();
    const kind = kindAktif();
    const parentId = parentEl.value || null;
    const parent = semuaKategori.find(item => item.id === parentId) || null;
    const iconValue = parent?.icon_value || form.elements.ikon.value || "ellipse-outline";
    const colorValue = parent?.color || form.elements.warna?.value || "#E58A2B";

    if (!name) return tampilPesan("Nama kategori wajib diisi.");
    if (name.length > 80) return tampilPesan("Nama kategori maksimal 80 karakter.");
    if (!kind) return tampilPesan("Jenis kategori tidak valid.");

    sedangProses = true;
    simpan.disabled = true;
    const label = categoryAktif ? "Menyimpan..." : "Membuat Kategori...";
    simpan.querySelector("span") ? simpan.querySelector("span").textContent = label : simpan.textContent = label;

    try {
      if (categoryAktif) {
        await FinanceService.ubahKategori({
          accountId: categoryAktif.id,
          name,
          kind: categoryAktif.kind,
          parentId,
          iconType: categoryAktif.icon_type || "ionicon",
          iconValue,
          color: colorValue,
          sortOrder: Number(categoryAktif.sort_order || 0)
        });
      } else {
        const sortOrder = semuaKategori.reduce((max, item) => Math.max(max, Number(item.sort_order || 0)), -1) + 1;
        await FinanceService.buatKategori({
          familyId: familyAktif.id,
          name,
          kind,
          parentId,
          iconType: "ionicon",
          iconValue,
          color: colorValue,
          sortOrder
        });
      }

      window.FinanceCache?.remove("categories", familyAktif.id);
      tampilPesan(categoryAktif ? "Perubahan kategori tersimpan." : "Kategori berhasil dibuat.", "success");
      setTimeout(() => { location.href = "akun.html"; }, 300);
    } catch (error) {
      console.error("[Simpan Kategori]", error);
      tampilPesan(error?.message || "Kategori gagal disimpan.");
      sedangProses = false;
      simpan.disabled = false;
      const normal = categoryAktif ? "Simpan Perubahan" : "Simpan Kategori";
      simpan.querySelector("span") ? simpan.querySelector("span").textContent = normal : simpan.textContent = normal;
    }
  });

  hapus.addEventListener("click", async () => {
    if (!categoryAktif || sedangProses || !bolehKelola) return;

    const children = semuaKategori.filter(item => item.parent_id === categoryAktif.id);
    const isChild = Boolean(categoryAktif.parent_id);
    const message = children.length
      ? `Hapus kategori “${categoryAktif.name}”?\n\nKategori ini memiliki ${children.length} subkategori. Semua subkategori di dalamnya juga akan ikut dihapus. Jika kategori atau subkategori sudah pernah dipakai dalam transaksi, sistem akan mengarsipkannya agar riwayat tetap tersimpan.`
      : isChild
        ? `Hapus subkategori “${categoryAktif.name}”?\n\nJika subkategori sudah pernah dipakai dalam transaksi, sistem akan mengarsipkannya agar riwayat tetap tersimpan.`
        : `Hapus kategori “${categoryAktif.name}”?\n\nJika kategori sudah pernah dipakai dalam transaksi, sistem akan mengarsipkannya agar riwayat tetap tersimpan.`;

    if (!confirm(message)) return;

    sedangProses = true;
    simpan.disabled = true;
    hapus.disabled = true;

    try {
      const result = await FinanceService.hapusKategori(categoryAktif.id);
      window.FinanceCache?.remove("categories", familyAktif.id);
      console.info("[Hapus/Arsip Kategori]", result);
      location.href = "akun.html";
    } catch (error) {
      console.error("[Hapus Kategori]", error);
      tampilPesan(error?.message || "Kategori belum berhasil dihapus/diarsipkan.");
      sedangProses = false;
      simpan.disabled = false;
      hapus.disabled = false;
    }
  });

  init();
})();
