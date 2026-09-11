// RuangKitha v2.0.0a44a — shared calendar/event read layer.
(() => {
  "use strict";

  function client() {
    if (!window.supabaseClient) throw new Error("Supabase belum tersedia.");
    return window.supabaseClient;
  }

  function isoDate(value = new Date()) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = value instanceof Date ? value : new Date(value);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function safeHref(raw) {
    const href = String(raw || "").trim();
    if (!href) return "";
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return "";
      return `${url.pathname.split("/").pop()}${url.search}${url.hash}`;
    } catch {
      return "";
    }
  }

  function normalize(row) {
    const eventDate = isoDate(row?.event_date || new Date());
    const eventAt = row?.event_at ? String(row.event_at) : "";
    return {
      key: String(row?.event_key || `${row?.source_module || "event"}:${row?.source_id || eventDate}:${row?.title || ""}`),
      date: eventDate,
      at: eventAt,
      allDay: row?.all_day !== false,
      title: String(row?.title || "Agenda RuangKitha").trim() || "Agenda RuangKitha",
      subtitle: String(row?.subtitle || "").trim(),
      module: String(row?.source_module || "calendar").trim().toLowerCase(),
      type: String(row?.source_type || "event").trim().toLowerCase(),
      sourceId: row?.source_id ? String(row.source_id) : "",
      href: safeHref(row?.source_href),
      status: String(row?.status || "active").trim().toLowerCase(),
      tone: String(row?.tone || row?.source_module || "calendar").trim().toLowerCase(),
      icon: String(row?.icon_name || "calendar-clear-outline").trim(),
      priority: Number(row?.priority || 50)
    };
  }

  async function loadRange({ familyId, start, end } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    const rangeStart = isoDate(start || new Date());
    const rangeEnd = isoDate(end || rangeStart);
    const { data, error } = await client().rpc("calendar_events_for_range_v2", {
      p_family_id: familyId,
      p_start: rangeStart,
      p_end: rangeEnd
    });
    if (error) throw error;
    return (data || []).map(normalize).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.priority !== b.priority) return a.priority - b.priority;
      const aTime = a.at || "9999";
      const bTime = b.at || "9999";
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      return a.title.localeCompare(b.title, "id");
    });
  }

  function groupByDate(items) {
    return (items || []).reduce((map, item) => {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date).push(item);
      return map;
    }, new Map());
  }

  function eventTimeLabel(item) {
    if (!item || item.allDay || !item.at) return "";
    const date = new Date(item.at);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(".", ":");
  }

  function moduleLabel(module) {
    const labels = {
      finance: "Keuangan",
      notes: "Catatan",
      calendar: "Kalender"
    };
    return labels[module] || "RuangKitha";
  }

  function open(item) {
    const href = safeHref(item?.href);
    if (!href) return false;
    location.href = href;
    return true;
  }

  window.RuangKithaCalendarEvents = {
    isoDate,
    loadRange,
    groupByDate,
    eventTimeLabel,
    moduleLabel,
    open
  };
})();
