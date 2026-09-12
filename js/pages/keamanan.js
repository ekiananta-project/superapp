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
    recoveryManage: document.querySelector("[data-recovery-manage]"),
    deviceNameSection: document.querySelector("[data-security-device-name]"),
    deviceNameCurrent: document.querySelector("[data-security-device-name-current]"),
    deviceRenameCurrent: document.querySelector("[data-security-device-rename-current]"),
    deviceList: document.querySelector("[data-device-list]"),
    deviceListEmpty: document.querySelector("[data-device-list-empty]"),
    renameLayer: document.querySelector("[data-security-device-rename-layer]"),
    renameClose: document.querySelector("[data-security-device-rename-close]"),
    renameForm: document.querySelector("[data-security-device-rename-form]"),
    renameInput: document.querySelector("[data-security-device-rename-input]"),
    renameMessage: document.querySelector("[data-security-device-rename-message]"),
    renameSubmit: document.querySelector("[data-security-device-rename-submit]"),
    revokeLayer: document.querySelector("[data-security-device-revoke-layer]"),
    revokeClose: document.querySelector("[data-security-device-revoke-close]"),
    revokeForm: document.querySelector("[data-security-device-revoke-form]"),
    revokeCopy: document.querySelector("[data-security-device-revoke-copy]"),
    revokePin: document.querySelector("[data-security-device-revoke-pin]"),
    revokeMessage: document.querySelector("[data-security-device-revoke-message]"),
    revokeSubmit: document.querySelector("[data-security-device-revoke-submit]")
  };

  let current = {
    state: null,
    local: null,
    capabilities: null,
    devices: [],
    loading: false,
    renameTarget: null,
    revokeTarget: null
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

  function setRenameMessage(message = "", tone = "error") {
    if (!els.renameMessage) return;
    els.renameMessage.hidden = !message;
    els.renameMessage.textContent = message;
    els.renameMessage.dataset.tone = tone;
  }

  function setRevokeMessage(message = "", tone = "error") {
    if (!els.revokeMessage) return;
    els.revokeMessage.hidden = !message;
    els.revokeMessage.textContent = message;
    els.revokeMessage.dataset.tone = tone;
  }

  function formatWhen(value) {
    if (!value) return "Belum ada aktivitas";
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "Waktu tidak tersedia";
    const diff = Math.max(0, Date.now() - time);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return "Baru saja";
    if (diff < hour) return `${Math.floor(diff / minute)} menit lalu`;
    if (diff < day) return `${Math.floor(diff / hour)} jam lalu`;
    if (diff < 7 * day) return `${Math.floor(diff / day)} hari lalu`;
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(time));
  }

  function iconForDeviceLabel(label = "") {
    const value = String(label).toLowerCase();
    if (/iphone|ipad|android|phone|mobile/.test(value)) return "phone-portrait-outline";
    return "desktop-outline";
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

    // a49c: if this browser was revoked from another Trusted Device, purge its local
    // trusted record before rendering. A transient network error is surfaced normally.
    await Trusted.revalidateCurrentDevice({ supabase: client, purgeRevoked: true });

    const [state, local, capabilities] = await Promise.all([
      rpc("security_vault_state_v1"),
      Trusted.localDeviceStatus({ supabase: client }),
      Trusted.checkCapabilities({ deep: false })
    ]);
    const deviceSnapshot = state?.configured
      ? await Trusted.listDevices({ supabase: client })
      : { devices: [], trusted_device_count: 0 };

    current = {
      ...current,
      state: state || { configured: false },
      local,
      capabilities,
      devices: Array.isArray(deviceSnapshot?.devices) ? deviceSnapshot.devices : []
    };
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
    if (els.deviceNameSection) els.deviceNameSection.hidden = true;
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
    if (els.deviceNameSection) els.deviceNameSection.hidden = true;
    if (els.recoveryCard) els.recoveryCard.hidden = true;
    setVaultMessage(message, "error");
    if (els.deviceDetail) els.deviceDetail.textContent = "Status Security Vault belum tersedia";
    if (els.deviceBadge) {
      els.deviceBadge.textContent = "Perlu dicek";
      els.deviceBadge.dataset.state = "danger";
    }
  }

  function renderDeviceList() {
    if (!els.deviceList) return;
    const devices = Array.isArray(current.devices) ? current.devices : [];
    const others = devices.filter((device) => !device.is_current);
    els.deviceList.replaceChildren();

    if (!others.length) {
      const empty = document.createElement("div");
      empty.className = "kartu-sesi-kosong";
      empty.innerHTML = `<ion-icon name="devices-outline"></ion-icon><strong>Belum ada perangkat lain</strong><p>Perangkat yang dipulihkan dengan Recovery Kit akan muncul di sini.</p>`;
      els.deviceList.appendChild(empty);
      return;
    }

    for (const device of others) {
      const item = document.createElement("article");
      item.className = "security-device-item";
      item.dataset.deviceId = device.device_id || "";
      item.dataset.revoked = device.trust_state === "revoked" ? "true" : "false";

      const icon = document.createElement("span");
      icon.className = "ikon-perangkat";
      icon.innerHTML = `<ion-icon name="${iconForDeviceLabel(device.device_label)}"></ion-icon>`;

      const copy = document.createElement("div");
      copy.className = "security-device-item-copy";
      const name = document.createElement("strong");
      name.textContent = device.device_label || "Trusted Device";
      const seen = document.createElement("span");
      seen.textContent = device.trust_state === "revoked"
        ? `Dicabut ${formatWhen(device.revoked_at)}`
        : `Terakhir aktif ${formatWhen(device.last_seen_at || device.verified_at || device.created_at)}`;
      const added = document.createElement("small");
      added.textContent = `Ditambahkan ${formatWhen(device.created_at)}`;
      const badge = document.createElement("span");
      badge.className = "security-device-state";
      badge.dataset.state = device.trust_state === "revoked" ? "revoked" : "trusted";
      badge.textContent = device.trust_state === "revoked" ? "Dicabut" : "Tepercaya";
      copy.append(name, seen, added, badge);

      item.append(icon, copy);

      if (device.trust_state === "trusted" && current.local?.ready) {
        const actions = document.createElement("div");
        actions.className = "security-device-actions";
        const rename = document.createElement("button");
        rename.type = "button"; rename.className = "security-device-action"; rename.textContent = "Ubah nama";
        rename.dataset.deviceAction = "rename";
        const revoke = document.createElement("button");
        revoke.type = "button"; revoke.className = "security-device-action danger"; revoke.textContent = "Cabut";
        revoke.dataset.deviceAction = "revoke";
        actions.append(rename, revoke);
        item.append(actions);
      }

      els.deviceList.appendChild(item);
    }
  }

  function renderSnapshot() {
    current.loading = false;
    const state = current.state || { configured: false };
    const local = current.local || { present: false, ready: false, unlocked: false };
    const caps = current.capabilities || { supported: false, reasons: ["Capability belum diperiksa."] };

    if (local.ready && local.deviceLabel) {
      if (els.nama) els.nama.textContent = local.deviceLabel;
      if (els.detail) els.detail.textContent = `${deteksiPerangkat().nama} · ${deteksiBrowser()}`;
    } else {
      setDeviceIdentity();
    }
    if (els.pinManage) els.pinManage.hidden = !local.ready;
    if (els.deviceNameSection) els.deviceNameSection.hidden = !local.ready;
    if (els.deviceNameCurrent) els.deviceNameCurrent.textContent = local.deviceLabel || "—";
    renderDeviceList();

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

  function openRenameDevice(device) {
    if (!current.local?.ready || !device || !els.renameLayer || !els.renameInput) return;
    current.renameTarget = device;
    setRenameMessage();
    els.renameInput.value = device.device_label || "";
    els.renameLayer.hidden = false;
    document.body.classList.add("security-sheet-open");
    requestAnimationFrame(() => { els.renameInput.focus(); els.renameInput.select(); });
  }

  function closeRenameDevice() {
    if (!els.renameLayer) return;
    els.renameLayer.hidden = true;
    document.body.classList.remove("security-sheet-open");
    current.renameTarget = null;
    if (els.renameInput) els.renameInput.value = "";
    setRenameMessage();
  }

  function openRevokeDevice(device) {
    if (!current.local?.ready || !current.state?.recovery_ready || !device || device.trust_state !== "trusted") {
      setVaultMessage("Recovery Kit aktif dan Trusted Device saat ini diperlukan untuk mencabut perangkat lain.", "error");
      return;
    }
    current.revokeTarget = device;
    setRevokeMessage();
    if (els.revokePin) els.revokePin.value = "";
    if (els.revokeCopy) els.revokeCopy.textContent = `Cabut akses “${device.device_label || "Trusted Device"}”. Perangkat tersebut tidak akan dapat membuka Security Vault lagi.`;
    els.revokeLayer.hidden = false;
    document.body.classList.add("security-sheet-open");
    requestAnimationFrame(() => els.revokePin?.focus());
  }

  function closeRevokeDevice() {
    if (!els.revokeLayer) return;
    els.revokeLayer.hidden = true;
    document.body.classList.remove("security-sheet-open");
    current.revokeTarget = null;
    if (els.revokePin) els.revokePin.value = "";
    setRevokeMessage();
  }

  async function handleRenameSubmit(event) {
    event.preventDefault();
    const target = current.renameTarget;
    if (!target || !els.renameInput || !els.renameSubmit) return;
    els.renameSubmit.disabled = true;
    els.renameSubmit.textContent = "Menyimpan…";
    try {
      const result = await Trusted.renameDevice({
        supabase: client,
        deviceId: target.device_id,
        deviceLabel: els.renameInput.value
      });
      closeRenameDevice();
      setVaultMessage(`Nama perangkat diubah menjadi “${result?.device_label || els.renameInput.value}”.`, "success");
      await refreshStatus({ quiet: true });
    } catch (error) {
      setRenameMessage(error?.message || "Nama perangkat tidak dapat diubah.", "error");
    } finally {
      els.renameSubmit.disabled = false;
      els.renameSubmit.textContent = "Simpan nama";
    }
  }

  async function handleRevokeSubmit(event) {
    event.preventDefault();
    const target = current.revokeTarget;
    if (!target || !els.revokePin || !els.revokeSubmit) return;
    const pin = els.revokePin.value;
    els.revokeSubmit.disabled = true;
    els.revokeSubmit.textContent = "Mencabut…";
    setRevokeMessage();
    try {
      Trusted.validatePin(pin);
      const proof = await Recovery.masterProofForTrustedAction({ supabase: client, pin });
      const result = await Trusted.revokeDevice({
        supabase: client,
        deviceId: target.device_id,
        masterProofSha256: proof
      });
      closeRevokeDevice();
      setVaultMessage(`Akses “${target.device_label || "Trusted Device"}” berhasil dicabut.`, "success");
      await refreshStatus({ quiet: true });
      return result;
    } catch (error) {
      let message = error?.message || "Trusted Device tidak dapat dicabut.";
      if (error?.code === "LOCAL_UNLOCK_FAILED") message = "PIN perangkat ini salah.";
      else if (error?.code === "LOCAL_UNLOCK_THROTTLED") message = `Terlalu banyak percobaan PIN. Coba lagi setelah ${formatRetry(error.retryAfterMs)}.`;
      setRevokeMessage(message, "error");
      els.revokePin.select();
    } finally {
      els.revokeSubmit.disabled = false;
      els.revokeSubmit.textContent = "Cabut akses perangkat";
    }
  }

  function currentDeviceDescriptor() {
    const local = current.local;
    if (!local?.ready || !local.deviceId) return null;
    return {
      device_id: local.deviceId,
      device_label: local.deviceLabel || deteksiPerangkat().nama,
      trust_state: "trusted",
      is_current: true
    };
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
      } else if (detail.reason === "device-revoked" || detail.reason === "self-revoked") {
        setVaultMessage("Trust perangkat ini telah dicabut. Gunakan Recovery Kit bila ingin mempercayai perangkat ini kembali.", "error");
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
    els.deviceRenameCurrent?.addEventListener("click", () => {
      const device = currentDeviceDescriptor();
      if (device) openRenameDevice(device);
    });
    els.deviceList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-device-action]");
      if (!button) return;
      const item = button.closest("[data-device-id]");
      const device = current.devices.find((entry) => entry.device_id === item?.dataset.deviceId);
      if (!device) return;
      if (button.dataset.deviceAction === "rename") openRenameDevice(device);
      else if (button.dataset.deviceAction === "revoke") openRevokeDevice(device);
    });
    els.renameForm?.addEventListener("submit", handleRenameSubmit);
    els.renameClose?.addEventListener("click", closeRenameDevice);
    els.revokeForm?.addEventListener("submit", handleRevokeSubmit);
    els.revokeClose?.addEventListener("click", closeRevokeDevice);
    els.unlockLayer?.addEventListener("click", (event) => {
      if (event.target === els.unlockLayer) closeUnlock();
    });
    els.pinLayer?.addEventListener("click", (event) => {
      if (event.target === els.pinLayer) closePinChange();
    });
    els.renameLayer?.addEventListener("click", (event) => {
      if (event.target === els.renameLayer) closeRenameDevice();
    });
    els.revokeLayer?.addEventListener("click", (event) => {
      if (event.target === els.revokeLayer) closeRevokeDevice();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (els.revokeLayer && !els.revokeLayer.hidden) closeRevokeDevice();
      else if (els.renameLayer && !els.renameLayer.hidden) closeRenameDevice();
      else if (els.pinLayer && !els.pinLayer.hidden) closePinChange();
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
