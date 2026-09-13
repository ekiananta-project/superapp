// RuangKitha v2.0.0a51a — Agenda Dekat V1 + a50f Home Insight baseline.
(() => {
  "use strict";

  const PREF_KEY = "keuangan_pengaturan_v1";
  const AVATAR_BUCKET = "profile-avatars";
  const PAGE_SIZE = 1000;
  const MAX_ROWS = 20000;
  let reminderSummary = null;
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
    const preview = q(".document-preview");
    const card = q('[data-module-id="documents"]');
    const count = Math.max(0, Number(summary?.attentionCount || 0));
    const expired = Math.max(0, Number(summary?.expiredCount || 0));
    const today = Math.max(0, Number(summary?.todayCount || 0));
    const top = summary?.topUrgent || null;

    let state = "safe";
    if (expired > 0) state = "expired";
    else if (today > 0) state = "today";
    else if (count > 0) state = "attention";

    preview?.classList.remove("is-safe", "is-expired", "is-today", "is-attention");
    preview?.classList.add(`is-${state}`);
    card?.setAttribute("data-documents-state", state);

    if (title) {
      if (count === 0) title.textContent = "Semua masih aman";
      else if (expired > 0) title.textContent = `${expired} dokumen sudah kedaluwarsa`;
      else if (today > 0) title.textContent = `${today} dokumen berakhir hari ini`;
      else title.textContent = `${count} dokumen perlu perhatian`;
    }

    if (!helper) return;
    if (count === 0) {
      helper.textContent = "Tidak ada dokumen yang perlu ditindak saat ini.";
      return;
    }
    if (!top?.displayName) {
      helper.textContent = "Buka Dokumen untuk melihat yang perlu dijaga.";
      return;
    }

    const days = Number(top.daysRemaining);
    if (top.state === "expired" && Number.isFinite(days)) {
      helper.textContent = `${top.displayName} · kedaluwarsa ${Math.abs(days)} hari lalu`;
    } else if (top.state === "today") {
      helper.textContent = `${top.displayName} · berakhir hari ini`;
    } else if (Number.isFinite(days)) {
      helper.textContent = `${top.displayName} · berakhir ${days} hari lagi`;
    } else {
      helper.textContent = `${top.displayName} · perlu diperhatikan`;
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

  function nearAgendaRange(now = new Date()) {
    const today = todayISO(now);
    const agenda = window.RuangKithaNearAgenda;
    return {
      start: agenda?.addDays ? agenda.addDays(today, -3) : today,
      end: agenda?.addDays ? agenda.addDays(today, 3) : today
    };
  }

  async function loadNearAgenda(familyId) {
    if (!window.RuangKithaNearAgenda?.project) throw new Error("Agenda Dekat belum tersedia.");
    const range = nearAgendaRange();
    const items = await window.RuangKithaCalendarEvents.loadRange({ familyId, start: range.start, end: range.end });
    return window.RuangKithaNearAgenda.project(items || [], new Date());
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

  function shortDateLabel(dateString, offset = null) {
    if (offset === 0) return "Hari ini";
    if (offset === 1) return "Besok";
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(date);
    const dayMonth = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date);
    return `${weekday} · ${dayMonth}`;
  }

  function pastDateLabel(dateString, todayString) {
    const days = Math.max(1, window.RuangKithaNearAgenda?.dayDelta?.(dateString, todayString) || 1);
    if (days === 1) return "Kemarin";
    return `${days} hari lalu`;
  }

  function buildAgendaRow(item, { past = false, today = todayISO() } = {}) {
    const row = document.createElement(item.href ? "button" : "div");
    if (item.href) row.type = "button";
    row.className = `today-item today-agenda-card is-${item.tone || item.module || "calendar"}${past ? " is-past-due" : ""}`;

    const icon = document.createElement("span");
    icon.className = "today-item-icon";
    const ion = document.createElement("ion-icon");
    ion.setAttribute("name", iconForEvent(item));
    ion.setAttribute("aria-hidden", "true");
    icon.appendChild(ion);

    const copy = document.createElement("span");
    copy.className = "today-agenda-copy";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("small");
    const baseMeta = eventMeta(item) || "Agenda RuangKitha";
    meta.textContent = past ? `${pastDateLabel(item.date, today)} · ${baseMeta}` : baseMeta;
    copy.append(title, meta);
    row.append(icon, copy);

    const chevron = document.createElement("ion-icon");
    chevron.className = "today-agenda-chevron";
    chevron.setAttribute("name", item.href ? "chevron-forward-outline" : "ellipse-outline");
    chevron.setAttribute("aria-hidden", "true");
    row.appendChild(chevron);
    if (item.href) row.addEventListener("click", () => window.RuangKithaCalendarEvents.open(item));
    return row;
  }

  function appendDayGroup(root, { label, items, date, today = false, forceEmpty = false } = {}) {
    if (!items?.length && !forceEmpty) return;
    const section = document.createElement("section");
    section.className = `near-agenda-day${today ? " is-today" : ""}`;

    const head = document.createElement("div");
    head.className = "near-agenda-day-head";
    const title = document.createElement("strong");
    title.textContent = label;
    const count = document.createElement("span");
    count.textContent = items?.length ? `${items.length} agenda` : "Tenang";
    head.append(title, count);
    section.appendChild(head);

    if (!items?.length) {
      const empty = document.createElement("p");
      empty.className = "near-agenda-day-empty";
      empty.textContent = today ? "Tidak ada agenda yang perlu ditindak hari ini." : "Tidak ada agenda.";
      section.appendChild(empty);
      root.appendChild(section);
      return;
    }

    const list = document.createElement("div");
    list.className = "near-agenda-day-list";
    items.slice(0, 3).forEach(item => list.appendChild(buildAgendaRow(item)));
    section.appendChild(list);

    if (items.length > 3) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "today-more-agenda";
      more.innerHTML = `<span>+${items.length - 3} agenda lainnya</span><ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>`;
      more.addEventListener("click", () => { location.href = `kalender.html?date=${encodeURIComponent(date)}`; });
      section.appendChild(more);
    }
    root.appendChild(section);
  }

  function appendPastReview(root, projection) {
    const items = projection?.pastReview || [];
    if (!items.length) return;

    const wrap = document.createElement("section");
    wrap.className = "near-agenda-past";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "near-agenda-past-trigger";
    trigger.setAttribute("aria-expanded", "false");

    const warning = document.createElement("span");
    warning.className = "near-agenda-past-icon";
    warning.innerHTML = '<ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>';
    const copy = document.createElement("span");
    copy.className = "near-agenda-past-copy";
    const title = document.createElement("strong");
    title.textContent = `${items.length} hal perlu ditinjau`;
    const helper = document.createElement("small");
    helper.textContent = "Dari 3 hari terakhir · hanya yang masih aktif";
    copy.append(title, helper);
    const chevron = document.createElement("ion-icon");
    chevron.className = "near-agenda-past-chevron";
    chevron.setAttribute("name", "chevron-down-outline");
    chevron.setAttribute("aria-hidden", "true");
    trigger.append(warning, copy, chevron);

    const panel = document.createElement("div");
    panel.className = "near-agenda-past-panel";
    panel.hidden = true;
    const groups = window.RuangKithaNearAgenda?.groupPastByDate?.(items) || [];
    groups.forEach(group => {
      const label = document.createElement("div");
      label.className = "near-agenda-past-date";
      label.textContent = pastDateLabel(group.date, projection.today);
      panel.appendChild(label);
      group.items.forEach(item => panel.appendChild(buildAgendaRow(item, { past: true, today: projection.today })));
    });

    trigger.addEventListener("click", () => {
      const open = trigger.getAttribute("aria-expanded") !== "true";
      trigger.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      chevron.setAttribute("name", open ? "chevron-up-outline" : "chevron-down-outline");
    });

    wrap.append(trigger, panel);
    root.appendChild(wrap);
  }

  function renderReminders(projection) {
    reminderSummary = projection || { pastReview: [], todayItems: [], upcoming: [], activeCount: 0, today: todayISO() };
    const past = reminderSummary.pastReview || [];
    const todayItems = reminderSummary.todayItems || [];
    const upcoming = reminderSummary.upcoming || [];
    const upcomingCount = upcoming.reduce((sum, group) => sum + (group.items?.length || 0), 0);
    const activeCount = past.length + todayItems.length + upcomingCount;

    q(".today-card")?.classList.toggle("is-empty", activeCount === 0);
    const root = q("[data-reminder-list]");
    if (!root) return;
    root.replaceChildren();

    const caption = q("[data-today-caption]");
    if (caption) {
      if (!activeCount) caption.textContent = "3 hari terakhir · hari ini · 3 hari ke depan";
      else if (past.length) caption.textContent = `${past.length} perlu ditinjau · ${todayItems.length} agenda hari ini`;
      else caption.textContent = `${todayItems.length} agenda hari ini · ${upcomingCount} akan datang`;
    }

    if (!activeCount) {
      const empty = document.createElement("div");
      empty.className = "near-agenda-all-clear";
      const strong = document.createElement("strong");
      strong.textContent = "Agenda dekat masih tenang";
      const small = document.createElement("small");
      small.textContent = "Tidak ada hal aktif dari 3 hari terakhir sampai 3 hari ke depan.";
      empty.append(strong, small);
      root.appendChild(empty);
      return;
    }

    appendPastReview(root, reminderSummary);
    appendDayGroup(root, {
      label: "HARI INI",
      items: todayItems,
      date: reminderSummary.today,
      today: true,
      forceEmpty: true
    });

    let futureRendered = 0;
    upcoming.forEach(group => {
      if (!group.items?.length) return;
      futureRendered += group.items.length;
      appendDayGroup(root, {
        label: String(shortDateLabel(group.date, group.offset)).toUpperCase(),
        items: group.items,
        date: group.date
      });
    });

    if (!futureRendered) {
      const calm = document.createElement("p");
      calm.className = "near-agenda-future-calm";
      calm.textContent = "3 hari ke depan masih tenang.";
      root.appendChild(calm);
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
        loadNearAgenda(family.id),
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
      loadNearAgenda(activeFamilyId),
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
  window.addEventListener("ruangkitha:documents-reminder-changed", refreshTodayFromExternalChange);

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
