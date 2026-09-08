(() => {
  "use strict";

  const notice = document.querySelector("[data-budget-notice]");
  const monthLabel = document.querySelector("[data-budget-month-label]");
  const monthInput = document.querySelector("[data-budget-month-input]");
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

  const cycleLabel = document.querySelector("[data-budget-cycle-label]");
  const cycleOpen = document.querySelector("[data-budget-cycle-open]");
  const cycleLayer = document.querySelector("[data-budget-cycle-layer]");
  const cycleClose = document.querySelector("[data-budget-cycle-close]");
  const cycleForm = document.querySelector("[data-budget-cycle-form]");
  const cycleModeInputs = [...document.querySelectorAll("[data-budget-cycle-mode]")];
  const cycleDayWrap = document.querySelector("[data-budget-cycle-day-wrap]");
  const cycleDaySelect = document.querySelector("[data-budget-cycle-day]");
  const cyclePreview = document.querySelector("[data-budget-cycle-preview]");
  const cycleSave = document.querySelector("[data-budget-cycle-save]");

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
  let cycleDay = 1;
  let month = firstDay(new Date());
  let editingBudget = null;
  let selectedCategoryId = "";
  const expandedCategories = new Set();
  let toastTimer = null;

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function firstDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function monthValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthDate(date = month) {
    return `${monthValue(date)}-01`;
  }

  function monthText(date = month) {
    return date.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric"
    });
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function cycleBoundary(anchor, day = cycleDay) {
    const safeDay = Math.min(
      Math.max(Number(day || 1), 1),
      daysInMonth(anchor.getFullYear(), anchor.getMonth())
    );
    return new Date(anchor.getFullYear(), anchor.getMonth(), safeDay);
  }

  function periodBounds(anchor = month, day = cycleDay) {
    const start = cycleBoundary(firstDay(anchor), day);
    const nextAnchor = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    const endExclusive = cycleBoundary(nextAnchor, day);
    const displayEnd = new Date(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate() - 1);
    return { start, endExclusive, displayEnd };
  }

  function currentPeriodAnchor(date = new Date(), day = cycleDay) {
    const anchor = firstDay(date);
    const boundary = cycleBoundary(anchor, day);
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return today >= boundary
      ? anchor
      : new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  }

  function periodText(anchor = month, day = cycleDay) {
    if (Number(day) === 1) return monthText(anchor);

    const { start, displayEnd } = periodBounds(anchor, day);
    const sameYear = start.getFullYear() === displayEnd.getFullYear();
    const sameMonth = sameYear && start.getMonth() === displayEnd.getMonth();

    if (sameMonth) {
      return `${start.getDate()} – ${displayEnd.toLocaleDateString("id-ID", {
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
    const endLabel = displayEnd.toLocaleDateString("id-ID", {
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
    }, 3500);
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

  function setMonth(next) {
    month = firstDay(next);
    syncMonthUI();
    loadBudgets();
  }

  function resetCurrentMonth({ reload = true } = {}) {
    const current = currentPeriodAnchor(new Date(), cycleDay);
    const changed = monthValue(month) !== monthValue(current);
    month = current;
    syncMonthUI();
    if (reload && changed && family) loadBudgets();
  }

  function syncCycleButton() {
    if (!cycleLabel) return;
    cycleLabel.textContent = cycleDay === 1
      ? "Kalender bulanan"
      : `Mulai tanggal ${cycleDay}`;
  }

  function syncMonthUI() {
    const label = periodText();
    if (monthLabel) monthLabel.textContent = label;
    if (monthInput) monthInput.value = monthValue(month);
    if (formPeriod) formPeriod.textContent = label;
    if (summaryTitle) summaryTitle.textContent = label;
    syncCycleButton();
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

    if (!budgets.length) {
      if (summaryBadge) summaryBadge.textContent = "Belum ada";
      if (summaryNote) summaryNote.textContent = "Tambahkan budget kategori untuk mulai mengontrol pengeluaran periode ini.";
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

    if (remainingEl) {
      remainingEl.style.color = remaining < 0 ? "var(--color-danger)" : "";
    }

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
    if (listEl) {
      listEl.innerHTML = '<div class="budget-loading-card" aria-hidden="true"></div><div class="budget-loading-card" aria-hidden="true"></div>';
    }
    if (countEl) countEl.textContent = "Memuat…";
    if (summary) summary.setAttribute("aria-busy", "true");

    try {
      budgets = await FinanceService.ambilBudgetBulan({
        familyId: family.id,
        periodMonth: monthDate()
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
    requestAnimationFrame(() => categorySearch?.focus());
  }

  function closeCategoryPicker() {
    if (!categoryLayer) return;
    const open = !categoryLayer.hidden;
    categoryLayer.hidden = true;
    document.body.classList.remove("category-picker-open");
    if (open) categoryTrigger?.focus();
  }

  function selectCategory(id) {
    const selected = categoryById(id);
    if (!selected || isCategoryUnavailable(selected)) return;
    selectedCategoryId = id;
    refreshCategoryTrigger();
    closeCategoryPicker();
  }

  function selectedCycleMode() {
    return cycleModeInputs.find(input => input.checked)?.value || "calendar";
  }

  function draftCycleDay() {
    if (selectedCycleMode() === "calendar") return 1;
    const day = Number(cycleDaySelect?.value || 25);
    return Math.min(31, Math.max(2, day));
  }

  function updateCycleFormUI() {
    const payday = selectedCycleMode() === "payday";
    if (cycleDayWrap) cycleDayWrap.hidden = !payday;

    if (cyclePreview) {
      const day = draftCycleDay();
      const anchor = currentPeriodAnchor(new Date(), day);
      cyclePreview.textContent = day === 1
        ? `Periode aktif: ${monthText(anchor)}`
        : `Contoh periode aktif: ${periodText(anchor, day)}`;
    }
  }

  function prepareCycleDayOptions() {
    if (!cycleDaySelect || cycleDaySelect.options.length) return;
    for (let day = 2; day <= 31; day += 1) {
      const option = document.createElement("option");
      option.value = String(day);
      option.textContent = `Tanggal ${day}`;
      cycleDaySelect.appendChild(option);
    }
  }

  function openCycleSheet() {
    prepareCycleDayOptions();
    const mode = cycleDay === 1 ? "calendar" : "payday";
    cycleModeInputs.forEach(input => {
      input.checked = input.value === mode;
    });
    if (cycleDaySelect) cycleDaySelect.value = String(cycleDay === 1 ? 25 : cycleDay);
    updateCycleFormUI();
    if (cycleLayer) cycleLayer.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCycleSheet() {
    if (cycleLayer) cycleLayer.hidden = true;
    document.body.style.overflow = "";
  }

  async function saveCycle(event) {
    event.preventDefault();
    if (!family) return;

    const nextDay = draftCycleDay();
    if (cycleSave) cycleSave.disabled = true;

    try {
      cycleDay = await FinanceService.simpanSiklusBudget({
        familyId: family.id,
        cycleDay: nextDay
      });
      closeCycleSheet();
      resetCurrentMonth({ reload: false });
      syncMonthUI();
      show(
        cycleDay === 1
          ? "Siklus budget kembali ke kalender bulanan."
          : `Siklus budget dimulai setiap tanggal ${cycleDay}.`,
        "success"
      );
      await loadBudgets();
    } catch (error) {
      console.error("[Budget Cycle Save]", error);
      show(error?.message || "Siklus budget gagal disimpan.", "error");
    } finally {
      if (cycleSave) cycleSave.disabled = false;
    }
  }

  function openForm(item = null) {
    editingBudget = item;
    selectedCategoryId = item?.account_id || "";

    if (formTitle) formTitle.textContent = item ? "Edit Budget" : "Tambah Budget";
    if (formPeriod) formPeriod.textContent = periodText();
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
        periodMonth: monthDate(),
        amount,
        warningPercent: 80
      });
      closeForm();
      show(wasEditing ? "Budget diperbarui." : "Budget ditambahkan.", "success");
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
    if (!confirm(`Hapus budget ${name} untuk ${periodText()}?\n\nRiwayat transaksi tidak akan dihapus.`)) return;

    deleteButton.disabled = true;
    if (saveButton) saveButton.disabled = true;

    try {
      await FinanceService.hapusBudget(editingBudget.budget_id);
      closeForm();
      show("Budget dihapus.", "success");
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

    try {
      cycleDay = await FinanceService.ambilSiklusBudget(family.id);
    } catch (error) {
      console.warn("[Budget Cycle Load]", error);
      cycleDay = 1;
    }

    resetCurrentMonth({ reload: false });

    categories = await FinanceService.ambilAkun(family.id, "expense");
    categories = categories.filter(item => !item.archived_at);

    await loadBudgets();
  }

  document.querySelectorAll("[data-budget-add]").forEach(button => {
    button.addEventListener("click", () => openForm());
  });

  cycleOpen?.addEventListener("click", openCycleSheet);
  cycleClose?.addEventListener("click", closeCycleSheet);
  cycleLayer?.addEventListener("click", event => {
    if (event.target === cycleLayer) closeCycleSheet();
  });
  cycleModeInputs.forEach(input => input.addEventListener("change", updateCycleFormUI));
  cycleDaySelect?.addEventListener("change", updateCycleFormUI);
  cycleForm?.addEventListener("submit", saveCycle);

  document.querySelector("[data-budget-month-prev]")?.addEventListener("click", () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  });

  document.querySelector("[data-budget-month-next]")?.addEventListener("click", () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  });

  document.querySelector("[data-budget-month-open]")?.addEventListener("click", () => {
    if (!monthInput) return;
    try {
      if (typeof monthInput.showPicker === "function") monthInput.showPicker();
      else monthInput.click();
    } catch {
      monthInput.focus();
      monthInput.click();
    }
  });

  monthInput?.addEventListener("change", () => {
    const match = /^(\d{4})-(\d{2})$/.exec(monthInput.value || "");
    if (!match) return;
    setMonth(new Date(Number(match[1]), Number(match[2]) - 1, 1));
  });

  listEl?.addEventListener("click", event => {
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
    if (choice && !choice.disabled) selectCategory(choice.dataset.budgetCategoryId);
  });

  window.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (categoryLayer && !categoryLayer.hidden) closeCategoryPicker();
    else if (sheetLayer && !sheetLayer.hidden) closeForm();
    else if (cycleLayer && !cycleLayer.hidden) closeCycleSheet();
  });

  window.addEventListener("pageshow", event => {
    if (!event.persisted || !family) return;
    resetCurrentMonth({ reload: true });
  });

  const run = () => start().catch(error => {
    console.error("[Budget Init]", error);
    show(error?.message || "Budget gagal dibuka.", "error");
    if (listEl) {
      listEl.innerHTML = `
        <div class="budget-empty">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <strong>Budget belum dapat dibuka</strong>
          <p>${escapeHTML(error?.message || "Coba lagi beberapa saat.")}</p>
        </div>
      `;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
