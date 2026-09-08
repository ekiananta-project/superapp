(() => {
  "use strict";

  const notice = document.querySelector("[data-budget-notice]");
  const periodLabel = document.querySelector("[data-budget-month-label]");
  const summary = document.querySelector("[data-budget-summary]");
  const summaryTitle = document.querySelector("[data-budget-summary-title]");
  const summaryBadge = document.querySelector("[data-budget-summary-badge]");
  const totalEl = document.querySelector("[data-budget-total]");
  const spentEl = document.querySelector("[data-budget-spent]");
  const remainingEl = document.querySelector("[data-budget-remaining]");
  const progressEl = document.querySelector("[data-budget-progress]");
  const summaryNote = document.querySelector("[data-budget-summary-note]");
  const countEl = document.querySelector("[data-budget-count]");
  const listEl = document.querySelector("[data-budget-list]");

  const prevButton = document.querySelector("[data-budget-month-prev]");
  const nextButton = document.querySelector("[data-budget-month-next]");
  const periodOpen = document.querySelector("[data-budget-month-open]");
  const periodLayer = document.querySelector("[data-budget-period-layer]");
  const periodForm = document.querySelector("[data-budget-period-form]");
  const periodTitle = document.querySelector("[data-budget-period-title]");
  const periodSubtitle = document.querySelector("[data-budget-period-subtitle]");
  const periodClose = document.querySelector("[data-budget-period-close]");
  const periodStartInput = document.querySelector("[data-budget-period-start]");
  const periodEndInput = document.querySelector("[data-budget-period-end]");
  const periodNewButton = document.querySelector("[data-budget-period-new]");
  const periodSaveButton = document.querySelector("[data-budget-period-save]");

  const sheetLayer = document.querySelector("[data-budget-sheet-layer]");
  const sheetClose = document.querySelector("[data-budget-sheet-close]");
  const form = document.querySelector("[data-budget-form]");
  const formTitle = document.querySelector("[data-budget-form-title]");
  const formPeriod = document.querySelector("[data-budget-form-period]");
  const amountInput = document.querySelector("[data-budget-amount]");
  const saveButton = document.querySelector("[data-budget-save]");
  const deleteButton = document.querySelector("[data-budget-delete]");

  const categoryTrigger = document.querySelector("[data-budget-category-trigger]");
  const categorySelected = document.querySelector("[data-budget-category-selected]");
  const categoryParent = document.querySelector("[data-budget-category-parent]");
  const categoryLayer = document.querySelector("[data-budget-category-layer]");
  const categoryClose = document.querySelector("[data-budget-category-close]");
  const categorySearch = document.querySelector("[data-budget-category-search]");
  const categoryList = document.querySelector("[data-budget-category-list]");

  let family = null;
  let categories = [];
  let budgets = [];
  let periods = [];
  let currentPeriod = null;
  let editingBudget = null;
  let selectedCategoryId = "";
  let creatingPeriod = false;
  let toastTimer = null;
  const expandedCategories = new Set();

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function localISO(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseLocalDate(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (
      date.getFullYear() !== Number(match[1]) ||
      date.getMonth() !== Number(match[2]) - 1 ||
      date.getDate() !== Number(match[3])
    ) return null;
    return date;
  }

  function addDays(iso, amount) {
    const date = parseLocalDate(iso);
    if (!date) return "";
    date.setDate(date.getDate() + Number(amount || 0));
    return localISO(date);
  }

  function daysBetween(startISO, endISO) {
    const start = parseLocalDate(startISO);
    const end = parseLocalDate(endISO);
    if (!start || !end) return 1;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  }

  function defaultCurrentRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: localISO(start), endDate: localISO(end) };
  }

  function rangeText(period = currentPeriod) {
    if (!period) return "Atur rentang tanggal";
    const start = parseLocalDate(period.start_date);
    const end = parseLocalDate(period.end_date);
    if (!start || !end) return "Periode Budget";

    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();

    if (sameMonth) {
      return `${start.getDate()} – ${end.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })}`;
    }

    const startLabel = start.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" })
    });
    const endLabel = end.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    return `${startLabel} – ${endLabel}`;
  }

  function rupiah(value) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function digits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatNumberInput(value) {
    const clean = digits(value);
    return clean ? new Intl.NumberFormat("id-ID").format(Number(clean)) : "";
  }

  function show(text, type = "info") {
    if (!notice) return;
    clearTimeout(toastTimer);
    notice.textContent = text;
    notice.dataset.tipe = type;
    notice.hidden = false;
    toastTimer = setTimeout(() => {
      notice.hidden = true;
    }, 3800);
  }

  function categoryById(id) {
    return categories.find(item => item.id === id) || null;
  }

  function sorted(items) {
    return [...items].sort((a, b) => {
      const order = Number(a.sort_order || 0) - Number(b.sort_order || 0);
      if (order) return order;
      return String(a.name || "").localeCompare(String(b.name || ""), "id");
    });
  }

  function activePeriodFrom(items) {
    if (!items.length) return null;
    const today = localISO();
    const active = items
      .filter(item => item.start_date <= today && item.end_date >= today)
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
    if (active.length) return active[0];

    const past = items
      .filter(item => item.end_date < today)
      .sort((a, b) => String(b.end_date).localeCompare(String(a.end_date)));
    if (past.length) return past[0];

    return [...items].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0];
  }

  function currentPeriodIndex() {
    if (!currentPeriod) return -1;
    return periods.findIndex(item => item.period_id === currentPeriod.period_id);
  }

  function syncPeriodUI() {
    const label = rangeText();
    if (periodLabel) periodLabel.textContent = label;
    if (summaryTitle) summaryTitle.textContent = currentPeriod ? label : "Belum ada periode";
    if (formPeriod) formPeriod.textContent = label;

    const index = currentPeriodIndex();
    if (prevButton) {
      prevButton.disabled = index <= 0;
      prevButton.setAttribute("aria-disabled", index <= 0 ? "true" : "false");
    }
    if (nextButton) {
      nextButton.disabled = index < 0 || index >= periods.length - 1;
      nextButton.setAttribute("aria-disabled", index < 0 || index >= periods.length - 1 ? "true" : "false");
    }
  }

  function renderSummary() {
    const total = budgets.reduce((sum, item) => sum + Number(item.budget_amount || 0), 0);
    const spent = budgets.reduce((sum, item) => sum + Number(item.spent_amount || 0), 0);
    const remaining = total - spent;
    const percent = total > 0 ? (spent / total) * 100 : 0;
    const overCount = budgets.filter(item => item.budget_status === "over").length;
    const warningCount = budgets.filter(item => item.budget_status === "warning").length;

    if (totalEl) totalEl.textContent = rupiah(total);
    if (spentEl) spentEl.textContent = rupiah(spent);
    if (remainingEl) remainingEl.textContent = rupiah(remaining);
    if (progressEl) progressEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;

    summary?.classList.remove("is-warning", "is-over");

    if (!currentPeriod) {
      if (summaryBadge) summaryBadge.textContent = "Atur periode";
      if (summaryNote) summaryNote.textContent = "Pilih tanggal mulai dan selesai sebelum membuat budget.";
    } else if (!budgets.length) {
      if (summaryBadge) summaryBadge.textContent = "Belum ada";
      if (summaryNote) summaryNote.textContent = "Tambahkan budget kategori untuk rentang tanggal ini.";
    } else if (overCount) {
      summary?.classList.add("is-over");
      if (summaryBadge) summaryBadge.textContent = "Melebihi";
      if (summaryNote) summaryNote.textContent = `${overCount} kategori sudah melewati budget.`;
    } else if (warningCount) {
      summary?.classList.add("is-warning");
      if (summaryBadge) summaryBadge.textContent = "Perhatian";
      if (summaryNote) summaryNote.textContent = `${warningCount} kategori sudah mencapai batas peringatan.`;
    } else {
      if (summaryBadge) summaryBadge.textContent = "Aman";
      if (summaryNote) summaryNote.textContent = `Penggunaan budget ${Math.round(percent)}% dan masih dalam batas aman.`;
    }

    if (remainingEl) remainingEl.style.color = remaining < 0 ? "var(--color-danger)" : "";
    if (summary) summary.setAttribute("aria-busy", "false");
  }

  function budgetItem(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "budget-item";
    if (item.budget_status === "warning") button.classList.add("is-warning");
    if (item.budget_status === "over") button.classList.add("is-over");
    button.dataset.budgetId = item.budget_id;

    const parentText = item.parent_name
      ? `<small>${escapeHTML(item.parent_name)}</small>`
      : item.category_archived
        ? `<small>Kategori diarsipkan</small>`
        : `<small>Kategori utama</small>`;

    const remaining = Number(item.remaining_amount || 0);
    const remainingText = remaining < 0
      ? `Lebih ${rupiah(Math.abs(remaining))}`
      : `Sisa ${rupiah(remaining)}`;

    button.innerHTML = `
      <div class="budget-item-top">
        <span class="budget-item-icon"><ion-icon name="${escapeHTML(item.icon_value || "folder-outline")}"></ion-icon></span>
        <span class="budget-item-copy">
          <strong>${escapeHTML(item.account_name || "Kategori")}</strong>
          ${parentText}
        </span>
        <ion-icon class="budget-item-chevron" name="chevron-forward-outline"></ion-icon>
      </div>
      <div class="budget-item-values">
        <strong>${rupiah(item.spent_amount)} / ${rupiah(item.budget_amount)}</strong>
        <span class="budget-item-remaining">${remainingText}</span>
      </div>
      <div class="budget-item-progress" aria-hidden="true"><span style="width:${Math.min(100, Math.max(0, Number(item.progress_percent || 0)))}%"></span></div>
    `;
    return button;
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!currentPeriod) {
      if (countEl) countEl.textContent = "Belum ada periode";
      listEl.innerHTML = `
        <button class="budget-empty budget-empty-action" type="button" data-budget-empty-period>
          <ion-icon name="calendar-outline"></ion-icon>
          <strong>Atur periode budget dulu</strong>
          <p>Pilih bebas tanggal mulai dan tanggal selesai sesuai alur keuangan keluarga.</p>
        </button>
      `;
      return;
    }

    if (countEl) countEl.textContent = budgets.length ? `${budgets.length} kategori dianggarkan` : "Belum ada budget";
    if (!budgets.length) {
      listEl.innerHTML = `
        <div class="budget-empty">
          <ion-icon name="pie-chart-outline"></ion-icon>
          <strong>Belum ada budget periode ini</strong>
          <p>Tambahkan budget pada kategori pengeluaran yang ingin kamu kontrol.</p>
        </div>
      `;
      return;
    }

    budgets.forEach(item => listEl.appendChild(budgetItem(item)));
  }

  async function loadBudgets() {
    if (!family) return;
    if (!currentPeriod) {
      budgets = [];
      renderSummary();
      renderList();
      return;
    }

    if (listEl) {
      listEl.innerHTML = '<div class="budget-loading-card" aria-hidden="true"></div><div class="budget-loading-card" aria-hidden="true"></div>';
    }
    if (countEl) countEl.textContent = "Memuat…";
    if (summary) summary.setAttribute("aria-busy", "true");

    try {
      budgets = await FinanceService.ambilBudgetPeriode({
        familyId: family.id,
        periodId: currentPeriod.period_id
      });
      renderSummary();
      renderList();
    } catch (error) {
      console.error("[Budget Load]", error);
      budgets = [];
      renderSummary();
      if (listEl) {
        listEl.innerHTML = `
          <div class="budget-empty">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <strong>Budget belum dapat dimuat</strong>
            <p>${escapeHTML(error?.message || "Coba lagi beberapa saat.")}</p>
          </div>
        `;
      }
      if (countEl) countEl.textContent = "Gagal memuat";
      show(error?.message || "Budget gagal dimuat.", "error");
    }
  }

  async function loadPeriods({ preferId = null, resetToActive = false } = {}) {
    periods = await FinanceService.ambilPeriodeBudget(family.id);
    periods.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)) || String(a.end_date).localeCompare(String(b.end_date)));

    if (preferId) {
      currentPeriod = periods.find(item => item.period_id === preferId) || null;
    } else if (resetToActive || !currentPeriod) {
      currentPeriod = activePeriodFrom(periods);
    } else {
      currentPeriod = periods.find(item => item.period_id === currentPeriod.period_id) || activePeriodFrom(periods);
    }

    syncPeriodUI();
  }

  async function movePeriod(delta) {
    const index = currentPeriodIndex();
    const next = periods[index + delta];
    if (!next) return;
    currentPeriod = next;
    syncPeriodUI();
    await loadBudgets();
  }

  function openPeriodSheet({ newPeriod = false } = {}) {
    creatingPeriod = newPeriod || !currentPeriod;

    if (creatingPeriod) {
      let startDate;
      let endDate;
      if (currentPeriod && newPeriod) {
        const length = daysBetween(currentPeriod.start_date, currentPeriod.end_date);
        startDate = addDays(currentPeriod.end_date, 1);
        endDate = addDays(startDate, length - 1);
      } else {
        const defaults = defaultCurrentRange();
        startDate = defaults.startDate;
        endDate = defaults.endDate;
      }
      if (periodStartInput) periodStartInput.value = startDate;
      if (periodEndInput) periodEndInput.value = endDate;
      if (periodTitle) periodTitle.textContent = "Buat Periode Budget";
      if (periodSubtitle) periodSubtitle.textContent = "Pilih sendiri tanggal mulai dan selesai. Tidak harus tanggal 1 atau mengikuti tanggal gajian.";
      if (periodNewButton) periodNewButton.hidden = true;
    } else {
      if (periodStartInput) periodStartInput.value = currentPeriod.start_date;
      if (periodEndInput) periodEndInput.value = currentPeriod.end_date;
      if (periodTitle) periodTitle.textContent = "Atur Periode Budget";
      if (periodSubtitle) periodSubtitle.textContent = "Ubah rentang tanggal periode ini. Nilai Terpakai akan dihitung ulang otomatis.";
      if (periodNewButton) periodNewButton.hidden = false;
    }

    if (periodEndInput && periodStartInput?.value) periodEndInput.min = periodStartInput.value;
    if (periodLayer) periodLayer.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => periodStartInput?.focus());
  }

  function closePeriodSheet() {
    if (periodLayer) periodLayer.hidden = true;
    document.body.style.overflow = "";
    creatingPeriod = false;
  }

  async function savePeriod(event) {
    event.preventDefault();
    if (!family) return;

    const startDate = String(periodStartInput?.value || "");
    const endDate = String(periodEndInput?.value || "");
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (!start || !end) {
      show("Tanggal mulai dan selesai wajib dipilih.", "error");
      return;
    }
    if (end < start) {
      show("Tanggal selesai tidak boleh sebelum tanggal mulai.", "error");
      periodEndInput?.focus();
      return;
    }

    if (periodSaveButton) periodSaveButton.disabled = true;
    try {
      const wasCreating = creatingPeriod;
      const periodId = await FinanceService.simpanPeriodeBudget({
        familyId: family.id,
        periodId: wasCreating ? null : currentPeriod?.period_id || null,
        startDate,
        endDate
      });
      closePeriodSheet();
      await loadPeriods({ preferId: periodId });
      show(wasCreating ? "Periode budget dibuat." : "Periode budget diperbarui.", "success");
      await loadBudgets();
    } catch (error) {
      console.error("[Budget Period Save]", error);
      show(error?.message || "Periode budget gagal disimpan.", "error");
    } finally {
      if (periodSaveButton) periodSaveButton.disabled = false;
    }
  }

  function refreshCategoryTrigger() {
    const selected = categoryById(selectedCategoryId);
    if (!selected) {
      if (categorySelected) categorySelected.textContent = "Pilih kategori";
      if (categoryParent) {
        categoryParent.textContent = "";
        categoryParent.hidden = true;
      }
      return;
    }

    if (categorySelected) categorySelected.textContent = selected.name || "Kategori";
    const parent = selected.parent_id ? categoryById(selected.parent_id) : null;
    if (categoryParent) {
      categoryParent.textContent = parent?.name || "";
      categoryParent.hidden = !parent;
    }
  }

  function isCategoryUnavailable(category) {
    if (editingBudget) return category.id !== editingBudget.account_id;

    const used = new Set(budgets.map(item => item.account_id));
    if (used.has(category.id)) return true;
    if (category.parent_id && used.has(category.parent_id)) return true;
    if (!category.parent_id) {
      return categories.some(child => child.parent_id === category.id && used.has(child.id));
    }
    return false;
  }

  function categoryChoice(category, parent = null, child = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-picker-choice ${child ? "category-picker-child-choice" : "category-picker-parent-choice"}`;
    button.dataset.budgetCategoryId = category.id;

    const unavailable = isCategoryUnavailable(category);
    if (unavailable) {
      button.classList.add("budget-category-disabled");
      button.disabled = true;
    }

    button.innerHTML = `
      ${child ? '<span class="category-picker-guide" aria-hidden="true">↳</span>' : ""}
      <span class="category-picker-icon"><ion-icon name="${escapeHTML(category.icon_value || parent?.icon_value || "folder-outline")}"></ion-icon></span>
      <span class="category-picker-name">${escapeHTML(category.name || "Kategori")}</span>
      ${selectedCategoryId === category.id ? '<ion-icon class="category-picker-check" name="checkmark-circle"></ion-icon>' : ""}
      ${unavailable && !editingBudget ? '<span class="budget-category-used">Sudah dianggarkan</span>' : ""}
    `;
    return button;
  }

  function renderCategoryPicker() {
    if (!categoryList) return;

    const query = String(categorySearch?.value || "").trim().toLocaleLowerCase("id");
    const parents = sorted(categories.filter(item => !item.parent_id));
    categoryList.innerHTML = "";

    if (!categories.length) {
      categoryList.innerHTML = '<div class="category-picker-empty">Belum ada kategori pengeluaran.</div>';
      return;
    }

    let rendered = 0;
    parents.forEach(parent => {
      const children = sorted(categories.filter(item => item.parent_id === parent.id));
      const parentMatch = String(parent.name || "").toLocaleLowerCase("id").includes(query);
      const matchingChildren = query
        ? children.filter(child => String(child.name || "").toLocaleLowerCase("id").includes(query))
        : children;

      if (query && !parentMatch && !matchingChildren.length) return;

      const group = document.createElement("section");
      group.className = "category-picker-group";
      const row = document.createElement("div");
      row.className = "category-picker-parent-row";
      row.appendChild(categoryChoice(parent));

      if (children.length) {
        const expand = document.createElement("button");
        expand.type = "button";
        expand.className = "category-picker-expand";
        expand.dataset.budgetCategoryExpand = parent.id;
        const shouldExpand = Boolean(query) || expandedCategories.has(parent.id);
        expand.setAttribute("aria-expanded", shouldExpand ? "true" : "false");
        expand.setAttribute("aria-label", `${shouldExpand ? "Tutup" : "Buka"} subkategori ${parent.name}`);
        expand.innerHTML = `<span>${children.length}</span><ion-icon name="${shouldExpand ? "chevron-up-outline" : "chevron-down-outline"}"></ion-icon>`;
        row.appendChild(expand);
      }

      group.appendChild(row);
      const shouldShow = children.length && (query || expandedCategories.has(parent.id));
      if (shouldShow) {
        const wrap = document.createElement("div");
        wrap.className = "category-picker-children";
        const visible = query && !parentMatch ? matchingChildren : children;
        visible.forEach(child => wrap.appendChild(categoryChoice(child, parent, true)));
        group.appendChild(wrap);
      }

      categoryList.appendChild(group);
      rendered += 1;
    });

    if (!rendered) {
      categoryList.innerHTML = '<div class="category-picker-empty">Kategori tidak ditemukan.</div>';
    }
  }

  function openCategoryPicker() {
    if (editingBudget) return;
    expandedCategories.clear();
    const selected = categoryById(selectedCategoryId);
    if (selected?.parent_id) expandedCategories.add(selected.parent_id);
    if (categorySearch) categorySearch.value = "";
    renderCategoryPicker();
    if (categoryLayer) categoryLayer.hidden = false;
    document.body.classList.add("category-picker-open");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => categorySearch?.focus());
  }

  function closeCategoryPicker() {
    if (!categoryLayer) return;
    const wasOpen = !categoryLayer.hidden;
    categoryLayer.hidden = true;
    document.body.classList.remove("category-picker-open");
    if ((!sheetLayer || sheetLayer.hidden) && (!periodLayer || periodLayer.hidden)) {
      document.body.style.overflow = "";
    }
    if (wasOpen) categoryTrigger?.focus();
  }

  function selectCategory(id) {
    const selected = categoryById(id);
    if (!selected || isCategoryUnavailable(selected)) return;
    selectedCategoryId = id;
    refreshCategoryTrigger();
    closeCategoryPicker();
  }

  function openForm(item = null) {
    if (!currentPeriod) {
      show("Atur rentang tanggal budget terlebih dulu.", "info");
      openPeriodSheet({ newPeriod: true });
      return;
    }

    editingBudget = item;
    selectedCategoryId = item?.account_id || "";

    if (formTitle) formTitle.textContent = item ? "Edit Budget" : "Tambah Budget";
    if (formPeriod) formPeriod.textContent = rangeText();
    if (amountInput) amountInput.value = item ? formatNumberInput(item.budget_amount) : "";
    if (deleteButton) deleteButton.hidden = !item;
    if (categoryTrigger) {
      categoryTrigger.disabled = false;
      categoryTrigger.classList.toggle("is-readonly", Boolean(item));
      categoryTrigger.setAttribute("aria-disabled", item ? "true" : "false");
      categoryTrigger.tabIndex = item ? -1 : 0;
      categoryTrigger.title = item ? "Kategori tidak dapat diganti saat edit. Hapus budget lalu buat baru jika ingin mengganti kategori." : "";
    }

    refreshCategoryTrigger();
    if (item && !categoryById(item.account_id)) {
      if (categorySelected) categorySelected.textContent = item.account_name || "Kategori";
      if (categoryParent) {
        categoryParent.textContent = item.parent_name || "Kategori diarsipkan";
        categoryParent.hidden = false;
      }
    }

    if (sheetLayer) sheetLayer.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => item ? amountInput?.focus() : categoryTrigger?.focus());
  }

  function closeForm() {
    if (sheetLayer) sheetLayer.hidden = true;
    editingBudget = null;
    selectedCategoryId = "";
    if (categoryTrigger) {
      categoryTrigger.disabled = false;
      categoryTrigger.classList.remove("is-readonly");
      categoryTrigger.setAttribute("aria-disabled", "false");
      categoryTrigger.tabIndex = 0;
      categoryTrigger.title = "";
    }
    document.body.style.overflow = "";
  }

  async function saveBudget(event) {
    event.preventDefault();
    if (!family || !currentPeriod) return;

    const amount = Number(digits(amountInput?.value));
    if (!selectedCategoryId) {
      show("Pilih kategori budget dulu.", "error");
      return;
    }
    if (!amount || amount <= 0) {
      show("Nominal budget harus lebih dari Rp 0.", "error");
      amountInput?.focus();
      return;
    }

    if (saveButton) saveButton.disabled = true;
    const wasEditing = Boolean(editingBudget);

    try {
      await FinanceService.simpanBudget({
        familyId: family.id,
        accountId: selectedCategoryId,
        periodId: currentPeriod.period_id,
        amount,
        warningPercent: 80
      });
      closeForm();
      show(wasEditing ? "Budget diperbarui." : "Budget ditambahkan.", "success");
      await loadPeriods({ preferId: currentPeriod.period_id });
      await loadBudgets();
    } catch (error) {
      console.error("[Budget Save]", error);
      show(error?.message || "Budget gagal disimpan.", "error");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }

  async function deleteBudget() {
    if (!editingBudget) return;
    const name = editingBudget.account_name || "kategori ini";
    if (!confirm(`Hapus budget ${name} untuk ${rangeText()}?\n\nRiwayat transaksi tidak akan dihapus.`)) return;

    deleteButton.disabled = true;
    if (saveButton) saveButton.disabled = true;
    try {
      await FinanceService.hapusBudget(editingBudget.budget_id);
      closeForm();
      show("Budget dihapus.", "success");
      await loadPeriods({ preferId: currentPeriod.period_id });
      await loadBudgets();
    } catch (error) {
      console.error("[Budget Delete]", error);
      show(error?.message || "Budget gagal dihapus.", "error");
    } finally {
      deleteButton.disabled = false;
      if (saveButton) saveButton.disabled = false;
    }
  }

  async function start() {
    if (window.AUTH_READY && (await window.AUTH_READY) === false) return;

    family = await AuthRouter.ambilFamilyAktif();
    if (!family) return;

    categories = await FinanceService.ambilAkun(family.id, "expense");
    categories = categories.filter(item => !item.archived_at);

    await loadPeriods({ resetToActive: true });
    await loadBudgets();
  }

  document.querySelectorAll("[data-budget-add]").forEach(button => {
    button.addEventListener("click", () => openForm());
  });

  prevButton?.addEventListener("click", () => movePeriod(-1));
  nextButton?.addEventListener("click", () => movePeriod(1));
  periodOpen?.addEventListener("click", () => openPeriodSheet({ newPeriod: !currentPeriod }));
  periodClose?.addEventListener("click", closePeriodSheet);
  periodLayer?.addEventListener("click", event => {
    if (event.target === periodLayer) closePeriodSheet();
  });
  periodForm?.addEventListener("submit", savePeriod);
  periodNewButton?.addEventListener("click", () => openPeriodSheet({ newPeriod: true }));
  periodStartInput?.addEventListener("change", () => {
    if (!periodStartInput.value) return;
    if (!periodEndInput.value || periodEndInput.value < periodStartInput.value) {
      periodEndInput.value = periodStartInput.value;
    }
    periodEndInput.min = periodStartInput.value;
  });

  listEl?.addEventListener("click", event => {
    const emptyPeriod = event.target.closest("[data-budget-empty-period]");
    if (emptyPeriod) {
      openPeriodSheet({ newPeriod: true });
      return;
    }

    const itemEl = event.target.closest("[data-budget-id]");
    if (!itemEl) return;
    const item = budgets.find(row => row.budget_id === itemEl.dataset.budgetId);
    if (item) openForm(item);
  });

  sheetClose?.addEventListener("click", closeForm);
  sheetLayer?.addEventListener("click", event => {
    if (event.target === sheetLayer) closeForm();
  });
  form?.addEventListener("submit", saveBudget);
  deleteButton?.addEventListener("click", deleteBudget);

  amountInput?.addEventListener("input", () => {
    amountInput.value = formatNumberInput(amountInput.value);
  });

  categoryTrigger?.addEventListener("click", openCategoryPicker);
  categoryClose?.addEventListener("click", closeCategoryPicker);
  categorySearch?.addEventListener("input", renderCategoryPicker);
  categoryLayer?.addEventListener("click", event => {
    if (event.target === categoryLayer) {
      closeCategoryPicker();
      return;
    }

    const expand = event.target.closest("[data-budget-category-expand]");
    if (expand) {
      const id = expand.dataset.budgetCategoryExpand;
      if (expandedCategories.has(id)) expandedCategories.delete(id);
      else expandedCategories.add(id);
      renderCategoryPicker();
      return;
    }

    const choice = event.target.closest("[data-budget-category-id]");
    if (choice) selectCategory(choice.dataset.budgetCategoryId);
  });

  window.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (categoryLayer && !categoryLayer.hidden) closeCategoryPicker();
    else if (sheetLayer && !sheetLayer.hidden) closeForm();
    else if (periodLayer && !periodLayer.hidden) closePeriodSheet();
  });

  window.addEventListener("pageshow", event => {
    if (!event.persisted || !family) return;
    loadPeriods({ resetToActive: true })
      .then(loadBudgets)
      .catch(error => console.error("[Budget PageShow]", error));
  });

  const run = () => start().catch(error => {
    console.error("[Budget Init]", error);
    show(error?.message || "Budget gagal dibuka.", "error");
    budgets = [];
    currentPeriod = null;
    syncPeriodUI();
    renderSummary();
    renderList();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
