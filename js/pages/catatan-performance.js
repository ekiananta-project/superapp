(() => {
  "use strict";

  const VERSION = 1;
  const PREFIX = "ruangkitha.catatan.cache.v1";
  const DEFAULT_MAX_AGE = 10 * 60 * 1000;
  const FRESH_PREFETCH_AGE = 45 * 1000;

  function clean(value) {
    return String(value ?? "").trim();
  }

  function contextKey(context = {}) {
    return Object.keys(context)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(clean(context[key]))}`)
      .join("&");
  }

  function storageKey(bucket, context = {}) {
    return `${PREFIX}:${clean(bucket)}:${contextKey(context)}`;
  }

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function readEntry(bucket, context = {}, maxAge = DEFAULT_MAX_AGE) {
    try {
      const raw = sessionStorage.getItem(storageKey(bucket, context));
      if (!raw) return null;
      const entry = safeParse(raw);
      if (!entry || entry.v !== VERSION || !Number.isFinite(entry.savedAt)) return null;
      const age = Math.max(0, Date.now() - entry.savedAt);
      if (Number.isFinite(maxAge) && maxAge >= 0 && age > maxAge) return null;
      return { data: entry.data, age, savedAt: entry.savedAt };
    } catch (_) {
      return null;
    }
  }

  function read(bucket, context = {}, maxAge = DEFAULT_MAX_AGE) {
    return readEntry(bucket, context, maxAge)?.data ?? null;
  }

  function write(bucket, context = {}, data) {
    try {
      sessionStorage.setItem(storageKey(bucket, context), JSON.stringify({
        v: VERSION,
        savedAt: Date.now(),
        data
      }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function remove(bucket, context = {}) {
    try { sessionStorage.removeItem(storageKey(bucket, context)); } catch (_) {}
  }

  function clearForUser(userId) {
    const needle = `userId=${encodeURIComponent(clean(userId))}`;
    if (!needle || needle.endsWith("=")) return;
    try {
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(`${PREFIX}:`) && key.includes(needle)) sessionStorage.removeItem(key);
      }
    } catch (_) {}
  }

  function fingerprint(value) {
    try { return JSON.stringify(value ?? null); } catch (_) { return String(Date.now()); }
  }

  function same(a, b) {
    return fingerprint(a) === fingerprint(b);
  }

  function skeletonCard(kind = "notes") {
    const card = document.createElement("div");
    card.className = `catatan-skeleton-card is-${kind}`;
    card.dataset.catatanSkeleton = "";
    card.setAttribute("aria-hidden", "true");
    const icon = document.createElement("span");
    icon.className = "catatan-skeleton-icon";
    const line1 = document.createElement("span");
    line1.className = "catatan-skeleton-line is-title";
    const line2 = document.createElement("span");
    line2.className = "catatan-skeleton-line is-body";
    const line3 = document.createElement("span");
    line3.className = "catatan-skeleton-line is-meta";
    card.append(icon, line1, line2, line3);
    return card;
  }

  function startSkeleton(grid, { kind = "notes", count = 4, delay = 180 } = {}) {
    if (!grid) return { finish() {} };
    let finished = false;
    const timer = window.setTimeout(() => {
      if (finished) return;
      const hasRealContent = grid.querySelector(
        ".catatan-card-shell,[data-preview-item],[data-folder-note],[data-archive-item]"
      );
      if (hasRealContent) return;
      grid.querySelectorAll("[data-catatan-skeleton]").forEach(node => node.remove());
      for (let index = 0; index < count; index += 1) grid.appendChild(skeletonCard(kind));
      grid.dataset.loading = "true";
    }, Math.max(0, Number(delay) || 0));

    return {
      finish() {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        grid.querySelectorAll("[data-catatan-skeleton]").forEach(node => node.remove());
        delete grid.dataset.loading;
      }
    };
  }

  async function enrichNotes(notes, { family = false } = {}) {
    const list = Array.isArray(notes) ? notes : [];
    const ids = list.map(note => clean(note?.id)).filter(Boolean);
    if (!ids.length || !window.NotesService) return list;

    const jobs = [
      Promise.resolve().then(() => NotesService.ambilTagMapCatatan(ids)),
      Promise.resolve().then(() => NotesService.ambilPreferensiCatatan(ids))
    ];
    if (family) jobs.push(Promise.resolve().then(() => NotesService.ambilHakLifecycleCatatan(ids)));
    const results = await Promise.allSettled(jobs);
    const tags = results[0]?.status === "fulfilled" ? (results[0].value || {}) : {};
    const preferences = results[1]?.status === "fulfilled" ? (results[1].value || {}) : {};
    const capabilities = family && results[2]?.status === "fulfilled" ? (results[2].value || {}) : {};

    list.forEach(note => {
      note._tags = tags[note.id] || note._tags || [];
      note._pinned = Boolean(preferences[note.id]?.pinned ?? note._pinned);
      if (family) note._canArchive = Boolean(capabilities[note.id]?.canArchive ?? note._canArchive);
    });
    if (window.CatatanManagement?.sortPinnedFirst) return CatatanManagement.sortPinnedFirst(list);
    // Home does not load CatatanManagement; keep backend recency order while
    // stably lifting pinned notes so the prefetched snapshot matches list pages.
    return [...list].sort((left, right) => Number(Boolean(right?._pinned)) - Number(Boolean(left?._pinned)));
  }

  async function prefetchCore({ userId, familyId } = {}) {
    userId = clean(userId);
    familyId = clean(familyId);
    if (!userId || !window.NotesService) return;

    const personalContext = { userId };
    const hasFreshPersonal = readEntry("personal-notes", personalContext, FRESH_PREFETCH_AGE)
      && readEntry("personal-folders", personalContext, FRESH_PREFETCH_AGE);

    if (!hasFreshPersonal) {
      Promise.all([
        NotesService.ambilCatatanPersonal(userId),
        NotesService.ambilFolderCatalog("personal", null)
      ]).then(async ([notes, folders]) => {
        const enriched = await enrichNotes(notes, { family: false });
        write("personal-notes", personalContext, enriched);
        write("personal-folders", personalContext, folders || []);
      }).catch(error => console.debug("[Catatan Prefetch Personal]", error?.message || error));
    }

    if (!familyId) return;
    const familyContext = { userId, familyId };
    const hasFreshFamily = readEntry("family-notes", familyContext, FRESH_PREFETCH_AGE)
      && readEntry("family-folders", familyContext, FRESH_PREFETCH_AGE);
    if (hasFreshFamily) return;

    Promise.all([
      NotesService.ambilCatatanKeluarga(familyId),
      NotesService.ambilFolderCatalog("family", familyId)
    ]).then(async ([notes, folders]) => {
      const enriched = await enrichNotes(notes, { family: true });
      write("family-notes", familyContext, enriched);
      write("family-folders", familyContext, folders || []);
    }).catch(error => console.debug("[Catatan Prefetch Family]", error?.message || error));
  }

  window.CatatanPerformance = Object.freeze({
    VERSION,
    DEFAULT_MAX_AGE,
    readEntry,
    read,
    write,
    remove,
    clearForUser,
    fingerprint,
    same,
    startSkeleton,
    prefetchCore
  });
})();
