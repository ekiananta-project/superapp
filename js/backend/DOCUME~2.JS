/* RuangKitha v2.0.0a50e — Documents Reminder + Calendar + Notification Integration V1 */
(() => {
  "use strict";

  function client() {
    if (!window.supabaseClient) throw new Error("Supabase belum tersedia.");
    return window.supabaseClient;
  }

  function cleanDate(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  async function rpc(name, args = {}) {
    const { data, error } = await client().rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function loadCalendarEvents({ familyId = null, start, end } = {}) {
    const rangeStart = cleanDate(start);
    const rangeEnd = cleanDate(end);
    if (!rangeStart || !rangeEnd) return [];
    const data = await rpc("document_calendar_events_for_range_v1", {
      p_family_id: familyId || null,
      p_start: rangeStart,
      p_end: rangeEnd
    });
    return Array.isArray(data) ? data : [];
  }

  async function attentionSummary(familyId = null) {
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
    loadCalendarEvents,
    attentionSummary,
    syncNotifications,
    signalChanged
  };
})();
