// RuangKitha v2.0.0a50e1 — Calendar projection + Documents reminder projection hotfix.
(() => {
  "use strict";

  const CACHE_VERSION = "a50e1-projection-v1";
  const CACHE_PREFIX = "ruangkitha:calendar-range:";
  const inflight = new Map();

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
    const eventDate = isoDate(row?.event_date || row?.date || new Date());
    const eventAt = row?.event_at ?? row?.at ?? "";
    return {
      key: String(row?.event_key || row?.key || `${row?.source_module || row?.module || "event"}:${row?.source_id || row?.sourceId || eventDate}:${row?.title || ""}`),
      date: eventDate,
      at: eventAt ? String(eventAt) : "",
      allDay: row?.all_day ?? row?.allDay ?? true,
      title: String(row?.title || "Agenda RuangKitha").trim() || "Agenda RuangKitha",
      subtitle: String(row?.subtitle || "").trim(),
      module: String(row?.source_module || row?.module || "calendar").trim().toLowerCase(),
      type: String(row?.source_type || row?.type || "event").trim().toLowerCase(),
      sourceId: row?.source_id || row?.sourceId ? String(row?.source_id || row?.sourceId) : "",
      href: safeHref(row?.source_href || row?.href),
      status: String(row?.status || "active").trim().toLowerCase(),
      tone: String(row?.tone || row?.source_module || row?.module || "calendar").trim().toLowerCase(),
      icon: String(row?.icon_name || row?.icon || "calendar-clear-outline").trim(),
      priority: Number(row?.priority || 50)
    };
  }

  function sortItems(items) {
    return [...(items || [])].map(normalize).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.priority !== b.priority) return a.priority - b.priority;
      const aTime = a.at || "9999";
      const bTime = b.at || "9999";
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      return a.title.localeCompare(b.title, "id");
    });
  }

  function cacheKey({ viewerId, familyId, start, end }) {
    if (!viewerId || !familyId) return "";
    return `${CACHE_PREFIX}${CACHE_VERSION}:${viewerId}:${familyId}:${isoDate(start)}:${isoDate(end)}`;
  }

  function peekRange({ viewerId, familyId, start, end } = {}) {
    const key = cacheKey({ viewerId, familyId, start, end });
    if (!key) return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== CACHE_VERSION || !Array.isArray(parsed?.items)) return null;
      return {
        items: sortItems(parsed.items),
        savedAt: Number(parsed.savedAt || 0),
        ageMs: Math.max(0, Date.now() - Number(parsed.savedAt || 0))
      };
    } catch {
      return null;
    }
  }

  function saveRange({ viewerId, familyId, start, end, items } = {}) {
    const key = cacheKey({ viewerId, familyId, start, end });
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), items: sortItems(items) }));
    } catch {}
  }

  function invalidateFamily({ viewerId, familyId } = {}) {
    if (!viewerId || !familyId) return;
    const prefix = `${CACHE_PREFIX}${CACHE_VERSION}:${viewerId}:${familyId}:`;
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
      }
    } catch {}
  }

  async function resolveViewerId(explicit = "") {
    if (explicit) return explicit;
    try {
      const { data } = await client().auth.getSession();
      return String(data?.session?.user?.id || "");
    } catch {
      return "";
    }
  }

  async function loadRange({ familyId, start, end, viewerId = "", forceFresh = true } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    const rangeStart = isoDate(start || new Date());
    const rangeEnd = isoDate(end || rangeStart);
    const resolvedViewerId = await resolveViewerId(viewerId);

    if (!forceFresh) {
      const cached = peekRange({ viewerId: resolvedViewerId, familyId, start: rangeStart, end: rangeEnd });
      if (cached) return cached.items;
    }

    const requestKey = `${resolvedViewerId || "viewer"}:${familyId}:${rangeStart}:${rangeEnd}`;
    if (inflight.has(requestKey)) return inflight.get(requestKey);

    const request = (async () => {
      let { data, error } = await client().rpc("calendar_events_for_range_v4", {
        p_family_id: familyId,
        p_start: rangeStart,
        p_end: rangeEnd
      });

      // Deployment-safe fallback only when 005D has not reached PostgREST yet.
      // Runtime/database errors from v4 are intentionally surfaced instead of hidden.
      const missingV4 = error && (
        error.code === "PGRST202" ||
        /calendar_events_for_range_v4/i.test(String(error.message || "")) && /not find|does not exist|schema cache/i.test(String(error.message || ""))
      );
      if (missingV4) {
        ({ data, error } = await client().rpc("calendar_events_for_range_v3", {
          p_family_id: familyId,
          p_start: rangeStart,
          p_end: rangeEnd
        }));
      }
      if (error) throw error;

      let documentItems = [];
      if (window.RuangKithaDocumentReminders?.loadCalendarEvents) {
        try {
          documentItems = await window.RuangKithaDocumentReminders.loadCalendarEvents({
            familyId,
            start: rangeStart,
            end: rangeEnd
          });
        } catch (documentError) {
          console.debug?.("[Calendar documents projection]", documentError);
        }
      }

      const items = sortItems([...(data || []), ...(documentItems || [])]);
      saveRange({ viewerId: resolvedViewerId, familyId, start: rangeStart, end: rangeEnd, items });
      return items;
    })();

    inflight.set(requestKey, request);
    try { return await request; }
    finally { inflight.delete(requestKey); }
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
    const labels = { finance: "Keuangan", notes: "Catatan", documents: "Dokumen", calendar: "Kalender" };
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
    peekRange,
    invalidateFamily,
    groupByDate,
    eventTimeLabel,
    moduleLabel,
    open
  };
})();
