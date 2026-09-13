/* RuangKitha v2.0.0a50e1 — Documents Reminder Projection Hotfix */
(() => {
  "use strict";

  const BUILD = "v2.0.0a50e1";

  function client() {
    if (!window.supabaseClient) throw new Error("Supabase belum tersedia.");
    return window.supabaseClient;
  }

  function cleanDate(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function dateOnlyToMs(value) {
    const clean = cleanDate(value);
    if (!clean) return null;
    const [y, m, d] = clean.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function msToDateOnly(ms) {
    if (!Number.isFinite(ms)) return null;
    const date = new Date(ms);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(value, delta) {
    const ms = dateOnlyToMs(value);
    return ms === null ? null : msToDateOnly(ms + Number(delta || 0) * 86400000);
  }

  function daysBetween(from, to) {
    const a = dateOnlyToMs(from);
    const b = dateOnlyToMs(to);
    if (a === null || b === null) return null;
    return Math.round((b - a) / 86400000);
  }

  function todayISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function inRange(value, start, end) {
    const clean = cleanDate(value);
    return Boolean(clean && clean >= start && clean <= end);
  }

  async function rpc(name, args = {}) {
    const { data, error } = await client().rpc(name, args);
    if (error) throw error;
    return data;
  }

  function documentsFromResult(result) {
    return Array.isArray(result?.documents) ? result.documents : [];
  }

  function dedupeRecords(records) {
    const map = new Map();
    for (const record of records || []) {
      const id = String(record?.document_id || "").trim();
      if (!id) continue;
      map.set(id, record);
    }
    return [...map.values()];
  }

  async function loadVisibleCatalog(familyId = null) {
    const tasks = [
      rpc("document_records_list_v1", { p_family_id: familyId || null, p_view: "personal" })
    ];
    if (familyId) {
      tasks.push(rpc("document_records_list_v1", { p_family_id: familyId, p_view: "family" }));
    }
    const settled = await Promise.allSettled(tasks);
    const records = [];
    const errors = [];
    settled.forEach((item) => {
      if (item.status === "fulfilled") records.push(...documentsFromResult(item.value));
      else errors.push(item.reason);
    });
    if (!records.length && errors.length === settled.length) throw errors[0];
    return dedupeRecords(records).filter((record) => String(record?.status || "active") === "active");
  }

  function eventForExpiry(record) {
    const expiry = cleanDate(record?.expires_on);
    if (!expiry) return null;
    const id = String(record?.document_id || "");
    const name = String(record?.display_name || "Dokumen").trim() || "Dokumen";
    const type = String(record?.document_type || "Dokumen").trim() || "Dokumen";
    return {
      event_key: `documents:${id}:expiry:${expiry}`,
      event_date: expiry,
      event_at: null,
      all_day: true,
      title: `${name} berakhir hari ini`,
      subtitle: `${type} · Masa berlaku dokumen`,
      source_module: "documents",
      source_type: "expiry",
      source_id: id,
      source_href: `dokumen.html?document=${encodeURIComponent(id)}`,
      status: "active",
      tone: "documents",
      icon_name: "document-text-outline",
      priority: 10
    };
  }

  function eventForReminder(record) {
    const expiry = cleanDate(record?.expires_on);
    const reminderDays = Number(record?.reminder_days || 0);
    if (!expiry || !Number.isInteger(reminderDays) || reminderDays < 1) return null;
    const reminderDate = addDays(expiry, -reminderDays);
    if (!reminderDate) return null;
    const id = String(record?.document_id || "");
    const name = String(record?.display_name || "Dokumen").trim() || "Dokumen";
    return {
      event_key: `documents:${id}:reminder:${reminderDate}`,
      event_date: reminderDate,
      event_at: null,
      all_day: true,
      title: `${name} perlu diperhatikan`,
      subtitle: `${reminderDays} hari sebelum masa berlaku berakhir`,
      source_module: "documents",
      source_type: "expiry_reminder",
      source_id: id,
      source_href: `dokumen.html?document=${encodeURIComponent(id)}`,
      status: "active",
      tone: "documents",
      icon_name: "document-text-outline",
      priority: 25
    };
  }

  function projectCalendar(records, start, end) {
    const events = [];
    for (const record of records || []) {
      const expiry = eventForExpiry(record);
      const reminder = eventForReminder(record);
      if (expiry && inRange(expiry.event_date, start, end)) events.push(expiry);
      if (reminder && inRange(reminder.event_date, start, end)) events.push(reminder);
    }
    return events.sort((a, b) => {
      if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.title.localeCompare(b.title, "id");
    });
  }

  function summarizeAttention(records, now = new Date()) {
    const today = todayISO(now);
    let attentionCount = 0;
    let expiredCount = 0;
    let todayCount = 0;
    let upcomingCount = 0;
    let nearestExpiresOn = null;

    for (const record of records || []) {
      const expiry = cleanDate(record?.expires_on);
      if (!expiry) continue;
      const diff = daysBetween(today, expiry);
      if (diff === null) continue;
      const reminderDays = Number(record?.reminder_days || 0);
      const inReminderWindow = Number.isInteger(reminderDays) && reminderDays > 0 && diff <= reminderDays;
      // Expired and expiry-today records are always important even when the user
      // deliberately chose "Tanpa pengingat". Reminder days only govern the
      // upcoming window before expiry.
      const attention = diff <= 0 || inReminderWindow;
      if (!attention) continue;

      attentionCount += 1;
      if (diff < 0) expiredCount += 1;
      else if (diff === 0) todayCount += 1;
      else upcomingCount += 1;
      if (!nearestExpiresOn || expiry < nearestExpiresOn) nearestExpiresOn = expiry;
    }

    return { attentionCount, expiredCount, todayCount, upcomingCount, nearestExpiresOn };
  }

  async function loadCalendarEvents({ familyId = null, start, end } = {}) {
    const rangeStart = cleanDate(start);
    const rangeEnd = cleanDate(end);
    if (!rangeStart || !rangeEnd) return [];

    // a50e1 intentionally projects from the stable catalog RPCs first. This
    // removes the silent-failure path where the optional a50e projection RPC
    // could be unavailable/stale in PostgREST and Calendar/Home would look empty.
    try {
      const records = await loadVisibleCatalog(familyId);
      return projectCalendar(records, rangeStart, rangeEnd);
    } catch (catalogError) {
      console.warn?.("[Documents calendar catalog projection]", catalogError);
    }

    // Server projection remains a safe fallback for deployments where catalog
    // listing is temporarily unavailable but 007G is healthy.
    const data = await rpc("document_calendar_events_for_range_v1", {
      p_family_id: familyId || null,
      p_start: rangeStart,
      p_end: rangeEnd
    });
    return Array.isArray(data) ? data : [];
  }

  async function attentionSummary(familyId = null) {
    try {
      const records = await loadVisibleCatalog(familyId);
      return summarizeAttention(records);
    } catch (catalogError) {
      console.warn?.("[Documents attention catalog projection]", catalogError);
    }

    const data = await rpc("document_attention_summary_v1", { p_family_id: familyId || null });
    return {
      attentionCount: Number(data?.attention_count || 0),
      expiredCount: Number(data?.expired_count || 0),
      todayCount: Number(data?.today_count || 0),
      upcomingCount: Number(data?.upcoming_count || 0),
      nearestExpiresOn: cleanDate(data?.nearest_expires_on)
    };
  }

  async function syncNotifications(horizonHours = 24 * 30) {
    const hours = Math.max(24, Math.min(Number(horizonHours || 24 * 30), 24 * 90));
    const data = await rpc("document_notification_sync_my_inbox_v1", { p_horizon_hours: hours });
    return Number(data || 0);
  }

  function signalChanged() {
    const stamp = String(Date.now());
    try { localStorage.setItem("ruangkitha:calendar:dirty", stamp); } catch {}
    window.dispatchEvent(new CustomEvent("ruangkitha:documents-reminder-changed", { detail: { at: Number(stamp) } }));
  }

  window.RuangKithaDocumentReminders = {
    BUILD,
    loadCalendarEvents,
    attentionSummary,
    syncNotifications,
    signalChanged,
    // Exposed only to local self-tests; callers should use the public methods.
    __test: { cleanDate, addDays, projectCalendar, summarizeAttention }
  };
})();
