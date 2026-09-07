(() => {
  "use strict";

  const PREFIX = "family_superapp_cache_v1";
  const TTL_MS = 10 * 60 * 1000;

  function key(type, familyId) {
    return `${PREFIX}:${String(type || "")}:${String(familyId || "")}`;
  }

  function read(type, familyId, userId = null) {
    if (!type || !familyId) return null;

    try {
      const raw = sessionStorage.getItem(key(type, familyId));
      if (!raw) return null;

      const payload = JSON.parse(raw);
      if (!payload || !Array.isArray(payload.data)) return null;
      if (userId && payload.userId && payload.userId !== userId) return null;
      if (Date.now() - Number(payload.savedAt || 0) > TTL_MS) return null;

      return payload.data;
    } catch {
      return null;
    }
  }

  function write(type, familyId, data, userId = null) {
    if (!type || !familyId || !Array.isArray(data)) return;

    try {
      sessionStorage.setItem(
        key(type, familyId),
        JSON.stringify({
          userId: userId || null,
          familyId,
          savedAt: Date.now(),
          data
        })
      );
    } catch (error) {
      console.warn("[FinanceCache write]", error);
    }
  }

  function remove(type, familyId) {
    if (!type || !familyId) return;
    try {
      sessionStorage.removeItem(key(type, familyId));
    } catch {}
  }

  function removeFamily(familyId) {
    if (!familyId) return;
    try {
      ["categories", "wallets"].forEach(type => remove(type, familyId));
    } catch {}
  }

  function clearAll() {
    try {
      Object.keys(sessionStorage)
        .filter(item => item.startsWith(`${PREFIX}:`))
        .forEach(item => sessionStorage.removeItem(item));
    } catch {}
  }

  async function prefetch({ familyId, userId = null } = {}) {
    if (!familyId || !window.FinanceService) return;

    const jobs = [];

    jobs.push(
      window.FinanceService.ambilAkun(familyId)
        .then(data => write("categories", familyId, data || [], userId))
        .catch(error => console.warn("[Prefetch kategori]", error))
    );

    jobs.push(
      window.FinanceService.ambilSaldoDompet(familyId)
        .then(data => write("wallets", familyId, data || [], userId))
        .catch(error => console.warn("[Prefetch dompet]", error))
    );

    await Promise.allSettled(jobs);
  }

  window.FinanceCache = {
    read,
    write,
    remove,
    removeFamily,
    clearAll,
    prefetch
  };
})();
