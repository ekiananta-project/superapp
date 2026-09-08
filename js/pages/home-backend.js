(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const DEFAULT_PREFERENSI = {
    dompetAktif: "",
    jenisAktif: "pengeluaran",
    periodeAktif: "month",
    periodeMulai: "",
    periodeSelesai: "",
    familyAktif: ""
  };
  const AVATAR_BUCKET = "profile-avatars";

  let firstHydrationDone = false;
  let lastProfileRefreshAt = 0;
  let profileRefreshPromise = null;
  let currentProfile = {};
  let familyAktif = null;
  let dompetList = [];
  let dompetAktif = null;
  let currentUserId = null;

  function rootHome() {
    return document.querySelector("[data-home-root]");
  }

  function cleanName(value) {
    const name = String(value ?? "").trim().replace(/\s+/g, " ");
    if (["", "undefined", "null", "[object object]"].includes(name.toLowerCase())) return "";
    return name;
  }

  function avatarPublicUrl(path, updatedAt) {
    if (!path || !window.supabaseClient) return "";
    const { data } = window.supabaseClient.storage.from(AVATAR_BUCKET).getPublicUrl(path);
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

  function rupiah(value, currency = "IDR") {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      minimumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function bacaPreferensi() {
    try {
      return {
        ...DEFAULT_PREFERENSI,
        ...JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}")
      };
    } catch {
      return { ...DEFAULT_PREFERENSI };
    }
  }

  function simpanPreferensi(data) {
    const lama = bacaPreferensi();
    localStorage.setItem(KUNCI_PENGATURAN, JSON.stringify({ ...lama, ...data }));
  }

  function bukaSheet(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  }

  function tutupSheet(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  function setSummaryLoading(loading) {
    document.querySelectorAll(".home-hydrate-summary").forEach(el => {
      el.classList.toggle("is-loading", loading);
    });
  }

  function setAllReady() {
    const root = rootHome();
    root?.classList.remove("home-hydrating");
    root?.classList.add("home-primary-ready", "home-ready");
    root?.setAttribute("aria-busy", "false");
    firstHydrationDone = true;
  }

  function renderSheetDompet() {
    const root = document.querySelector("[data-sheet-dompet-list]");
    if (!root) return;
    root.innerHTML = "";

    dompetList.forEach(item => {
      const btn = document.createElement("button");
      btn.className = "pilihan-sheet";

      const icon = document.createElement("ion-icon");
      icon.setAttribute("name", item.icon_value || "wallet-outline");

      const info = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = item.name;
      const br = document.createElement("br");
      const balance = document.createElement("small");
      balance.textContent = rupiah(item.current_balance, item.currency_code);
      info.append(name, br, balance);
      btn.append(icon, info);

      if (item.wallet_id === dompetAktif?.wallet_id) {
        const check = document.createElement("ion-icon");
        check.className = "cek";
        check.setAttribute("name", "checkmark-circle");
        btn.appendChild(check);
      }

      btn.addEventListener("click", async () => {
        dompetAktif = item;
        simpanPreferensi({ dompetAktif: item.wallet_id });
        tutupSheet("sheet-dompet");
        renderWalletPrimary();
        renderSheetDompet();
        await refreshPeriodSummary();
      });

      root.appendChild(btn);
    });
  }

  function renderWalletPrimary() {
    if (!dompetAktif) return;
    const label = document.querySelector("[data-dompet-label]");
    const saldo = document.querySelector("[data-dompet-saldo]");
    const icon = document.querySelector("[data-dompet-ikon]");
    const listLink = document.querySelector("[data-daftar-transaksi]");

    if (label) label.textContent = `Total Uang ${dompetAktif.name}`;
    if (saldo) saldo.textContent = rupiah(dompetAktif.current_balance, dompetAktif.currency_code);
    if (icon) icon.setAttribute("name", dompetAktif.icon_value || "wallet-outline");
    if (listLink) listLink.href = `dompet-detail.html?id=${encodeURIComponent(dompetAktif.wallet_id)}`;
  }

  async function refreshPeriodSummary() {
    const incomeEl = document.querySelector("[data-home-pemasukan]");
    const expenseEl = document.querySelector("[data-home-pengeluaran]");

    if (!familyAktif || !dompetAktif || !window.FinancePeriod) {
      if (incomeEl) incomeEl.textContent = rupiah(0);
      if (expenseEl) expenseEl.textContent = rupiah(0);
      return;
    }

    setSummaryLoading(true);
    try {
      const range = FinancePeriod.getRange();
      const summary = await FinanceService.ambilRingkasanPeriodeDompet({
        familyId: familyAktif.id,
        walletId: dompetAktif.wallet_id,
        startDate: range.startDate,
        endDate: range.endDate
      });
      if (incomeEl) incomeEl.textContent = rupiah(summary.incomeTotal, dompetAktif.currency_code);
      if (expenseEl) expenseEl.textContent = rupiah(summary.expenseTotal, dompetAktif.currency_code);
    } catch (error) {
      console.error("[Home period summary]", error);
      if (incomeEl) incomeEl.textContent = rupiah(0, dompetAktif.currency_code);
      if (expenseEl) expenseEl.textContent = rupiah(0, dompetAktif.currency_code);
    } finally {
      setSummaryLoading(false);
    }
  }

  function setupControls() {
    const walletButton = document.querySelector("[data-buka-dompet]");
    walletButton?.addEventListener("click", () => bukaSheet("sheet-dompet"));

    document.querySelectorAll('[data-sheet-close="sheet-dompet"]').forEach(button => {
      button.addEventListener("click", () => tutupSheet("sheet-dompet"));
    });

    const sheet = document.getElementById("sheet-dompet");
    sheet?.addEventListener("click", event => {
      if (event.target === sheet) tutupSheet("sheet-dompet");
    });

    FinancePeriod?.mount();
    window.addEventListener("finance-period-change", refreshPeriodSummary);
  }

  async function renderHomeBackend() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    try {
      const session = await AuthService.ambilSession();
      if (!session) throw new Error("Belum ada session Supabase. Login melalui login.html.");
      currentUserId = session.user?.id || null;

      const preferensi = bacaPreferensi();
      const [profile, families] = await Promise.all([
        FamilyService.ambilProfilSaya(),
        FamilyService.ambilKeluargaSaya()
      ]);

      if (!families.length) throw new Error("Akun ini belum tergabung ke ruang keluarga.");
      familyAktif = families.find(item => item.id === preferensi.familyAktif) || families[0];
      if (familyAktif.id !== preferensi.familyAktif) simpanPreferensi({ familyAktif: familyAktif.id });

      /* v1.2.0d: Home hanya menunggu data yang benar-benar dibutuhkan untuk
         first render. Kategori diprefetch setelah Home siap. Saldo dompet tetap
         dipaksa fresh karena termasuk data yang cepat berubah. */
      const [wallets, totalRows] = await Promise.all([
        (FinanceService.ambilSaldoDompetFresh || FinanceService.ambilSaldoDompet)(familyAktif.id),
        FinanceService.ambilTotalKeluarga(familyAktif.id)
      ]);

      dompetList = wallets || [];
      if (window.FinanceCache) {
        FinanceCache.pruneContext(currentUserId, familyAktif.id);
        FinanceCache.write("wallets", familyAktif.id, dompetList, currentUserId);
      }

      renderProfileHome(profile);

      const currency = familyAktif.default_currency || "IDR";
      const totalFamily = (totalRows || []).find(row => row.currency_code === currency);
      const totalEl = document.querySelector("[data-total-global]");
      if (totalEl) totalEl.textContent = rupiah(totalFamily?.total_balance || 0, currency);

      if (!dompetList.length) {
        const label = document.querySelector("[data-dompet-label]");
        const saldo = document.querySelector("[data-dompet-saldo]");
        if (label) label.textContent = "Belum ada dompet";
        if (saldo) saldo.textContent = rupiah(0, currency);
        document.querySelector("[data-daftar-transaksi]")?.setAttribute("aria-disabled", "true");
        document.querySelector("[data-daftar-transaksi]")?.removeAttribute("href");
        document.querySelector("[data-home-pemasukan]").textContent = rupiah(0, currency);
        document.querySelector("[data-home-pengeluaran]").textContent = rupiah(0, currency);
        setAllReady();
        return;
      }

      dompetAktif = dompetList.find(item => item.wallet_id === preferensi.dompetAktif) || dompetList[0];
      if (dompetAktif.wallet_id !== preferensi.dompetAktif) simpanPreferensi({ dompetAktif: dompetAktif.wallet_id });

      renderWalletPrimary();
      renderSheetDompet();
      FinancePeriod?.sync();
      await refreshPeriodSummary();
      setAllReady();

      /* Warm shared reference data only after Home is interactive. */
      if (window.FinanceCache && currentUserId && familyAktif?.id) {
        FinanceCache.idle(() => {
          FinanceCache.revalidate(
            "categories",
            familyAktif.id,
            currentUserId,
            () => (FinanceService.ambilAkunFresh || FinanceService.ambilAkun)(familyAktif.id)
          ).catch(error => console.warn("[Home category prefetch]", error));
        });
      }
    } catch (error) {
      console.error("[Home Backend]", error);
      setAllReady();
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

  document.addEventListener("DOMContentLoaded", () => {
    setupControls();
    renderHomeBackend();
  });

  window.addEventListener("pageshow", event => {
    if (event.persisted) renderHomeBackend();
    else refreshProfileOnly();
  });
  window.addEventListener("focus", () => refreshProfileOnly());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshProfileOnly();
  });
  window.addEventListener("profil-pengguna-berubah", event => {
    const detail = event?.detail || {};
    if (detail.display_name !== undefined || detail.avatar_path !== undefined) renderProfileHome(detail);
    else refreshProfileOnly({ force: true });
  });
})();
