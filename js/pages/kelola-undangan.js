(() => {
  "use strict";

  const PAGE_SIZE = 20;

  const familyName = document.querySelector("[data-invitation-family-name]");
  const message = document.querySelector("[data-invitation-message]");
  const relationship = document.querySelector("[data-invite-relationship]");
  const expiry = document.querySelector("[data-invite-expiry]");
  const createButton = document.querySelector("[data-invite-create]");
  const activeCount = document.querySelector("[data-active-count]");
  const activeLoading = document.querySelector("[data-active-loading]");
  const activeEmpty = document.querySelector("[data-active-empty]");
  const activeList = document.querySelector("[data-active-list]");
  const historyToggle = document.querySelector("[data-history-toggle]");
  const historyBody = document.querySelector("[data-history-body]");
  const historyLoading = document.querySelector("[data-history-loading]");
  const historyEmpty = document.querySelector("[data-history-empty]");
  const historyList = document.querySelector("[data-history-list]");
  const historyMore = document.querySelector("[data-history-more]");

  let family = null;
  let activeInvitations = [];
  let historyLoaded = false;
  let historyCursor = null;
  let historyHasMore = false;
  let loadingHistory = false;
  let toastTimer = null;

  function tampilToast(text, type = "success") {
    const value = String(text || "").trim();
    if (!value) return;

    let toast = document.querySelector("[data-invitation-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "invitation-toast";
      toast.setAttribute("data-invitation-toast", "");
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.replaceChildren();
    const icon = document.createElement("ion-icon");
    icon.setAttribute("name", type === "error" ? "alert-circle-outline" : "checkmark-circle-outline");
    const label = document.createElement("span");
    label.textContent = value;
    toast.append(icon, label);
    toast.dataset.type = type;

    if (toastTimer) clearTimeout(toastTimer);
    requestAnimationFrame(() => toast.classList.add("is-show"));
    toastTimer = setTimeout(() => toast.classList.remove("is-show"), 2200);
  }

  function labelHubungan(value) {
    const map = {
      pasangan: "Pasangan",
      orang_tua: "Orang Tua",
      anak: "Anak",
      saudara: "Saudara",
      kerabat: "Kerabat",
      lainnya: "Lainnya"
    };
    return map[value] || "Belum ditentukan";
  }

  function formatWaktu(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    try {
      return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: family?.timezone || undefined
      }).format(date);
    } catch {
      return date.toLocaleString("id-ID");
    }
  }

  function tampilPesan(text = "", type = "info") {
    if (!message) return;
    message.hidden = !text;
    message.textContent = text;
    message.dataset.type = type;
  }

  async function salinTeks(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) {
      console.warn("[Clipboard API]", error);
    }

    // Fallback untuk PWA/browser yang tidak memberi Clipboard API.
    try {
      const helper = document.createElement("textarea");
      helper.value = value;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      helper.style.pointerEvents = "none";
      document.body.appendChild(helper);
      helper.select();
      helper.setSelectionRange(0, helper.value.length);
      const copied = document.execCommand("copy");
      helper.remove();
      if (copied) return true;
    } catch (error) {
      console.warn("[Clipboard fallback]", error);
    }

    window.prompt("Salin teks berikut:", value);
    return false;
  }

  async function bagikanUndangan(item) {
    const teks = `Undangan Ruang Keluarga ${family?.name || ""}\nKode: ${item.code}\nBerlaku sampai ${formatWaktu(item.expires_at)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Undangan Ruang Keluarga", text: teks });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const copied = await salinTeks(teks);
    if (copied) {
      tampilToast("Teks undangan disalin.", "success");
    }
  }

  function buatActiveCard(item) {
    const card = document.createElement("article");
    card.className = "invitation-card";

    const top = document.createElement("div");
    top.className = "invitation-card-top";

    const code = document.createElement("p");
    code.className = "invitation-code";
    code.textContent = item.code || "----";

    const badge = document.createElement("span");
    badge.className = "invitation-badge";
    badge.dataset.status = "active";
    badge.textContent = "Aktif";

    top.append(code, badge);

    const meta = document.createElement("p");
    meta.className = "invitation-meta";
    meta.textContent = `${labelHubungan(item.relationship)} • Berlaku sampai ${formatWaktu(item.expires_at)}`;

    const created = document.createElement("p");
    created.className = "invitation-meta";
    created.textContent = `Dibuat ${formatWaktu(item.created_at)}${item.created_by_name ? ` oleh ${item.created_by_name}` : ""}`;

    const actions = document.createElement("div");
    actions.className = "invitation-actions";

    const copy = document.createElement("button");
    copy.className = "tombol-sekunder";
    copy.type = "button";
    copy.innerHTML = '<ion-icon name="copy-outline"></ion-icon> Salin';
    copy.addEventListener("click", async () => {
      const copied = await salinTeks(item.code);
      if (copied) {
        tampilToast("Kode undangan disalin.", "success");
      }
    });

    const share = document.createElement("button");
    share.className = "tombol-sekunder";
    share.type = "button";
    share.innerHTML = '<ion-icon name="share-social-outline"></ion-icon> Bagikan';
    share.addEventListener("click", () => bagikanUndangan(item));

    actions.append(copy, share);

    const revoke = document.createElement("button");
    revoke.className = "invitation-revoke";
    revoke.type = "button";
    revoke.innerHTML = '<ion-icon name="close-circle-outline"></ion-icon> Cabut undangan ini';
    revoke.addEventListener("click", async () => {
      if (!confirm("Cabut kode undangan ini? Kode tidak dapat dipakai lagi.")) return;
      revoke.disabled = true;
      try {
        await FamilyService.cabutUndangan(item.invitation_id);
        tampilPesan("Undangan dicabut.", "success");
        await muatAktif();
        if (historyLoaded) await muatHistory({ reset: true });
      } catch (error) {
        tampilPesan(error?.message || "Undangan gagal dicabut.", "error");
      } finally {
        revoke.disabled = false;
      }
    });

    card.append(top, meta, created, actions, revoke);
    return card;
  }

  function renderAktif() {
    activeList?.replaceChildren();
    activeCount.textContent = String(activeInvitations.length);

    for (const item of activeInvitations) {
      activeList?.appendChild(buatActiveCard(item));
    }

    if (activeEmpty) activeEmpty.hidden = activeInvitations.length > 0;
  }

  async function muatAktif() {
    if (!family) return;
    activeLoading.hidden = false;
    activeEmpty.hidden = true;
    try {
      activeInvitations = await FamilyService.ambilUndanganAktifSemua(family.id);
      renderAktif();
    } catch (error) {
      console.error("[Undangan aktif]", error);
      tampilPesan(error?.message || "Undangan aktif belum dapat dimuat.", "error");
    } finally {
      activeLoading.hidden = true;
    }
  }

  function historyStatusLabel(status) {
    if (status === "used") return "Dipakai";
    if (status === "revoked") return "Dicabut";
    if (status === "expired") return "Kedaluwarsa";
    return "Selesai";
  }

  function historyEventText(item) {
    if (item.effective_status === "used") {
      return `Dipakai ${formatWaktu(item.used_at)}${item.used_by_name ? ` oleh ${item.used_by_name}` : ""}`;
    }
    if (item.effective_status === "revoked") {
      return `Dicabut ${formatWaktu(item.revoked_at)}${item.revoked_by_name ? ` oleh ${item.revoked_by_name}` : ""}`;
    }
    return `Kedaluwarsa ${formatWaktu(item.expires_at)}`;
  }

  function buatHistoryCard(item) {
    const card = document.createElement("article");
    card.className = "invitation-card";

    const top = document.createElement("div");
    top.className = "invitation-card-top";

    const code = document.createElement("p");
    code.className = "invitation-code";
    code.textContent = item.code_masked || "----";

    const badge = document.createElement("span");
    badge.className = "invitation-badge";
    badge.dataset.status = item.effective_status || "expired";
    badge.textContent = historyStatusLabel(item.effective_status);

    top.append(code, badge);

    const meta = document.createElement("p");
    meta.className = "invitation-meta";
    meta.textContent = `${labelHubungan(item.relationship)} • Dibuat ${formatWaktu(item.created_at)}${item.created_by_name ? ` oleh ${item.created_by_name}` : ""}`;

    const event = document.createElement("p");
    event.className = "invitation-event";
    event.textContent = historyEventText(item);

    card.append(top, meta, event);
    return card;
  }

  function refreshHistoryState() {
    const hasItems = Boolean(historyList?.children.length);
    historyEmpty.hidden = hasItems || loadingHistory;
    historyMore.hidden = !hasItems || !historyHasMore;
  }

  async function muatHistory({ reset = false } = {}) {
    if (!family || loadingHistory) return;

    if (reset) {
      historyCursor = null;
      historyHasMore = false;
      historyList?.replaceChildren();
    }

    const append = Boolean(historyCursor);
    loadingHistory = true;
    historyLoading.hidden = append;
    if (!append) historyLoading.hidden = false;
    historyMore.disabled = true;
    refreshHistoryState();

    try {
      const result = await FamilyService.ambilRiwayatUndangan(family.id, {
        limit: PAGE_SIZE,
        beforeCreatedAt: historyCursor?.createdAt || null,
        beforeId: historyCursor?.id || null
      });

      for (const item of result.items) {
        historyList?.appendChild(buatHistoryCard(item));
      }

      historyCursor = result.nextCursor;
      historyHasMore = result.hasMore;
      historyLoaded = true;
    } catch (error) {
      console.error("[Riwayat undangan]", error);
      tampilPesan(error?.message || "Riwayat undangan belum dapat dimuat.", "error");
    } finally {
      loadingHistory = false;
      historyLoading.hidden = true;
      historyMore.disabled = false;
      refreshHistoryState();
    }
  }

  createButton?.addEventListener("click", async () => {
    if (!family) return;
    createButton.disabled = true;
    const original = createButton.innerHTML;
    createButton.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Membuat...';
    try {
      await FamilyService.buatUndanganKeluarga({
        familyId: family.id,
        relationship: relationship?.value || null,
        expiresHours: Number(expiry?.value || 24)
      });
      tampilPesan("Undangan baru berhasil dibuat.", "success");
      await muatAktif();
    } catch (error) {
      console.error("[Buat undangan]", error);
      tampilPesan(error?.message || "Undangan gagal dibuat.", "error");
    } finally {
      createButton.disabled = false;
      createButton.innerHTML = original;
    }
  });

  historyToggle?.addEventListener("click", async () => {
    const open = historyToggle.getAttribute("aria-expanded") === "true";
    historyToggle.setAttribute("aria-expanded", String(!open));
    historyBody.hidden = open;
    if (!open && !historyLoaded) {
      await muatHistory({ reset: true });
    }
  });

  historyMore?.addEventListener("click", () => muatHistory());

  async function init() {
    try {
      if (window.AUTH_READY) {
        const ok = await window.AUTH_READY;
        if (ok === false) return;
      }

      family = await AuthRouter.ambilFamilyAktif();
      if (!family) {
        location.replace("keluarga-awal.html");
        return;
      }

      if (family.membership?.role !== "owner") {
        location.replace("keluarga.html");
        return;
      }

      if (familyName) familyName.textContent = family.name || "Ruang Keluarga";
      await muatAktif();

      if (location.hash === "#buat") {
        document.querySelector("#buat")?.scrollIntoView({ block: "start" });
      }
    } catch (error) {
      console.error("[Kelola undangan init]", error);
      tampilPesan(error?.message || "Kelola undangan belum dapat dibuka.", "error");
    }
  }

  init();
})();
