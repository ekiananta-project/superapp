/* RuangKitha v2.0.0a52a — Maintenance UX + Finance Hotfix V1 */
(() => {
  "use strict";

  const BUILD = "v2.0.0a52a";
  const PREF_KEY = "keuangan_pengaturan_v1";

  function client() {
    if (!window.supabaseClient) throw new Error("Supabase belum tersedia.");
    return window.supabaseClient;
  }

  async function rpc(name, args = {}) {
    const { data, error } = await client().rpc(name, args);
    if (error) throw error;
    return data;
  }

  function todayISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function cleanDate(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function dateMs(value) {
    const clean = cleanDate(value);
    if (!clean) return null;
    const [y, m, d] = clean.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function daysBetween(from, to) {
    const a = dateMs(from);
    const b = dateMs(to);
    if (a === null || b === null) return null;
    return Math.round((b - a) / 86400000);
  }

  function inRange(value, start, end) {
    const date = cleanDate(value);
    return Boolean(date && date >= start && date <= end);
  }

  function normalizeDashboard(data) {
    return {
      groups: Array.isArray(data?.groups) ? data.groups : [],
      assets: Array.isArray(data?.assets) ? data.assets : [],
      items: Array.isArray(data?.items) ? data.items.map(item => ({
        ...item,
        interval_value: item?.interval_value == null ? null : Number(item.interval_value),
        history_count: Number(item?.history_count || 0),
        reminder_days: Array.isArray(item?.reminder_days)
          ? [...new Set(item.reminder_days.map(Number).filter(value => Number.isInteger(value) && value > 0))].sort((a, b) => b - a)
          : []
      })) : []
    };
  }

  async function ensureDefaults(familyId) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    return rpc("maintenance_ensure_defaults_v1", { p_family_id: familyId });
  }

  async function dashboard(familyId) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    return normalizeDashboard(await rpc("maintenance_dashboard_v1", { p_family_id: familyId }));
  }

  async function saveGroup({ familyId, groupId = null, name, sortOrder = null } = {}) {
    return rpc("maintenance_group_save_v1", {
      p_family_id: familyId,
      p_group_id: groupId || null,
      p_name: String(name || "").trim(),
      p_sort_order: sortOrder == null ? null : Number(sortOrder)
    });
  }

  async function removeGroup({ familyId, groupId } = {}) {
    return rpc("maintenance_group_remove_v1", { p_family_id: familyId, p_group_id: groupId });
  }

  async function saveAsset({ familyId, assetId = null, groupId, name, sortOrder = null } = {}) {
    return rpc("maintenance_asset_save_v1", {
      p_family_id: familyId,
      p_asset_id: assetId || null,
      p_group_id: groupId,
      p_name: String(name || "").trim(),
      p_sort_order: sortOrder == null ? null : Number(sortOrder)
    });
  }

  async function removeAsset({ familyId, assetId } = {}) {
    const result = await rpc("maintenance_asset_remove_v1", { p_family_id: familyId, p_asset_id: assetId });
    signalChanged();
    return result;
  }

  function normalizeReminders(values) {
    return [...new Set((values || []).map(Number).filter(value => Number.isInteger(value) && value >= 1 && value <= 3650))]
      .sort((a, b) => b - a);
  }

  async function saveItem({
    familyId,
    itemId = null,
    assetId,
    title,
    note = null,
    scheduleMode = "once",
    nextDueOn,
    intervalValue = null,
    intervalUnit = null,
    reminderDays = []
  } = {}) {
    const result = await rpc("maintenance_item_save_v1", {
      p_family_id: familyId,
      p_item_id: itemId || null,
      p_asset_id: assetId,
      p_title: String(title || "").trim(),
      p_note: String(note || "").trim() || null,
      p_schedule_mode: scheduleMode,
      p_next_due_on: cleanDate(nextDueOn),
      p_interval_value: scheduleMode === "recurring" ? Number(intervalValue || 0) : null,
      p_interval_unit: scheduleMode === "recurring" ? intervalUnit : null,
      p_reminder_days: normalizeReminders(reminderDays)
    });
    signalChanged();
    void syncNotifications().catch(error => console.debug?.("[Maintenance notification sync]", error));
    return result;
  }

  async function archiveItem({ familyId, itemId } = {}) {
    const result = await rpc("maintenance_item_archive_v1", { p_family_id: familyId, p_item_id: itemId });
    signalChanged();
    void syncNotifications().catch(error => console.debug?.("[Maintenance notification sync]", error));
    return result;
  }

  async function history({ familyId, itemId, limit = 50 } = {}) {
    const rows = await rpc("maintenance_history_list_v1", {
      p_family_id: familyId,
      p_item_id: itemId,
      p_limit: Math.max(1, Math.min(Number(limit || 50), 200))
    });
    return Array.isArray(rows) ? rows.map(row => ({
      ...row,
      finance_amount: row?.finance_amount == null ? null : Number(row.finance_amount)
    })) : [];
  }

  async function complete({
    familyId,
    itemId,
    performedOn,
    note = null,
    walletId = null,
    amount = null,
    financeAccountId = null
  } = {}) {
    const hasCost = walletId || amount;
    const result = await rpc("maintenance_complete_v1", {
      p_family_id: familyId,
      p_item_id: itemId,
      p_performed_on: cleanDate(performedOn),
      p_note: String(note || "").trim() || null,
      p_wallet_id: hasCost ? walletId || null : null,
      p_amount: hasCost ? Math.round(Number(amount || 0)) : null,
      p_finance_account_id: null
    });
    signalChanged();
    if (window.FinanceCache) window.FinanceCache.remove("wallets", familyId);
    void syncNotifications().catch(error => console.debug?.("[Maintenance notification sync]", error));
    return result;
  }

  async function addHistoryExpense({ familyId, historyId, walletId, amount, financeAccountId = null } = {}) {
    const result = await rpc("maintenance_history_add_expense_v1", {
      p_family_id: familyId,
      p_history_id: historyId,
      p_wallet_id: walletId,
      p_amount: Math.round(Number(amount || 0)),
      p_finance_account_id: null
    });
    if (window.FinanceCache) window.FinanceCache.remove("wallets", familyId);
    return result;
  }

  function readFinancePrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  async function financeOptions(familyId) {
    if (!window.FinanceService) return { wallets: [], category: null, preferredWalletId: "" };
    const [wallets, categoryId] = await Promise.all([
      window.FinanceService.ambilSaldoDompet(familyId),
      window.FinanceService.pastikanKategoriMaintenance(familyId)
    ]);
    const prefs = readFinancePrefs();
    const preferredWalletId = (wallets || []).some(item => item.wallet_id === prefs.dompetAktif) ? prefs.dompetAktif : (wallets?.[0]?.wallet_id || "");
    const category = categoryId ? { id: categoryId, name: "Maintenance", kind: "expense" } : null;
    return { wallets: wallets || [], category, preferredWalletId };
  }

  function projectCalendar(data, start, end) {
    return (data?.items || [])
      .filter(item => item?.next_due_on && inRange(item.next_due_on, start, end))
      .map(item => ({
        event_key: `maintenance:${item.id}:due:${item.next_due_on}`,
        event_date: item.next_due_on,
        event_at: null,
        all_day: true,
        title: item.title || "Perawatan",
        subtitle: `${item.asset_name || "Aset"} · ${item.group_name || "Maintenance"}`,
        source_module: "maintenance",
        source_type: "maintenance_due",
        source_id: String(item.id || ""),
        source_href: `maintenance.html?item=${encodeURIComponent(String(item.id || ""))}`,
        status: "active",
        tone: "maintenance",
        icon_name: "build-outline",
        priority: 15
      }))
      .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.title.localeCompare(b.title, "id"));
  }

  async function loadCalendarEvents({ familyId, start, end } = {}) {
    if (!familyId || !cleanDate(start) || !cleanDate(end)) return [];
    return projectCalendar(await dashboard(familyId), start, end);
  }

  function summarize(data, now = new Date()) {
    const today = todayISO(now);
    const active = (data?.items || []).filter(item => cleanDate(item?.next_due_on));
    let overdue = 0;
    let todayCount = 0;
    let upcoming = 0;
    let nearest = null;
    let top = null;
    active.forEach(item => {
      const diff = daysBetween(today, item.next_due_on);
      if (diff === null) return;
      if (diff < 0) overdue += 1;
      else if (diff === 0) todayCount += 1;
      else if (diff <= 30) upcoming += 1;
      if (!nearest || item.next_due_on < nearest) nearest = item.next_due_on;
      const rank = diff < 0 ? 0 : diff === 0 ? 1 : 2;
      if (!top || rank < top.rank || (rank === top.rank && item.next_due_on < top.nextDueOn)) {
        top = { rank, itemId: item.id, title: item.title, assetName: item.asset_name, nextDueOn: item.next_due_on, days: diff };
      }
    });
    return { activeCount: active.length, overdue, todayCount, upcoming, nearestDueOn: nearest, top };
  }

  async function summary(familyId) {
    return summarize(await dashboard(familyId));
  }

  async function syncNotifications(horizonHours = 2160) {
    return Number(await rpc("maintenance_notification_sync_my_inbox_v1", {
      p_horizon_hours: Math.max(24, Math.min(Number(horizonHours || 2160), 2160))
    }) || 0);
  }

  function signalChanged() {
    const stamp = String(Date.now());
    try { localStorage.setItem("ruangkitha:calendar:dirty", stamp); } catch {}
    try {
      window.dispatchEvent(new CustomEvent("ruangkitha:maintenance-changed", { detail: { at: Number(stamp) } }));
    } catch {}
  }

  window.RuangKithaMaintenance = {
    BUILD,
    todayISO,
    daysBetween,
    ensureDefaults,
    dashboard,
    saveGroup,
    removeGroup,
    saveAsset,
    removeAsset,
    saveItem,
    archiveItem,
    history,
    complete,
    addHistoryExpense,
    financeOptions,
    loadCalendarEvents,
    summary,
    syncNotifications,
    signalChanged,
    __test: { cleanDate, normalizeReminders, projectCalendar, summarize }
  };
})();
