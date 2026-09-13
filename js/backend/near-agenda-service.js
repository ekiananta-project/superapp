// RuangKitha v2.0.0a51a — Agenda Dekat V1 projection helpers.
(() => {
  "use strict";

  const BUILD = "v2.0.0a51a";
  const RESOLVED_STATUSES = new Set(["paid", "completed", "complete", "resolved", "done", "archived", "cancelled", "canceled"]);

  function isoDate(value = new Date()) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = value instanceof Date ? value : new Date(value);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function dateAtNoon(value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
    const clean = isoDate(value);
    const [y, m, d] = clean.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }

  function addDays(value, amount) {
    const date = dateAtNoon(value);
    date.setDate(date.getDate() + Number(amount || 0));
    return isoDate(date);
  }

  function dayDelta(from, to) {
    const left = dateAtNoon(from);
    const right = dateAtNoon(to);
    return Math.round((right - left) / 86400000);
  }

  function statusOf(item) {
    return String(item?.status || "active").trim().toLowerCase();
  }

  function isResolved(item) {
    return RESOLVED_STATUSES.has(statusOf(item));
  }

  function isPastActionable(item) {
    if (!item || isResolved(item)) return false;
    const module = String(item.module || "").trim().toLowerCase();

    // Agenda Dekat never invents a global completion state. Only modules that
    // already own an unresolved state are surfaced as "perlu ditinjau".
    if (module === "finance") return true;      // unpaid / partial bill stays active
    if (module === "notes") return true;        // active Reminder; a51 completion removes/advances it
    if (module === "documents") return true;    // old expiry/reminder; renewal moves the source date

    // Calendar/holiday items are time-based history, not unfinished tasks.
    return false;
  }

  function sortItems(items) {
    return [...(items || [])].sort((a, b) => {
      const aDate = String(a?.date || "");
      const bDate = String(b?.date || "");
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      const aPriority = Number(a?.priority ?? 50);
      const bPriority = Number(b?.priority ?? 50);
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aTime = String(a?.at || "9999");
      const bTime = String(b?.at || "9999");
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      return String(a?.title || "").localeCompare(String(b?.title || ""), "id");
    });
  }

  function project(items, now = new Date()) {
    const today = isoDate(now);
    const start = addDays(today, -3);
    const end = addDays(today, 3);
    const active = sortItems(items).filter(item => {
      const date = isoDate(item?.date || today);
      return date >= start && date <= end && !isResolved(item);
    });

    const pastReview = active
      .filter(item => String(item.date) < today && isPastActionable(item))
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date); // most recent first
        return sortItems([a, b])[0] === a ? -1 : 1;
      });

    const todayItems = active.filter(item => String(item.date) === today);
    const upcoming = [1, 2, 3].map(offset => {
      const date = addDays(today, offset);
      return { offset, date, items: active.filter(item => String(item.date) === date) };
    });

    return {
      start,
      today,
      end,
      pastReview,
      todayItems,
      upcoming,
      activeCount: pastReview.length + todayItems.length + upcoming.reduce((sum, group) => sum + group.items.length, 0)
    };
  }

  function groupPastByDate(items) {
    const groups = new Map();
    (items || []).forEach(item => {
      const key = String(item.date || "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, group]) => ({ date, items: sortItems(group) }));
  }

  window.RuangKithaNearAgenda = {
    BUILD,
    isoDate,
    addDays,
    dayDelta,
    isResolved,
    isPastActionable,
    project,
    groupPastByDate,
    __test: { statusOf, sortItems }
  };
})();
