/* RuangKitha a49b1 — Recovery Kit V1 + per-device PIN UX */
(function initRuangKithaRecoveryUI(root) {
  "use strict";

  const Recovery = root.RuangKithaRecoveryKit;
  const Trusted = root.RuangKithaTrustedDevice;
  const BUILD = "v2.0.0a49b1";

  let generateState = null;
  let recoverState = null;

  function requireDeps() {
    if (!Recovery || !Trusted) throw new Error("Recovery Kit engine belum dimuat.");
  }

  function createElement(tag, className, attrs = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "text") el.textContent = value;
      else if (key === "html") el.innerHTML = value;
      else if (key.startsWith("data-")) el.setAttribute(key, value);
      else if (key in el) el[key] = value;
      else el.setAttribute(key, value);
    }
    return el;
  }

  function ensureGenerateLayer() {
    let layer = document.querySelector("[data-recovery-generate-layer]");
    if (layer) return layer;
    layer = createElement("div", "lapisan security-recovery-layer", { "data-recovery-generate-layer": "", hidden: true });
    layer.innerHTML = `
      <section class="bottom-sheet security-recovery-sheet" role="dialog" aria-modal="true" aria-labelledby="recovery-generate-title">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div>
            <h2 id="recovery-generate-title" data-recovery-generate-title>Buat Recovery Kit</h2>
            <p class="sheet-subjudul" data-recovery-generate-subtitle>Recovery Kit memulihkan vault bila Trusted Device hilang.</p>
          </div>
          <button class="tombol-ikon" type="button" data-recovery-generate-close aria-label="Tutup"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div data-recovery-generate-step="pin">
          <div class="security-warning-box">
            <ion-icon name="warning-outline"></ion-icon>
            <p>Recovery Code adalah rahasia. RuangKitha tidak menyimpan kode ini dan tidak dapat menampilkannya kembali setelah sheet ditutup.</p>
          </div>
          <form class="formulir" data-recovery-generate-form>
            <div class="grup-input">
              <label for="recovery-current-pin">PIN lokal perangkat ini</label>
              <input class="input" id="recovery-current-pin" data-recovery-current-pin type="password" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="12" autocomplete="current-password" required>
              <small class="security-field-hint">PIN hanya dipakai lokal untuk membuka Master Key pada Trusted Device ini.</small>
            </div>
            <p class="security-unlock-message" data-recovery-generate-message role="alert" hidden></p>
            <button class="tombol-utama" type="submit" data-recovery-generate-submit>Buat Recovery Kit</button>
          </form>
        </div>
        <div data-recovery-generate-step="kit" hidden>
          <div class="security-warning-box security-warning-box-strong">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <p><strong>Simpan sekarang.</strong> Unduh atau cetak Recovery Kit. Kode ini belum menggantikan kit lama sampai kamu menekan “Aktifkan Recovery Kit”.</p>
          </div>
          <div class="recovery-qr" data-recovery-qr aria-label="QR Recovery Kit"></div>
          <div class="recovery-code" data-recovery-code></div>
          <div class="recovery-artifact-actions">
            <button class="tombol-sekunder" type="button" data-recovery-download><ion-icon name="download-outline"></ion-icon> Unduh</button>
            <button class="tombol-sekunder" type="button" data-recovery-print><ion-icon name="print-outline"></ion-icon> Cetak</button>
          </div>
          <label class="recovery-confirm">
            <input type="checkbox" data-recovery-saved-check>
            <span>Saya sudah menyimpan Recovery Kit di tempat yang aman.</span>
          </label>
          <p class="security-unlock-message" data-recovery-kit-message role="alert" hidden></p>
          <button class="tombol-utama" type="button" data-recovery-activate disabled>Aktifkan Recovery Kit</button>
        </div>
        <div data-recovery-generate-step="done" hidden>
          <div class="recovery-success">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
            <h3>Recovery Kit aktif</h3>
            <p>Kit lama sudah tidak berlaku. Simpan Recovery Kit baru ini dan jangan membagikannya.</p>
          </div>
          <div class="recovery-qr" data-recovery-done-qr></div>
          <div class="recovery-code" data-recovery-done-code></div>
          <div class="recovery-artifact-actions">
            <button class="tombol-sekunder" type="button" data-recovery-done-download>Unduh lagi</button>
            <button class="tombol-sekunder" type="button" data-recovery-done-print>Cetak</button>
          </div>
          <button class="tombol-utama" type="button" data-recovery-done>Selesai</button>
        </div>
      </section>`;
    document.body.appendChild(layer);
    bindGenerateLayer(layer);
    return layer;
  }

  function ensureRecoverLayer() {
    let layer = document.querySelector("[data-recovery-device-layer]");
    if (layer) return layer;
    layer = createElement("div", "lapisan security-recovery-layer", { "data-recovery-device-layer": "", hidden: true });
    layer.innerHTML = `
      <section class="bottom-sheet security-recovery-sheet" role="dialog" aria-modal="true" aria-labelledby="recovery-device-title">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div>
            <h2 id="recovery-device-title">Pulihkan perangkat ini</h2>
            <p class="sheet-subjudul">Gunakan Recovery Kit untuk menjadikan browser ini Trusted Device baru. Setelah recovery, buat PIN khusus perangkat ini.</p>
          </div>
          <button class="tombol-ikon" type="button" data-recovery-device-close aria-label="Tutup"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <form class="formulir" data-recovery-device-form>
          <div class="grup-input">
            <label for="recovery-device-code">Recovery Code</label>
            <textarea class="input recovery-code-input" id="recovery-device-code" data-recovery-device-code rows="4" autocomplete="off" autocapitalize="characters" spellcheck="false" required placeholder="RK1-XXXX-XXXX-..."></textarea>
            <small class="security-field-hint">Masukkan kode RK1 yang tercetak di Recovery Kit. QR berisi kode yang sama.</small>
          </div>
          <div class="grup-input">
            <label for="recovery-device-label">Nama perangkat</label>
            <input class="input" id="recovery-device-label" data-recovery-device-label maxlength="120" required>
          </div>
          <div class="security-two-fields">
            <div class="grup-input">
              <label for="recovery-device-pin">PIN perangkat ini</label>
              <input class="input" id="recovery-device-pin" data-recovery-device-pin type="password" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="12" autocomplete="new-password" required>
            </div>
            <div class="grup-input">
              <label for="recovery-device-pin-confirm">Ulangi PIN perangkat ini</label>
              <input class="input" id="recovery-device-pin-confirm" data-recovery-device-pin-confirm type="password" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="12" autocomplete="new-password" required>
            </div>
          </div>
          <small class="security-field-hint security-pin-device-hint">PIN ini hanya berlaku di browser/perangkat ini. PIN perangkat lain tidak disalin lewat Recovery Kit. Kamu boleh memasukkan PIN yang sama seperti Trusted Device lain agar lebih mudah diingat.</small>
          <div class="grup-input">
            <label for="recovery-device-autolock">Kunci otomatis</label>
            <select class="input" id="recovery-device-autolock" data-recovery-device-autolock>
              <option value="5">5 menit</option><option value="10">10 menit</option><option value="15">15 menit</option><option value="30">30 menit</option>
            </select>
          </div>
          <div class="security-warning-box">
            <ion-icon name="lock-closed-outline"></ion-icon>
            <p>Recovery Code tidak dikirim ke server. Server hanya menerima bukti bahwa Master Key yang dipulihkan benar.</p>
          </div>
          <p class="security-unlock-message" data-recovery-device-message role="alert" hidden></p>
          <button class="tombol-utama" type="submit" data-recovery-device-submit>Pulihkan &amp; Percayai Perangkat</button>
        </form>
      </section>`;
    document.body.appendChild(layer);
    bindRecoverLayer(layer);
    return layer;
  }

  function message(el, text = "", tone = "error") {
    if (!el) return;
    el.hidden = !text;
    el.textContent = text;
    el.dataset.tone = tone;
  }

  function resetGenerate(layer, rotating) {
    const pinStep = layer.querySelector('[data-recovery-generate-step="pin"]');
    const kitStep = layer.querySelector('[data-recovery-generate-step="kit"]');
    const doneStep = layer.querySelector('[data-recovery-generate-step="done"]');
    pinStep.hidden = false; kitStep.hidden = true; doneStep.hidden = true;
    const pin = layer.querySelector("[data-recovery-current-pin]");
    if (pin) pin.value = "";
    const check = layer.querySelector("[data-recovery-saved-check]");
    if (check) check.checked = false;
    const activate = layer.querySelector("[data-recovery-activate]");
    if (activate) activate.disabled = true;
    layer.querySelector("[data-recovery-qr]").replaceChildren();
    layer.querySelector("[data-recovery-code]").textContent = "";
    layer.querySelector("[data-recovery-done-qr]").replaceChildren();
    layer.querySelector("[data-recovery-done-code]").textContent = "";
    const title = layer.querySelector("[data-recovery-generate-title]");
    const subtitle = layer.querySelector("[data-recovery-generate-subtitle]");
    if (title) title.textContent = rotating ? "Ganti Recovery Kit" : "Buat Recovery Kit";
    if (subtitle) subtitle.textContent = rotating
      ? "Kit baru akan menggantikan Recovery Kit lama tanpa mengenkripsi ulang data."
      : "Buat jalur pemulihan bila semua Trusted Device hilang.";
    const submit = layer.querySelector("[data-recovery-generate-submit]");
    if (submit) submit.textContent = rotating ? "Buat Kit Pengganti" : "Buat Recovery Kit";
    message(layer.querySelector("[data-recovery-generate-message]"));
    message(layer.querySelector("[data-recovery-kit-message]"));
  }

  async function closeGenerate({ activated = false } = {}) {
    const layer = document.querySelector("[data-recovery-generate-layer]");
    if (!layer || layer.hidden) return;
    const draft = generateState?.draft;
    if (draft && !activated) {
      const okay = typeof window === "undefined" || window.confirm("Recovery Kit ini belum aktif. Menutup sekarang akan membatalkan kit yang baru dibuat. Lanjut tutup?");
      if (!okay) return;
    }
    if (draft && !activated && generateState?.supabase) {
      await Recovery.cancelPreparedRecovery({
        supabase: generateState.supabase,
        recoveryEnvelopeId: draft.recoveryEnvelopeId
      });
    }
    layer.hidden = true;
    document.body.classList.remove("security-sheet-open");
    const onClose = generateState?.onClose;
    generateState = null;
    resetGenerate(layer, false);
    if (typeof onClose === "function") onClose();
  }

  function bindGenerateLayer(layer) {
    layer.querySelector("[data-recovery-generate-close]")?.addEventListener("click", () => closeGenerate());
    layer.addEventListener("click", (event) => { if (event.target === layer) closeGenerate(); });

    layer.querySelector("[data-recovery-generate-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!generateState) return;
      const pin = layer.querySelector("[data-recovery-current-pin]");
      const submit = layer.querySelector("[data-recovery-generate-submit]");
      const msg = layer.querySelector("[data-recovery-generate-message]");
      message(msg);
      submit.disabled = true;
      submit.textContent = "Membuat…";
      try {
        Trusted.validatePin(pin.value);
        const draft = await Recovery.prepareRecoveryKit({ supabase: generateState.supabase, pin: pin.value });
        generateState.draft = draft;
        pin.value = "";
        layer.querySelector('[data-recovery-generate-step="pin"]').hidden = true;
        layer.querySelector('[data-recovery-generate-step="kit"]').hidden = false;
        layer.querySelector("[data-recovery-qr]").innerHTML = draft.qrSvg;
        layer.querySelector("[data-recovery-code]").textContent = draft.code;
      } catch (error) {
        let text = error?.message || String(error);
        if (error?.code === "LOCAL_UNLOCK_FAILED") text = "PIN lokal salah atau material Trusted Device tidak dapat dibuka.";
        message(msg, text, "error");
        pin.select();
      } finally {
        submit.disabled = false;
        submit.textContent = generateState?.rotating ? "Buat Kit Pengganti" : "Buat Recovery Kit";
      }
    });

    const doDownload = () => {
      if (!generateState?.draft) return;
      try { Recovery.downloadRecoveryArtifact(generateState.draft); }
      catch (error) { message(layer.querySelector("[data-recovery-kit-message]"), error?.message || String(error)); }
    };
    const doPrint = () => {
      if (!generateState?.draft) return;
      try { Recovery.printRecoveryArtifact(generateState.draft); }
      catch (error) { message(layer.querySelector("[data-recovery-kit-message]"), error?.message || String(error)); }
    };
    layer.querySelector("[data-recovery-download]")?.addEventListener("click", doDownload);
    layer.querySelector("[data-recovery-print]")?.addEventListener("click", doPrint);
    layer.querySelector("[data-recovery-done-download]")?.addEventListener("click", doDownload);
    layer.querySelector("[data-recovery-done-print]")?.addEventListener("click", doPrint);

    layer.querySelector("[data-recovery-saved-check]")?.addEventListener("change", (event) => {
      const activate = layer.querySelector("[data-recovery-activate]");
      if (activate) activate.disabled = !event.target.checked;
    });

    layer.querySelector("[data-recovery-activate]")?.addEventListener("click", async () => {
      if (!generateState?.draft) return;
      const button = layer.querySelector("[data-recovery-activate]");
      const msg = layer.querySelector("[data-recovery-kit-message]");
      message(msg);
      button.disabled = true;
      button.textContent = "Mengaktifkan…";
      try {
        await Recovery.activatePreparedRecovery({
          supabase: generateState.supabase,
          recoveryEnvelopeId: generateState.draft.recoveryEnvelopeId
        });
        generateState.activated = true;
        layer.querySelector('[data-recovery-generate-step="kit"]').hidden = true;
        layer.querySelector('[data-recovery-generate-step="done"]').hidden = false;
        layer.querySelector("[data-recovery-done-qr]").innerHTML = generateState.draft.qrSvg;
        layer.querySelector("[data-recovery-done-code]").textContent = generateState.draft.code;
        if (typeof generateState.onSuccess === "function") generateState.onSuccess({ ...generateState.draft, activated: true });
      } catch (error) {
        message(msg, error?.message || String(error), "error");
        button.disabled = false;
        button.textContent = "Aktifkan Recovery Kit";
      }
    });

    layer.querySelector("[data-recovery-done]")?.addEventListener("click", () => closeGenerate({ activated: true }));
  }

  function bindRecoverLayer(layer) {
    const close = () => {
      layer.hidden = true;
      document.body.classList.remove("security-sheet-open");
      const onClose = recoverState?.onClose;
      recoverState = null;
      layer.querySelector("[data-recovery-device-form]")?.reset();
      message(layer.querySelector("[data-recovery-device-message]"));
      if (typeof onClose === "function") onClose();
    };
    layer.querySelector("[data-recovery-device-close]")?.addEventListener("click", close);
    layer.addEventListener("click", (event) => { if (event.target === layer) close(); });

    layer.querySelector("[data-recovery-device-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!recoverState) return;
      const code = layer.querySelector("[data-recovery-device-code]");
      const label = layer.querySelector("[data-recovery-device-label]");
      const pin = layer.querySelector("[data-recovery-device-pin]");
      const confirm = layer.querySelector("[data-recovery-device-pin-confirm]");
      const autoLock = layer.querySelector("[data-recovery-device-autolock]");
      const submit = layer.querySelector("[data-recovery-device-submit]");
      const msg = layer.querySelector("[data-recovery-device-message]");
      message(msg);

      if (pin.value !== confirm.value) {
        message(msg, "Konfirmasi PIN perangkat ini belum sama.");
        confirm.focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = "Memulihkan…";
      try {
        Trusted.validatePin(pin.value);
        await Recovery.recoverNewDevice({
          supabase: recoverState.supabase,
          recoveryCode: code.value,
          pin: pin.value,
          deviceLabel: label.value,
          autoLockMinutes: Number(autoLock.value || 5)
        });
        const onSuccess = recoverState.onSuccess;
        close();
        if (typeof onSuccess === "function") onSuccess();
      } catch (error) {
        let text = error?.message || String(error);
        if (error?.code === "RECOVERY_CHECKSUM_MISMATCH") text = "Recovery Code salah ketik: checksum tidak cocok.";
        message(msg, text, "error");
      } finally {
        submit.disabled = false;
        submit.textContent = "Pulihkan & Percayai Perangkat";
      }
    });
  }

  function openGenerate({ supabase, rotating = false, onSuccess = null, onClose = null } = {}) {
    requireDeps();
    const layer = ensureGenerateLayer();
    resetGenerate(layer, Boolean(rotating));
    generateState = { supabase, rotating: Boolean(rotating), onSuccess, onClose, draft: null, activated: false };
    layer.hidden = false;
    document.body.classList.add("security-sheet-open");
    requestAnimationFrame(() => layer.querySelector("[data-recovery-current-pin]")?.focus());
  }

  function openRecover({ supabase, onSuccess = null, onClose = null } = {}) {
    requireDeps();
    const layer = ensureRecoverLayer();
    recoverState = { supabase, onSuccess, onClose };
    layer.querySelector("[data-recovery-device-form]")?.reset();
    const label = layer.querySelector("[data-recovery-device-label]");
    if (label) label.value = Trusted.suggestDeviceLabel();
    message(layer.querySelector("[data-recovery-device-message]"));
    layer.hidden = false;
    document.body.classList.add("security-sheet-open");
    requestAnimationFrame(() => layer.querySelector("[data-recovery-device-code]")?.focus());
  }

  const api = Object.freeze({ BUILD, openGenerate, openRecover });
  root.RuangKithaRecoveryUI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
