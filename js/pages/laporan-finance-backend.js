(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const MAX_RANGE_DAYS = 366;

  const state = {
    family: null,
    userId: null,
    mode: "this",
    startDate: "",
    endDate: "",
    accounts: [],
    transactions: [],
    wallets: [],
    budgetPeriods: [],
    budgetRows: [],
    bills: []
  };

  let toastTimer = null;

  const q = selector => document.querySelector(selector);

  function localISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseLocalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function monthRange(offset = 0) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return { startDate: localISO(start), endDate: localISO(end) };
  }

  function daysBetween(startDate, endDate) {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (!start || !end) return Infinity;
    return Math.floor((end - start) / 86400000);
  }

  function rupiah(value) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function compactRupiah(value) {
    const n = Number(value || 0);
    if (Math.abs(n) < 1_000_000) return rupiah(n);
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      notation: "compact",
      maximumFractionDigits: 1
    }).format(n);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function bacaPreferensi() {
    try {
      return JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}");
    } catch {
      return {};
    }
  }

  function simpanPreferensi(data) {
    localStorage.setItem(KUNCI_PENGATURAN, JSON.stringify({ ...bacaPreferensi(), ...data }));
  }

  function showNotice(text, type = "info") {
    const el = q("[data-report-notice]");
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = text;
    el.dataset.tipe = type;
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
  }

  function setLoading(loading) {
    q("[data-report-root]")?.setAttribute("aria-busy", loading ? "true" : "false");
    q(".report-page")?.classList.toggle("report-loading", loading);
    q("[data-report-refresh]")?.toggleAttribute("disabled", loading);
  }

  function formatDateRange(startDate, endDate) {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (!start || !end) return "Periode laporan";
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.getDate()} – ${end.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
    }
    return `${start.toLocaleDateString("id-ID", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })} – ${end.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  function syncFilterUI() {
    q("[data-report-range-label]").textContent = formatDateRange(state.startDate, state.endDate);
    document.querySelectorAll("[data-report-preset]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.reportPreset === state.mode);
    });
  }

  function accountMap() {
    return new Map(state.accounts.map(item => [item.id, item]));
  }

  function calculateCashflow() {
    let income = 0;
    let expense = 0;
    for (const item of state.transactions) {
      const amount = Number(item.amount || 0);
      if (item.kind === "income") income += amount;
      if (item.kind === "expense") expense += amount;
      if (item.kind === "transfer" && Number(item.transfer_fee || 0) > 0) {
        expense += Number(item.transfer_fee || 0);
      }
    }
    return { income, expense, net: income - expense };
  }

  function categoryGroups(kind) {
    const accounts = accountMap();
    const groups = new Map();
    for (const item of state.transactions) {
      if (item.kind !== kind) continue;
      const amount = Number(item.amount || 0);
      if (amount <= 0) continue;
      const account = accounts.get(item.account_id);
      const key = item.account_id || "__uncategorized__";
      const current = groups.get(key) || {
        id: key,
        name: account?.name || "Tanpa Kategori",
        icon: account?.icon_value || "ellipse-outline",
        amount: 0
      };
      current.amount += amount;
      groups.set(key, current);
    }

    if (kind === "expense") {
      const fee = state.transactions.reduce((sum, item) => {
        if (item.kind !== "transfer") return sum;
        return sum + Math.max(0, Number(item.transfer_fee || 0));
      }, 0);
      if (fee > 0) groups.set("__transfer_fee__", { id: "__transfer_fee__", name: "Biaya Admin Transfer", icon: "card-outline", amount: fee });
    }

    return [...groups.values()].sort((a, b) => b.amount - a.amount);
  }

  function renderCashflow() {
    const { income, expense, net } = calculateCashflow();
    q("[data-report-income]").textContent = rupiah(income);
    q("[data-report-expense]").textContent = rupiah(expense);
    q("[data-report-net]").textContent = `${net > 0 ? "+ " : ""}${rupiah(net)}`;

    const status = q("[data-report-cash-status]");
    const hero = q("[data-report-hero]");
    const heroIcon = hero?.querySelector(".report-hero-icon ion-icon");
    status.classList.remove("is-good", "is-bad");
    hero?.classList.remove("is-good", "is-bad");

    if (net > 0) {
      status.textContent = "Surplus";
      status.classList.add("is-good");
      hero?.classList.add("is-good");
      heroIcon?.setAttribute("name", "trending-up-outline");
      q("[data-report-net-note]").textContent = `Pemasukan lebih besar ${rupiah(net)} dibanding pengeluaran pada periode ini.`;
    } else if (net < 0) {
      status.textContent = "Defisit";
      status.classList.add("is-bad");
      hero?.classList.add("is-bad");
      heroIcon?.setAttribute("name", "trending-down-outline");
      q("[data-report-net-note]").textContent = `Pengeluaran lebih besar ${rupiah(Math.abs(net))} dibanding pemasukan pada periode ini.`;
    } else {
      status.textContent = "Seimbang";
      heroIcon?.setAttribute("name", "analytics-outline");
      q("[data-report-net-note]").textContent = "Pemasukan dan pengeluaran bernilai sama pada periode ini.";
    }
  }

  function renderCategories() {
    const rows = categoryGroups("expense");
    const root = q("[data-report-expense-categories]");
    const total = rows.reduce((sum, item) => sum + item.amount, 0);
    q("[data-report-expense-count]").textContent = rows.length ? `${rows.length} kategori` : "0 kategori";
    root.innerHTML = "";

    if (!rows.length) {
      root.innerHTML = '<div class="report-empty"><ion-icon name="pie-chart-outline"></ion-icon><span>Belum ada pengeluaran pada periode ini.</span></div>';
      return;
    }

    rows.slice(0, 7).forEach(item => {
      const percent = total > 0 ? (item.amount / total) * 100 : 0;
      const div = document.createElement("div");
      div.className = "report-category-item";
      div.innerHTML = `
        <div class="report-category-head">
          <div class="report-category-name">
            <span class="report-category-icon"><ion-icon name="${escapeHTML(item.icon)}"></ion-icon></span>
            <span><strong>${escapeHTML(item.name)}</strong><small>${Math.round(percent)}% dari pengeluaran</small></span>
          </div>
          <strong>${escapeHTML(compactRupiah(item.amount))}</strong>
        </div>
        <div class="report-track" aria-hidden="true"><span style="width:${Math.min(100, percent)}%"></span></div>`;
      root.appendChild(div);
    });
  }

  function periodOverlaps(period) {
    return String(period.start_date) <= state.endDate && String(period.end_date) >= state.startDate;
  }

  async function loadBudgets() {
    const periods = (state.budgetPeriods || []).filter(item => Number(item.budget_count || 0) > 0 && periodOverlaps(item));
    if (!periods.length) {
      state.budgetRows = [];
      return;
    }

    const groups = await Promise.all(periods.map(async period => {
      const rows = await FinanceService.ambilBudgetPeriode({ familyId: state.family.id, periodId: period.period_id });
      return rows.map(item => ({ ...item, period_start: period.start_date, period_end: period.end_date }));
    }));
    state.budgetRows = groups.flat();
  }

  function renderBudgets() {
    const rows = state.budgetRows || [];
    const root = q("[data-report-budgets]");
    const total = rows.reduce((sum, item) => sum + Number(item.budget_amount || 0), 0);
    const spent = rows.reduce((sum, item) => sum + Number(item.spent_amount || 0), 0);
    const remaining = total - spent;

    q("[data-report-budget-total]").textContent = rupiah(total);
    q("[data-report-budget-spent]").textContent = rupiah(spent);
    q("[data-report-budget-remaining]").textContent = rupiah(remaining);
    q("[data-report-budget-remaining]").style.color = remaining < 0 ? "var(--color-danger)" : "";

    const uniquePeriods = new Set(rows.map(item => `${item.period_start}|${item.period_end}`)).size;
    q("[data-report-budget-note]").textContent = rows.length
      ? `Akumulasi ${rows.length} budget dari ${uniquePeriods} rentang. Pemakaian setiap budget tetap dihitung berdasarkan rentang budget aslinya.`
      : "Belum ada budget yang bersinggungan dengan periode laporan ini.";

    root.innerHTML = "";
    if (!rows.length) {
      root.innerHTML = '<div class="report-empty"><ion-icon name="pie-chart-outline"></ion-icon><span>Belum ada budget terkait periode ini.</span></div>';
      return;
    }

    const sorted = [...rows].sort((a, b) => {
      const rank = item => item.budget_status === "over" ? 0 : item.budget_status === "warning" ? 1 : 2;
      return rank(a) - rank(b) || Number(b.progress_percent || 0) - Number(a.progress_percent || 0);
    });

    sorted.slice(0, 7).forEach(item => {
      const progress = Math.max(0, Number(item.progress_percent || 0));
      const div = document.createElement("div");
      div.className = `report-budget-item${item.budget_status === "over" ? " is-over" : item.budget_status === "warning" ? " is-warning" : ""}`;
      const statusText = item.budget_status === "over" ? "Melebihi" : item.budget_status === "warning" ? "Perhatian" : "Aman";
      div.innerHTML = `
        <div class="report-budget-head">
          <div class="report-budget-name">
            <span class="report-budget-icon"><ion-icon name="${escapeHTML(item.icon_value || "folder-outline")}"></ion-icon></span>
            <span><strong>${escapeHTML(item.account_name || "Kategori")}</strong><small>${escapeHTML(formatDateRange(item.period_start, item.period_end))}</small></span>
          </div>
          <strong>${Math.round(progress)}%</strong>
        </div>
        <div class="report-track" aria-hidden="true"><span style="width:${Math.min(100, progress)}%"></span></div>
        <div class="report-budget-meta"><span>${escapeHTML(statusText)}</span><span>${escapeHTML(compactRupiah(item.spent_amount))} / ${escapeHTML(compactRupiah(item.budget_amount))}</span></div>`;
      root.appendChild(div);
    });
  }

  function renderBills() {
    const bills = state.bills || [];
    const total = bills.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = bills.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
    const remaining = bills.reduce((sum, item) => sum + Number(item.remaining_amount || 0), 0);
    const today = localISO();
    const overdue = bills.filter(item => Number(item.remaining_amount || 0) > 0 && String(item.due_on) < today).length;
    const partial = bills.filter(item => Number(item.paid_amount || 0) > 0 && Number(item.remaining_amount || 0) > 0).length;

    q("[data-report-bill-total]").textContent = rupiah(total);
    q("[data-report-bill-paid]").textContent = rupiah(paid);
    q("[data-report-bill-remaining]").textContent = rupiah(remaining);

    const status = q("[data-report-bill-status]");
    status.classList.toggle("is-warning", overdue > 0);
    if (!bills.length) {
      status.textContent = "Belum ada tagihan dengan jatuh tempo pada periode ini.";
    } else if (remaining <= 0) {
      status.textContent = `${bills.length} tagihan pada periode ini sudah lunas seluruhnya.`;
    } else {
      const bits = [`${bills.length} tagihan`, `sisa ${rupiah(remaining)}`];
      if (partial) bits.push(`${partial} dibayar sebagian`);
      if (overdue) bits.push(`${overdue} terlambat`);
      status.textContent = bits.join(" · ");
    }
  }

  function renderWallets(totalRows) {
    const wallets = state.wallets || [];
    const total = Number(totalRows?.[0]?.total_balance ?? wallets.reduce((sum, item) => sum + Number(item.current_balance || 0), 0));
    q("[data-report-wallet-total]").textContent = rupiah(total);
    const root = q("[data-report-wallets]");
    root.innerHTML = "";

    if (!wallets.length) {
      root.innerHTML = '<div class="report-empty"><ion-icon name="wallet-outline"></ion-icon><span>Belum ada dompet aktif.</span></div>';
      return;
    }

    const maxAbs = Math.max(...wallets.map(item => Math.abs(Number(item.current_balance || 0))), 1);
    wallets.forEach(item => {
      const amount = Number(item.current_balance || 0);
      const percent = (Math.abs(amount) / maxAbs) * 100;
      const div = document.createElement("div");
      div.className = "report-wallet-item";
      div.innerHTML = `
        <div class="report-wallet-head">
          <div class="report-wallet-name">
            <span class="report-wallet-icon"><ion-icon name="${escapeHTML(item.icon_value || "wallet-outline")}"></ion-icon></span>
            <span><strong>${escapeHTML(item.name || "Dompet")}</strong><small>Saldo terkini</small></span>
          </div>
          <strong>${escapeHTML(rupiah(amount))}</strong>
        </div>
        <div class="report-track" aria-hidden="true"><span style="width:${Math.min(100, percent)}%"></span></div>`;
      root.appendChild(div);
    });
  }

  function insightNode(icon, title, text, warning = false) {
    const div = document.createElement("div");
    div.className = "report-insight";
    div.innerHTML = `
      <span class="report-insight-icon${warning ? " is-warning" : ""}"><ion-icon name="${escapeHTML(icon)}"></ion-icon></span>
      <span class="report-insight-copy"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(text)}</span></span>`;
    return div;
  }

  function renderInsights() {
    const root = q("[data-report-insights]");
    root.innerHTML = "";
    const { income, expense, net } = calculateCashflow();
    const expenseGroups = categoryGroups("expense");
    const top = expenseGroups[0] || null;
    const budgetWarning = state.budgetRows.filter(item => ["warning", "over"].includes(item.budget_status));
    const billRemaining = state.bills.reduce((sum, item) => sum + Number(item.remaining_amount || 0), 0);
    const today = localISO();
    const overdue = state.bills.filter(item => Number(item.remaining_amount || 0) > 0 && String(item.due_on) < today).length;

    if (income === 0 && expense === 0) {
      root.appendChild(insightNode("sparkles-outline", "Belum ada arus kas", "Belum ada transaksi pemasukan atau pengeluaran pada periode ini."));
    } else if (net >= 0) {
      root.appendChild(insightNode("trending-up-outline", "Arus kas terjaga", `Periode ini surplus ${rupiah(net)}.`));
    } else {
      root.appendChild(insightNode("trending-down-outline", "Arus kas defisit", `Pengeluaran melampaui pemasukan sebesar ${rupiah(Math.abs(net))}.`, true));
    }

    if (top) {
      const share = expense > 0 ? Math.round((top.amount / expense) * 100) : 0;
      root.appendChild(insightNode("pie-chart-outline", "Pengeluaran terbesar", `${top.name} menyerap ${share}% atau ${rupiah(top.amount)} dari pengeluaran.`));
    }

    if (budgetWarning.length) {
      const over = budgetWarning.filter(item => item.budget_status === "over").length;
      root.appendChild(insightNode("speedometer-outline", "Budget perlu perhatian", `${budgetWarning.length} budget mencapai batas peringatan${over ? `; ${over} sudah melebihi budget` : ""}.`, over > 0));
    } else if (state.budgetRows.length) {
      root.appendChild(insightNode("shield-checkmark-outline", "Budget masih aman", "Belum ada budget terkait periode ini yang mencapai batas peringatan."));
    }

    if (billRemaining > 0) {
      root.appendChild(insightNode("receipt-outline", "Masih ada kewajiban", `Sisa tagihan ${rupiah(billRemaining)}${overdue ? ` dan ${overdue} tagihan sudah terlambat` : ""}.`, overdue > 0));
    } else if (state.bills.length) {
      root.appendChild(insightNode("checkmark-circle-outline", "Tagihan periode ini lunas", "Semua tagihan dengan jatuh tempo di periode laporan sudah terbayar."));
    }
  }

  async function loadReport() {
    if (!state.family) return;
    setLoading(true);
    try {
      const walletLoader = FinanceService.ambilSaldoDompetFresh || FinanceService.ambilSaldoDompet;
      const [transactions, accounts, wallets, totalRows, periods, bills] = await Promise.all([
        FinanceService.ambilTransaksiRentangLengkap({ familyId: state.family.id, startDate: state.startDate, endDate: state.endDate }),
        FinanceService.ambilAkunLaporan(state.family.id),
        walletLoader(state.family.id),
        FinanceService.ambilTotalKeluarga(state.family.id),
        FinanceService.ambilPeriodeBudget(state.family.id),
        FinanceService.ambilTagihanRentang({ familyId: state.family.id, startDate: state.startDate, endDate: state.endDate })
      ]);

      state.transactions = transactions || [];
      state.accounts = accounts || [];
      state.wallets = wallets || [];
      state.budgetPeriods = periods || [];
      state.bills = bills || [];

      await loadBudgets();
      renderCashflow();
      renderCategories();
      renderBudgets();
      renderBills();
      renderWallets(totalRows || []);
      renderInsights();
    } catch (error) {
      console.error("[Laporan Finance]", error);
      showNotice(error?.message || "Laporan gagal dimuat.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function setPreset(mode) {
    if (mode === "custom") {
      openCustom();
      return;
    }
    const range = mode === "last" ? monthRange(-1) : monthRange(0);
    state.mode = mode;
    state.startDate = range.startDate;
    state.endDate = range.endDate;
    syncFilterUI();
    await loadReport();
  }

  function openCustom() {
    q("[data-report-custom-start]").value = state.startDate;
    q("[data-report-custom-end]").value = state.endDate;
    q("[data-report-custom-error]").hidden = true;
    q("[data-report-custom-layer]").hidden = false;
  }

  function closeCustom() {
    q("[data-report-custom-layer]").hidden = true;
  }

  async function applyCustom() {
    const start = q("[data-report-custom-start]").value;
    const end = q("[data-report-custom-end]").value;
    const error = q("[data-report-custom-error]");
    let message = "";
    if (!start || !end) message = "Tanggal mulai dan tanggal selesai wajib dipilih.";
    else if (end < start) message = "Tanggal selesai tidak boleh sebelum tanggal mulai.";
    else if (daysBetween(start, end) > MAX_RANGE_DAYS) message = "Periode custom maksimal 367 hari.";

    if (message) {
      error.textContent = message;
      error.hidden = false;
      return;
    }

    state.mode = "custom";
    state.startDate = start;
    state.endDate = end;
    closeCustom();
    syncFilterUI();
    await loadReport();
  }

  function setupEvents() {
    document.querySelectorAll("[data-report-preset]").forEach(button => {
      button.addEventListener("click", () => setPreset(button.dataset.reportPreset));
    });
    q("[data-report-refresh]")?.addEventListener("click", loadReport);
    q("[data-report-custom-close]")?.addEventListener("click", closeCustom);
    q("[data-report-custom-apply]")?.addEventListener("click", applyCustom);
    q("[data-report-custom-layer]")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeCustom();
    });
  }

  async function init() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    try {
      const session = await AuthService.ambilSession();
      if (!session) throw new Error("Belum ada session Supabase.");
      state.userId = session.user?.id || null;

      const families = await FamilyService.ambilKeluargaSaya();
      if (!families.length) throw new Error("Akun ini belum tergabung ke ruang keluarga.");
      const prefs = bacaPreferensi();
      state.family = families.find(item => item.id === prefs.familyAktif) || families[0];
      simpanPreferensi({ familyAktif: state.family.id });

      const range = monthRange(0);
      state.startDate = range.startDate;
      state.endDate = range.endDate;
      syncFilterUI();
      setupEvents();
      await loadReport();
    } catch (error) {
      console.error("[Laporan Init]", error);
      showNotice(error?.message || "Laporan tidak dapat dibuka.", "error");
      setLoading(false);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
