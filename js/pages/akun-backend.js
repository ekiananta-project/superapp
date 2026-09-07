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
    try { return JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}"); }
    catch { return {}; }
  }

  function simpanPreferensi(data) {
    const lama = bacaPreferensi();
    localStorage.setItem(KUNCI_PENGATURAN, JSON.stringify({ ...lama, ...data }));
  }

  function urutkan(a, b) {
    return Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "id");
  }

  function childRows(parent, all) {
    return all.filter(item => item.parent_id === parent.id).sort(urutkan);
  }

  function categoryRow(item, { child = false } = {}) {
    const link = document.createElement("a");
    link.className = child ? "kategori-child-row" : "kartu-list akun-kartu kategori-parent-main";
    link.href = `akun-form.html?id=${encodeURIComponent(item.id)}`;
    link.innerHTML = `
      <span class="ikon-bulat akun-ikon-berwarna${child ? " kategori-child-icon" : ""}" style="--akun-warna:${escapeHTML(item.color || "#E58A2B")}">
        <ion-icon name="${escapeHTML(item.icon_value || "ellipse-outline")}"></ion-icon>
      </span>
      <span class="kartu-list-info">
        <strong>${escapeHTML(item.name)}</strong>
        <span>${child ? "Subkategori" : (item.kind === "income" ? "Pemasukan" : "Pengeluaran")}</span>
      </span>
      <ion-icon name="chevron-forward-outline" aria-label="Edit kategori"></ion-icon>`;
    return link;
  }

  function parentCard(parent, all) {
    const children = childRows(parent, all);
    const wrap = document.createElement("article");
    wrap.className = "kategori-parent-card";
    wrap.appendChild(categoryRow(parent));

    if (!children.length) return wrap;

    const toggle = document.createElement("button");
    toggle.className = "kategori-child-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<span>${children.length} subkategori</span><ion-icon name="chevron-down-outline"></ion-icon>`;

    const childList = document.createElement("div");
    childList.className = "kategori-child-list";
    childList.hidden = true;
    children.forEach(item => childList.appendChild(categoryRow(item, { child: true })));

    toggle.addEventListener("click", () => {
      const open = childList.hidden;
      childList.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector("ion-icon")?.setAttribute("name", open ? "chevron-up-outline" : "chevron-down-outline");
    });

    wrap.append(toggle, childList);
    return wrap;
  }

  function render(categories) {
    root.innerHTML = "";
    const active = (categories || []).filter(item => !item.archived_at);

    if (!active.length) {
      root.innerHTML = `
        <div class="kosong-data akun-kosong-semua">
          <ion-icon name="pricetags-outline"></ion-icon>
          <span>Belum ada kategori pada ruang keluarga ini.</span>
          <a class="tombol-utama" href="akun-form.html">Buat Kategori Pertama</a>
        </div>`;
      return;
    }

    GRUP.forEach(grup => {
      const items = active.filter(item => item.kind === grup.kind);
      const parents = items.filter(item => !item.parent_id).sort(urutkan);

      const section = document.createElement("section");
      section.className = "akun-grup";
      section.innerHTML = `
        <div class="akun-grup-heading">
          <h2 class="judul-grup"><ion-icon name="${grup.icon}" aria-hidden="true"></ion-icon>${grup.label}</h2>
          <span class="akun-jumlah">${parents.length}</span>
        </div>`;

      if (!parents.length) {
        const empty = document.createElement("div");
        empty.className = "akun-grup-kosong";
        empty.textContent = `Belum ada kategori ${grup.label.toLowerCase()}.`;
        section.appendChild(empty);
      } else {
        const list = document.createElement("div");
        list.className = "daftar-kartu akun-daftar kategori-tree";
        parents.forEach(parent => list.appendChild(parentCard(parent, items)));
        section.appendChild(list);
      }

      root.appendChild(section);
    });
  }

  async function quickRenderCache() {
    try {
      const pref = bacaPreferensi();
      if (!pref.familyAktif || !window.FinanceCache) return;
      const session = await AuthService.ambilSession();
      if (!session?.user?.id) return;
      const cached = FinanceCache.read("categories", pref.familyAktif, session.user.id);
      if (cached) render(cached);
    } catch {}
  }

  async function ambilFamilyAktif() {
    const session = await AuthService.ambilSession();
    if (!session) throw new Error("Belum ada session. Silakan login kembali.");

    const families = await FamilyService.ambilKeluargaSaya();
    if (!families.length) throw new Error("Akun ini belum tergabung ke ruang keluarga.");

    const pref = bacaPreferensi();
    const family = families.find(item => item.id === pref.familyAktif) || families[0];
    if (family.id !== pref.familyAktif) simpanPreferensi({ familyAktif: family.id });
    return { family, userId: session.user.id };
  }

  async function init() {
    quickRenderCache();

    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    try {
      const { family, userId } = await ambilFamilyAktif();
      const cached = window.FinanceCache?.read("categories", family.id, userId);
      if (cached) render(cached);

      const categories = await FinanceService.ambilAkun(family.id);
      render(categories || []);
      window.FinanceCache?.write("categories", family.id, categories || [], userId);
    } catch (error) {
      console.error("[Kategori Backend]", error);
      const pref = bacaPreferensi();
      const session = await AuthService.ambilSession().catch(() => null);
      const fallback = window.FinanceCache?.read("categories", pref.familyAktif, session?.user?.id || null);
      if (fallback) return;

      root.innerHTML = `
        <div class="kosong-data akun-backend-error">
          <ion-icon name="cloud-offline-outline"></ion-icon>
          <span>${escapeHTML(error?.message || "Kategori belum dapat dimuat. Periksa koneksi internet.")}</span>
        </div>`;
    }
  }

  init();
})();
