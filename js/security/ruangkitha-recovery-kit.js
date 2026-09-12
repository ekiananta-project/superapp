/*
 * RuangKitha Security Foundation — Recovery Kit V1
 * Build: v2.0.0a49b
 *
 * SECURITY CONTRACT
 * - Recovery secret is 256-bit random material generated on-device.
 * - Recovery secret / human recovery code is NEVER sent to Supabase.
 * - Server stores only the encrypted Master Key envelope and a private Master-possession proof hash.
 * - Creating/rotating a kit on a Trusted Device requires the local PIN so the Master Key can be
 *   re-opened temporarily as extractable, re-wrapped, then dropped from scope.
 * - New-device recovery requires both account authentication and possession of the Recovery Kit.
 * - QR is generated locally with no network request and contains only the same Recovery Code shown
 *   to the user.
 */
(function initRuangKithaRecoveryKit(root) {
  "use strict";

  const Crypto = root.RuangKithaCrypto ||
    (typeof module !== "undefined" && module.exports ? require("./ruangkitha-crypto-core.js") : null);
  const Trusted = root.RuangKithaTrustedDevice ||
    (typeof module !== "undefined" && module.exports ? require("./ruangkitha-trusted-device.js") : null);

  const BUILD = "v2.0.0a49b";
  const VERSION = 1;
  const HUMAN_PREFIX = "RK1";
  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const CHECKSUM_BYTES = 5; // 40-bit typo checksum => 8 Crockford chars
  const QR_VERSION = 5;
  const QR_SIZE = 17 + QR_VERSION * 4;
  const QR_DATA_CODEWORDS = 108; // Version 5-L
  const QR_ECC_CODEWORDS = 26;   // Version 5-L, one RS block

  function assertDeps() {
    if (!Crypto || !Trusted) throw new Error("Security Foundation belum dimuat lengkap.");
    Crypto.assertAvailable();
  }

  function normalizeUuid(value, label = "ID") {
    const text = String(value || "").trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text)) {
      throw new Error(`${label} tidak valid.`);
    }
    return text;
  }

  async function rpc(supabase, name, params = {}) {
    if (!supabase || typeof supabase.rpc !== "function") throw new Error("Supabase client tidak valid.");
    const { data, error } = await supabase.rpc(name, params);
    if (error) throw error;
    return data;
  }

  async function currentUserId(supabase) {
    if (!supabase?.auth?.getUser) throw new Error("Supabase Auth belum tersedia.");
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data?.user?.id) throw new Error("User belum login.");
    return normalizeUuid(data.user.id, "User ID");
  }

  function base32Encode(bytes) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("bytes harus Uint8Array.");
    let buffer = 0;
    let bits = 0;
    let out = "";
    for (const byte of bytes) {
      buffer = (buffer << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        out += CROCKFORD[(buffer >>> bits) & 31];
        buffer &= (1 << bits) - 1;
      }
    }
    if (bits > 0) out += CROCKFORD[(buffer << (5 - bits)) & 31];
    return out;
  }

  function base32Decode(text) {
    const cleaned = String(text || "").toUpperCase().replace(/[\s-]/g, "")
      .replace(/O/g, "0").replace(/[IL]/g, "1");
    if (!cleaned) throw new Error("Recovery Code kosong.");
    let buffer = 0;
    let bits = 0;
    const out = [];
    for (const ch of cleaned) {
      const value = CROCKFORD.indexOf(ch);
      if (value < 0) throw new Error(`Karakter Recovery Code tidak valid: ${ch}`);
      buffer = (buffer << 5) | value;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out.push((buffer >>> bits) & 255);
        buffer &= (1 << bits) - 1;
      }
    }
    return new Uint8Array(out);
  }

  async function checksumForSecret(secretBytes) {
    const digest = await Crypto.sha256(secretBytes);
    try {
      return base32Encode(digest.subarray(0, CHECKSUM_BYTES));
    } finally {
      Crypto.zeroize(digest);
    }
  }

  async function formatRecoveryCode(secretBytes) {
    if (!(secretBytes instanceof Uint8Array) || secretBytes.byteLength !== Crypto.constants.RECOVERY_SECRET_BYTES) {
      throw new Error("Recovery secret harus tepat 32 byte.");
    }
    const body = base32Encode(secretBytes);
    const checksum = await checksumForSecret(secretBytes);
    const groups = body.match(/.{1,4}/g) || [];
    return `${HUMAN_PREFIX}-${groups.join("-")}-${checksum}`;
  }

  async function parseRecoveryCode(input) {
    assertDeps();
    const normalized = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
    const compact = normalized.replace(/-/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
    if (!compact.startsWith(HUMAN_PREFIX)) throw new Error("Recovery Code bukan format RuangKitha RK1.");
    const payload = compact.slice(HUMAN_PREFIX.length);
    if (payload.length !== 60) throw new Error("Panjang Recovery Code tidak valid.");
    const body = payload.slice(0, 52);
    const checksum = payload.slice(52);
    const secretBytes = base32Decode(body);
    if (secretBytes.byteLength !== Crypto.constants.RECOVERY_SECRET_BYTES) {
      Crypto.zeroize(secretBytes);
      throw new Error("Recovery Code tidak menghasilkan secret 256-bit yang valid.");
    }
    const expected = await checksumForSecret(secretBytes);
    if (checksum !== expected) {
      Crypto.zeroize(secretBytes);
      const error = new Error("Checksum Recovery Code tidak cocok. Periksa kembali kode yang dimasukkan.");
      error.code = "RECOVERY_CHECKSUM_MISMATCH";
      throw error;
    }
    return {
      code: await formatRecoveryCode(secretBytes),
      checksum,
      secretBytes,
      recoverySecret: Crypto.bytesToBase64Url(secretBytes)
    };
  }

  function proofAad(vaultId) {
    return Crypto.buildAad(["recovery-proof", normalizeUuid(vaultId, "Vault ID")]);
  }

  async function masterProofHashFromEnvelope(masterKey, recoveryEnvelope, vaultId) {
    if (!recoveryEnvelope?.proof?.wrapped) throw new Error("Recovery envelope belum memiliki Master proof a49b.");
    const aad = recoveryEnvelope.proof.aad || proofAad(vaultId);
    let proofBytes;
    let digest;
    try {
      proofBytes = await Crypto.decryptBytes(masterKey, recoveryEnvelope.proof.wrapped, { aad });
      if (proofBytes.byteLength !== 32) throw new Error("Master proof recovery tidak valid.");
      digest = await Crypto.sha256(proofBytes);
      return Crypto.bytesToBase64Url(digest);
    } finally {
      if (proofBytes) Crypto.zeroize(proofBytes);
      if (digest) Crypto.zeroize(digest);
    }
  }

  async function recoveryMaterial(supabase) {
    const data = await rpc(supabase, "security_recovery_material_v1");
    return data || { found: false };
  }

  async function prepareRecoveryKit({ supabase, pin } = {}) {
    assertDeps();
    Trusted.validatePin(pin);
    await currentUserId(supabase);

    return Trusted.withExtractableMasterKeyFromPin({
      supabase,
      pin,
      callback: async (masterKey, context) => {
        const vaultId = normalizeUuid(context.vaultId, "Vault ID");
        const state = await rpc(supabase, "security_vault_state_v1");
        if (!state?.configured) throw new Error("Security Vault belum aktif.");

        let currentProofSha256 = null;
        if (state.recovery_ready) {
          const current = await recoveryMaterial(supabase);
          if (!current?.found || !current.envelope) throw new Error("Recovery Kit aktif tidak dapat dibaca.");
          currentProofSha256 = await masterProofHashFromEnvelope(masterKey, current.envelope, vaultId);
        }

        const secretBytes = Crypto.randomBytes(Crypto.constants.RECOVERY_SECRET_BYTES);
        const proofBytes = Crypto.randomBytes(32);
        let proofHash;
        let proofDigest;
        try {
          const created = await Crypto.createRecoveryEnvelope(masterKey, { recoverySecretBytes: secretBytes });
          const code = await formatRecoveryCode(secretBytes);
          const aad = proofAad(vaultId);
          const proofWrapped = await Crypto.encryptBytes(masterKey, proofBytes, { aad });
          proofDigest = await Crypto.sha256(proofBytes);
          proofHash = Crypto.bytesToBase64Url(proofDigest);

          const envelope = {
            ...created.envelope,
            recovery_state: "saved",
            kit_version: 1,
            proof: {
              v: 1,
              kind: "master-possession-proof",
              aad,
              wrapped: proofWrapped
            }
          };

          const prepared = await rpc(supabase, "security_prepare_recovery_v1", {
            p_recovery_envelope: envelope,
            p_master_proof_sha256: proofHash,
            p_device_client_id: context.deviceInstanceId,
            p_current_master_proof_sha256: currentProofSha256
          });
          if (!prepared?.recovery_envelope_id) throw new Error("Server tidak mengembalikan Recovery envelope ID.");

          return {
            build: BUILD,
            recoveryEnvelopeId: normalizeUuid(prepared.recovery_envelope_id, "Recovery envelope ID"),
            vaultId,
            code,
            checksum: code.split("-").pop(),
            createdAt: new Date().toISOString(),
            rotating: Boolean(state.recovery_ready),
            qrSvg: createQrSvg(code)
          };
        } finally {
          Crypto.zeroize(secretBytes);
          Crypto.zeroize(proofBytes);
          if (proofDigest) Crypto.zeroize(proofDigest);
        }
      }
    });
  }

  async function activatePreparedRecovery({ supabase, recoveryEnvelopeId } = {}) {
    const id = normalizeUuid(recoveryEnvelopeId, "Recovery envelope ID");
    const result = await rpc(supabase, "security_activate_recovery_v1", {
      p_recovery_envelope_id: id
    });
    if (!result?.activated) throw new Error("Recovery Kit belum dapat diaktifkan.");
    return result;
  }

  async function cancelPreparedRecovery({ supabase, recoveryEnvelopeId } = {}) {
    const id = normalizeUuid(recoveryEnvelopeId, "Recovery envelope ID");
    try {
      return await rpc(supabase, "security_cancel_recovery_v1", { p_recovery_envelope_id: id });
    } catch (_) {
      return false;
    }
  }

  async function recoverNewDevice({ supabase, recoveryCode, pin, deviceLabel, autoLockMinutes = 5 } = {}) {
    assertDeps();
    Trusted.validatePin(pin);
    await currentUserId(supabase);
    const parsed = await parseRecoveryCode(recoveryCode);
    let masterKey;
    try {
      const material = await recoveryMaterial(supabase);
      if (!material?.found || !material.recovery_envelope_id || !material.envelope) {
        const error = new Error("Recovery Kit aktif tidak ditemukan pada akun ini.");
        error.code = "RECOVERY_NOT_READY";
        throw error;
      }
      if (material.envelope.recovery_state !== "saved") throw new Error("Recovery envelope belum berstatus saved.");

      masterKey = await Crypto.recoverMasterKey(parsed.recoverySecret, material.envelope, { extractable: true });
      const masterProofSha256 = await masterProofHashFromEnvelope(masterKey, material.envelope, material.vault_id);

      return Trusted.recoverDeviceWithMaster({
        supabase,
        pin,
        deviceLabel,
        autoLockMinutes,
        masterKey,
        recoveryEnvelopeId: material.recovery_envelope_id,
        masterProofSha256
      });
    } finally {
      Crypto.zeroize(parsed.secretBytes);
      // CryptoKey cannot be explicitly zeroized; extractable recovery key is dropped from scope here.
    }
  }

  // ---------- Local QR generator: fixed Version 5 / EC-L / Byte mode ----------
  function rsTables() {
    const exp = new Uint8Array(512);
    const log = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i += 1) {
      exp[i] = x;
      log[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255];
    return { exp, log };
  }

  const QR_GF = rsTables();

  function gfMul(a, b) {
    if (!a || !b) return 0;
    return QR_GF.exp[QR_GF.log[a] + QR_GF.log[b]];
  }

  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i += 1) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j += 1) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], QR_GF.exp[i]);
      }
      poly = next;
    }
    return poly;
  }

  const QR_RS_GENERATOR = rsGenerator(QR_ECC_CODEWORDS);

  function qrDataCodewords(text) {
    const bytes = new TextEncoder().encode(String(text));
    if (bytes.length > 106) throw new Error("Payload QR Recovery Kit terlalu panjang untuk format v1.");
    const bits = [];
    const pushBits = (value, count) => {
      for (let i = count - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
    };
    pushBits(0b0100, 4); // byte mode
    pushBits(bytes.length, 8); // v1-v9 byte-mode count
    for (const byte of bytes) pushBits(byte, 8);
    const capacityBits = QR_DATA_CODEWORDS * 8;
    const terminator = Math.min(4, capacityBits - bits.length);
    for (let i = 0; i < terminator; i += 1) bits.push(0);
    while (bits.length % 8) bits.push(0);

    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
      out.push(value);
    }
    let pad = true;
    while (out.length < QR_DATA_CODEWORDS) {
      out.push(pad ? 0xec : 0x11);
      pad = !pad;
    }
    return out;
  }

  function qrCodewords(text) {
    const data = qrDataCodewords(text);
    const work = data.concat(new Array(QR_ECC_CODEWORDS).fill(0));
    for (let i = 0; i < data.length; i += 1) {
      const factor = work[i];
      if (!factor) continue;
      for (let j = 0; j < QR_RS_GENERATOR.length; j += 1) {
        work[i + j] ^= gfMul(QR_RS_GENERATOR[j], factor);
      }
    }
    return data.concat(work.slice(data.length));
  }

  function formatBits(mask) {
    const data = (1 << 3) | mask; // EC level L = binary 01
    let rem = data;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ (((rem >>> 9) & 1) ? 0x537 : 0);
    return ((data << 10) | rem) ^ 0x5412;
  }

  function qrMatrix(text, mask = 0) {
    if (!Number.isInteger(mask) || mask < 0 || mask > 7) throw new Error("QR mask tidak valid.");
    const size = QR_SIZE;
    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const fn = Array.from({ length: size }, () => Array(size).fill(false));
    const setFn = (x, y, dark) => {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      modules[y][x] = Boolean(dark);
      fn[y][x] = true;
    };

    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFn(cx + dx, cy + dy, dist !== 2 && dist !== 4);
        }
      }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);

    for (let i = 0; i < size; i += 1) {
      if (!fn[6][i]) setFn(i, 6, i % 2 === 0);
      if (!fn[i][6]) setFn(6, i, i % 2 === 0);
    }

    // Version 5 alignment centers: 6,30. Only bottom-right does not overlap a finder.
    const align = (cx, cy) => {
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    };
    align(30, 30);

    // Reserve/write format information (also reserves its cells before data placement).
    const fbits = formatBits(mask);
    const bit = (i) => ((fbits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i += 1) setFn(8, i, bit(i));
    setFn(8, 7, bit(6));
    setFn(8, 8, bit(7));
    setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i += 1) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true); // fixed dark module

    const codewords = qrCodewords(text);
    const dataBits = [];
    for (const byte of codewords) for (let i = 7; i >= 0; i -= 1) dataBits.push((byte >>> i) & 1);

    const maskFn = [
      (x, y) => (x + y) % 2 === 0,
      (_x, y) => y % 2 === 0,
      (x) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) === 0,
      (x, y) => (((x * y) % 2 + (x * y) % 3) % 2) === 0,
      (x, y) => (((x + y) % 2 + (x * y) % 3) % 2) === 0
    ][mask];

    let dataIndex = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right -= 1;
      for (let vert = 0; vert < size; vert += 1) {
        const y = upward ? size - 1 - vert : vert;
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          if (fn[y][x]) continue;
          let dark = dataIndex < dataBits.length ? dataBits[dataIndex] !== 0 : false;
          if (maskFn(x, y)) dark = !dark;
          modules[y][x] = dark;
          dataIndex += 1;
        }
      }
      upward = !upward;
    }
    if (dataIndex < dataBits.length) throw new Error("QR data overflow.");
    return modules;
  }

  function createQrSvg(text, { scale = 5, border = 4 } = {}) {
    const matrix = qrMatrix(text, 0);
    const size = matrix.length;
    const dim = (size + border * 2) * scale;
    const paths = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (matrix[y][x]) paths.push(`M${(x + border) * scale},${(y + border) * scale}h${scale}v${scale}h-${scale}z`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges" role="img" aria-label="QR Recovery Kit RuangKitha"><rect width="100%" height="100%" fill="#fff"/><path d="${paths.join("")}" fill="#000"/></svg>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function createRecoveryArtifactHtml(draft) {
    if (!draft?.code || !draft?.qrSvg) throw new Error("Draft Recovery Kit tidak valid.");
    const created = new Date(draft.createdAt || Date.now());
    const dateLabel = Number.isNaN(created.getTime()) ? "" : created.toLocaleString("id-ID");
    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RuangKitha Recovery Kit</title><style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f7f3ea;color:#263129}.page{max-width:720px;margin:0 auto;padding:42px}.card{background:#fff;border:1px solid #d9ded8;border-radius:24px;padding:30px}.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#718078;font-weight:700}h1{font-size:28px;margin:8px 0 10px}p{color:#66736c;line-height:1.55}.qr{display:flex;justify-content:center;margin:28px 0}.qr svg{width:260px;height:260px;max-width:100%}.code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:17px;line-height:1.8;word-break:break-word;background:#eef2ee;border-radius:16px;padding:18px;color:#1f2b24;font-weight:700;letter-spacing:.04em}.warning{margin-top:22px;padding:16px;border-radius:16px;background:#fff4dc;color:#6c5121;font-size:14px}.meta{margin-top:20px;font-size:12px;color:#7c8781}.brand{font-weight:800;color:#527d69}@media print{body{background:#fff}.page{padding:0}.card{border:0;box-shadow:none}}</style></head><body><div class="page"><div class="card"><div class="eyebrow">Security Foundation · Recovery Kit V1</div><h1><span class="brand">RuangKitha</span> Recovery Kit</h1><p>Simpan dokumen ini di tempat pribadi yang aman. Recovery Kit dapat digunakan untuk memulihkan Security Vault pada perangkat baru.</p><div class="qr">${draft.qrSvg}</div><div class="code">${escapeHtml(draft.code)}</div><div class="warning"><strong>Rahasia.</strong> Siapa pun yang memiliki Recovery Kit ini dan akses ke akun dapat mencoba memulihkan vault. Jangan unggah ke chat, email publik, atau penyimpanan yang tidak dipercaya. Kit ini berlaku setelah proses “Aktifkan Recovery Kit” selesai di aplikasi.</div><div class="meta">Dibuat: ${escapeHtml(dateLabel)} · Format RK1 · ${escapeHtml(BUILD)}</div></div></div></body></html>`;
  }

  function downloadRecoveryArtifact(draft) {
    if (typeof document === "undefined" || typeof URL === "undefined") throw new Error("Download artifact hanya tersedia di browser.");
    const html = createRecoveryArtifactHtml(draft);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RuangKitha-Recovery-Kit-${new Date().toISOString().slice(0, 10)}.html`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  }

  function printRecoveryArtifact(draft) {
    if (typeof window === "undefined") throw new Error("Cetak artifact hanya tersedia di browser.");
    const popup = window.open("", "_blank");
    if (!popup) throw new Error("Popup cetak diblokir browser.");
    try { popup.opener = null; } catch (_) {}
    popup.document.open();
    popup.document.write(createRecoveryArtifactHtml(draft));
    popup.document.close();
    popup.addEventListener("load", () => {
      popup.focus();
      popup.print();
    }, { once: true });
    return true;
  }

  const api = {
    BUILD,
    VERSION,
    HUMAN_PREFIX,
    prepareRecoveryKit,
    activatePreparedRecovery,
    cancelPreparedRecovery,
    recoveryMaterial,
    recoverNewDevice,
    parseRecoveryCode,
    formatRecoveryCode,
    createQrSvg,
    createRecoveryArtifactHtml,
    downloadRecoveryArtifact,
    printRecoveryArtifact
  };

  if (typeof module !== "undefined" && module.exports) {
    api.__test = Object.freeze({
      base32Encode,
      base32Decode,
      checksumForSecret,
      qrDataCodewords,
      qrCodewords,
      qrMatrix,
      formatBits
    });
    module.exports = Object.freeze(api);
  }
  root.RuangKithaRecoveryKit = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : window);
