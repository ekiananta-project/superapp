// RuangKitha v2.0.0a50e — Home Documents reminder insight integration.
(() => {
  "use strict";

  const PREF_KEY = "keuangan_pengaturan_v1";
  const AVATAR_BUCKET = "profile-avatars";
  const PAGE_SIZE = 1000;
  const MAX_ROWS = 20000;
  let reminderSummary = [];
  let activeFamilyId = "";
  let toastTimer = null;

  const q = selector => document.querySelector(selector);

  function readPreferences() {
    try {
      return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveActiveFamily(familyId) {
    if (!familyId) return;
    const value = { ...readPreferences(), familyAktif: familyId };
    try { localStorage.setItem(PREF_KEY, JSON.stringify(value)); } catch {}
  }

  function cleanName(value) {
    const name = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!name || ["undefined", "null", "[object object]"].includes(name.toLowerCase())) return "Pengguna";
    return name;
  }

  function avatarUrl(profile) {
    if (!profile?.avatar_path || !window.supabaseClient) return "";
    const { data } = window.supabaseClient.storage.from(AVATAR_BUCKET).getPublicUrl(profile.avatar_path);
    const raw = data?.publicUrl || "";
    if (!raw) return "";
    const version = encodeURIComponent(String(profile.updated_at || "1"));
    return `${raw}${raw.includes("?") ? "&" : "?"}v=${version}`;
  }

  function renderProfile(profile) {
    const name = cleanName(profile?.display_name);
    const nameEl = q("[data-superapp-name]");
    if (nameEl) nameEl.textContent = name;

    const avatar = q("[data-superapp-avatar]");
    if (!avatar) return;
    avatar.replaceChildren();
    const url = avatarUrl(profile);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.decoding = "async";
      img.onload = () => avatar.classList.remove("is-loading");
      img.onerror = () => renderAvatarFallback(avatar);
      avatar.appendChild(img);
    } else {
      renderAvatarFallback(avatar);
    }
  }

  function renderAvatarFallback(root) {
    root.replaceChildren();
    const icon = document.createElement("ion-icon");
    icon.setAttribute("name", "person-outline");
    icon.setAttribute("aria-hidden", "true");
    root.appendChild(icon);
    root.classList.remove("is-loading");
  }

  function todayISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function monthRange() {
    const now = new Date();
    return {
      start: todayISO(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: todayISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    };
  }

  function rupiah(value, signed = false) {
    const number = Math.round(Number(value || 0));
    const absolute = new Intl.NumberFormat("id-ID").format(Math.abs(number));
    if (signed && number > 0) return `+ Rp ${absolute}`;
    if (number < 0) return `-Rp ${absolute}`;
    return `Rp ${absolute}`;
  }

  async function loadCashflow(familyId) {
    const client = window.supabaseClient;
    if (!client) throw new Error("Supabase belum tersedia.");
    const range = monthRange();
    let offset = 0;
    let income = 0;
    let expense = 0;

    while (offset < MAX_ROWS) {
      const to = Math.min(offset + PAGE_SIZE - 1, MAX_ROWS - 1);
      const { data, error } = await client
        .from("finance_transactions")
        .select("kind,amount,transfer_fee")
        .eq("family_id", familyId)
        .is("voided_at", null)
        .gte("occurred_on", range.start)
        .lte("occurred_on", range.end)
        .order("occurred_on", { ascending: false })
        .range(offset, to);

      if (error) throw error;
      const rows = data || [];
      rows.forEach(item => {
        const amount = Math.max(0, Number(item.amount || 0));
        if (item.kind === "income") income += amount;
        if (item.kind === "expense") expense += amount;
        if (item.kind === "transfer") expense += Math.max(0, Number(item.transfer_fee || 0));
      });

      if (rows.length < PAGE_SIZE) break;
      offset += rows.length;
    }

    return { income, expense, net: income - expense };
  }

  function fitSingleLineAmount(element, minSize = 13) {
    if (!element) return;
    element.style.removeProperty("font-size");
    element.style.removeProperty("letter-spacing");
    requestAnimationFrame(() => {
      if (!element.clientWidth) return;
      let size = parseFloat(getComputedStyle(element).fontSize) || 24;
      element.style.fontSize = `${size}px`;
      while (element.scrollWidth > element.clientWidth && size > minSize) {
        size -= 1;
        element.style.fontSize = `${size}px`;
      }
      if (element.scrollWidth > element.clientWidth) {
        element.style.letterSpacing = "-0.06em";
      }
    });
  }

  function renderCashflow(summary) {
    const net = Number(summary?.net || 0);
    const amount = q("[data-finance-net]");
    const status = q("[data-finance-status]");
    const helper = q("[data-finance-helper]");
    const icon = q("[data-finance-trend-icon]");
    if (amount) { amount.textContent = rupiah(net, true); fitSingleLineAmount(amount); }
    status?.classList.remove("is-surplus", "is-deficit", "is-neutral");

    if (net > 0) {
      if (status) { status.textContent = "Surplus"; status.classList.add("is-surplus"); }
      if (helper) helper.textContent = "Pemasukan lebih besar dari pengeluaran bulan ini.";
      icon?.setAttribute("name", "trending-up-outline");
    } else if (net < 0) {
      if (status) { status.textContent = "Defisit"; status.classList.add("is-deficit"); }
      if (helper) helper.textContent = "Pengeluaran lebih besar dari pemasukan bulan ini.";
      icon?.setAttribute("name", "trending-down-outline");
    } else {
      if (status) { status.textContent = "Seimbang"; status.classList.add("is-neutral"); }
      if (helper) helper.textContent = "Arus kas bulan ini masih seimbang.";
      icon?.setAttribute("name", "analytics-outline");
    }
  }

  function iconForEvent(item) {
    return item?.icon || ({ finance: "receipt-outline", notes: "alarm-outline", documents: "document-text-outline", calendar: "calendar-clear-outline" }[item?.module] || "notifications-outline");
  }


  function renderDocumentAttention(summary) {
    const title = q("[data-documents-attention]");
    const helper = q("[data-documents-helper]");
    const count = Math.max(0, Number(summary?.attentionCount || 0));
    const expired = Math.max(0, Number(summary?.expiredCount || 0));
    const today = Math.max(0, Number(summary?.todayCount || 0));

    if (title) {
      if (count === 0) title.textContent = "Semua masih aman";
      else if (expired > 0) title.textContent = `${expired} dokumen sudah kedaluwarsa`;
      else if (today > 0) title.textContent = `${today} dokumen berakhir hari ini`;
      else title.textContent = `${count} dokumen perlu perhatian`;
    }
    if (helper) {
      helper.textContent = count === 0
        ? "Tidak ada masa berlaku yang perlu ditindak."
        : "Buka Dokumen untuk melihat yang perlu dijaga.";
    }
  }

  async function loadDocumentAttention(familyId) {
    if (!window.RuangKithaDocumentReminders?.attentionSummary) return { attentionCount: 0 };
    return window.RuangKithaDocumentReminders.attentionSummary(familyId);
  }

  function eventMeta(item) {
    const time = window.RuangKithaCalendarEvents?.eventTimeLabel?.(item) || "";
    const source = window.RuangKithaCalendarEvents?.moduleLabel?.(item?.module) || "RuangKitha";
    return [time, item?.subtitle, source].filter(Boolean).join(" · ");
  }

  async function loadTodayEvents(familyId) {
    const today = todayISO();
    const items = await window.RuangKithaCalendarEvents.loadRange({ familyId, start: today, end: today });
    return (items || []).filter(item => item.status !== "paid");
  }

  function calendarGridRange(date = new Date()) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return { start: todayISO(start), end: todayISO(end) };
  }

  function prefetchCurrentCalendarMonth(familyId) {
    if (!familyId || !window.RuangKithaCalendarEvents?.loadRange) return;
    const run = () => {
      const range = calendarGridRange(new Date());
      window.RuangKithaCalendarEvents.loadRange({
        familyId,
        start: range.start,
        end: range.end,
        forceFresh: true
      }).catch(error => console.debug?.("[Calendar prefetch]", error));
    };
    if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 1800 });
    else setTimeout(run, 700);
  }

  function renderReminders(items) {
    reminderSummary = items || [];
    q(".today-card")?.classList.toggle("is-empty", reminderSummary.length === 0);
    const root = q("[data-reminder-list]");
    if (!root) return;
    root.replaceChildren();

    const caption = q("[data-today-caption]");
    if (!reminderSummary.length) {
      const empty = document.createElement("p");
      empty.className = "today-empty";
      empty.textContent = "Belum ada agenda penting dari modul yang aktif.";
      root.appendChild(empty);
      if (caption) caption.textContent = "Semua aman untuk saat ini";
      return;
    }

    if (caption) caption.textContent = `${reminderSummary.length} agenda hari ini`;
    reminderSummary.slice(0, 3).forEach(item => {
      const row = document.createElement(item.href ? "button" : "div");
      if (item.href) row.type = "button";
      row.className = `today-item today-agenda-card is-${item.tone || item.module || "calendar"}`;

      const icon = document.createElement("span");
      icon.className = "today-item-icon";
      const ion = document.createElement("ion-icon");
      ion.setAttribute("name", iconForEvent(item));
      icon.appendChild(ion);

      const copy = document.createElement("span");
      copy.className = "today-agenda-copy";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const meta = document.createElement("small");
      meta.textContent = eventMeta(item) || "Agenda RuangKitha";
      copy.append(title, meta);
      row.append(icon, copy);

      const chevron = document.createElement("ion-icon");
      chevron.className = "today-agenda-chevron";
      chevron.setAttribute("name", item.href ? "chevron-forward-outline" : "ellipse-outline");
      row.appendChild(chevron);
      if (item.href) row.addEventListener("click", () => window.RuangKithaCalendarEvents.open(item));
      root.appendChild(row);
    });

    if (reminderSummary.length > 3) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "today-more-agenda";
      more.innerHTML = `<span>+${reminderSummary.length - 3} agenda lainnya</span><ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>`;
      more.addEventListener("click", () => { location.href = `kalender.html?date=${encodeURIComponent(todayISO())}`; });
      root.appendChild(more);
    }
  }

  function showToast(text) {
    const toast = q("[data-superapp-toast]");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function setupInteractions() {
    document.querySelectorAll("[data-coming-soon]").forEach(button => {
      button.addEventListener("click", () => showToast(`Modul ${button.dataset.comingSoon} akan dibangun setelah fondasi Superapp stabil.`));
    });
    q("[data-reminder-all]")?.addEventListener("click", () => {
      location.href = `kalender.html?date=${encodeURIComponent(todayISO())}`;
    });
  }

  async function init() {
    setupInteractions();
    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }

    try {
      const session = await AuthService.ambilSession();
      if (!session) return;

      const [profile, families] = await Promise.all([
        FamilyService.ambilProfilSaya(),
        FamilyService.ambilKeluargaSaya()
      ]);
      renderProfile(profile);

      if (!families?.length) {
        location.replace("keluarga-awal.html");
        return;
      }

      const pref = readPreferences();
      const family = families.find(item => item.id === pref.familyAktif) || families[0];
      saveActiveFamily(family.id);

      activeFamilyId = family.id;
      const [cashflowResult, reminderResult, documentsResult] = await Promise.allSettled([
        loadCashflow(family.id),
        loadTodayEvents(family.id),
        loadDocumentAttention(family.id)
      ]);

      if (cashflowResult.status === "fulfilled") renderCashflow(cashflowResult.value);
      else {
        console.warn("[Superapp Home cashflow]", cashflowResult.reason);
        renderCashflow({ net: 0 });
      }

      if (reminderResult.status === "fulfilled") renderReminders(reminderResult.value);
      else {
        console.warn("[Superapp Home reminder]", reminderResult.reason);
        renderReminders([]);
      }

      if (documentsResult.status === "fulfilled") renderDocumentAttention(documentsResult.value);
      else {
        console.warn("[Superapp Home documents]", documentsResult.reason);
        renderDocumentAttention({ attentionCount: 0 });
      }

      // Warm the exact Calendar grid range after Home is usable. This is intentionally
      // idle/background work and never blocks the Home card.
      prefetchCurrentCalendarMonth(family.id);
    } catch (error) {
      console.error("[Superapp Home]", error);
      renderReminders([]);
      renderCashflow({ net: 0 });
      renderDocumentAttention({ attentionCount: 0 });
    } finally {
      q("[data-superapp-home]")?.setAttribute("aria-busy", "false");
    }
  }

  async function refreshTodayFromExternalChange() {
    if (!activeFamilyId || document.hidden) return;
    const [todayResult, documentsResult] = await Promise.allSettled([
      loadTodayEvents(activeFamilyId),
      loadDocumentAttention(activeFamilyId)
    ]);
    if (todayResult.status === "fulfilled") renderReminders(todayResult.value);
    else console.warn("[Superapp Home Today refresh]", todayResult.reason);
    if (documentsResult.status === "fulfilled") renderDocumentAttention(documentsResult.value);
    else console.warn("[Superapp Home Documents refresh]", documentsResult.reason);
  }

  window.addEventListener("pageshow", event => {
    if (event.persisted) refreshTodayFromExternalChange();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshTodayFromExternalChange();
  });
  window.addEventListener("storage", event => {
    if (event.key === "ruangkitha:calendar:dirty") refreshTodayFromExternalChange();
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
