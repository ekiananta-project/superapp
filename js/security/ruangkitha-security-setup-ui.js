/*
 * RuangKitha v2.0.0a49a1 — Security Vault first-device setup UI
 * Optional, self-contained UI adapter around RuangKithaTrustedDevice.
 * Nothing opens automatically. Call RuangKithaSecuritySetupUI.open({ supabase }).
 */
(function initRuangKithaSecuritySetupUI(root) {
  "use strict";

  const Trusted = root.RuangKithaTrustedDevice;
  const STYLE_ID = "rk-security-setup-ui-style-v1";
  let active = null;

  function ensureDeps() {
    if (!Trusted) throw new Error("RuangKithaTrustedDevice belum dimuat.");
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .rksec-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(10,15,20,.54);display:flex;align-items:flex-end;justify-content:center;padding:18px;box-sizing:border-box}
      .rksec-sheet{width:min(100%,430px);max-height:min(88vh,760px);overflow:auto;background:var(--color-surface,var(--rk-surface,#fff));color:var(--color-text,var(--rk-text,#18211d));border-radius:24px 24px 18px 18px;box-shadow:0 24px 70px rgba(0,0,0,.24);font-family:Manrope,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px;box-sizing:border-box}
      .rksec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}.rksec-kicker{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.62}.rksec-title{font-size:22px;line-height:1.2;margin:4px 0 0;font-weight:750}.rksec-close{border:0;background:transparent;color:inherit;font:inherit;font-size:24px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:10px}
      .rksec-copy{font-size:14px;line-height:1.55;opacity:.82;margin:0 0 16px}.rksec-card{border:1px solid color-mix(in srgb,currentColor 13%,transparent);border-radius:16px;padding:14px;margin:12px 0;background:var(--color-surface-soft,color-mix(in srgb,var(--rk-surface,#fff) 96%,currentColor 4%))}
      .rksec-label{display:block;font-size:13px;font-weight:700;margin:14px 0 7px}.rksec-input,.rksec-select{width:100%;box-sizing:border-box;border:1px solid color-mix(in srgb,currentColor 20%,transparent);background:var(--color-surface,var(--rk-surface,#fff));color:inherit;border-radius:13px;padding:12px 13px;font:inherit;outline:none}.rksec-input:focus,.rksec-select:focus{border-color:color-mix(in srgb,currentColor 55%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,currentColor 10%,transparent)}
      .rksec-actions{display:flex;gap:10px;margin-top:18px}.rksec-btn{min-height:44px;border-radius:13px;border:0;padding:0 16px;font:inherit;font-weight:700;cursor:pointer}.rksec-btn:disabled{opacity:.55;cursor:wait}.rksec-primary{flex:1;background:var(--color-primary,var(--rk-accent,#496f5d));color:#fff}.rksec-secondary{background:color-mix(in srgb,currentColor 8%,transparent);color:inherit}.rksec-note{font-size:12px;line-height:1.5;opacity:.68;margin-top:8px}.rksec-error{display:none;margin:12px 0 0;padding:11px 12px;border-radius:12px;background:rgba(180,45,45,.10);font-size:13px;line-height:1.45}.rksec-error[data-show="true"]{display:block}.rksec-status{display:flex;gap:10px;align-items:flex-start}.rksec-dot{width:10px;height:10px;border-radius:999px;background:currentColor;margin-top:5px;opacity:.7;flex:none}.rksec-success{font-size:15px;font-weight:750;margin:0 0 4px}.rksec-small{font-size:13px;opacity:.74;margin:0;line-height:1.5}
      @media (min-width:560px){.rksec-overlay{align-items:center}.rksec-sheet{border-radius:24px}}
    `;
    document.head.appendChild(style);
  }

  function el(tag, attrs = {}, text = null) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else if (key === "type") node.type = value;
      else if (key === "name") node.name = value;
      else if (key === "autocomplete") node.autocomplete = value;
      else if (key === "inputmode") node.inputMode = value;
      else if (key === "maxlength") node.maxLength = value;
      else if (key === "minlength") node.minLength = value;
      else if (key === "value") node.value = value;
      else node.setAttribute(key, value);
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function close() {
    if (!active) return;
    const { overlay, keyHandler } = active;
    document.removeEventListener("keydown", keyHandler, true);
    overlay.remove();
    active = null;
  }

  async function open({ supabase, onSuccess = null, onClose = null } = {}) {
    ensureDeps();
    if (active) close();
    installStyles();

    const overlay = el("div", { class: "rksec-overlay", role: "presentation" });
    const sheet = el("section", { class: "rksec-sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "rksec-title" });
    const head = el("div", { class: "rksec-head" });
    const titleWrap = el("div");
    titleWrap.append(el("div", { class: "rksec-kicker" }, "Security Vault"));
    const title = el("h2", { class: "rksec-title", id: "rksec-title" }, "Jadikan perangkat ini tepercaya");
    titleWrap.append(title);
    const closeBtn = el("button", { class: "rksec-close", type: "button", "aria-label": "Tutup" }, "×");
    head.append(titleWrap, closeBtn);
    sheet.append(head);

    const intro = el("p", { class: "rksec-copy" }, "Perangkat ini akan menyimpan material kunci lokal yang dilindungi PIN. PIN tidak dikirim ke server dan bukan kunci utama akun.");
    sheet.append(intro);

    const capabilityCard = el("div", { class: "rksec-card" });
    const capabilityText = el("div", { class: "rksec-status" });
    capabilityText.append(el("span", { class: "rksec-dot" }));
    const capabilityCopy = el("div");
    capabilityCopy.append(el("p", { class: "rksec-success" }, "Memeriksa keamanan browser…"));
    capabilityCopy.append(el("p", { class: "rksec-small" }, "Web Crypto, secure context, ECDH P-256, dan penyimpanan CryptoKey lokal akan diperiksa."));
    capabilityText.append(capabilityCopy);
    capabilityCard.append(capabilityText);
    sheet.append(capabilityCard);

    const form = el("form");
    form.hidden = true;
    const deviceLabel = el("input", { class: "rksec-input", type: "text", maxlength: "120", autocomplete: "off", value: Trusted.suggestDeviceLabel() });
    const pin = el("input", { class: "rksec-input", type: "password", inputmode: "numeric", minlength: "6", maxlength: "12", autocomplete: "new-password" });
    const pin2 = el("input", { class: "rksec-input", type: "password", inputmode: "numeric", minlength: "6", maxlength: "12", autocomplete: "new-password" });
    const autoLock = el("select", { class: "rksec-select" });
    [["5", "5 menit"], ["10", "10 menit"], ["15", "15 menit"], ["30", "30 menit"]].forEach(([value, label]) => {
      const option = el("option", { value }, label);
      autoLock.append(option);
    });

    form.append(el("label", { class: "rksec-label" }, "Nama perangkat"), deviceLabel);
    form.append(el("label", { class: "rksec-label" }, "PIN lokal (6–12 digit)"), pin);
    form.append(el("div", { class: "rksec-note" }, "PIN hanya membuka Security Vault pada browser/perangkat ini. Jangan gunakan PIN sebagai password akun."));
    form.append(el("label", { class: "rksec-label" }, "Ulangi PIN"), pin2);
    form.append(el("label", { class: "rksec-label" }, "Kunci otomatis setelah tidak aktif"), autoLock);

    const warning = el("div", { class: "rksec-card" });
    warning.append(el("p", { class: "rksec-small" }, "Recovery Kit belum dibuat pada a49a. Sampai a49b dipasang, jangan bergantung pada perangkat ini sebagai satu-satunya tempat untuk data terenkripsi penting."));
    form.append(warning);

    const errorBox = el("div", { class: "rksec-error", role: "alert", "data-show": "false" });
    form.append(errorBox);
    const actions = el("div", { class: "rksec-actions" });
    const cancelBtn = el("button", { class: "rksec-btn rksec-secondary", type: "button" }, "Batal");
    const submitBtn = el("button", { class: "rksec-btn rksec-primary", type: "submit" }, "Aktifkan perangkat");
    actions.append(cancelBtn, submitBtn);
    form.append(actions);
    sheet.append(form);
    overlay.append(sheet);
    document.body.append(overlay);

    const keyHandler = (event) => { if (event.key === "Escape") close(); };
    active = { overlay, keyHandler };
    document.addEventListener("keydown", keyHandler, true);

    function doClose() {
      close();
      if (typeof onClose === "function") onClose();
    }
    closeBtn.addEventListener("click", doClose);
    cancelBtn.addEventListener("click", doClose);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) doClose(); });

    let capabilities;
    try {
      capabilities = await Trusted.checkCapabilities({ deep: true });
      if (!capabilities.supported) throw new Error(capabilities.reasons.join(" "));
      capabilityCopy.firstChild.textContent = "Browser siap untuk Trusted Device";
      capabilityCopy.lastChild.textContent = `Web Crypto + IndexedDB siap. PIN KDF: ${capabilities.pinKdf}.`;
      form.hidden = false;
      deviceLabel.focus();
    } catch (error) {
      capabilityCopy.firstChild.textContent = "Perangkat belum didukung";
      capabilityCopy.lastChild.textContent = error && error.message ? error.message : String(error);
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.dataset.show = "false";
      errorBox.textContent = "";
      if (pin.value !== pin2.value) {
        errorBox.textContent = "PIN dan konfirmasi PIN belum sama.";
        errorBox.dataset.show = "true";
        pin2.focus();
        return;
      }

      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      closeBtn.disabled = true;
      submitBtn.textContent = "Mengaktifkan…";
      try {
        Trusted.validatePin(pin.value);
        const result = await Trusted.setupFirstVault({
          supabase,
          pin: pin.value,
          deviceLabel: deviceLabel.value,
          autoLockMinutes: Number(autoLock.value)
        });
        pin.value = "";
        pin2.value = "";
        form.remove();
        capabilityCard.remove();
        intro.remove();
        title.textContent = "Perangkat sudah tepercaya";
        const done = el("div", { class: "rksec-card" });
        done.append(el("p", { class: "rksec-success" }, "Security Vault aktif di perangkat ini."));
        done.append(el("p", { class: "rksec-small" }, `Vault akan terkunci otomatis setelah ${result.autoLockMinutes} menit tanpa aktivitas. Recovery Kit akan dilengkapi pada a49b.`));
        const doneBtn = el("button", { class: "rksec-btn rksec-primary", type: "button" }, "Selesai");
        doneBtn.style.width = "100%";
        doneBtn.style.marginTop = "14px";
        doneBtn.addEventListener("click", () => {
          close();
          if (typeof onSuccess === "function") onSuccess(result);
        });
        done.append(doneBtn);
        sheet.append(done);
      } catch (error) {
        errorBox.textContent = error && error.message ? error.message : String(error);
        errorBox.dataset.show = "true";
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        closeBtn.disabled = false;
        submitBtn.textContent = "Aktifkan perangkat";
      }
    });

    return { close, capabilities };
  }

  const api = Object.freeze({ open, close });
  root.RuangKithaSecuritySetupUI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
