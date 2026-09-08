(() => {
  "use strict";

  /*
   * Family Superapp v1.2.0d
   * Shared Finance navigation cache.
   *
   * Scope deliberately small:
   * - categories: cache-first + background revalidation;
   * - wallets: only a very short cache window because current_balance is dynamic.
   *
   * Source of truth remains Supabase. sessionStorage is only a navigation accelerator.
   */

  const PREFIX = "family-superapp:finance-cache:v2";
  const VERSION = 2;
  const TTL = Object.freeze({
    categories: 15 * 60 * 1000,
    wallets: 15 * 1000
  });
  const inFlight = new Map();
  let serviceWrapped = false;

  function now() {
    return Date.now();
  }

  function text(value) {
    return String(value || "").trim();
  }

  function storageAvailable() {
    try {
      const key = `${PREFIX}:probe`;
      sessionStorage.setItem(key, "1");
      sessionStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  const enabled = storageAvailable();

  function key(kind, familyId, userId) {
    const safeKind = text(kind);
    const safeFamily = text(familyId);
    const safeUser = text(userId);
    if (!safeKind || !safeFamily || !safeUser) return "";
    return `${PREFIX}:${safeUser}:${safeFamily}:${safeKind}`;
  }

  function parse(raw) {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      if (!value || value.version !== VERSION || !Array.isArray(value.data)) return null;
      return value;
    } catch {
      return null;
    }
  }

  function readEntry(kind, familyId, userId, { allowExpired = false } = {}) {
    if (!enabled) return null;
    const cacheKey = key(kind, familyId, userId);
    if (!cacheKey) return null;
    const entry = parse(sessionStorage.getItem(cacheKey));
    if (!entry) return null;

    const maxAge = Number(TTL[kind] ?? 0);
    const age = Math.max(0, now() - Number(entry.fetchedAt || 0));
    if (!allowExpired && maxAge > 0 && age > maxAge) return null;

    return { ...entry, age };
  }

  function read(kind, familyId, userId, options = {}) {
    return readEntry(kind, familyId, userId, options)?.data || null;
  }

  function write(kind, familyId, data, userId) {
    if (!enabled || !Array.isArray(data)) return data;
    const cacheKey = key(kind, familyId, userId);
    if (!cacheKey) return data;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({
        version: VERSION,
        fetchedAt: now(),
        data
      }));
    } catch (error) {
      console.warn("[FinanceCache write]", error);
    }
    return data;
  }

  function keysMatching({ kind = null, familyId = null, userId = null } = {}) {
    if (!enabled) return [];
    const result = [];
    const kindText = text(kind);
    const familyText = text(familyId);
    const userText = text(userId);

    for (let i = 0; i < sessionStorage.length; i += 1) {
      const itemKey = sessionStorage.key(i) || "";
      if (!itemKey.startsWith(`${PREFIX}:`)) continue;
      if (kindText && !itemKey.endsWith(`:${kindText}`)) continue;
      if (familyText && !itemKey.includes(`:${familyText}:`)) continue;
      if (userText && !itemKey.startsWith(`${PREFIX}:${userText}:`)) continue;
      result.push(itemKey);
    }
    return result;
  }

  function remove(kind = null, familyId = null, userId = null) {
    keysMatching({ kind, familyId, userId }).forEach(itemKey => {
      try { sessionStorage.removeItem(itemKey); } catch { /* noop */ }
    });
  }

  function clearUser(userId) {
    remove(null, null, userId);
  }

  function clearAll() {
    remove();
  }

  async function currentUserId() {
    try {
      if (window.AuthService?.ambilSession) {
        const session = await window.AuthService.ambilSession();
        return session?.user?.id || "";
      }
      const { data } = await window.supabaseClient?.auth?.getSession?.();
      return data?.session?.user?.id || "";
    } catch {
      return "";
    }
  }

  function comparable(data) {
    try { return JSON.stringify(data || []); } catch { return ""; }
  }

  function emit(kind, familyId, userId, data, changed) {
    window.dispatchEvent(new CustomEvent("finance-cache-updated", {
      detail: { kind, familyId, userId, data, changed }
    }));
  }

  async function revalidate(kind, familyId, userId, fetcher) {
    if (typeof fetcher !== "function") throw new Error("fetcher wajib berupa function.");
    const requestKey = key(kind, familyId, userId) || `${kind}:${familyId}:${userId}`;
    if (inFlight.has(requestKey)) return inFlight.get(requestKey);

    const previous = read(kind, familyId, userId, { allowExpired: true }) || [];
    const promise = (async () => {
      try {
        const fresh = await fetcher();
        const rows = Array.isArray(fresh) ? fresh : [];
        const changed = comparable(previous) !== comparable(rows);
        write(kind, familyId, rows, userId);
        emit(kind, familyId, userId, rows, changed);
        return rows;
      } finally {
        inFlight.delete(requestKey);
      }
    })();

    inFlight.set(requestKey, promise);
    return promise;
  }

  async function swr(kind, familyId, userId, fetcher) {
    const cached = read(kind, familyId, userId);
    if (cached) {
      revalidate(kind, familyId, userId, fetcher).catch(error => {
        console.warn(`[FinanceCache revalidate ${kind}]`, error);
      });
      return { data: cached, source: "cache" };
    }

    const data = await revalidate(kind, familyId, userId, fetcher);
    return { data, source: "network" };
  }

  function idle(callback, timeout = 1200) {
    if (typeof callback !== "function") return;
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => callback(), { timeout });
      return;
    }
    window.setTimeout(callback, 250);
  }

  function pruneContext(userId, familyId) {
    if (!enabled) return;
    const safeUser = text(userId);
    const safeFamily = text(familyId);
    if (!safeUser || !safeFamily) return;
    keysMatching({ userId: safeUser }).forEach(itemKey => {
      if (!itemKey.includes(`:${safeFamily}:`)) {
        try { sessionStorage.removeItem(itemKey); } catch { /* noop */ }
      }
    });
  }

  function invalidateAfterTransaction(familyId = null) {
    // Wallet balance is dynamic. Categories remain valid.
    remove("wallets", familyId || null);
  }

  function wrapMutation(name, resolver) {
    const service = window.FinanceService;
    const original = service?.[name];
    if (typeof original !== "function" || original.__financeCacheWrapped) return;

    const wrapped = async function(...args) {
      const result = await original.apply(service, args);
      try { resolver?.(args, result); } catch (error) {
        console.warn(`[FinanceCache invalidate ${name}]`, error);
      }
      return result;
    };
    wrapped.__financeCacheWrapped = true;
    service[name] = wrapped;
  }

  function installServiceWrappers() {
    if (serviceWrapped || !window.FinanceService) return;
    const service = window.FinanceService;

    const originalAccounts = service.ambilAkun?.bind(service);
    const originalWallets = service.ambilSaldoDompet?.bind(service);

    if (originalAccounts) {
      service.ambilAkunFresh = async function(familyId, kind = null) {
        const rows = await originalAccounts(familyId, kind);
        if (!kind) {
          const userId = await currentUserId();
          if (familyId && userId) write("categories", familyId, rows || [], userId);
        }
        return rows;
      };
      service.ambilAkun = async function(familyId, kind = null) {
        const userId = await currentUserId();
        if (!familyId || !userId) return originalAccounts(familyId, kind);

        const result = await swr(
          "categories",
          familyId,
          userId,
          () => originalAccounts(familyId, null)
        );
        return kind
          ? result.data.filter(item => item.kind === kind)
          : result.data;
      };
    }

    if (originalWallets) {
      service.ambilSaldoDompetFresh = async function(familyId) {
        const rows = await originalWallets(familyId);
        const userId = await currentUserId();
        if (familyId && userId) write("wallets", familyId, rows || [], userId);
        return rows;
      };
      service.ambilSaldoDompet = async function(familyId) {
        const userId = await currentUserId();
        if (!familyId || !userId) return originalWallets(familyId);

        const result = await swr(
          "wallets",
          familyId,
          userId,
          () => originalWallets(familyId)
        );
        return result.data;
      };
    }

    // Metadata mutations.
    wrapMutation("buatKategori", args => remove("categories", args?.[0]?.familyId || null));
    wrapMutation("ubahKategori", () => remove("categories"));
    wrapMutation("hapusKategori", () => remove("categories"));
    wrapMutation("arsipAkun", () => remove("categories"));
    wrapMutation("buatDompet", args => remove("wallets", args?.[0]?.familyId || null));
    wrapMutation("ubahDompet", () => remove("wallets"));
    wrapMutation("arsipDompet", () => remove("wallets"));

    // Anything touching ledger may change current_balance.
    ["buatTransaksi", "buatPengeluaran", "buatPemasukan", "transfer", "adjustment"]
      .forEach(name => wrapMutation(name, args => {
        const first = args?.[0] || {};
        remove("wallets", first.familyId || null);
      }));
    wrapMutation("updateTransaksi", () => remove("wallets"));
    wrapMutation("voidTransaksi", () => remove("wallets"));
    wrapMutation("bayarTagihan", () => remove("wallets"));

    serviceWrapped = true;
  }

  // finance-service.js is intentionally loaded before this file on Finance pages.
  installServiceWrappers();

  try {
    window.supabaseClient?.auth?.onAuthStateChange?.((event, session) => {
      if (event === "SIGNED_OUT") clearAll();
      if (event === "SIGNED_IN" && session?.user?.id) {
        // Do not use cache owned by another user in the same tab session.
        keysMatching().forEach(itemKey => {
          if (!itemKey.startsWith(`${PREFIX}:${session.user.id}:`)) {
            try { sessionStorage.removeItem(itemKey); } catch { /* noop */ }
          }
        });
      }
    });
  } catch (error) {
    console.warn("[FinanceCache auth listener]", error);
  }

  window.FinanceCache = {
    VERSION,
    TTL,
    read,
    readEntry,
    write,
    remove,
    clearUser,
    clearAll,
    currentUserId,
    revalidate,
    swr,
    idle,
    pruneContext,
    invalidateAfterTransaction,
    installServiceWrappers
  };
})();
