/* RuangKitha v2.0.0a50 — Dokumen page integration */
(() => {
  "use strict";

  const root = document.querySelector("[data-documents-root]");
  if (!root) return;

  const q = (selector) => document.querySelector(selector);
  const list = q("[data-doc-list]");
  const addButton = q("[data-doc-add]");
  const fileInput = q("[data-doc-file]");
  const vaultTitle = q("[data-doc-vault-title]");
  const vaultCopy = q("[data-doc-vault-copy]");
  const vaultBadge = q("[data-doc-vault-badge]");
  const countLabel = q("[data-doc-count]");
  const message = q("[data-doc-message]");
  const unlockLayer = q("[data-doc-unlock-layer]");
  const unlockForm = q("[data-doc-unlock-form]");
  const unlockClose = q("[data-doc-unlock-close]");
  const pinInput = q("[data-doc-pin]");
  const unlockMessage = q("[data-doc-unlock-message]");
  const unlockSubmit = q("[data-doc-unlock-submit]");

  const Service = () => window.RuangKithaDocumentsService;
  const Trusted = () => window.RuangKithaTrustedDevice;

  let currentStatus = null;
  let currentPreflight = null;
  let busy = false;

  function setMessage(text = "", isError = false) {
    if (!message) return;
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle("is-error", Boolean(isError));
  }

  function setBadge(text, state) {
    vaultBadge.textContent = text;
    vaultBadge.dataset.state = state || "";
  }

  function setState(icon, title, copy, action = null) {
    list.innerHTML = "";
    const state = document.createElement("div");
    state.className = "dokumen-state";
    const iconWrap = document.createElement("span");
    const ion = document.createElement("ion-icon");
    ion.name = icon;
    iconWrap.appendChild(ion);
    const strong = document.createElement("strong");
    strong.textContent = title;
    const p = document.createElement("p");
    p.textContent = copy;
    state.append(iconWrap, strong, p);
    if (action) {
      const element = action.href ? document.createElement("a") : document.createElement("button");
      element.className = "dokumen-state-action";
      element.textContent = action.label;
      if (action.href) element.href = action.href;
      else {
        element.type = "button";
        element.addEventListener("click", action.onClick);
      }
      state.appendChild(element);
    }
    list.appendChild(state);
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function iconForMime(mime) {
    const value = String(mime || "").toLowerCase();
    if (value.includes("pdf")) return "document-text-outline";
    if (value.startsWith("image/")) return "image-outline";
    if (value.includes("sheet") || value.includes("excel")) return "grid-outline";
    if (value.includes("word") || value.includes("text")) return "reader-outline";
    return "document-outline";
  }

  function openUnlock() {
    unlockMessage.hidden = true;
    unlockMessage.textContent = "";
    pinInput.value = "";
    unlockLayer.hidden = false;
    setTimeout(() => pinInput.focus(), 80);
  }

  function closeUnlock() {
    unlockLayer.hidden = true;
    pinInput.value = "";
  }

  async function renderDocuments() {
    if (!currentStatus?.unlocked) return;
    setState("hourglass-outline", "Membuka metadata terenkripsi", "Nama dan tipe file hanya didekripsi di perangkat ini.");
    try {
      const documents = await Service().listReadable();
      countLabel.textContent = documents.length ? `${documents.length} dokumen terenkripsi` : "Belum ada dokumen";
      list.innerHTML = "";
      if (!documents.length) {
        setState("folder-open-outline", "Vault dokumen masih kosong", "Tambah file pertama. File dan nama file akan dienkripsi sebelum meninggalkan perangkat.");
        return;
      }
      documents.forEach((doc) => {
        const card = document.createElement("article");
        card.className = "dokumen-card";
        const iconWrap = document.createElement("span");
        iconWrap.className = "dokumen-card-icon";
        const icon = document.createElement("ion-icon");
        icon.name = doc.metadata ? iconForMime(doc.metadata.mime_type) : "warning-outline";
        iconWrap.appendChild(icon);

        const copy = document.createElement("div");
        copy.className = "dokumen-card-copy";
        const title = document.createElement("strong");
        title.textContent = doc.metadata?.name || "Metadata tidak dapat dibuka";
        const meta = document.createElement("span");
        meta.textContent = doc.metadata
          ? `${formatBytes(doc.metadata.size)} · ${formatDate(doc.committed_at || doc.created_at)}`
          : "Ciphertext tersimpan · metadata gagal didekripsi";
        copy.append(title, meta);

        const download = document.createElement("button");
        download.className = "dokumen-card-download";
        download.type = "button";
        download.setAttribute("aria-label", `Unduh ${doc.metadata?.name || "dokumen"}`);
        download.disabled = !doc.metadata;
        const dlIcon = document.createElement("ion-icon");
        dlIcon.name = "download-outline";
        download.appendChild(dlIcon);
        download.addEventListener("click", async () => {
          if (busy) return;
          busy = true;
          download.disabled = true;
          setMessage("Mengunduh dan mendekripsi dokumen di perangkat…");
          try {
            const result = await Service().downloadToBrowser(doc.document_id);
            setMessage(`Dokumen “${result.name}” berhasil dibuka dari ciphertext.`);
          } catch (error) {
            setMessage(error?.message || "Dokumen gagal diunduh.", true);
          } finally {
            busy = false;
            download.disabled = false;
          }
        });
        card.append(iconWrap, copy, download);
        list.appendChild(card);
      });
    } catch (error) {
      setMessage(error?.message || "Daftar dokumen gagal dibuka.", true);
      if (error?.code === "VAULT_LOCKED") await refreshState();
    }
  }

  async function refreshState() {
    root.setAttribute("aria-busy", "true");
    addButton.disabled = true;
    setMessage("");
    try {
      currentStatus = await Service().localStatus();
      if (!currentStatus.ready) {
        currentPreflight = null;
        vaultTitle.textContent = "Trusted Device diperlukan";
        vaultCopy.textContent = "Siapkan Security Vault dan Trusted Device sebelum membuat dokumen terenkripsi.";
        setBadge("Belum siap", "blocked");
        countLabel.textContent = "Storage belum aktif";
        setState("shield-outline", "Security Vault belum siap", "Dokumen terenkripsi memerlukan Trusted Device aktif.", { label: "Buka Perangkat & Sesi", href: "keamanan.html" });
        return;
      }

      try {
        currentPreflight = await Service().preflight();
      } catch (error) {
        currentPreflight = null;
        throw error;
      }

      if (!currentPreflight?.recovery_ready) {
        vaultTitle.textContent = "Recovery Kit diperlukan";
        vaultCopy.textContent = "RuangKitha menahan upload terenkripsi sampai Recovery Kit aktif agar dokumen tidak terjebak jika perangkat hilang.";
        setBadge("Recovery", "blocked");
        countLabel.textContent = "Storage belum aktif";
        setState("key-outline", "Aktifkan Recovery Kit dahulu", "Buka Perangkat & Sesi dan pastikan Recovery Kit berstatus Siap.", { label: "Kelola Recovery Kit", href: "keamanan.html" });
        return;
      }

      if (!currentStatus.unlocked) {
        vaultTitle.textContent = "Security Vault terkunci";
        vaultCopy.textContent = "Buka dengan PIN perangkat ini untuk melihat metadata, mengunggah, atau mengunduh dokumen.";
        setBadge("Terkunci", "locked");
        countLabel.textContent = "Metadata tetap terenkripsi";
        setState("lock-closed-outline", "Dokumen terkunci", "File di Storage tetap berupa ciphertext. Buka vault untuk mengaksesnya.", { label: "Buka dengan PIN", onClick: openUnlock });
        return;
      }

      vaultTitle.textContent = "Security Vault terbuka";
      vaultCopy.textContent = "Dokumen baru akan memakai Document Key acak yang dibungkus oleh Master Key perangkat ini.";
      setBadge("Terbuka", "open");
      addButton.disabled = false;
      await renderDocuments();
    } catch (error) {
      vaultTitle.textContent = "Dokumen belum dapat dimuat";
      vaultCopy.textContent = "Periksa koneksi dan status Trusted Device, lalu coba lagi.";
      setBadge("Error", "blocked");
      countLabel.textContent = "Gagal memuat";
      setState("alert-circle-outline", "Storage Foundation belum siap", error?.message || "Terjadi kesalahan saat memuat dokumen.", { label: "Coba lagi", onClick: refreshState });
    } finally {
      root.setAttribute("aria-busy", "false");
    }
  }

  unlockClose.addEventListener("click", closeUnlock);
  unlockLayer.addEventListener("click", (event) => { if (event.target === unlockLayer) closeUnlock(); });
  unlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    unlockSubmit.disabled = true;
    unlockSubmit.textContent = "Membuka…";
    unlockMessage.hidden = true;
    try {
      await Service().unlock(pinInput.value);
      closeUnlock();
      await refreshState();
    } catch (error) {
      unlockMessage.textContent = error?.message || "PIN tidak dapat membuka vault.";
      unlockMessage.hidden = false;
    } finally {
      busy = false;
      unlockSubmit.disabled = false;
      unlockSubmit.textContent = "Buka vault dokumen";
    }
  });

  addButton.addEventListener("click", () => { if (!busy && currentStatus?.unlocked) fileInput.click(); });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file || busy) return;
    busy = true;
    addButton.disabled = true;
    const stageCopy = {
      encrypting: "Mengenkripsi file dan metadata di perangkat…",
      preparing: "Menyiapkan record ciphertext…",
      uploading: "Mengunggah ciphertext ke private Storage…",
      committing: "Memverifikasi upload terenkripsi…",
      done: "Dokumen terenkripsi berhasil disimpan."
    };
    try {
      await Service().uploadFile(file, { onStage: (stage) => setMessage(stageCopy[stage] || "Memproses dokumen…") });
      await refreshState();
      setMessage("Dokumen terenkripsi berhasil disimpan. Nama dan isi file tidak dikirim sebagai plaintext.");
    } catch (error) {
      await refreshState();
      setMessage(error?.message || "Dokumen gagal disimpan.", true);
    } finally {
      busy = false;
      addButton.disabled = !currentStatus?.unlocked;
    }
  });

  window.addEventListener(Trusted()?.STATE_EVENT || "ruangkitha:security-state", (event) => {
    const unlocked = Boolean(event?.detail?.unlocked);
    if (!unlocked && currentStatus?.unlocked) {
      currentStatus.unlocked = false;
      refreshState().catch(() => {});
    }
  });

  (async () => {
    try {
      if (window.AUTH_READY) await window.AUTH_READY;
      await refreshState();
    } catch (error) {
      setMessage(error?.message || "Dokumen gagal dimulai.", true);
    }
  })();
})();
