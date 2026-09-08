(() => {
  "use strict";

  const PAGE_SIZE = 20;
  const AVATAR_BUCKET = "profile-avatars";

  const list = document.querySelector("[data-history-list]");
  const familyName = document.querySelector("[data-history-family-name]");
  const loading = document.querySelector("[data-history-loading]");
  const empty = document.querySelector("[data-history-empty]");
  const errorBox = document.querySelector("[data-history-error]");
  const errorMessage = document.querySelector("[data-history-error-message]");
  const retry = document.querySelector("[data-history-retry]");
  const more = document.querySelector("[data-history-more]");

  let family = null;
  let cursor = null;
  let hasMore = false;
  let sedangMemuat = false;

  function labelHubungan(value) {
    const map = {
      pasangan: "Pasangan",
      anak: "Anak",
      orang_tua: "Orang Tua",
      saudara: "Saudara",
      kerabat: "Kerabat",
      lainnya: "Lainnya"
    };

    return map[value] || "Belum ditentukan";
  }

  function labelRole(value) {
    return value === "owner" ? "Pemilik" : "Anggota";
  }

  function inisial(nama) {
    return String(nama || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(kata => kata[0]?.toUpperCase() || "")
      .join("") || "?";
  }

  function avatarUrl(path, version) {
    if (!path || !window.supabaseClient) return "";

    const { data } = window.supabaseClient.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(path);

    const url = data?.publicUrl || "";
    const token = String(version || "").trim();

    if (!url) return "";
    return token ? `${url}?v=${encodeURIComponent(token)}` : url;
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

  function renderAvatar(container, item) {
    container.replaceChildren();

    const url = avatarUrl(item.avatar_path, item.profile_updated_at);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = `Foto profil ${item.member_name || "anggota"}`;
      container.appendChild(img);
      return;
    }

    const span = document.createElement("span");
    span.textContent = inisial(item.member_name);
    span.setAttribute("aria-label", `Avatar ${item.member_name || "anggota"}`);
    container.appendChild(span);
  }

  function buatKartu(item) {
    const card = document.createElement("article");
    card.className = "member-history-card";

    const avatar = document.createElement("span");
    avatar.className = "member-history-avatar";
    renderAvatar(avatar, item);

    const main = document.createElement("div");
    main.className = "member-history-main";

    const heading = document.createElement("div");
    heading.className = "member-history-heading";

    const nama = document.createElement("strong");
    nama.textContent = item.member_name || "Anggota";

    const status = document.createElement("span");
    status.className = "member-history-status";
    status.dataset.status = item.status || "left";
    status.textContent = item.status === "removed" ? "Dikeluarkan" : "Keluar sendiri";

    heading.append(nama, status);

    const meta = document.createElement("p");
    meta.className = "member-history-meta";
    meta.textContent = `${labelHubungan(item.relationship)} • ${labelRole(item.role)}`;

    const event = document.createElement("p");
    event.className = "member-history-event";
    event.textContent = item.status === "removed"
      ? `Dikeluarkan pada ${formatWaktu(item.event_at)}`
      : `Keluar pada ${formatWaktu(item.event_at)}`;

    main.append(heading, meta, event);

    if (item.status === "removed" && item.removed_by_name) {
      const actor = document.createElement("p");
      actor.className = "member-history-actor";
      actor.textContent = `Oleh ${item.removed_by_name}`;
      main.appendChild(actor);
    }

    const period = document.createElement("p");
    period.className = "member-history-period";
    period.textContent = `Bergabung pada ${formatWaktu(item.joined_at)}`;
    main.appendChild(period);

    card.append(avatar, main);
    return card;
  }

  function setLoading(value, { append = false } = {}) {
    sedangMemuat = value;

    if (loading) {
      loading.hidden = !value || append;
    }

    if (more) {
      more.disabled = value;
      if (value && append) {
        more.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Memuat...';
      } else {
        more.innerHTML = '<ion-icon name="chevron-down-outline"></ion-icon> Muat Riwayat Lainnya';
      }
    }
  }

  function setError(message = "") {
    if (!errorBox) return;

    errorBox.hidden = !message;
    if (errorMessage && message) {
      errorMessage.textContent = message;
    }
  }

  function refreshState() {
    const adaItem = Boolean(list?.children.length);

    if (empty) {
      empty.hidden = adaItem || sedangMemuat || !family || Boolean(errorBox && !errorBox.hidden);
    }

    if (more) {
      more.hidden = !adaItem || !hasMore;
    }
  }

  async function muatRiwayat({ reset = false } = {}) {
    if (!family || sedangMemuat) return;

    if (reset) {
      cursor = null;
      hasMore = false;
      if (list) list.replaceChildren();
    }

    const append = Boolean(cursor);
    setError();
    setLoading(true, { append });
    refreshState();

    try {
      const result = await FamilyService.ambilRiwayatAnggota(
        family.id,
        {
          limit: PAGE_SIZE,
          beforeEventAt: cursor?.eventAt || null,
          beforeId: cursor?.id || null
        }
      );

      for (const item of result.items) {
        list?.appendChild(buatKartu(item));
      }

      cursor = result.nextCursor;
      hasMore = result.hasMore;
    } catch (err) {
      console.error("[Riwayat anggota]", err);
      setError(err?.message || "Riwayat anggota belum dapat dimuat. Silakan coba lagi.");
    } finally {
      setLoading(false, { append });
      refreshState();
    }
  }

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

      if (familyName) familyName.textContent = family.name || "Ruang Keluarga";
      await muatRiwayat({ reset: true });
    } catch (err) {
      console.error("[Riwayat anggota init]", err);
      setLoading(false);
      setError(err?.message || "Halaman riwayat belum dapat dimuat.");
      refreshState();
    }
  }

  retry?.addEventListener("click", () => muatRiwayat({ reset: !list?.children.length }));
  more?.addEventListener("click", () => muatRiwayat());

  init();
})();
