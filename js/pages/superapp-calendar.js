// RuangKitha v2.0.0a44 — Kalender lintas modul + tanggal merah.
(() => {
  "use strict";

  const PREF_KEY = "keuangan_pengaturan_v1";
  const q = selector => document.querySelector(selector);
  let viewMonth = new Date();
  let selectedDate = new Date();
  let familyId = "";
  let events = [];
  let eventsByDate = new Map();
  let loadingToken = 0;

  function readPreferences() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function saveActiveFamily(id) {
    if (!id) return;
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...readPreferences(), familyAktif: id })); } catch {}
  }

  function atNoon(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  }

  function parseISO(raw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw || ""))) return null;
    const [y, m, d] = raw.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  function iso(date) { return window.RuangKithaCalendarEvents.isoDate(date); }

  function monthLabel(date) {
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date);
  }

  function longDate(date) {
    return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  }

  function gridRange(monthDate) {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return { start, end };
  }

  function iconFor(item) {
    return item.icon || ({ finance: "receipt-outline", notes: "alarm-outline", calendar: "calendar-clear-outline" }[item.module] || "calendar-clear-outline");
  }

  function holidayEvent(items) {
    return (items || []).find(item => item.type === "national_holiday" || item.type === "collective_leave");
  }

  function dotItems(items) {
    return (items || []).slice(0, 3);
  }

  function renderGrid() {
    const root = q("[data-calendar-grid]");
    const title = q("[data-calendar-title]");
    if (!root || !title) return;
    title.textContent = monthLabel(viewMonth);
    root.replaceChildren();

    const { start } = gridRange(viewMonth);
    const todayKey = iso(new Date());
    const selectedKey = iso(selectedDate);

    for (let i = 0; i < 42; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = iso(date);
      const dayEvents = eventsByDate.get(key) || [];
      const holiday = holidayEvent(dayEvents);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.dataset.calendarDate = key;
      button.setAttribute("aria-label", `${longDate(date)}${dayEvents.length ? `, ${dayEvents.length} agenda` : ""}`);
      if (date.getMonth() !== viewMonth.getMonth()) button.classList.add("is-outside");
      if (date.getDay() === 0) button.classList.add("is-sunday");
      if (holiday) button.classList.add("is-holiday");
      if (key === todayKey) button.classList.add("is-today");
      if (key === selectedKey) button.classList.add("is-selected");

      const number = document.createElement("span");
      number.className = "calendar-day-number";
      number.textContent = String(date.getDate());
      button.appendChild(number);

      const dots = document.createElement("span");
      dots.className = "calendar-dots";
      dotItems(dayEvents).forEach(item => {
        const dot = document.createElement("i");
        dot.className = `calendar-dot is-${item.tone || item.module || "calendar"}`;
        dots.appendChild(dot);
      });
      button.appendChild(dots);

      button.addEventListener("click", () => {
        selectedDate = atNoon(date);
        if (selectedDate.getMonth() !== viewMonth.getMonth() || selectedDate.getFullYear() !== viewMonth.getFullYear()) {
          viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
          updateUrl();
          loadMonth();
          return;
        }
        updateUrl();
        renderGrid();
        renderAgenda();
      });
      root.appendChild(button);
    }
  }

  function eventMeta(item) {
    const time = window.RuangKithaCalendarEvents.eventTimeLabel(item);
    const module = window.RuangKithaCalendarEvents.moduleLabel(item.module);
    return [time, item.subtitle, module].filter(Boolean).join(" · ");
  }

  function makeAgendaCard(item) {
    const actionable = Boolean(item.href);
    const card = document.createElement(actionable ? "button" : "article");
    if (actionable) card.type = "button";
    card.className = `calendar-agenda-card is-${item.tone || item.module || "calendar"}${item.status === "paid" ? " is-complete" : ""}`;

    const icon = document.createElement("span");
    icon.className = "calendar-agenda-icon";
    const ion = document.createElement("ion-icon");
    ion.setAttribute("name", iconFor(item));
    ion.setAttribute("aria-hidden", "true");
    icon.appendChild(ion);

    const copy = document.createElement("span");
    copy.className = "calendar-agenda-copy";
    const source = document.createElement("small");
    source.className = "calendar-agenda-source";
    source.textContent = window.RuangKithaCalendarEvents.moduleLabel(item.module);
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.className = "calendar-agenda-meta";
    meta.textContent = eventMeta(item) || "Agenda RuangKitha";
    copy.append(source, title, meta);

    card.append(icon, copy);
    if (actionable) {
      const chevron = document.createElement("ion-icon");
      chevron.className = "calendar-agenda-chevron";
      chevron.setAttribute("name", "chevron-forward-outline");
      chevron.setAttribute("aria-hidden", "true");
      card.appendChild(chevron);
      card.addEventListener("click", () => window.RuangKithaCalendarEvents.open(item));
    }
    return card;
  }

  function renderAgenda() {
    const key = iso(selectedDate);
    const items = eventsByDate.get(key) || [];
    const title = q("[data-agenda-title]");
    const count = q("[data-agenda-count]");
    const root = q("[data-agenda-list]");
    if (title) title.textContent = longDate(selectedDate);
    if (count) count.textContent = items.length ? `${items.length} agenda` : "Kosong";
    if (!root) return;
    root.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-agenda-empty";
      empty.innerHTML = `<span><ion-icon name="calendar-clear-outline" aria-hidden="true"></ion-icon></span><div><strong>Tidak ada agenda</strong><p>Belum ada hal yang dijadwalkan untuk tanggal ini.</p></div>`;
      root.appendChild(empty);
      return;
    }
    items.forEach(item => root.appendChild(makeAgendaCard(item)));
  }

  function renderError() {
    const root = q("[data-agenda-list]");
    if (!root) return;
    root.innerHTML = `<div class="calendar-agenda-empty is-error"><span><ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon></span><div><strong>Agenda belum dapat dimuat</strong><p>Periksa koneksi atau pastikan migration Kalender sudah dipasang.</p></div></div>`;
  }

  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set("date", iso(selectedDate));
    history.replaceState(null, "", `${url.pathname.split("/").pop()}${url.search}`);
  }

  async function loadMonth() {
    if (!familyId) return;
    const token = ++loadingToken;
    q("[data-calendar-grid]")?.setAttribute("aria-busy", "true");
    const range = gridRange(viewMonth);
    try {
      const rows = await window.RuangKithaCalendarEvents.loadRange({ familyId, start: range.start, end: range.end });
      if (token !== loadingToken) return;
      events = rows;
      eventsByDate = window.RuangKithaCalendarEvents.groupByDate(rows);
      renderGrid();
      renderAgenda();
    } catch (error) {
      console.error("[Kalender]", error);
      if (token !== loadingToken) return;
      events = [];
      eventsByDate = new Map();
      renderGrid();
      renderError();
    } finally {
      q("[data-calendar-grid]")?.removeAttribute("aria-busy");
    }
  }

  function moveMonth(delta) {
    const originalDay = selectedDate.getDate();
    const nextMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1, 12);
    const last = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0, 12).getDate();
    selectedDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(originalDay, last), 12);
    viewMonth = nextMonth;
    updateUrl();
    loadMonth();
  }

  async function init() {
    try {
      if (window.AUTH_READY) {
        const allowed = await window.AUTH_READY;
        if (allowed === false) return;
      }
      const fromQuery = parseISO(new URL(location.href).searchParams.get("date"));
      selectedDate = fromQuery || atNoon(new Date());
      viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);

      const families = await FamilyService.ambilKeluargaSaya();
      if (!families?.length) {
        location.replace("keluarga-awal.html");
        return;
      }
      const pref = readPreferences();
      const family = families.find(item => item.id === pref.familyAktif) || families[0];
      familyId = family.id;
      saveActiveFamily(familyId);

      q("[data-calendar-prev]")?.addEventListener("click", () => moveMonth(-1));
      q("[data-calendar-next]")?.addEventListener("click", () => moveMonth(1));
      q("[data-calendar-today]")?.addEventListener("click", () => {
        selectedDate = atNoon(new Date());
        viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
        updateUrl();
        loadMonth();
      });
      updateUrl();
      await loadMonth();
    } catch (error) {
      console.error("[Kalender init]", error);
      renderError();
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
