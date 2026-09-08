(() => {
  "use strict";

  const notice = document.querySelector("[data-bill-notice]");
  const monthLabel = document.querySelector("[data-bill-month-label]");
  const summary = document.querySelector("[data-bill-summary]");
  const summaryTitle = document.querySelector("[data-bill-summary-title]");
  const summaryBadge = document.querySelector("[data-bill-summary-badge]");
  const summaryNote = document.querySelector("[data-bill-summary-note]");
  const pendingTotalEl = document.querySelector("[data-bill-pending-total]");
  const paidTotalEl = document.querySelector("[data-bill-paid-total]");
  const countEl = document.querySelector("[data-bill-count]");
  const listEl = document.querySelector("[data-bill-list]");

  const formLayer = document.querySelector("[data-bill-form-layer]");
  const form = document.querySelector("[data-bill-form]");
  const formTitle = document.querySelector("[data-bill-form-title]");
  const formPeriod = document.querySelector("[data-bill-form-period]");
  const formClose = document.querySelector("[data-bill-form-close]");
  const nameInput = document.querySelector("[data-bill-name]");
  const amountInput = document.querySelector("[data-bill-amount]");
  const dueDateInput = document.querySelector("[data-bill-due-date]");
  const noteInput = document.querySelector("[data-bill-note]");
  const editInfo = document.querySelector("[data-bill-edit-info]");
  const deleteButton = document.querySelector("[data-bill-delete]");
  const saveButton = document.querySelector("[data-bill-save]");

  const categoryLayer = document.querySelector("[data-bill-category-layer]");
  const categoryTrigger = document.querySelector("[data-bill-category-trigger]");
  const categorySelected = document.querySelector("[data-bill-category-selected]");
  const categoryParent = document.querySelector("[data-bill-category-parent]");
  const categoryClose = document.querySelector("[data-bill-category-close]");
  const categorySearch = document.querySelector("[data-bill-category-search]");
  const categoryList = document.querySelector("[data-bill-category-list]");

  const payLayer = document.querySelector("[data-bill-pay-layer]");
  const payForm = document.querySelector("[data-bill-pay-form]");
  const payClose = document.querySelector("[data-bill-pay-close]");
  const payPeriod = document.querySelector("[data-bill-pay-period]");
  const payName = document.querySelector("[data-bill-pay-name]");
  const payAmount = document.querySelector("[data-bill-pay-amount]");
  const payWallet = document.querySelector("[data-bill-pay-wallet]");
  const payDate = document.querySelector("[data-bill-pay-date]");
  const paySubmit = document.querySelector("[data-bill-pay-submit]");

  let family = null;
  let bills = [];
  let categories = [];
  let wallets = [];
  let month = firstDay(new Date());
  let selectedCategoryId = "";
  let editingItem = null;
  let paymentItem = null;
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

  function firstDay(value) {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function monthValue(value = month) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthDate(value = month) {
    return `${monthValue(value)}-01`;
  }

  function monthText(value = month) {
    return value.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }

  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function parseLocalDate(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function shortDate(iso) {
    const date = parseLocalDate(iso);
    if (!date) return "—";
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
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

  function sorted(items) {
    return [...items].sort((a, b) => {
      const order = Number(a.sort_order || 0) - Number(b.sort_order || 0);
      if (order) return order;
      return String(a.name || "").localeCompare(String(b.name || ""), "id");
    });
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

  function syncMonthUI() {
    const label = monthText();
    if (monthLabel) monthLabel.textContent = label;
    if (summaryTitle) summaryTitle.textContent = label;
    if (formPeriod) formPeriod.textContent = `Mulai ${label}`;
  }

  function setMonth(next) {
    month = firstDay(next);
    syncMonthUI();
    loadBills();
  }

  function resetCurrentMonth({ reload = true } = {}) {
    const current = firstDay(new Date());
    const changed = monthValue(month) !== monthValue(current);
    month = current;
    syncMonthUI();
    if (reload && changed && family) loadBills();
  }

  function billState(item) {
    if (item.status === "paid") {
      return { key: "paid", text: "Lunas", className: "is-paid" };
    }

    const due = parseLocalDate(item.due_on);
    const now = parseLocalDate(todayISO());
    if (due && now && due < now) {
      return { key: "overdue", text: "Terlambat", className: "is-overdue" };
    }

    if (due && now && due.getTime() === now.getTime()) {
      return { key: "today", text: "Hari ini", className: "is-overdue" };
    }

    return { key: "pending", text: "Belum Lunas", className: "" };
  }

  function renderSummary() {
    const pending = bills.filter(item => item.status !== "paid");
    const paid = bills.filter(item => item.status === "paid");
    const pendingTotal = pending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidTotal = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const overdue = pending.filter(item => billState(item).key === "overdue").length;

    if (pendingTotalEl) pendingTotalEl.textContent = rupiah(pendingTotal);
    if (paidTotalEl) paidTotalEl.textContent = rupiah(paidTotal);

    summaryBadge?.classList.remove("is-warning", "is-good");
    if (!bills.length) {
      if (summaryBadge) summaryBadge.textContent = "Belum ada";
      if (summaryNote) summaryNote.textContent = "Tambahkan tagihan rutin supaya kewajiban keluarga lebih mudah dipantau.";
    } else if (overdue) {
      summaryBadge?.classList.add("is-warning");
      if (summaryBadge) summaryBadge.textContent = `${overdue} terlambat`;
      if (summaryNote) summaryNote.textContent = `${pending.length} tagihan belum lunas, ${overdue} di antaranya melewati jatuh tempo.`;
    } else if (pending.length) {
      if (summaryBadge) summaryBadge.textContent = `${pending.length} belum lunas`;
      if (summaryNote) summaryNote.textContent = `${paid.length} tagihan sudah lunas dan ${pending.length} masih menunggu pembayaran.`;
    } else {
      summaryBadge?.classList.add("is-good");
      if (summaryBadge) summaryBadge.textContent = "Semua lunas";
      if (summaryNote) summaryNote.textContent = "Semua tagihan pada periode ini sudah dibayar.";
    }

    if (summary) summary.setAttribute("aria-busy", "false");
  }

  function cardFor(item) {
    const article = document.createElement("article");
    const state = billState(item);
    article.className = `bill-card ${state.className}`.trim();
    article.dataset.billPeriodId = item.period_id;

    const categoryText = item.parent_name
      ? `${item.parent_name} · ${item.account_name}`
      : item.account_name || "Kategori";

    const paidMeta = item.status === "paid"
      ? `Dibayar ${shortDate(item.paid_on)}${item.paid_wallet_name ? ` · ${escapeHTML(item.paid_wallet_name)}` : ""}`
      : `Jatuh tempo ${shortDate(item.due_on)}`;

    article.innerHTML = `
      <div class="bill-card-head">
        <span class="bill-card-icon"><ion-icon name="${escapeHTML(item.icon_value || "receipt-outline")}"></ion-icon></span>
        <span class="bill-card-title">
          <strong>${escapeHTML(item.bill_name || "Tagihan")}</strong>
          <small>${escapeHTML(categoryText)}</small>
        </span>
        <span class="bill-status ${state.className}">${escapeHTML(state.text)}</span>
      </div>
      <div class="bill-card-main">
        <div>
          <div class="bill-card-amount">${rupiah(item.amount)}</div>
          <p class="bill-card-meta">${paidMeta}</p>
        </div>
      </div>
      <div class="bill-card-actions">
        <button class="bill-card-button" type="button" data-bill-edit="${escapeHTML(item.period_id)}">
          <ion-icon name="create-outline"></ion-icon><span>Atur</span>
        </button>
        ${item.status !== "paid" ? `
          <button class="bill-card-button primary" type="button" data-bill-pay="${escapeHTML(item.period_id)}" ${item.category_archived ? "disabled" : ""}>
            <ion-icon name="checkmark-circle-outline"></ion-icon><span>${item.category_archived ? "Perbaiki Kategori" : "Bayar"}</span>
          </button>
        ` : ""}
      </div>
    `;

    return article;
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (countEl) countEl.textContent = bills.length ? `${bills.length} tagihan` : "Belum ada tagihan";

    if (!bills.length) {
      listEl.innerHTML = `
        <div class="bills-empty">
          <ion-icon name="receipt-outline"></ion-icon>
          <strong>Belum ada tagihan</strong>
          <p>Tambahkan listrik, internet, cicilan, langganan, atau kewajiban rutin lainnya.</p>
        </div>
      `;
      return;
    }

    bills.forEach(item => listEl.appendChild(cardFor(item)));
  }

  async function loadBills() {
    if (!family) return;
    if (listEl) {
      listEl.innerHTML = '<div class="bills-loading-card" aria-hidden="true"></div><div class="bills-loading-card" aria-hidden="true"></div>';
    }
    if (countEl) countEl.textContent = "Memuat…";
    if (summary) summary.setAttribute("aria-busy", "true");

    try {
      bills = await FinanceService.ambilTagihanBulan({
        familyId: family.id,
        periodMonth: monthDate()
      });
      renderSummary();
      renderList();
    } catch (error) {
      console.error("[Bills Load]", error);
      bills = [];
      renderSummary();
      if (listEl) {
        listEl.innerHTML = `
          <div class="bills-empty">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <strong>Tagihan belum dapat dimuat</strong>
            <p>${escapeHTML(error?.message || "Coba lagi beberapa saat.")}</p>
          </div>
        `;
      }
      if (countEl) countEl.textContent = "Gagal memuat";
      show(error?.message || "Tagihan gagal dimuat.", "error");
    }
  }


  function categoryById(id) {
    return categories.find(item => item.id === id) || null;
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

  function categoryChoice(category, parent = null, child = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-picker-choice ${child ? "category-picker-child-choice" : "category-picker-parent-choice"}`;
    button.dataset.billCategoryId = category.id;
    button.innerHTML = `
      ${child ? '<span class="category-picker-guide" aria-hidden="true">↳</span>' : ""}
      <span class="category-picker-icon"><ion-icon name="${escapeHTML(category.icon_value || parent?.icon_value || "folder-outline")}"></ion-icon></span>
      <span class="category-picker-name">${escapeHTML(category.name || "Kategori")}</span>
      ${selectedCategoryId === category.id ? '<ion-icon class="category-picker-check" name="checkmark-circle"></ion-icon>' : ""}
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
        expand.dataset.billCategoryExpand = parent.id;
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
    categoryLayer.hidden = true;
    document.body.classList.remove("category-picker-open");
    if ((!formLayer || formLayer.hidden) && (!payLayer || payLayer.hidden)) {
      document.body.style.overflow = "";
    }
    categoryTrigger?.focus();
  }

  function selectCategory(id) {
    if (!categoryById(id)) return;
    selectedCategoryId = id;
    refreshCategoryTrigger();
    closeCategoryPicker();
  }

  function openForm(item = null) {
    editingItem = item;
    selectedCategoryId = item?.account_id || "";

    if (formTitle) formTitle.textContent = item ? "Atur Tagihan" : "Tambah Tagihan";
    if (formPeriod) formPeriod.textContent = item ? `Jatuh tempo saat ini ${shortDate(item.due_on)}` : "Pilih tanggal jatuh tempo pertama";
    if (nameInput) nameInput.value = item?.bill_name || "";
    if (amountInput) amountInput.value = item ? formatNumberInput(item.amount) : "";
    if (dueDateInput) dueDateInput.value = item?.due_on || "";
    if (noteInput) noteInput.value = item?.bill_note || "";
    if (deleteButton) deleteButton.hidden = !item;
    if (editInfo) editInfo.hidden = !item;

    refreshCategoryTrigger();
    if (item && !categoryById(item.account_id)) {
      if (categorySelected) categorySelected.textContent = item.account_name || "Kategori diarsipkan";
      if (categoryParent) {
        categoryParent.textContent = "Pilih kategori aktif sebelum pembayaran.";
        categoryParent.hidden = false;
      }
    }

    if (formLayer) formLayer.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => nameInput?.focus());
  }

  function closeForm() {
    if (formLayer) formLayer.hidden = true;
    editingItem = null;
    selectedCategoryId = "";
    document.body.style.overflow = "";
  }

  async function saveBill(event) {
    event.preventDefault();
    if (!family) return;

    const name = String(nameInput?.value || "").trim();
    const amount = Number(digits(amountInput?.value));
    const dueDate = String(dueDateInput?.value || "");
    const note = String(noteInput?.value || "").trim();

    if (!name) {
      show("Nama tagihan wajib diisi.", "error");
      nameInput?.focus();
      return;
    }
    if (!amount || amount <= 0) {
      show("Nominal tagihan harus lebih dari Rp 0.", "error");
      amountInput?.focus();
      return;
    }
    if (!dueDate || !parseLocalDate(dueDate)) {
      show("Pilih tanggal jatuh tempo dari kalender.", "error");
      dueDateInput?.focus();
      return;
    }
    if (!selectedCategoryId) {
      show("Pilih kategori pengeluaran untuk tagihan ini.", "error");
      categoryTrigger?.focus();
      return;
    }

    if (saveButton) saveButton.disabled = true;
    const wasEditing = Boolean(editingItem);

    try {
      await FinanceService.simpanTagihan({
        familyId: family.id,
        billId: editingItem?.bill_id || null,
        dueDate,
        name,
        amount,
        accountId: selectedCategoryId,
        note
      });
      const editedPaidHistory = wasEditing && editingItem?.status === "paid";
      const due = parseLocalDate(dueDate);
      closeForm();
      if (due) {
        month = firstDay(due);
        syncMonthUI();
      }
      show(
        editedPaidHistory
          ? "Pengaturan tagihan berikutnya diperbarui. Periode yang sudah lunas tetap sebagai histori."
          : (wasEditing ? "Tagihan diperbarui." : "Tagihan ditambahkan."),
        "success"
      );
      await loadBills();
    } catch (error) {
      console.error("[Bill Save]", error);
      show(error?.message || "Tagihan gagal disimpan.", "error");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }

  async function archiveBill() {
    if (!editingItem || !family) return;
    const label = editingItem.bill_name || "tagihan ini";
    if (!confirm(`Hentikan ${label} mulai ${monthText()}?\n\nRiwayat tagihan dan pembayaran periode sebelumnya tetap disimpan.`)) return;

    if (deleteButton) deleteButton.disabled = true;
    if (saveButton) saveButton.disabled = true;
    try {
      await FinanceService.arsipTagihan({
        billId: editingItem.bill_id,
        periodMonth: monthDate()
      });
      closeForm();
      show("Tagihan dihentikan mulai periode ini.", "success");
      await loadBills();
    } catch (error) {
      console.error("[Bill Archive]", error);
      show(error?.message || "Tagihan gagal dihentikan.", "error");
    } finally {
      if (deleteButton) deleteButton.disabled = false;
      if (saveButton) saveButton.disabled = false;
    }
  }

  function fillWalletOptions() {
    if (!payWallet) return;
    payWallet.innerHTML = "";
    if (!wallets.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Belum ada dompet aktif";
      payWallet.appendChild(option);
      return;
    }

    wallets.forEach(wallet => {
      const option = document.createElement("option");
      option.value = wallet.wallet_id || wallet.id;
      option.textContent = `${wallet.name || "Dompet"} · ${rupiah(wallet.current_balance)}`;
      payWallet.appendChild(option);
    });
  }

  function openPay(item) {
    if (!item || item.status === "paid") return;
    if (item.category_archived) {
      show("Kategori tagihan sudah diarsipkan. Atur tagihan dan pilih kategori aktif dulu.", "error");
      openForm(item);
      return;
    }
    if (!wallets.length) {
      show("Belum ada dompet aktif untuk membayar tagihan.", "error");
      return;
    }

    paymentItem = item;
    fillWalletOptions();
    if (payName) payName.textContent = item.bill_name || "Tagihan";
    if (payAmount) payAmount.textContent = rupiah(item.amount);
    if (payPeriod) payPeriod.textContent = `${monthText()} · jatuh tempo ${shortDate(item.due_on)}`;
    if (payDate) payDate.value = todayISO();
    if (payLayer) payLayer.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => payWallet?.focus());
  }

  function closePay() {
    if (payLayer) payLayer.hidden = true;
    paymentItem = null;
    document.body.style.overflow = "";
  }

  async function payBill(event) {
    event.preventDefault();
    if (!family || !paymentItem) return;
    const walletId = payWallet?.value || "";
    const paidOn = payDate?.value || todayISO();

    if (!walletId) {
      show("Pilih dompet pembayaran.", "error");
      return;
    }

    if (paySubmit) paySubmit.disabled = true;
    try {
      await FinanceService.bayarTagihan({
        periodId: paymentItem.period_id,
        walletId,
        paidOn
      });
      window.FinanceCache?.remove("wallets", family.id);
      closePay();
      show("Tagihan lunas dan transaksi pengeluaran sudah dicatat.", "success");
      wallets = await FinanceService.ambilSaldoDompet(family.id);
      await loadBills();
    } catch (error) {
      console.error("[Bill Pay]", error);
      show(error?.message || "Pembayaran tagihan gagal.", "error");
    } finally {
      if (paySubmit) paySubmit.disabled = false;
    }
  }

  async function start() {
    if (window.AUTH_READY && (await window.AUTH_READY) === false) return;

    family = await AuthRouter.ambilFamilyAktif();
    if (!family) return;

    resetCurrentMonth({ reload: false });

    const [accountRows, walletRows] = await Promise.all([
      FinanceService.ambilAkun(family.id, "expense"),
      FinanceService.ambilSaldoDompet(family.id)
    ]);

    categories = (accountRows || []).filter(item => !item.archived_at);
    wallets = (walletRows || []).filter(item => !item.archived_at);
    await loadBills();
  }

  document.querySelectorAll("[data-bill-add]").forEach(button => {
    button.addEventListener("click", () => openForm());
  });

  document.querySelector("[data-bill-month-prev]")?.addEventListener("click", () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  });
  document.querySelector("[data-bill-month-next]")?.addEventListener("click", () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  });

  listEl?.addEventListener("click", event => {
    const edit = event.target.closest("[data-bill-edit]");
    if (edit) {
      const item = bills.find(row => row.period_id === edit.dataset.billEdit);
      if (item) openForm(item);
      return;
    }

    const pay = event.target.closest("[data-bill-pay]");
    if (pay && !pay.disabled) {
      const item = bills.find(row => row.period_id === pay.dataset.billPay);
      if (item) openPay(item);
    }
  });

  formClose?.addEventListener("click", closeForm);
  formLayer?.addEventListener("click", event => {
    if (event.target === formLayer) closeForm();
  });
  form?.addEventListener("submit", saveBill);
  deleteButton?.addEventListener("click", archiveBill);
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

    const expand = event.target.closest("[data-bill-category-expand]");
    if (expand) {
      const id = expand.dataset.billCategoryExpand;
      if (expandedCategories.has(id)) expandedCategories.delete(id);
      else expandedCategories.add(id);
      renderCategoryPicker();
      return;
    }

    const choice = event.target.closest("[data-bill-category-id]");
    if (choice) selectCategory(choice.dataset.billCategoryId);
  });

  payClose?.addEventListener("click", closePay);
  payLayer?.addEventListener("click", event => {
    if (event.target === payLayer) closePay();
  });
  payForm?.addEventListener("submit", payBill);

  window.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (categoryLayer && !categoryLayer.hidden) closeCategoryPicker();
    else if (payLayer && !payLayer.hidden) closePay();
    else if (formLayer && !formLayer.hidden) closeForm();
  });

  window.addEventListener("pageshow", event => {
    if (!event.persisted || !family) return;
    resetCurrentMonth({ reload: true });
  });

  const run = () => start().catch(error => {
    console.error("[Bills Init]", error);
    show(error?.message || "Tagihan gagal dibuka.", "error");
    if (listEl) {
      listEl.innerHTML = `
        <div class="bills-empty">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <strong>Tagihan belum dapat dibuka</strong>
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
