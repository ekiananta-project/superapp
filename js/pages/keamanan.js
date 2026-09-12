(() => {
  "use strict";

  const client = window.supabaseClient;
  const Trusted = window.RuangKithaTrustedDevice;
  const SetupUI = window.RuangKithaSecuritySetupUI;
  const Recovery = window.RuangKithaRecoveryKit;
  const RecoveryUI = window.RuangKithaRecoveryUI;

  const els = {
    nama: document.querySelector("[data-nama-perangkat]"),
    detail: document.querySelector("[data-detail-perangkat]"),
    ikon: document.querySelector("[data-ikon-perangkat]"),
    deviceDetail: document.querySelector("[data-device-security-detail]"),
    deviceBadge: document.querySelector("[data-device-security-badge]"),
    vaultHeading: document.querySelector("[data-vault-heading]"),
    vaultCopy: document.querySelector("[data-vault-copy]"),
    vaultBadge: document.querySelector("[data-vault-badge]"),
    trustedCount: document.querySelector("[data-trusted-device-count]"),
    recoveryStatus: document.querySelector("[data-recovery-status]"),
    localStatus: document.querySelector("[data-local-vault-status]"),
    vaultMessage: document.querySelector("[data-vault-message]"),
    primary: document.querySelector("[data-vault-primary]"),
    lock: document.querySelector("[data-vault-lock]"),
    autoLock: document.querySelector("[data-security-autolock]"),
    autoLockSelect: document.querySelector("[data-security-autolock-select]"),
    pinManage: document.querySelector("[data-security-pin-manage]"),
    pinChange: document.querySelector("[data-security-pin-change]"),
    pinLayer: document.querySelector("[data-security-pin-layer]"),
    pinClose: document.querySelector("[data-security-pin-close]"),
    pinForm: document.querySelector("[data-security-pin-form]"),
    pinCurrent: document.querySelector("[data-security-pin-current]"),
    pinNew: document.querySelector("[data-security-pin-new]"),
    pinConfirm: document.querySelector("[data-security-pin-confirm]"),
    pinMessage: document.querySelector("[data-security-pin-message]"),
    pinSubmit: document.querySelector("[data-security-pin-submit]"),
    unlockLayer: document.querySelector("[data-security-unlock-layer]"),
    unlockClose: document.querySelector("[data-security-unlock-close]"),
    unlockForm: document.querySelector("[data-security-unlock-form]"),
    unlockPin: document.querySelector("[data-security-unlock-pin]"),
    unlockMessage: document.querySelector("[data-security-unlock-message]"),
    unlockSubmit: document.querySelector("[data-security-unlock-submit]"),
    recoveryCard: document.querySelector("[data-recovery-card]"),
    recoveryCardTitle: document.querySelector("[data-recovery-card-title]"),
    recoveryCardCopy: document.querySelector("[data-recovery-card-copy]"),
    recoveryManage: document.querySelector("[data-recovery-manage]")
  };

  let current = {
    state: null,
    local: null,
    capabilities: null,
    loading: false
  };

  function deteksiBrowser() {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return "Microsoft Edge";
    if (/Chrome\//.test(ua)) return "Google Chrome";
    if (/Firefox\//.test(ua)) return "Mozilla Firefox";
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
    return "Browser";
  }

  function deteksiPerangkat() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return { nama: "Android", ikon: "phone-portrait-outline" };
    if (/iPhone|iPad|iPod/i.test(ua)) return { nama: "iPhone / iPad", ikon: "phone-portrait-outline" };
    if (/Windows/i.test(ua)) return { nama: "Windows", ikon: "desktop-outline" };
    if (/Macintosh|Mac OS X/i.test(ua)) return { nama: "Mac", ikon: "desktop-outline" };
    return { nama: "Perangkat ini", ikon: "hardware-chip-outline" };
  }

  function setDeviceIdentity() {
    if (!els.nama || !els.detail || !els.ikon) return;
    const perangkat = deteksiPerangkat();
    els.nama.textContent = perangkat.nama;
    els.detail.textContent = deteksiBrowser();
    els.ikon.setAttribute("name", perangkat.ikon);
  }

  function setVaultBadge(text, state) {
    if (!els.vaultBadge) return;
    els.vaultBadge.textContent = text;
    els.vaultBadge.dataset.state = state || "neutral";
  }

  function setVaultMessage(message = "", tone = "info") {
    if (!els.vaultMessage) return;
    els.vaultMessage.hidden = !message;
    els.vaultMessage.textContent = message;
    els.vaultMessage.dataset.tone = tone;
  }

  function setUnlockMessage(message = "", tone = "error") {
    if (!els.unlockMessage) return;
    els.unlockMessage.hidden = !message;
    els.unlockMessage.textContent = message;
    els.unlockMessage.dataset.tone = tone;
  }

  function setPinMessage(message = "", tone = "error") {
    if (!els.pinMessage) return;
    els.pinMessage.hidden = !message;
    els.pinMessage.textContent = message;
    els.pinMessage.dataset.tone = tone;
  }

  function formatRecovery(state) {
    if (!state || !state.configured) return "Belum dibuat";
    if (state.recovery_ready) return "Siap";
    if (state.recovery_state === "provisional") return "Belum dibuat";
    if (state.recovery_state === "missing") return "Belum tersedia";
    return "Belum siap";
  }

  function formatRetry(ms) {
    const seconds = Math.max(1, Math.ceil(Number(ms || 0) / 1000));
    if (seconds < 60) return `${seconds} detik`;
    return `${Math.ceil(seconds / 60)} menit`;
  }

  async function rpc(name, params = {}) {
    if (!client || typeof client.rpc !== "function") {
      throw new Error("Supabase client belum tersedia.");
    }
    const { data, error } = await client.rpc(name, params);
    if (error) throw error;
    return data;
  }

  async function loadSnapshot() {
    if (!Trusted) throw new Error("Trusted Device engine belum dimuat.");

    const [state, local, capabilities] = await Promise.all([
      rpc("security_vault_state_v1"),
      Trusted.localDeviceStatus({ supabase: client }),
      Trusted.checkCapabilities({ deep: false })
    ]);

    current = { ...current, state: state || { configured: false }, local, capabilities };
    return current;
  }

  function renderLoading() {
    current.loading = true;
    if (els.vaultHeading) els.vaultHeading.textContent = "Memeriksa Security Vault…";
    if (els.vaultCopy) els.vaultCopy.textContent = "Memeriksa status vault dan trusted device pada akun ini.";
    setVaultBadge("Memuat", "loading");
    if (els.trustedCount) els.trustedCount.textContent = "—";
    if (els.recoveryStatus) els.recoveryStatus.textContent = "—";
    if (els.localStatus) els.localStatus.textContent = "—";
    if (els.primary) {
      els.primary.disabled = true;
      els.primary.textContent = "Memuat…";
      els.primary.dataset.action = "";
    }
    if (els.lock) els.lock.hidden = true;
    if (els.autoLock) els.autoLock.hidden = true;
    if (els.pinManage) els.pinManage.hidden = true;
    if (els.recoveryCard) els.recoveryCard.hidden = true;
    setVaultMessage();
  }

  function renderError(error) {
    current.loading = false;
    const message = error && error.message ? error.message : String(error || "Status Security Vault tidak dapat dimuat.");
    if (els.vaultHeading) els.vaultHeading.textContent = "Security Vault belum dapat diperiksa";
    if (els.vaultCopy) els.vaultCopy.textContent = "Pastikan sesi login aktif dan migration Security Foundation sudah terpasang.";
    setVaultBadge("Perlu dicek", "danger");
    if (els.trustedCount) els.trustedCount.textContent = "—";
    if (els.recoveryStatus) els.recoveryStatus.textContent = "—";
    if (els.localStatus) els.localStatus.textContent = "—";
    if (els.primary) {
      els.primary.disabled = false;
      els.primary.textContent = "Coba lagi";
      els.primary.dataset.action = "refresh";
    }
    if (els.lock) els.lock.hidden = true;
    if (els.autoLock) els.autoLock.hidden = true;
    if (els.pinManage) els.pinManage.hidden = true;
    if (els.recoveryCard) els.recoveryCard.hidden = true;
    setVaultMessage(message, "error");
    if (els.deviceDetail) els.deviceDetail.textContent = "Status Security Vault belum tersedia";
    if (els.deviceBadge) {
      els.deviceBadge.textContent = "Perlu dicek";
      els.deviceBadge.dataset.state = "danger";
    }
  }

  function renderSnapshot() {
    current.loading = false;
    const state = current.state || { configured: false };
    const local = current.local || { present: false, ready: false, unlocked: false };
    const caps = current.capabilities || { supported: false, reasons: ["Capability belum diperiksa."] };

    if (els.pinManage) els.pinManage.hidden = !local.ready;

    if (els.trustedCount) els.trustedCount.textContent = state.configured ? String(state.trusted_device_count ?? 0) : "0";
    if (els.recoveryStatus) els.recoveryStatus.textContent = formatRecovery(state);

    if (els.recoveryCard) {
      const canManageRecovery = Boolean(state.configured && local.ready);
      els.recoveryCard.hidden = !canManageRecovery;
      if (canManageRecovery) {
        if (state.recovery_ready) {
          if (els.recoveryCardTitle) els.recoveryCardTitle.textContent = "Recovery Kit aktif";
          if (els.recoveryCardCopy) els.recoveryCardCopy.textContent = "Kode lama tidak disimpan oleh RuangKitha. Jika kit hilang, buat kit pengganti dari Trusted Device ini.";
          if (els.recoveryManage) { els.recoveryManage.textContent = "Ganti"; els.recoveryManage.dataset.action = "rotate-recovery"; }
        } else {
          if (els.recoveryCardTitle) els.recoveryCardTitle.textContent = "Recovery Kit belum dibuat";
          if (els.recoveryCardCopy) els.recoveryCardCopy.textContent = "Buat Recovery Kit agar vault dapat dipulihkan bila semua Trusted Device hilang.";
          if (els.recoveryManage) { els.recoveryManage.textContent = "Buat"; els.recoveryManage.dataset.action = "create-recovery"; }
        }
      }
    }

    if (local.ready) {
      if (els.localStatus) els.localStatus.textContent = local.unlocked ? "Terbuka" : "Terkunci";
      if (els.deviceDetail) {
        els.deviceDetail.textContent = local.unlocked
          ? `Trusted Device · Vault terbuka · auto-lock ${local.autoLockMinutes || 5} menit`
          : `Trusted Device · Vault terkunci · auto-lock ${local.autoLockMinutes || 5} menit`;
      }
      if (els.deviceBadge) {
        els.deviceBadge.textContent = local.unlocked ? "Terbuka" : "Trusted";
        els.deviceBadge.dataset.state = local.unlocked ? "success" : "trusted";
      }
      if (els.autoLock && els.autoLockSelect) {
        els.autoLock.hidden = false;
        const value = String(local.autoLockMinutes || 5);
        if ([...els.autoLockSelect.options].some(option => option.value === value)) {
          els.autoLockSelect.value = value;
        }
      }
    } else if (local.present) {
      if (els.localStatus) els.localStatus.textContent = local.phase === "pending-bootstrap" ? "Setup tertunda" : "Belum siap";
      if (els.deviceDetail) els.deviceDetail.textContent = "Material Trusted Device lokal ada, tetapi setup belum selesai";
      if (els.deviceBadge) {
        els.deviceBadge.textContent = "Tertunda";
        els.deviceBadge.dataset.state = "warning";
      }
      if (els.autoLock) els.autoLock.hidden = true;
    } else {
      if (els.localStatus) els.localStatus.textContent = "Belum ada";
      if (els.deviceDetail) els.deviceDetail.textContent = "Belum menjadi Trusted Device";
      if (els.deviceBadge) {
        els.deviceBadge.textContent = "Saat ini";
        els.deviceBadge.dataset.state = "neutral";
      }
      if (els.autoLock) els.autoLock.hidden = true;
    }

    if (!state.configured) {
      if (els.vaultHeading) els.vaultHeading.textContent = local.present ? "Setup Security Vault belum selesai" : "Security Vault belum diaktifkan";
      if (els.vaultCopy) {
        els.vaultCopy.textContent = caps.supported
          ? "Perangkat ini siap menjadi Trusted Device pertama. Buat PIN perangkat ini untuk melindungi material kunci lokal pada browser ini."
          : `Browser ini belum memenuhi kebutuhan Security Vault. ${(caps.reasons || []).join(" ")}`;
      }
      setVaultBadge(local.present ? "Tertunda" : "Belum aktif", local.present ? "warning" : "neutral");
      if (els.primary) {
        els.primary.disabled = !caps.supported;
        els.primary.textContent = local.present ? "Lanjutkan setup" : "Aktifkan Security Vault";
        els.primary.dataset.action = "setup";
      }
      if (els.lock) els.lock.hidden = true;
      return;
    }

    if (local.ready) {
      if (els.vaultHeading) els.vaultHeading.textContent = local.unlocked ? "Security Vault terbuka" : "Security Vault aktif dan terkunci";
      if (els.vaultCopy) {
        els.vaultCopy.textContent = local.unlocked
          ? "Master Key runtime tersedia hanya di memori dan akan dibuang saat auto-lock, reload, atau halaman ditinggalkan."
          : "Trusted Device ini siap. Buka vault menggunakan PIN perangkat ini untuk memuat Master Key runtime ke memori.";
      }
      setVaultBadge(local.unlocked ? "Terbuka" : "Terkunci", local.unlocked ? "success" : "trusted");
      if (els.primary) {
        els.primary.disabled = local.unlocked;
        els.primary.textContent = local.unlocked ? "Vault sudah terbuka" : "Buka dengan PIN";
        els.primary.dataset.action = local.unlocked ? "" : "unlock";
      }
      if (els.lock) els.lock.hidden = !local.unlocked;
    } else {
      if (els.vaultHeading) els.vaultHeading.textContent = "Security Vault sudah aktif";
      if (els.vaultCopy) {
        els.vaultCopy.textContent = state.recovery_ready
          ? "Browser ini belum menjadi Trusted Device. Gunakan Recovery Kit untuk memulihkan Master Key lalu buat PIN khusus perangkat ini. PIN perangkat lain tidak otomatis disalin."
          : "Browser ini belum dipercaya dan akun belum memiliki Recovery Kit aktif. Gunakan Trusted Device lama untuk membuat Recovery Kit terlebih dahulu.";
      }
      setVaultBadge("Aktif", "trusted");
      if (els.primary) {
        els.primary.disabled = !state.recovery_ready || !caps.supported;
        els.primary.textContent = state.recovery_ready ? "Pulihkan perangkat ini" : "Recovery Kit belum tersedia";
        els.primary.dataset.action = state.recovery_ready && caps.supported ? "recover" : "";
      }
      if (els.lock) els.lock.hidden = true;
    }
  }

  async function refreshStatus({ quiet = false } = {}) {
    if (!quiet) renderLoading();
    try {
      await loadSnapshot();
      renderSnapshot();
    } catch (error) {
      console.error("[RuangKitha Security] status gagal:", error);
      renderError(error);
    }
  }

  function openUnlock() {
    if (!els.unlockLayer || !els.unlockPin) return;
    setUnlockMessage();
    els.unlockPin.value = "";
    els.unlockLayer.hidden = false;
    document.body.classList.add("security-sheet-open");
    requestAnimationFrame(() => els.unlockPin.focus());
  }

  function closeUnlock() {
    if (!els.unlockLayer) return;
    els.unlockLayer.hidden = true;
    document.body.classList.remove("security-sheet-open");
    if (els.unlockPin) els.unlockPin.value = "";
    setUnlockMessage();
  }

  function openPinChange() {
    if (!current.local?.ready || !els.pinLayer || !els.pinCurrent || !els.pinNew || !els.pinConfirm) return;
    setPinMessage();
    els.pinCurrent.value = "";
    els.pinNew.value = "";
    els.pinConfirm.value = "";
    els.pinLayer.hidden = false;
    document.body.classList.add("security-sheet-open");
    requestAnimationFrame(() => els.pinCurrent.focus());
  }

  function closePinChange() {
    if (!els.pinLayer) return;
    els.pinLayer.hidden = true;
    document.body.classList.remove("security-sheet-open");
    if (els.pinCurrent) els.pinCurrent.value = "";
    if (els.pinNew) els.pinNew.value = "";
    if (els.pinConfirm) els.pinConfirm.value = "";
    setPinMessage();
  }

  async function openSetup() {
    if (!SetupUI || typeof SetupUI.open !== "function") {
      setVaultMessage("UI setup Security Vault belum tersedia.", "error");
      return;
    }
    try {
      await SetupUI.open({
        supabase: client,
        onSuccess: () => refreshStatus(),
        onClose: () => refreshStatus({ quiet: true })
      });
    } catch (error) {
      console.error("[RuangKitha Security] setup UI gagal:", error);
      setVaultMessage(error && error.message ? error.message : String(error), "error");
    }
  }

  async function handlePrimary() {
    const action = els.primary?.dataset.action;
    if (action === "setup") return openSetup();
    if (action === "unlock") return openUnlock();
    if (action === "recover") return openRecoveryDevice();
    if (action === "refresh") return refreshStatus();
  }

  function openRecoveryDevice() {
    if (!RecoveryUI || typeof RecoveryUI.openRecover !== "function") {
      setVaultMessage("Recovery Kit UI belum tersedia.", "error");
      return;
    }
    RecoveryUI.openRecover({
      supabase: client,
      onSuccess: async () => {
        setVaultMessage("Perangkat ini berhasil dipulihkan dan menjadi Trusted Device.", "success");
        await refreshStatus({ quiet: true });
      },
      onClose: () => refreshStatus({ quiet: true })
    });
  }

  function openRecoveryManage() {
    if (!RecoveryUI || typeof RecoveryUI.openGenerate !== "function") {
      setVaultMessage("Recovery Kit UI belum tersedia.", "error");
      return;
    }
    const rotating = current.state?.recovery_ready === true;
    RecoveryUI.openGenerate({
      supabase: client,
      rotating,
      onSuccess: async () => {
        setVaultMessage(rotating ? "Recovery Kit berhasil diganti." : "Recovery Kit berhasil diaktifkan.", "success");
        await refreshStatus({ quiet: true });
      },
      onClose: () => refreshStatus({ quiet: true })
    });
  }

  async function handleLock() {
    const userId = current.local?.userId;
    if (!userId || !Trusted) return;
    Trusted.lock(userId);
    setVaultMessage("Security Vault dikunci pada perangkat ini.", "success");
    await refreshStatus({ quiet: true });
  }

  async function handleUnlockSubmit(event) {
    event.preventDefault();
    if (!Trusted || !els.unlockPin || !els.unlockSubmit) return;

    const pin = els.unlockPin.value;
    setUnlockMessage();
    els.unlockSubmit.disabled = true;
    els.unlockSubmit.textContent = "Membuka…";

    try {
      Trusted.validatePin(pin);
      await Trusted.unlockWithPin({ supabase: client, pin });
      closeUnlock();
      setVaultMessage("Security Vault berhasil dibuka.", "success");
      await refreshStatus({ quiet: true });
    } catch (error) {
      console.error("[RuangKitha Security] unlock gagal:", error);
      let message = error && error.message ? error.message : "Security Vault tidak dapat dibuka.";
      if (error?.code === "LOCAL_UNLOCK_FAILED") {
        const attempts = Number(error.failedAttempts || 0);
        message = attempts
          ? `PIN salah. Percobaan gagal lokal: ${attempts}.`
          : "PIN salah atau data Trusted Device lokal rusak.";
        if (error.retryAfterMs) message += ` Coba lagi setelah ${formatRetry(error.retryAfterMs)}.`;
      } else if (error?.code === "LOCAL_UNLOCK_THROTTLED") {
        message = `Terlalu banyak percobaan PIN. Coba lagi setelah ${formatRetry(error.retryAfterMs)}.`;
      }
      setUnlockMessage(message, "error");
      els.unlockPin.select();
    } finally {
      els.unlockSubmit.disabled = false;
      els.unlockSubmit.textContent = "Buka Vault";
    }
  }

  async function handlePinChangeSubmit(event) {
    event.preventDefault();
    if (!Trusted || !els.pinCurrent || !els.pinNew || !els.pinConfirm || !els.pinSubmit) return;

    const currentPin = els.pinCurrent.value;
    const newPin = els.pinNew.value;
    const confirmPin = els.pinConfirm.value;
    setPinMessage();

    if (newPin !== confirmPin) {
      setPinMessage("Konfirmasi PIN baru belum sama.", "error");
      els.pinConfirm.focus();
      return;
    }
    if (currentPin === newPin) {
      setPinMessage("PIN baru masih sama dengan PIN perangkat saat ini.", "error");
      els.pinNew.select();
      return;
    }

    els.pinSubmit.disabled = true;
    els.pinSubmit.textContent = "Mengubah…";
    try {
      Trusted.validatePin(currentPin);
      Trusted.validatePin(newPin);
      await Trusted.changeLocalPin({
        supabase: client,
        currentPin,
        newPin
      });
      closePinChange();
      setVaultMessage("PIN perangkat ini berhasil diubah. Security Vault dikunci; buka kembali memakai PIN baru.", "success");
      await refreshStatus({ quiet: true });
    } catch (error) {
      console.error("[RuangKitha Security] ubah PIN gagal:", error);
      let message = error && error.message ? error.message : "PIN perangkat ini tidak dapat diubah.";
      if (error?.code === "LOCAL_UNLOCK_FAILED") {
        const attempts = Number(error.failedAttempts || 0);
        message = attempts
          ? `PIN perangkat saat ini salah. Percobaan gagal lokal: ${attempts}.`
          : "PIN perangkat saat ini salah atau material Trusted Device lokal rusak.";
        if (error.retryAfterMs) message += ` Coba lagi setelah ${formatRetry(error.retryAfterMs)}.`;
      } else if (error?.code === "LOCAL_UNLOCK_THROTTLED") {
        message = `Terlalu banyak percobaan PIN. Coba lagi setelah ${formatRetry(error.retryAfterMs)}.`;
      } else if (error?.code === "LOCAL_PIN_UNCHANGED") {
        message = "PIN baru masih sama dengan PIN perangkat saat ini.";
      }
      setPinMessage(message, "error");
      if (error?.code === "LOCAL_UNLOCK_FAILED") els.pinCurrent.select();
    } finally {
      els.pinSubmit.disabled = false;
      els.pinSubmit.textContent = "Ubah PIN";
    }
  }

  async function handleAutoLockChange() {
    if (!Trusted || !els.autoLockSelect) return;
    const previous = current.local?.autoLockMinutes || 5;
    els.autoLockSelect.disabled = true;
    try {
      const minutes = await Trusted.updateAutoLock({
        supabase: client,
        minutes: Number(els.autoLockSelect.value)
      });
      setVaultMessage(`Auto-lock diubah menjadi ${minutes} menit.`, "success");
      await refreshStatus({ quiet: true });
    } catch (error) {
      els.autoLockSelect.value = String(previous);
      setVaultMessage(error && error.message ? error.message : String(error), "error");
    } finally {
      els.autoLockSelect.disabled = false;
    }
  }

  async function handleRuntimeStateChange(event) {
    if (!Trusted) return;
    const detail = event && event.detail ? event.detail : {};
    const userId = current.local?.userId;
    if (!userId || detail.userId !== userId) return;

    if (detail.unlocked === false) {
      if (detail.reason === "auto-lock" || detail.reason === "expired") {
        setVaultMessage("Security Vault terkunci otomatis setelah tidak ada aktivitas.", "info");
      }
      await refreshStatus({ quiet: true });
    }
  }

  function syncAfterVisibilityReturn() {
    if (document.visibilityState === "hidden") return;
    refreshStatus({ quiet: true });
  }

  function bindEvents() {
    els.primary?.addEventListener("click", handlePrimary);
    els.lock?.addEventListener("click", handleLock);
    els.unlockForm?.addEventListener("submit", handleUnlockSubmit);
    els.unlockClose?.addEventListener("click", closeUnlock);
    els.autoLockSelect?.addEventListener("change", handleAutoLockChange);
    els.pinChange?.addEventListener("click", openPinChange);
    els.pinForm?.addEventListener("submit", handlePinChangeSubmit);
    els.pinClose?.addEventListener("click", closePinChange);
    els.recoveryManage?.addEventListener("click", openRecoveryManage);
    els.unlockLayer?.addEventListener("click", (event) => {
      if (event.target === els.unlockLayer) closeUnlock();
    });
    els.pinLayer?.addEventListener("click", (event) => {
      if (event.target === els.pinLayer) closePinChange();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (els.pinLayer && !els.pinLayer.hidden) closePinChange();
      else if (els.unlockLayer && !els.unlockLayer.hidden) closeUnlock();
    });
    window.addEventListener("pageshow", () => refreshStatus({ quiet: true }));
    window.addEventListener("focus", () => refreshStatus({ quiet: true }));
    document.addEventListener("visibilitychange", syncAfterVisibilityReturn);
    window.addEventListener(Trusted?.STATE_EVENT || "ruangkitha:security-vault-statechange", handleRuntimeStateChange);
  }

  async function init() {
    setDeviceIdentity();
    bindEvents();

    if (!client || !Trusted || !Recovery || !RecoveryUI) {
      renderError(new Error("Security Foundation / Recovery Kit belum dimuat lengkap."));
      return;
    }

    await refreshStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
