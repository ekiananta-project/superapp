/* RuangKitha v2.0.0a50e — Documents Reminder + Calendar + Notification Integration V1 */
(() => {
  "use strict";

  const root = document.querySelector("[data-documents-root]");
  if (!root) return;

  const q = (selector) => document.querySelector(selector);
  const qa = (selector) => Array.from(document.querySelectorAll(selector));
  const Service = () => window.RuangKithaDocumentsService;
  const Trusted = () => window.RuangKithaTrustedDevice;

  const list = q("[data-doc-list]");
  const countLabel = q("[data-doc-count]");
  const message = q("[data-doc-message]");
  const addButton = q("[data-doc-add]");
  const vaultCopy = q("[data-doc-vault-copy]");
  const vaultAction = q("[data-doc-vault-action]");
  const vaultBadge = q("[data-doc-vault-badge]");
  const tabs = qa("[data-doc-view]");
  const archiveOpen = q("[data-doc-archive-open]");
  const searchInput = q("[data-doc-search]");
  const searchClear = q("[data-doc-search-clear]");
  const filterOpen = q("[data-doc-filter-open]");
  const filterCount = q("[data-doc-filter-count]");
  const activeFilters = q("[data-doc-active-filters]");
  const sortLabel = q("[data-doc-sort-label]");
  const filterLayer = q("[data-doc-filter-layer]");
  const filterForm = q("[data-doc-filter-form]");
  const filterClose = q("[data-doc-filter-close]");
  const filterReset = q("[data-doc-filter-reset]");
  const filterScopeSection = q("[data-doc-filter-scope-section]");

  const formLayer = q("[data-doc-form-layer]");
  const form = q("[data-doc-form]");
  const formClose = q("[data-doc-form-close]");
  const formTitle = q("[data-doc-form-title]");
  const formName = q("[data-doc-name]");
  const formType = q("[data-doc-type]");
  const typeTrigger = q("[data-doc-type-trigger]");
  const typeLabel = q("[data-doc-type-label]");
  const typeLayer = q("[data-doc-type-layer]");
  const typeClose = q("[data-doc-type-close]");
  const typeSearch = q("[data-doc-type-search]");
  const typeList = q("[data-doc-type-list]");
  const scopeFamily = q("[data-doc-scope-family]");
  const scopePrivate = q("[data-doc-scope-private]");
  const expiryToggle = q("[data-doc-expiry-toggle]");
  const expiryFields = q("[data-doc-expiry-fields]");
  const expiryInput = q("[data-doc-expiry]");
  const reminderInput = q("[data-doc-reminder]");
  const formPickFile = q("[data-doc-form-pick-file]");
  const formFile = q("[data-doc-form-file]");
  const formFileLabel = q("[data-doc-form-file-label]");
  const createShareSection = q("[data-doc-create-share]");
  const createShareList = q("[data-doc-create-share-list]");
  const createShareMessage = q("[data-doc-create-share-message]");
  const formMessage = q("[data-doc-form-message]");
  const saveButton = q("[data-doc-save]");

  const detailLayer = q("[data-doc-detail-layer]");
  const detailClose = q("[data-doc-detail-close]");
  const detailScope = q("[data-doc-detail-scope]");
  const detailTitle = q("[data-doc-detail-title]");
  const detailType = q("[data-doc-detail-type]");
  const detailExpiry = q("[data-doc-detail-expiry]");
  const detailReminder = q("[data-doc-detail-reminder]");
  const detailAttention = q("[data-doc-detail-attention]");
  const detailLifecycle = q("[data-doc-detail-lifecycle]");
  const detailUpdated = q("[data-doc-detail-updated]");
  const attachmentSummary = q("[data-doc-attachment-summary]");
  const attachmentBody = q("[data-doc-attachment-body]");
  const detailAddAttachment = q("[data-doc-detail-add-attachment]");
  const detailFile = q("[data-doc-detail-file]");
  const detailEdit = q("[data-doc-detail-edit]");
  const detailArchive = q("[data-doc-detail-archive]");
  const shareSection = q("[data-doc-share-section]");
  const shareSummary = q("[data-doc-share-summary]");
  const shareManage = q("[data-doc-share-manage]");
  const shareLayer = q("[data-doc-share-layer]");
  const shareClose = q("[data-doc-share-close]");
  const shareList = q("[data-doc-share-list]");
  const shareMessage = q("[data-doc-share-message]");

  const archiveLayer = q("[data-doc-archive-layer]");
  const archiveClose = q("[data-doc-archive-close]");
  const archiveList = q("[data-doc-archive-list]");
  const archiveMessage = q("[data-doc-archive-message]");

  const confirmLayer = q("[data-doc-confirm-layer]");
  const confirmClose = q("[data-doc-confirm-close]");
  const confirmTitle = q("[data-doc-confirm-title]");
  const confirmCopy = q("[data-doc-confirm-copy]");
  const confirmAction = q("[data-doc-confirm-action]");
  const confirmCancel = q("[data-doc-confirm-cancel]");

  const unlockLayer = q("[data-doc-unlock-layer]");
  const unlockForm = q("[data-doc-unlock-form]");
  const unlockClose = q("[data-doc-unlock-close]");
  const unlockPurpose = q("[data-doc-unlock-purpose]");
  const pinInput = q("[data-doc-pin]");
  const unlockMessage = q("[data-doc-unlock-message]");
  const unlockSubmit = q("[data-doc-unlock-submit]");

  let activeFamily = null;
  let currentView = "attention";
  let records = [];
  let currentRecord = null;
  let currentStatus = null;
  let formMode = "create";
  let editingId = null;
  let formAttachment = null;
  let createShareCandidates = [];
  let createShareSelected = new Set();
  let createShareLoadSeq = 0;
  let busy = false;
  let pendingUnlockAction = null;
  let pendingConfirmAction = null;
  let detailFileMode = { mode: "add", attachmentId: null };
  const discovery = {
    query: "",
    status: "all",
    attachment: "all",
    scope: "all",
    sort: "smart"
  };

  const DOCUMENT_TYPE_GROUPS = [
    { label: "Identitas", items: ["KTP", "Kartu Keluarga", "SIM", "Paspor"] },
    { label: "Kendaraan", items: ["STNK", "BPKB"] },
    { label: "Rumah & Properti", items: ["Sertifikat", "PBB"] },
    { label: "Pendidikan", items: ["Ijazah", "Sertifikat pendidikan"] },
    { label: "Kesehatan", items: ["Kartu kesehatan", "Dokumen kesehatan"] }
  ];
  const DOCUMENT_TYPES = DOCUMENT_TYPE_GROUPS.flatMap((group) => group.items);

  function ion(name) {
    const el = document.createElement("ion-icon");
    el.name = name;
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  function setMessage(text = "", isError = false) {
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle("is-error", Boolean(isError));
  }

  function setFormMessage(text = "") {
    formMessage.textContent = text;
    formMessage.hidden = !text;
  }

  function setShareMessage(text = "", isError = false) {
    shareMessage.textContent = text;
    shareMessage.hidden = !text;
    shareMessage.classList.toggle("is-error", Boolean(isError));
  }

  function setCreateShareMessage(text = "", isError = false) {
    createShareMessage.textContent = text;
    createShareMessage.hidden = !text;
    createShareMessage.classList.toggle("is-error", Boolean(isError));
  }

  function setArchiveMessage(text = "", isError = false) {
    archiveMessage.textContent = text;
    archiveMessage.hidden = !text;
    archiveMessage.classList.toggle("is-error", Boolean(isError));
  }

  function setVaultBadge(text, state = "") {
    vaultBadge.textContent = text;
    vaultAction.dataset.state = state;
    vaultAction.setAttribute("aria-label", `${text}. Buka Perangkat dan Sesi`);
  }

  function setState(iconName, titleText, copyText, action = null) {
    list.replaceChildren();
    const state = document.createElement("div");
    state.className = "dokumen-state";
    const iconWrap = document.createElement("span");
    iconWrap.appendChild(ion(iconName));
    const strong = document.createElement("strong");
    strong.textContent = titleText;
    const p = document.createElement("p");
    p.textContent = copyText;
    state.append(iconWrap, strong, p);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dokumen-state-action";
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
      state.appendChild(button);
    }
    list.appendChild(state);
  }

  function parseDateOnly(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  }

  function formatDate(value) {
    const parts = parseDateOnly(value);
    if (!parts) return "Tidak ada masa berlaku";
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" })
      .format(new Date(parts.y, parts.m - 1, parts.d));
  }

  function daysUntil(value) {
    const parts = parseDateOnly(value);
    if (!parts) return null;
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const target = Date.UTC(parts.y, parts.m - 1, parts.d);
    return Math.round((target - today) / 86400000);
  }

  function expiryPresentation(record) {
    if (!record?.expires_on) return { text: "Tidak ada masa berlaku", attention: false, expired: false, state: "no-expiry", label: "Tanpa masa berlaku" };
    const days = daysUntil(record.expires_on);
    const reminder = Number(record.reminder_days || 0);
    if (days === null) return { text: formatDate(record.expires_on), attention: false, expired: false, state: "valid", label: "Aktif" };
    if (days < 0) return { text: `Kedaluwarsa ${Math.abs(days)} hari lalu`, attention: true, expired: true, state: "expired", label: "Kedaluwarsa" };
    if (days === 0) return { text: "Berakhir hari ini", attention: true, expired: false, state: "today", label: "Berakhir hari ini" };
    if (reminder > 0 && days <= reminder) return { text: `Berakhir ${days} hari lagi`, attention: true, expired: false, state: "attention", label: "Perlu perhatian" };
    return { text: `Berlaku sampai ${formatDate(record.expires_on)}`, attention: false, expired: false, state: "valid", label: "Aktif" };
  }

  function formatUpdated(value) {
    if (!value) return "";
    try {
      return `Diperbarui ${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))}`;
    } catch {
      return "";
    }
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function iconForType(type) {
    const value = String(type || "").toLowerCase();
    if (value.includes("ktp") || value.includes("paspor") || value.includes("identitas")) return "id-card-outline";
    if (value.includes("sim")) return "card-outline";
    if (value.includes("stnk") || value.includes("bpkb") || value.includes("kendaraan")) return "car-outline";
    if (value.includes("rumah") || value.includes("pbb") || value.includes("sertifikat")) return "home-outline";
    if (value.includes("ijazah") || value.includes("pendidikan")) return "school-outline";
    if (value.includes("bpjs") || value.includes("kesehatan")) return "medkit-outline";
    return "document-text-outline";
  }

  function scopeLabel(record) {
    return record?.scope === "family" ? "Keluarga" : "Pribadi";
  }

  function syncTabs() {
    tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.docView === currentView));
  }

  function searchText(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
  }

  function lifecycleMatches(record, filterValue) {
    if (filterValue === "all") return true;
    const state = expiryPresentation(record).state;
    if (filterValue === "attention") return state === "attention" || state === "today";
    if (filterValue === "expired") return state === "expired";
    if (filterValue === "valid") return state === "valid";
    if (filterValue === "no-expiry") return state === "no-expiry";
    return true;
  }

  function attachmentMatches(record, filterValue) {
    const hasAttachment = Number(record?.attachment_count || 0) > 0;
    if (filterValue === "with") return hasAttachment;
    if (filterValue === "without") return !hasAttachment;
    return true;
  }

  function scopeMatches(record, filterValue) {
    if (currentView !== "attention" || filterValue === "all") return true;
    return record?.scope === filterValue;
  }

  function smartRank(record) {
    const state = expiryPresentation(record).state;
    return ({ expired: 0, today: 1, attention: 2, valid: 3, "no-expiry": 4 })[state] ?? 5;
  }

  function expiryTime(record) {
    const parts = parseDateOnly(record?.expires_on);
    return parts ? Date.UTC(parts.y, parts.m - 1, parts.d) : Number.POSITIVE_INFINITY;
  }

  function updatedTime(record) {
    const value = Date.parse(record?.updated_at || record?.created_at || "");
    return Number.isFinite(value) ? value : 0;
  }

  function sortRecords(items) {
    const output = items.slice();
    const byName = (a, b) => String(a?.display_name || "").localeCompare(String(b?.display_name || ""), "id-ID", { sensitivity: "base" });
    if (discovery.sort === "name") return output.sort(byName);
    if (discovery.sort === "updated") return output.sort((a, b) => updatedTime(b) - updatedTime(a) || byName(a, b));
    if (discovery.sort === "expiry") return output.sort((a, b) => expiryTime(a) - expiryTime(b) || updatedTime(b) - updatedTime(a) || byName(a, b));
    return output.sort((a, b) => smartRank(a) - smartRank(b) || expiryTime(a) - expiryTime(b) || updatedTime(b) - updatedTime(a) || byName(a, b));
  }

  function visibleRecords() {
    const query = searchText(discovery.query);
    const filtered = records.filter((record) => {
      if (query) {
        const haystack = searchText(`${record?.display_name || ""} ${record?.document_type || ""}`);
        if (!haystack.includes(query)) return false;
      }
      return lifecycleMatches(record, discovery.status)
        && attachmentMatches(record, discovery.attachment)
        && scopeMatches(record, discovery.scope);
    });
    return sortRecords(filtered);
  }

  function activeFilterCount() {
    let count = 0;
    if (discovery.status !== "all") count += 1;
    if (discovery.attachment !== "all") count += 1;
    if (currentView === "attention" && discovery.scope !== "all") count += 1;
    if (discovery.sort !== "smart") count += 1;
    return count;
  }

  function statusFilterLabel(value) {
    return ({ attention: "Perlu perhatian", expired: "Kedaluwarsa", valid: "Aktif", "no-expiry": "Tanpa masa berlaku" })[value] || "";
  }

  function attachmentFilterLabel(value) {
    return ({ with: "Ada lampiran", without: "Tanpa lampiran" })[value] || "";
  }

  function sortFilterLabel(value) {
    return ({ smart: "Urutan pintar", expiry: "Masa berlaku terdekat", updated: "Baru diperbarui", name: "Nama A–Z" })[value] || "Urutan pintar";
  }

  function makeActiveFilterChip(text, onClear) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "dokumen-active-filter-chip";
    const label = document.createElement("span");
    label.textContent = text;
    chip.append(label, ion("close-outline"));
    chip.addEventListener("click", onClear);
    return chip;
  }

  function renderDiscoveryState() {
    const count = activeFilterCount();
    filterCount.textContent = String(count);
    filterCount.hidden = count === 0;
    filterOpen.classList.toggle("is-active", count > 0);
    searchClear.hidden = !searchText(discovery.query);
    sortLabel.textContent = sortFilterLabel(discovery.sort);

    activeFilters.replaceChildren();
    const chips = [];
    if (discovery.status !== "all") chips.push(makeActiveFilterChip(statusFilterLabel(discovery.status), () => { discovery.status = "all"; renderRecords(); }));
    if (discovery.attachment !== "all") chips.push(makeActiveFilterChip(attachmentFilterLabel(discovery.attachment), () => { discovery.attachment = "all"; renderRecords(); }));
    if (currentView === "attention" && discovery.scope !== "all") chips.push(makeActiveFilterChip(discovery.scope === "family" ? "Keluarga" : "Pribadi", () => { discovery.scope = "all"; renderRecords(); }));
    if (discovery.sort !== "smart") chips.push(makeActiveFilterChip(sortFilterLabel(discovery.sort), () => { discovery.sort = "smart"; renderRecords(); }));
    chips.forEach((chip) => activeFilters.appendChild(chip));
    activeFilters.hidden = chips.length === 0;
  }

  function setRadioValue(name, value) {
    const field = filterForm.elements.namedItem(name);
    if (!field) return;
    const items = typeof field.length === "number" && !field.tagName ? Array.from(field) : [field];
    items.forEach((input) => { input.checked = input.value === value; });
  }

  function getRadioValue(name, fallback) {
    const input = filterForm.querySelector(`input[name="${name}"]:checked`);
    return input?.value || fallback;
  }

  function syncFilterForm() {
    setRadioValue("doc-filter-status", discovery.status);
    setRadioValue("doc-filter-attachment", discovery.attachment);
    setRadioValue("doc-filter-scope", currentView === "attention" ? discovery.scope : "all");
    setRadioValue("doc-filter-sort", discovery.sort);
    filterScopeSection.hidden = currentView !== "attention";
  }

  function openFilterSheet() {
    syncFilterForm();
    filterLayer.hidden = false;
  }

  function closeFilterSheet() {
    filterLayer.hidden = true;
  }

  function resetDiscovery({ clearSearch = true } = {}) {
    discovery.status = "all";
    discovery.attachment = "all";
    discovery.scope = "all";
    discovery.sort = "smart";
    if (clearSearch) {
      discovery.query = "";
      searchInput.value = "";
    }
    renderRecords();
  }

  async function refreshVaultStatus() {
    try {
      currentStatus = await Service().localStatus();
      if (!currentStatus?.ready) {
        setVaultBadge("Belum siap", "blocked");
        vaultCopy.textContent = "Catatan dokumen tetap bisa dipakai. Lampiran aman membutuhkan Trusted Device.";
        return currentStatus;
      }
      if (currentStatus.unlocked) {
        setVaultBadge("Terbuka", "open");
        vaultCopy.textContent = "Lampiran aman dapat diakses pada perangkat ini.";
      } else {
        setVaultBadge("Terkunci", "locked");
        vaultCopy.textContent = "Lampiran aman hanya dibuka saat diperlukan.";
      }
      return currentStatus;
    } catch (_) {
      currentStatus = null;
      setVaultBadge("Belum siap", "blocked");
      vaultCopy.textContent = "Catatan dokumen tetap tersedia; status lampiran aman belum dapat diperiksa.";
      return null;
    }
  }

  function renderRecords() {
    list.replaceChildren();
    renderDiscoveryState();

    if (!records.length) {
      countLabel.textContent = "Belum ada dokumen";
      const copy = currentView === "attention"
        ? "Belum ada dokumen yang perlu perhatian. RuangKitha akan menampilkannya ketika masa berlaku mendekat."
        : currentView === "family"
          ? "Catat dokumen penting keluarga agar masa berlakunya tidak terlewat. Lampiran tidak wajib."
          : "Catat dokumen pribadi yang ingin kamu jaga dan ingat masa berlakunya.";
      setState(
        currentView === "attention" ? "checkmark-circle-outline" : "folder-open-outline",
        currentView === "attention" ? "Semua masih aman" : "Belum ada dokumen",
        copy,
        currentView === "attention" ? null : { label: "Tambah dokumen", onClick: () => openForm() }
      );
      return;
    }

    const shown = visibleRecords();
    countLabel.textContent = shown.length === records.length
      ? `${records.length} dokumen`
      : `${shown.length} dari ${records.length} dokumen`;

    if (!shown.length) {
      setState(
        "search-outline",
        "Tidak ada yang cocok",
        "Coba ubah kata pencarian atau reset filter agar dokumen lain kembali terlihat.",
        { label: "Reset pencarian & filter", onClick: () => resetDiscovery({ clearSearch: true }) }
      );
      return;
    }

    shown.forEach((record) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "dokumen-card";
      card.addEventListener("click", () => openDetail(record));

      const iconWrap = document.createElement("span");
      iconWrap.className = "dokumen-card-icon";
      iconWrap.appendChild(ion(iconForType(record.document_type)));

      const copy = document.createElement("span");
      copy.className = "dokumen-card-copy";
      const title = document.createElement("span");
      title.className = "dokumen-card-title";
      title.textContent = record.display_name;
      const meta = document.createElement("span");
      meta.className = "dokumen-card-meta";
      meta.textContent = `${record.document_type} • ${scopeLabel(record)}`;
      const status = document.createElement("span");
      status.className = "dokumen-card-status";
      const expiry = expiryPresentation(record);
      card.dataset.lifecycle = expiry.state;
      status.textContent = record.expires_on ? expiry.text : formatUpdated(record.updated_at || record.created_at);
      if (expiry.attention) status.classList.add("is-attention");
      if (expiry.expired) status.classList.add("is-expired");
      copy.append(title, meta, status);

      const side = document.createElement("span");
      side.className = "dokumen-card-side";
      if (Number(record.attachment_count || 0) > 0) {
        const clip = document.createElement("span");
        clip.className = "dokumen-paperclip";
        clip.append(ion("attach-outline"));
        const clipCount = document.createElement("span");
        clipCount.textContent = String(record.attachment_count);
        clip.appendChild(clipCount);
        side.appendChild(clip);
      }
      const chevron = ion("chevron-forward-outline");
      chevron.classList.add("dokumen-card-chevron");
      side.appendChild(chevron);

      card.append(iconWrap, copy, side);
      list.appendChild(card);
    });
  }

  async function loadRecords() {
    root.setAttribute("aria-busy", "true");
    setMessage("");
    countLabel.textContent = "Memuat dokumen…";
    try {
      records = await Service().listRecords({ familyId: activeFamily?.id || null, view: currentView });
      renderRecords();
    } catch (error) {
      records = [];
      countLabel.textContent = "Gagal memuat";
      renderDiscoveryState();
      setState("alert-circle-outline", "Dokumen belum dapat dimuat", error?.message || "Terjadi kesalahan saat memuat dokumen.", { label: "Coba lagi", onClick: loadRecords });
    } finally {
      root.setAttribute("aria-busy", "false");
    }
  }

  async function switchView(view) {
    if (!['family', 'attention', 'personal'].includes(view)) return;
    currentView = view;
    discovery.scope = "all";
    syncTabs();
    closeFilterSheet();
    await loadRecords();
  }

  function normalizeTypeValue(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
  }

  function setTypeValue(value) {
    const clean = normalizeTypeValue(value);
    formType.value = clean;
    typeLabel.textContent = clean || "Pilih jenis dokumen";
    typeLabel.classList.toggle("is-placeholder", !clean);
  }

  function makeTypeButton(value) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dokumen-type-option";
    if (normalizeTypeValue(formType.value).toLocaleLowerCase("id-ID") === value.toLocaleLowerCase("id-ID")) {
      button.classList.add("is-selected");
    }
    const label = document.createElement("span");
    label.textContent = value;
    const marker = ion(button.classList.contains("is-selected") ? "checkmark-circle-outline" : "chevron-forward-outline");
    button.append(label, marker);
    button.addEventListener("click", () => {
      setTypeValue(value);
      closeTypePicker();
      typeTrigger.focus();
    });
    return button;
  }

  function renderTypePicker() {
    const query = normalizeTypeValue(typeSearch.value);
    const needle = query.toLocaleLowerCase("id-ID");
    typeList.replaceChildren();
    let visibleCount = 0;

    DOCUMENT_TYPE_GROUPS.forEach((group) => {
      const items = needle
        ? group.items.filter((item) => item.toLocaleLowerCase("id-ID").includes(needle))
        : group.items;
      if (!items.length) return;
      visibleCount += items.length;
      const section = document.createElement("section");
      section.className = "dokumen-type-group";
      const heading = document.createElement("h3");
      heading.className = "dokumen-type-group-title";
      heading.textContent = group.label;
      section.appendChild(heading);
      items.forEach((item) => section.appendChild(makeTypeButton(item)));
      typeList.appendChild(section);
    });

    const exactMatch = DOCUMENT_TYPES.some((item) => item.toLocaleLowerCase("id-ID") === needle);
    if (query && !exactMatch) {
      const custom = document.createElement("button");
      custom.type = "button";
      custom.className = "dokumen-type-custom";
      const label = document.createElement("span");
      label.textContent = `Gunakan “${query}”`;
      custom.append(label, ion("add-circle-outline"));
      custom.addEventListener("click", () => {
        setTypeValue(query);
        closeTypePicker();
        typeTrigger.focus();
      });
      typeList.appendChild(custom);
    } else if (!query) {
      const custom = document.createElement("button");
      custom.type = "button";
      custom.className = "dokumen-type-custom";
      const label = document.createElement("span");
      label.textContent = "Jenis lainnya…";
      custom.append(label, ion("create-outline"));
      custom.addEventListener("click", () => {
        typeSearch.focus();
        typeSearch.placeholder = "Tulis jenis dokumen...";
      });
      typeList.appendChild(custom);
    }

    if (!visibleCount && !query) {
      const empty = document.createElement("p");
      empty.className = "dokumen-type-empty";
      empty.textContent = "Belum ada jenis dokumen bawaan.";
      typeList.appendChild(empty);
    }
  }

  function openTypePicker() {
    typeSearch.value = "";
    typeSearch.placeholder = "Cari atau tulis jenis dokumen...";
    renderTypePicker();
    typeLayer.hidden = false;
    setTimeout(() => typeSearch.focus(), 70);
  }

  function closeTypePicker() {
    typeLayer.hidden = true;
    typeSearch.value = "";
  }

  function createShareReady(member) {
    return Number(member?.trusted_device_count || 0) > 0 && Boolean(member?.recovery_ready);
  }

  function createShareStatusText(member) {
    const deviceCount = Number(member?.trusted_device_count || 0);
    if (deviceCount < 1) return "Belum punya Trusted Device";
    if (!member?.recovery_ready) return "Recovery Kit belum siap";
    return `${deviceCount} Trusted Device siap`;
  }

  function renderCreateShareCandidates() {
    createShareList.replaceChildren();
    if (!createShareCandidates.length) {
      const empty = document.createElement("div");
      empty.className = "dokumen-share-empty";
      empty.appendChild(ion("people-outline"));
      const strong = document.createElement("strong");
      strong.textContent = "Belum ada anggota lain";
      const p = document.createElement("p");
      p.textContent = "Lampiran tetap bisa disimpan untukmu sendiri. Akses dapat diatur nanti dari detail dokumen.";
      empty.append(strong, p);
      createShareList.appendChild(empty);
      return;
    }

    createShareCandidates.forEach((member) => {
      const row = document.createElement("div");
      row.className = "dokumen-share-row";

      const avatar = document.createElement("span");
      avatar.className = "dokumen-share-avatar";
      avatar.appendChild(ion("person-outline"));

      const copy = document.createElement("div");
      copy.className = "dokumen-share-row-copy";
      const name = document.createElement("strong");
      name.textContent = member.display_name || "Anggota keluarga";
      const status = document.createElement("span");
      status.textContent = createShareStatusText(member);
      copy.append(name, status);

      const action = document.createElement("button");
      action.type = "button";
      action.className = "dokumen-share-toggle";
      const ready = createShareReady(member);
      const selected = createShareSelected.has(member.user_id);
      action.classList.toggle("is-selected", selected);
      action.textContent = ready ? (selected ? "Dipilih" : "Pilih") : "Belum siap";
      action.disabled = !ready;
      action.setAttribute("aria-pressed", selected ? "true" : "false");
      action.addEventListener("click", () => {
        if (!ready) return;
        if (createShareSelected.has(member.user_id)) createShareSelected.delete(member.user_id);
        else createShareSelected.add(member.user_id);
        renderCreateShareCandidates();
      });

      row.append(avatar, copy, action);
      createShareList.appendChild(row);
    });
  }

  async function loadCreateShareCandidates() {
    const seq = ++createShareLoadSeq;
    createShareList.replaceChildren(createAttachmentPlaceholder("hourglass-outline", "Memuat anggota keluarga", "RuangKitha sedang memeriksa Trusted Device yang siap menerima lampiran."));
    setCreateShareMessage("");
    try {
      const members = await Service().listShareCandidates(activeFamily?.id || null);
      if (seq !== createShareLoadSeq) return;
      createShareCandidates = members;
      renderCreateShareCandidates();
    } catch (error) {
      if (seq !== createShareLoadSeq) return;
      createShareCandidates = [];
      createShareList.replaceChildren(createAttachmentPlaceholder("alert-circle-outline", "Akses keluarga belum dapat dimuat", error?.message || "Dokumen tetap bisa disimpan. Atur akses lampiran nanti dari detail dokumen."));
      setCreateShareMessage("Dokumen tetap dapat disimpan tanpa memilih penerima sekarang.", true);
    }
  }

  function syncCreateShareVisibility() {
    const shouldShow = formMode === "create" && Boolean(formAttachment) && Boolean(scopeFamily.checked) && Boolean(activeFamily?.id);
    createShareSection.hidden = !shouldShow;
    if (!shouldShow) {
      createShareLoadSeq += 1;
      createShareCandidates = [];
      createShareSelected.clear();
      createShareList.replaceChildren();
      setCreateShareMessage("");
      return;
    }
    loadCreateShareCandidates();
  }

  function setExpiryVisibility(enabled) {
    expiryToggle.checked = Boolean(enabled);
    expiryFields.hidden = !enabled;
    expiryInput.required = Boolean(enabled);
    if (!enabled) {
      expiryInput.value = "";
      reminderInput.value = "30";
    }
  }

  function resetFormFile() {
    formAttachment = null;
    formFile.value = "";
    formFileLabel.textContent = "Tambahkan foto atau file";
    createShareLoadSeq += 1;
    createShareCandidates = [];
    createShareSelected.clear();
    createShareSection.hidden = true;
    createShareList.replaceChildren();
    setCreateShareMessage("");
  }

  function openForm(record = null) {
    setFormMessage("");
    resetFormFile();
    form.reset();
    editingId = record?.document_id || null;
    formMode = record ? "edit" : "create";
    formTitle.textContent = record ? "Edit Dokumen" : "Tambah Dokumen";
    saveButton.textContent = record ? "Simpan perubahan" : "Simpan";

    if (record) {
      formName.value = record.display_name || "";
      setTypeValue(record.document_type || "");
      scopeFamily.checked = record.scope === "family";
      scopePrivate.checked = record.scope !== "family";
      const hasExpiry = Boolean(record.expires_on);
      setExpiryVisibility(hasExpiry);
      if (hasExpiry) {
        expiryInput.value = record.expires_on;
        reminderInput.value = record.reminder_days == null ? "" : String(record.reminder_days);
      }
    } else {
      const preferPrivate = currentView === "personal";
      setTypeValue("");
      scopePrivate.checked = preferPrivate;
      scopeFamily.checked = !preferPrivate;
      setExpiryVisibility(false);
    }

    formLayer.hidden = false;
    setTimeout(() => formName.focus(), 70);
  }

  function closeForm() {
    closeTypePicker();
    formLayer.hidden = true;
    setFormMessage("");
    resetFormFile();
    editingId = null;
    formMode = "create";
  }

  function openUnlock(purpose, action) {
    pendingUnlockAction = action;
    unlockPurpose.textContent = purpose || "Lampiran dokumen dilindungi Security Vault.";
    unlockMessage.hidden = true;
    unlockMessage.textContent = "";
    pinInput.value = "";
    unlockLayer.hidden = false;
    setTimeout(() => pinInput.focus(), 70);
  }

  function closeUnlock({ cancelAction = true } = {}) {
    unlockLayer.hidden = true;
    pinInput.value = "";
    unlockMessage.hidden = true;
    if (cancelAction) pendingUnlockAction = null;
  }

  function openConfirm({ title, copy, actionLabel = "Lanjutkan", danger = false, onConfirm }) {
    pendingConfirmAction = typeof onConfirm === "function" ? onConfirm : null;
    confirmTitle.textContent = title || "Konfirmasi";
    confirmCopy.textContent = copy || "Pastikan tindakan ini memang kamu inginkan.";
    confirmAction.textContent = actionLabel;
    confirmAction.classList.toggle("is-danger", Boolean(danger));
    confirmLayer.hidden = false;
  }

  function closeConfirm({ cancelAction = true } = {}) {
    confirmLayer.hidden = true;
    confirmAction.classList.remove("is-danger");
    if (cancelAction) pendingConfirmAction = null;
  }

  async function runWithVault(action, purpose) {
    let status;
    try {
      status = await Service().localStatus();
    } catch (error) {
      setMessage(error?.message || "Security Vault belum siap untuk lampiran.", true);
      return;
    }
    currentStatus = status;
    if (!status?.ready) {
      setMessage("Catatan dokumen sudah bisa digunakan, tetapi lampiran aman memerlukan Trusted Device. Atur lewat Perangkat & Sesi.", true);
      return;
    }
    if (status.unlocked) {
      return action();
    }
    openUnlock(purpose, action);
  }

  function closeDetail() {
    detailLayer.hidden = true;
    currentRecord = null;
    attachmentBody.replaceChildren();
    detailFile.value = "";
    detailFileMode = { mode: "add", attachmentId: null };
  }

  function createAttachmentPlaceholder(iconName, titleText, copyText, buttonText = null, onClick = null) {
    const wrap = document.createElement("div");
    wrap.className = "dokumen-attachment-placeholder";
    wrap.appendChild(ion(iconName));
    const strong = document.createElement("strong");
    strong.textContent = titleText;
    const p = document.createElement("p");
    p.textContent = copyText;
    wrap.append(strong, p);
    if (buttonText && onClick) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = buttonText;
      button.addEventListener("click", onClick);
      wrap.appendChild(button);
    }
    return wrap;
  }

  function renderAttachmentLockedState(record) {
    attachmentBody.replaceChildren();
    const count = Number(record?.attachment_count || 0);
    const accessible = Number(record?.attachment_accessible_count || 0);
    attachmentSummary.textContent = count ? `${count} lampiran aman` : "Opsional";
    detailAddAttachment.hidden = !record?.can_edit;

    if (!count) {
      attachmentBody.appendChild(createAttachmentPlaceholder(
        "attach-outline",
        "Belum ada lampiran",
        "Dokumen ini tetap lengkap tanpa foto atau file. Tambahkan salinan hanya jika kamu membutuhkannya.",
        record?.can_edit ? "Tambahkan lampiran" : null,
        record?.can_edit ? () => detailFile.click() : null
      ));
      return;
    }

    if (accessible < 1) {
      if (!record?.can_edit && record?.attachment_share_granted) {
        attachmentBody.appendChild(createAttachmentPlaceholder(
          "key-outline",
          "Akses lampiran tersedia",
          "Pemilik sudah membagikan kunci lampiran. Buka Security Vault untuk mengaktifkan akses aman di akunmu.",
          "Buka lampiran",
          () => runWithVault(() => loadReadableAttachments(record), "Masukkan PIN untuk menerima kunci dan membuka lampiran dokumen ini.")
        ));
      } else if (!record?.can_edit) {
        attachmentBody.appendChild(createAttachmentPlaceholder(
          "lock-closed-outline",
          "Lampiran belum dibagikan",
          "Metadata dokumen keluarga dapat kamu lihat, tetapi lampiran aman hanya terbuka setelah pemilik memberikan akses."
        ));
      } else {
        attachmentBody.appendChild(createAttachmentPlaceholder(
          "lock-closed-outline",
          "Lampiran aman tersedia",
          "Buka Security Vault untuk melihat lampiran milikmu."
        ));
      }
      return;
    }

    attachmentBody.appendChild(createAttachmentPlaceholder(
      "lock-closed-outline",
      `${count} lampiran terlindungi`,
      "Nama file dan isi lampiran baru didekripsi di perangkat setelah Security Vault dibuka.",
      "Lihat lampiran",
      () => runWithVault(() => loadReadableAttachments(record), "Masukkan PIN untuk melihat lampiran dokumen ini.")
    ));
  }

  async function loadReadableAttachments(record) {
    if (!currentRecord || currentRecord.document_id !== record.document_id) return;
    attachmentBody.replaceChildren(createAttachmentPlaceholder("hourglass-outline", "Membuka lampiran", "Metadata lampiran sedang didekripsi di perangkat ini."));
    try {
      const attachments = await Service().listReadableAttachments(record.document_id, { familyId: activeFamily?.id || null });
      attachmentBody.replaceChildren();
      if (!attachments.length) {
        renderAttachmentLockedState(record);
        return;
      }
      attachments.forEach((attachment) => {
        const row = document.createElement("div");
        row.className = "dokumen-attachment-row";
        row.appendChild(ion(attachment.metadata?.mime_type?.startsWith("image/") ? "image-outline" : "document-outline"));

        const copy = document.createElement("div");
        copy.className = "dokumen-attachment-row-copy";
        const title = document.createElement("strong");
        title.textContent = attachment.metadata?.name || "Lampiran terenkripsi";
        const meta = document.createElement("span");
        meta.textContent = attachment.metadata
          ? `${formatBytes(attachment.metadata.size)} • terlindungi`
          : "Metadata gagal didekripsi";
        copy.append(title, meta);

        const actions = document.createElement("div");
        actions.className = "dokumen-attachment-actions";

        const download = document.createElement("button");
        download.type = "button";
        download.setAttribute("aria-label", `Unduh ${attachment.metadata?.name || "lampiran"}`);
        download.title = "Unduh";
        download.appendChild(ion("download-outline"));
        download.disabled = !attachment.metadata;
        download.addEventListener("click", () => runWithVault(async () => {
          busy = true;
          download.disabled = true;
          setMessage("Mendekripsi lampiran di perangkat…");
          try {
            const result = await Service().downloadAttachmentToBrowser(attachment.attachment_id);
            setMessage(`Lampiran “${result.name}” berhasil diunduh.`);
          } catch (error) {
            setMessage(error?.message || "Lampiran gagal diunduh.", true);
          } finally {
            busy = false;
            download.disabled = false;
          }
        }, "Masukkan PIN untuk mengunduh lampiran ini."));
        actions.appendChild(download);

        if (record.can_edit) {
          const replace = document.createElement("button");
          replace.type = "button";
          replace.className = "is-secondary";
          replace.setAttribute("aria-label", `Ganti ${attachment.metadata?.name || "lampiran"}`);
          replace.title = "Ganti lampiran";
          replace.appendChild(ion("swap-horizontal-outline"));
          replace.addEventListener("click", () => {
            detailFileMode = { mode: "replace", attachmentId: attachment.attachment_id };
            detailFile.click();
          });

          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "is-danger";
          remove.setAttribute("aria-label", `Hapus ${attachment.metadata?.name || "lampiran"}`);
          remove.title = "Hapus lampiran";
          remove.appendChild(ion("trash-outline"));
          remove.addEventListener("click", () => {
            const attachmentName = attachment.metadata?.name || "lampiran ini";
            openConfirm({
              title: "Hapus lampiran?",
              copy: `“${attachmentName}” akan dihapus dari penyimpanan terenkripsi. Catatan dokumennya tetap ada.`,
              actionLabel: "Hapus lampiran",
              danger: true,
              onConfirm: () => runWithVault(async () => {
                busy = true;
                setMessage("Menghapus ciphertext lampiran…");
                try {
                  await Service().deleteAttachment(attachment.attachment_id);
                  setMessage("Lampiran berhasil dihapus. Catatan dokumen tetap tersimpan.");
                  const fresh = await refreshCurrentRecord();
                  const status = await refreshVaultStatus();
                  if (fresh && status?.unlocked) await loadReadableAttachments(fresh);
                  await loadRecords();
                } catch (error) {
                  setMessage(error?.message || "Lampiran gagal dihapus.", true);
                } finally {
                  busy = false;
                }
              }, "Masukkan PIN untuk menghapus lampiran terenkripsi ini.")
            });
          });
          actions.append(replace, remove);
        }

        row.append(copy, actions);
        attachmentBody.appendChild(row);
      });
      await refreshVaultStatus();
    } catch (error) {
      setMessage(error?.message || "Lampiran gagal dibuka.", true);
      renderAttachmentLockedState(record);
      await refreshVaultStatus();
    }
  }

  function updateShareSection(record) {
    const isFamily = record?.scope === "family";
    shareSection.hidden = !isFamily;
    if (!isFamily) return;

    const ownerCanManage = Boolean(record?.can_manage_sharing ?? (record?.can_edit && isFamily));
    shareManage.hidden = !ownerCanManage;
    if (ownerCanManage) {
      shareSummary.textContent = "Pilih anggota yang boleh membuka lampiran aman. Metadata keluarga tetap terlihat oleh semua anggota aktif.";
    } else if (record?.attachment_share_granted) {
      shareSummary.textContent = "Pemilik sudah memberikan akses lampiran aman ke akunmu.";
    } else {
      shareSummary.textContent = "Metadata keluarga terlihat, tetapi lampiran aman belum dibagikan ke akunmu.";
    }
  }

  function closeShareManager() {
    shareLayer.hidden = true;
    shareList.replaceChildren();
    setShareMessage("");
  }

  function shareStatusText(member) {
    const deviceCount = Number(member.trusted_device_count || 0);
    const acceptedCount = Number(member.accepted_attachment_count || 0);
    const pendingCount = Number(member.pending_transfer_count || 0);
    if (member.share_active && acceptedCount > 0) return "Dapat melihat lampiran";
    if (member.share_active && pendingCount > 0) return "Dibagikan · menunggu dibuka";
    if (member.share_active && (deviceCount < 1 || !member.recovery_ready)) return "Dibagikan · perangkat belum siap";
    if (member.share_active) return "Dibagikan";
    if (deviceCount < 1) return "Belum punya Trusted Device";
    if (!member.recovery_ready) return "Recovery Kit belum siap";
    return `${deviceCount} Trusted Device siap`;
  }

  function renderShareTargets(members) {
    shareList.replaceChildren();
    if (!members.length) {
      const empty = document.createElement("div");
      empty.className = "dokumen-share-empty";
      empty.appendChild(ion("people-outline"));
      const strong = document.createElement("strong");
      strong.textContent = "Belum ada anggota lain";
      const p = document.createElement("p");
      p.textContent = "Saat ada anggota aktif lain di keluarga, akses lampiran dapat dibagikan dari sini.";
      empty.append(strong, p);
      shareList.appendChild(empty);
      return;
    }

    members.forEach((member) => {
      const row = document.createElement("div");
      row.className = "dokumen-share-row";

      const avatar = document.createElement("span");
      avatar.className = "dokumen-share-avatar";
      avatar.appendChild(ion("person-outline"));

      const copy = document.createElement("div");
      copy.className = "dokumen-share-row-copy";
      const name = document.createElement("strong");
      name.textContent = member.display_name || "Anggota keluarga";
      const status = document.createElement("span");
      status.textContent = shareStatusText(member);
      copy.append(name, status);

      const action = document.createElement("button");
      action.type = "button";
      action.className = "dokumen-share-toggle";
      action.classList.toggle("is-active", Boolean(member.share_active));
      const ready = Number(member.trusted_device_count || 0) > 0 && Boolean(member.recovery_ready);
      const canAct = Boolean(member.share_active) || ready;
      action.textContent = member.share_active ? "Cabut" : (ready ? "Bagikan" : "Belum siap");
      action.disabled = !canAct;

      action.addEventListener("click", async () => {
        if (!currentRecord || busy || !canAct) return;
        const documentId = currentRecord.document_id;
        await runWithVault(async () => {
          busy = true;
          action.disabled = true;
          setShareMessage(member.share_active ? "Mencabut akses lampiran…" : `Menyiapkan kunci aman untuk ${member.display_name || "anggota keluarga"}…`);
          try {
            if (member.share_active) {
              await Service().revokeMemberShare(documentId, member.user_id);
              setShareMessage("Akses lampiran berhasil dicabut.");
            } else {
              await Service().shareWithMember(documentId, member.user_id, {
                onStage: (stage) => {
                  const copyByStage = {
                    planning: "Memeriksa Trusted Device penerima…",
                    wrapping: "Mendistribusikan Attachment Key secara terenkripsi…",
                    committing: "Menyimpan key transfer aman…",
                    done: "Akses lampiran berhasil dibagikan."
                  };
                  setShareMessage(copyByStage[stage] || "Memproses akses lampiran…");
                }
              });
              setShareMessage("Akses lampiran berhasil dibagikan.");
            }
            await refreshShareTargets();
            await refreshCurrentRecord();
          } catch (error) {
            setShareMessage(error?.message || "Akses lampiran gagal diperbarui.", true);
          } finally {
            busy = false;
          }
        }, member.share_active
          ? "Masukkan PIN untuk mencabut akses lampiran keluarga ini."
          : "Masukkan PIN untuk membagikan Attachment Key secara aman.");
      });

      row.append(avatar, copy, action);
      shareList.appendChild(row);
    });
  }

  async function refreshShareTargets() {
    if (!currentRecord || !(currentRecord.can_manage_sharing ?? (currentRecord.can_edit && currentRecord.scope === "family"))) return;
    shareList.replaceChildren(createAttachmentPlaceholder("hourglass-outline", "Memuat akses keluarga", "RuangKitha sedang memeriksa anggota dan Trusted Device yang siap."));
    try {
      const members = await Service().listShareTargets(currentRecord.document_id);
      renderShareTargets(members);
    } catch (error) {
      shareList.replaceChildren(createAttachmentPlaceholder("alert-circle-outline", "Akses belum dapat dimuat", error?.message || "Coba lagi beberapa saat."));
    }
  }

  async function openShareManager() {
    if (!currentRecord || !(currentRecord.can_manage_sharing ?? (currentRecord.can_edit && currentRecord.scope === "family"))) return;
    setShareMessage("");
    shareLayer.hidden = false;
    await refreshShareTargets();
  }

  function closeArchiveManager() {
    archiveLayer.hidden = true;
    archiveList.replaceChildren();
    setArchiveMessage("");
  }

  function archivedAtLabel(record) {
    if (!record?.archived_at) return "Diarsipkan";
    try {
      return `Diarsipkan ${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(record.archived_at))}`;
    } catch {
      return "Diarsipkan";
    }
  }

  function renderArchiveRecords(items) {
    archiveList.replaceChildren();
    if (!items.length) {
      archiveList.appendChild(createAttachmentPlaceholder(
        "archive-outline",
        "Arsip masih kosong",
        "Dokumen yang kamu arsipkan akan muncul di sini."
      ));
      return;
    }

    items.forEach((record) => {
      const row = document.createElement("article");
      row.className = "dokumen-archive-row";

      const iconWrap = document.createElement("span");
      iconWrap.className = "dokumen-archive-icon";
      iconWrap.appendChild(ion(iconForType(record.document_type)));

      const copy = document.createElement("div");
      copy.className = "dokumen-archive-copy";
      const title = document.createElement("strong");
      title.textContent = record.display_name || "Dokumen";
      const meta = document.createElement("span");
      const attachmentCount = Number(record.attachment_count || 0);
      meta.textContent = `${record.document_type || "Lainnya"} • ${scopeLabel(record)}${attachmentCount ? ` • ${attachmentCount} lampiran` : ""}`;
      const archived = document.createElement("small");
      archived.textContent = archivedAtLabel(record);
      copy.append(title, meta, archived);

      const actions = document.createElement("div");
      actions.className = "dokumen-archive-actions";
      const restore = document.createElement("button");
      restore.type = "button";
      restore.className = "is-restore";
      restore.textContent = "Pulihkan";
      restore.addEventListener("click", async () => {
        if (busy) return;
        busy = true;
        restore.disabled = true;
        setArchiveMessage("Memulihkan dokumen…");
        try {
          await Service().restoreRecord(record.document_id, { familyId: activeFamily?.id || null });
          setArchiveMessage("Dokumen dipulihkan. Akses lampiran keluarga yang pernah dicabut tidak aktif kembali otomatis.");
          await loadArchiveRecords();
          await loadRecords();
        } catch (error) {
          setArchiveMessage(error?.message || "Dokumen gagal dipulihkan.", true);
        } finally {
          busy = false;
          restore.disabled = false;
        }
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "is-delete";
      remove.textContent = "Hapus";
      remove.addEventListener("click", () => {
        const attachmentCount = Number(record.attachment_count || 0);
        openConfirm({
          title: "Hapus permanen?",
          copy: attachmentCount
            ? `“${record.display_name}” dan ${attachmentCount} lampiran terenkripsinya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
            : `“${record.display_name}” akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
          actionLabel: "Hapus permanen",
          danger: true,
          onConfirm: async () => {
            const executeDelete = async () => {
              busy = true;
              setArchiveMessage(attachmentCount ? "Menghapus ciphertext dan dokumen…" : "Menghapus dokumen…");
              try {
                await Service().deleteArchivedRecord(record.document_id, { hasAttachments: attachmentCount > 0 });
                setArchiveMessage("Dokumen berhasil dihapus permanen.");
                await loadArchiveRecords();
                await loadRecords();
                await refreshVaultStatus();
              } catch (error) {
                setArchiveMessage(error?.message || "Dokumen gagal dihapus permanen.", true);
              } finally {
                busy = false;
              }
            };
            if (attachmentCount > 0) {
              return runWithVault(executeDelete, "Masukkan PIN untuk menghapus lampiran terenkripsi secara permanen.");
            }
            return executeDelete();
          }
        });
      });
      actions.append(restore, remove);
      row.append(iconWrap, copy, actions);
      archiveList.appendChild(row);
    });
  }

  async function loadArchiveRecords() {
    archiveList.replaceChildren(createAttachmentPlaceholder("hourglass-outline", "Memuat arsip", "RuangKitha sedang menyiapkan dokumen yang pernah diarsipkan."));
    try {
      const items = await Service().listArchivedRecords({ familyId: activeFamily?.id || null });
      renderArchiveRecords(items);
    } catch (error) {
      archiveList.replaceChildren(createAttachmentPlaceholder("alert-circle-outline", "Arsip belum dapat dimuat", error?.message || "Coba lagi beberapa saat."));
    }
  }

  async function openArchiveManager() {
    setArchiveMessage("");
    archiveLayer.hidden = false;
    await loadArchiveRecords();
  }

  function openDetail(record) {
    currentRecord = record;
    detailScope.textContent = scopeLabel(record);
    detailTitle.textContent = record.display_name;
    detailType.textContent = record.document_type || "Lainnya";
    detailExpiry.textContent = formatDate(record.expires_on);
    detailReminder.textContent = record.expires_on
      ? (record.reminder_days ? `${record.reminder_days} hari sebelumnya` : "Tanpa pengingat")
      : "Tidak diperlukan";

    const expiry = expiryPresentation(record);
    detailLifecycle.textContent = expiry.label;
    detailLifecycle.dataset.state = expiry.state;
    detailUpdated.textContent = formatUpdated(record.updated_at || record.created_at) || "Tersimpan di RuangKitha";
    detailAttention.hidden = !expiry.attention;
    detailAttention.classList.toggle("is-expired", expiry.expired);
    detailAttention.textContent = expiry.attention ? expiry.text : "";
    detailEdit.hidden = !record.can_edit;
    detailArchive.hidden = !record.can_edit;
    updateShareSection(record);
    renderAttachmentLockedState(record);
    detailLayer.hidden = false;
  }

  async function openDeepLinkedDocument() {
    const documentId = new URLSearchParams(location.search).get("document");
    if (!documentId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) return false;
    try {
      const record = await Service().getRecord(documentId, { familyId: activeFamily?.id || null });
      openDetail(record);
      return true;
    } catch (error) {
      console.debug?.("[Documents deep link]", error);
      return false;
    }
  }

  async function refreshCurrentRecord() {
    if (!currentRecord) return null;
    try {
      const fresh = await Service().getRecord(currentRecord.document_id, { familyId: activeFamily?.id || null });
      currentRecord = fresh;
      openDetail(fresh);
      return fresh;
    } catch {
      closeDetail();
      return null;
    }
  }

  async function uploadToRecord(recordId, file) {
    if (!file) return;
    const stageCopy = {
      encrypting: "Mengenkripsi lampiran di perangkat…",
      preparing: "Menyiapkan record lampiran aman…",
      uploading: "Mengunggah ciphertext…",
      committing: "Memverifikasi lampiran terenkripsi…",
      sharing: "Menyinkronkan akses lampiran keluarga…",
      done: "Lampiran aman berhasil disimpan."
    };
    setMessage("Menyiapkan lampiran aman…");
    try {
      const uploaded = await Service().uploadAttachment(recordId, file, {
        familyId: activeFamily?.id || null,
        onStage: (stage) => setMessage(stageCopy[stage] || "Memproses lampiran…")
      });
      setMessage(uploaded?.shareSyncWarning
        ? `Lampiran tersimpan aman. ${uploaded.shareSyncWarning}`
        : "Lampiran berhasil disimpan secara terenkripsi.", Boolean(uploaded?.shareSyncWarning));
      await loadRecords();
      if (currentRecord?.document_id === recordId) await refreshCurrentRecord();
      await refreshVaultStatus();
      return uploaded;
    } catch (error) {
      setMessage(error?.message || "Dokumen sudah tersimpan, tetapi lampiran gagal ditambahkan.", true);
      await refreshVaultStatus();
      return null;
    }
  }

  async function shareSelectedMembersAfterCreate(documentId, userIds) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    if (!ids.length) return { shared: 0, failed: [] };
    let shared = 0;
    const failed = [];
    for (let index = 0; index < ids.length; index += 1) {
      const userId = ids[index];
      setMessage(`Membagikan lampiran ke anggota keluarga ${index + 1} dari ${ids.length}…`);
      try {
        await Service().shareWithMember(documentId, userId);
        shared += 1;
      } catch (error) {
        failed.push({ userId, message: error?.message || "Gagal membagikan lampiran." });
      }
    }
    return { shared, failed };
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.docView)));
  addButton.addEventListener("click", () => openForm());
  searchInput.addEventListener("input", () => {
    discovery.query = searchInput.value;
    renderRecords();
  });
  searchClear.addEventListener("click", () => {
    discovery.query = "";
    searchInput.value = "";
    searchInput.focus();
    renderRecords();
  });
  filterOpen.addEventListener("click", openFilterSheet);
  filterClose.addEventListener("click", closeFilterSheet);
  filterLayer.addEventListener("click", (event) => { if (event.target === filterLayer) closeFilterSheet(); });
  filterReset.addEventListener("click", () => {
    discovery.status = "all";
    discovery.attachment = "all";
    discovery.scope = "all";
    discovery.sort = "smart";
    syncFilterForm();
  });
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    discovery.status = getRadioValue("doc-filter-status", "all");
    discovery.attachment = getRadioValue("doc-filter-attachment", "all");
    discovery.scope = currentView === "attention" ? getRadioValue("doc-filter-scope", "all") : "all";
    discovery.sort = getRadioValue("doc-filter-sort", "smart");
    closeFilterSheet();
    renderRecords();
  });

  archiveOpen.addEventListener("click", openArchiveManager);

  typeTrigger.addEventListener("click", openTypePicker);
  typeClose.addEventListener("click", closeTypePicker);
  typeLayer.addEventListener("click", (event) => { if (event.target === typeLayer) closeTypePicker(); });
  typeSearch.addEventListener("input", renderTypePicker);
  typeSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = normalizeTypeValue(typeSearch.value);
    if (!value) return;
    const canonical = DOCUMENT_TYPES.find((item) => item.toLocaleLowerCase("id-ID") === value.toLocaleLowerCase("id-ID"));
    setTypeValue(canonical || value);
    closeTypePicker();
    typeTrigger.focus();
  });

  expiryToggle.addEventListener("change", () => setExpiryVisibility(expiryToggle.checked));
  formPickFile.addEventListener("click", () => formFile.click());
  formFile.addEventListener("change", () => {
    formAttachment = formFile.files?.[0] || null;
    formFileLabel.textContent = formAttachment ? formAttachment.name : "Tambahkan foto atau file";
    syncCreateShareVisibility();
  });
  scopeFamily.addEventListener("change", syncCreateShareVisibility);
  scopePrivate.addEventListener("change", syncCreateShareVisibility);

  formClose.addEventListener("click", closeForm);
  formLayer.addEventListener("click", (event) => { if (event.target === formLayer && !busy) closeForm(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const scope = scopeFamily.checked ? "family" : "private";
    const documentType = normalizeTypeValue(formType.value);
    if (!documentType) {
      setFormMessage("Pilih atau tulis jenis dokumen.");
      openTypePicker();
      return;
    }
    if (scope === "family" && !activeFamily?.id) {
      setFormMessage("Keluarga aktif belum tersedia.");
      return;
    }
    const expiresOn = expiryToggle.checked ? expiryInput.value : null;
    if (expiryToggle.checked && !expiresOn) {
      setFormMessage("Pilih tanggal masa berlaku atau matikan opsi tanggal berakhir.");
      return;
    }

    const selectedFile = formAttachment;
    const selectedShareUserIds = formMode === "create" && scope === "family" && selectedFile
      ? Array.from(createShareSelected)
      : [];
    const wasCreate = formMode === "create";
    busy = true;
    saveButton.disabled = true;
    saveButton.textContent = "Menyimpan…";
    setFormMessage("");
    try {
      const payload = {
        familyId: scope === "family" ? activeFamily.id : null,
        scope,
        displayName: formName.value,
        documentType,
        expiresOn,
        reminderDays: expiresOn ? (reminderInput.value || null) : null
      };
      const saved = wasCreate
        ? await Service().createRecord(payload)
        : await Service().updateRecord(editingId, payload);

      closeForm();
      if (wasCreate) {
        currentView = scope === "family" ? "family" : "personal";
        discovery.query = "";
        discovery.status = "all";
        discovery.attachment = "all";
        discovery.scope = "all";
        discovery.sort = "smart";
        searchInput.value = "";
      }
      syncTabs();
      await loadRecords();
      setMessage(selectedFile
        ? "Dokumen tersimpan. Lampiran akan disimpan secara aman setelah Security Vault dibuka."
        : "Dokumen berhasil disimpan. Lampiran tidak wajib.");

      if (selectedFile) {
        await runWithVault(
          async () => {
            const uploaded = await uploadToRecord(saved.document_id, selectedFile);
            if (!uploaded) return;
            if (selectedShareUserIds.length) {
              const result = await shareSelectedMembersAfterCreate(saved.document_id, selectedShareUserIds);
              if (result.failed.length) {
                setMessage(`Lampiran aman tersimpan. ${result.shared} anggota berhasil diberi akses, ${result.failed.length} perlu dicoba lagi dari Kelola akses lampiran.`, true);
              } else {
                setMessage(`Lampiran aman tersimpan dan dibagikan ke ${result.shared} anggota keluarga.`);
              }
              await loadRecords();
            }
          },
          selectedShareUserIds.length
            ? "Masukkan PIN sekali untuk mengenkripsi lampiran dan membagikannya kepada anggota yang dipilih."
            : "Masukkan PIN untuk mengenkripsi dan menyimpan lampiran pilihanmu."
        );
      }
    } catch (error) {
      setFormMessage(error?.message || "Dokumen gagal disimpan.");
    } finally {
      busy = false;
      saveButton.disabled = false;
      saveButton.textContent = formMode === "edit" ? "Simpan perubahan" : "Simpan";
    }
  });

  detailClose.addEventListener("click", closeDetail);
  detailLayer.addEventListener("click", (event) => { if (event.target === detailLayer && !busy) closeDetail(); });
  detailEdit.addEventListener("click", () => {
    if (!currentRecord?.can_edit) return;
    const record = currentRecord;
    closeDetail();
    openForm(record);
  });
  detailArchive.addEventListener("click", () => {
    if (!currentRecord?.can_edit) return;
    const record = currentRecord;
    openConfirm({
      title: "Arsipkan dokumen?",
      copy: `“${record.display_name}” akan disembunyikan dari tab aktif dan Perlu Perhatian. Lampiran tetap tersimpan aman dan dokumen dapat dipulihkan dari Arsip.`,
      actionLabel: "Arsipkan",
      onConfirm: async () => {
        if (busy) return;
        busy = true;
        setMessage("Mengarsipkan dokumen…");
        try {
          await Service().archiveRecord(record.document_id);
          closeDetail();
          await loadRecords();
          setMessage("Dokumen berhasil diarsipkan. Akses lampiran keluarga aktif telah dicabut.");
        } catch (error) {
          setMessage(error?.message || "Dokumen gagal diarsipkan.", true);
        } finally {
          busy = false;
        }
      }
    });
  });
  shareManage.addEventListener("click", openShareManager);
  shareClose.addEventListener("click", closeShareManager);
  shareLayer.addEventListener("click", (event) => { if (event.target === shareLayer && !busy) closeShareManager(); });

  detailAddAttachment.addEventListener("click", () => {
    detailFileMode = { mode: "add", attachmentId: null };
    detailFile.click();
  });
  detailFile.addEventListener("change", async () => {
    const file = detailFile.files?.[0] || null;
    detailFile.value = "";
    if (!file || !currentRecord) {
      detailFileMode = { mode: "add", attachmentId: null };
      return;
    }
    const recordId = currentRecord.document_id;
    const mode = detailFileMode;
    detailFileMode = { mode: "add", attachmentId: null };

    if (mode.mode === "replace" && mode.attachmentId) {
      await runWithVault(async () => {
        busy = true;
        setMessage("Mengganti lampiran secara aman…");
        const stageCopy = {
          encrypting: "Mengenkripsi lampiran baru di perangkat…",
          preparing: "Menyiapkan lampiran pengganti…",
          uploading: "Mengunggah ciphertext baru…",
          committing: "Memverifikasi lampiran baru…",
          sharing: "Menyinkronkan akses keluarga…",
          "removing-old": "Menghapus ciphertext lampiran lama…",
          done: "Lampiran berhasil diganti."
        };
        try {
          const result = await Service().replaceAttachment(recordId, mode.attachmentId, file, {
            familyId: activeFamily?.id || null,
            onStage: (stage) => setMessage(stageCopy[stage] || "Memproses lampiran pengganti…")
          });
          setMessage(result?.replaceWarning
            ? `Lampiran baru tersimpan. ${result.replaceWarning}`
            : "Lampiran berhasil diganti dan tetap dilindungi Security Vault.", Boolean(result?.replaceWarning));
          await loadRecords();
          const fresh = await refreshCurrentRecord();
          const status = await refreshVaultStatus();
          if (fresh && status?.unlocked) await loadReadableAttachments(fresh);
        } catch (error) {
          setMessage(error?.message || "Lampiran gagal diganti.", true);
        } finally {
          busy = false;
        }
      }, "Masukkan PIN untuk mengenkripsi lampiran pengganti dan menghapus lampiran lama.");
      return;
    }

    await runWithVault(
      () => uploadToRecord(recordId, file),
      "Masukkan PIN untuk mengenkripsi dan menambahkan lampiran ini."
    );
  });

  archiveClose.addEventListener("click", closeArchiveManager);
  archiveLayer.addEventListener("click", (event) => { if (event.target === archiveLayer && !busy) closeArchiveManager(); });

  confirmClose.addEventListener("click", () => closeConfirm({ cancelAction: true }));
  confirmCancel.addEventListener("click", () => closeConfirm({ cancelAction: true }));
  confirmLayer.addEventListener("click", (event) => { if (event.target === confirmLayer && !busy) closeConfirm({ cancelAction: true }); });
  confirmAction.addEventListener("click", async () => {
    if (busy) return;
    const action = pendingConfirmAction;
    closeConfirm({ cancelAction: false });
    pendingConfirmAction = null;
    if (typeof action === "function") await action();
  });

  unlockClose.addEventListener("click", () => closeUnlock({ cancelAction: true }));
  unlockLayer.addEventListener("click", (event) => { if (event.target === unlockLayer && !busy) closeUnlock({ cancelAction: true }); });
  unlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    unlockSubmit.disabled = true;
    unlockSubmit.textContent = "Membuka…";
    unlockMessage.hidden = true;
    try {
      await Service().unlock(pinInput.value);
      const action = pendingUnlockAction;
      closeUnlock({ cancelAction: false });
      pendingUnlockAction = null;
      await refreshVaultStatus();
      if (typeof action === "function") await action();
    } catch (error) {
      unlockMessage.textContent = error?.message || "PIN tidak dapat membuka Security Vault.";
      unlockMessage.hidden = false;
    } finally {
      busy = false;
      unlockSubmit.disabled = false;
      unlockSubmit.textContent = "Buka Security Vault";
    }
  });

  window.addEventListener(Trusted()?.STATE_EVENT || "ruangkitha:security-state", (event) => {
    const unlocked = Boolean(event?.detail?.unlocked);
    if (!unlocked) {
      if (currentStatus) currentStatus.unlocked = false;
      if (currentRecord) renderAttachmentLockedState(currentRecord); // purge decrypted attachment names from DOM
    }
    refreshVaultStatus().catch(() => {});
  });

  (async () => {
    try {
      if (window.AUTH_READY) await window.AUTH_READY;
      activeFamily = await window.AuthRouter.ambilFamilyAktif();
      if (!activeFamily) throw new Error("Keluarga aktif tidak ditemukan.");
      const requestedView = new URLSearchParams(location.search).get("view");
      if (["family", "attention", "personal"].includes(requestedView)) currentView = requestedView;
      syncTabs();
      renderDiscoveryState();
      await Promise.all([refreshVaultStatus(), loadRecords()]);
      await openDeepLinkedDocument();
    } catch (error) {
      countLabel.textContent = "Gagal memuat";
      setMessage(error?.message || "Dokumen gagal dimulai.", true);
      setState("alert-circle-outline", "Dokumen belum dapat dimulai", error?.message || "Terjadi kesalahan saat menyiapkan modul Dokumen.");
    }
  })();
})();
