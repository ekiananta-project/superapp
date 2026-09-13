/* RuangKitha v2.0.0a52 — Maintenance Core V1 page */
(() => {
  "use strict";

  const PREF_KEY = "keuangan_pengaturan_v1";
  const q = selector => document.querySelector(selector);
  const qa = selector => [...document.querySelectorAll(selector)];

  let familyId = "";
  let data = { groups: [], assets: [], items: [] };
  let currentAssetId = "";
  let currentItemId = "";
  let editingItemId = "";
  let reminderSelection = new Set([7, 3]);
  let financeSelection = null;
  let financeOptionsCache = null;
  let financeContext = { mode: "completion", historyId: "" };
  let editorContext = { type: "group", id: "", returnToItem: false };
  let toastTimer = null;

  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function writeFamily(id) {
    if (!id) return;
    const next = { ...readPrefs(), familyAktif: id };
    try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch {}
  }

  function showMessage(target, text) {
    if (!target) return;
    target.textContent = String(text || "");
    target.hidden = !text;
  }

  function showToast(text) {
    const root = q("[data-maint-toast]");
    if (!root) return;
    clearTimeout(toastTimer);
    root.textContent = text;
    root.hidden = false;
    toastTimer = setTimeout(() => { root.hidden = true; }, 2800);
  }

  function setLayer(selector, open) {
    const layer = q(selector);
    if (!layer) return;
    layer.hidden = !open;
    document.documentElement.classList.toggle("modal-open", qa(".maintenance-layer:not([hidden])").length > 0);
  }

  function closeAllLayers() {
    qa(".maintenance-layer").forEach(layer => { layer.hidden = true; });
    document.documentElement.classList.remove("modal-open");
  }

  function formatDate(value, options = {}) {
    if (!value) return "—";
    const [y, m, d] = String(value).split("-").map(Number);
    const date = new Date(y, m - 1, d, 12);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: options.short ? "short" : "long",
      year: options.noYear ? undefined : "numeric"
    }).format(date);
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  function parseMoney(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return 0;
    const number = Number(digits);
    return Number.isSafeInteger(number) ? number : 0;
  }

  function formatMoneyInput(el) {
    if (!el) return;
    const number = parseMoney(el.value);
    el.value = number ? new Intl.NumberFormat("id-ID").format(number) : "";
  }

  function groupById(id) { return data.groups.find(item => item.id === id) || null; }
  function assetById(id) { return data.assets.find(item => item.id === id) || null; }
  function itemById(id) { return data.items.find(item => item.id === id) || null; }
  function itemsForAsset(assetId) { return data.items.filter(item => item.asset_id === assetId); }

  function dueState(item) {
    if (!item?.next_due_on) return { key: "complete", label: "Selesai" };
    const diff = window.RuangKithaMaintenance.daysBetween(window.RuangKithaMaintenance.todayISO(), item.next_due_on);
    if (diff < 0) return { key: "overdue", label: `Terlewat ${Math.abs(diff)} hari`, diff };
    if (diff === 0) return { key: "today", label: "Hari ini", diff };
    if (diff <= 30) return { key: "upcoming", label: `${diff} hari lagi`, diff };
    return { key: "safe", label: formatDate(item.next_due_on, { short: true }), diff };
  }

  function assetState(assetId) {
    const items = itemsForAsset(assetId).filter(item => item.next_due_on);
    if (!items.length) return { key: "safe", label: "Belum ada jadwal", helper: "Tambah perawatan saat dibutuhkan" };
    const ranked = items.map(item => ({ item, state: dueState(item) })).sort((a, b) => {
      const rank = { overdue: 0, today: 1, upcoming: 2, safe: 3, complete: 4 };
      const delta = (rank[a.state.key] ?? 9) - (rank[b.state.key] ?? 9);
      if (delta) return delta;
      return String(a.item.next_due_on || "9999").localeCompare(String(b.item.next_due_on || "9999"));
    });
    const top = ranked[0];
    return { key: top.state.key, label: top.state.label, helper: `${top.item.title} · ${items.length} jadwal aktif` };
  }

  function renderSummary() {
    const summary = window.RuangKithaMaintenance.__test.summarize(data);
    const overdue = q("[data-maint-overdue]");
    const today = q("[data-maint-today]");
    const upcoming = q("[data-maint-upcoming]");
    if (overdue) overdue.textContent = String(summary.overdue || 0);
    if (today) today.textContent = String(summary.todayCount || 0);
    if (upcoming) upcoming.textContent = String(summary.upcoming || 0);
  }

  function icon(name) {
    const node = document.createElement("ion-icon");
    node.setAttribute("name", name);
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function renderGroups() {
    const root = q("[data-maint-groups]");
    if (!root) return;
    root.replaceChildren();

    if (!data.groups.length) {
      const empty = document.createElement("div");
      empty.className = "maintenance-empty-state";
      const visual = document.createElement("span"); visual.appendChild(icon("layers-outline"));
      const strong = document.createElement("strong"); strong.textContent = "Belum ada kelompok aset";
      const text = document.createElement("p"); text.textContent = "Buat kelompok lalu tambahkan aset yang ingin dijaga bersama.";
      empty.append(visual, strong, text);
      root.appendChild(empty);
      return;
    }

    data.groups.forEach(group => {
      const card = document.createElement("section");
      card.className = "maintenance-group-card";

      const head = document.createElement("div");
      head.className = "maintenance-group-heading";
      const title = document.createElement("strong"); title.textContent = group.name;
      const assets = data.assets.filter(asset => asset.group_id === group.id);
      const count = document.createElement("span"); count.textContent = `${assets.length} aset`;
      head.append(title, count);
      card.appendChild(head);

      const list = document.createElement("div");
      list.className = "maintenance-asset-list";
      if (!assets.length) {
        const empty = document.createElement("div");
        empty.className = "maintenance-empty-group";
        empty.textContent = "Belum ada aset di kelompok ini.";
        list.appendChild(empty);
      } else {
        assets.forEach(asset => {
          const state = assetState(asset.id);
          const button = document.createElement("button");
          button.type = "button";
          button.className = "maintenance-asset-row";
          button.dataset.assetId = asset.id;

          const visual = document.createElement("span");
          visual.className = "maintenance-asset-icon";
          visual.appendChild(icon("cube-outline"));

          const copy = document.createElement("span");
          copy.className = "maintenance-asset-copy";
          const name = document.createElement("strong"); name.textContent = asset.name;
          const helper = document.createElement("small"); helper.textContent = state.helper;
          copy.append(name, helper);

          const right = document.createElement("span");
          right.className = "maintenance-asset-state";
          const pill = document.createElement("span");
          pill.className = `maintenance-state-pill is-${state.key}`;
          pill.textContent = state.label;
          right.append(pill, icon("chevron-forward-outline"));

          button.append(visual, copy, right);
          button.addEventListener("click", () => openAssetDetail(asset.id));
          list.appendChild(button);
        });
      }
      card.appendChild(list);
      root.appendChild(card);
    });
  }

  async function refresh({ silent = false } = {}) {
    if (!familyId) return;
    if (!silent) q("[data-maintenance-root]")?.setAttribute("aria-busy", "true");
    try {
      data = await window.RuangKithaMaintenance.dashboard(familyId);
      renderSummary();
      renderGroups();
      renderManageList();
      fillAssetSelect();
    } catch (error) {
      console.error("[Maintenance refresh]", error);
      showMessage(q("[data-maint-message]"), error?.message || "Maintenance belum dapat dimuat.");
    } finally {
      q("[data-maintenance-root]")?.setAttribute("aria-busy", "false");
    }
  }

  function fillAssetSelect(selected = "") {
    const select = q("[data-maint-asset-select]");
    if (!select) return;
    select.replaceChildren();
    data.groups.forEach(group => {
      const assets = data.assets.filter(asset => asset.group_id === group.id);
      if (!assets.length) return;
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.name;
      assets.forEach(asset => {
        const option = document.createElement("option");
        option.value = asset.id;
        option.textContent = asset.name;
        option.selected = asset.id === selected;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });
  }

  function renderReminderOptions() {
    const root = q("[data-maint-reminder-options]");
    if (!root) return;
    root.replaceChildren();
    const values = [...new Set([30, 7, 3, ...reminderSelection])].sort((a, b) => b - a);
    values.forEach(value => {
      const label = document.createElement("label");
      if (![30, 7, 3].includes(value)) label.classList.add("is-custom");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(value);
      input.checked = reminderSelection.has(value);
      input.addEventListener("change", () => {
        if (input.checked) reminderSelection.add(value);
        else reminderSelection.delete(value);
      });
      const text = document.createElement("span");
      text.textContent = `${value} hari sebelum`;
      label.append(input, text);
      root.appendChild(label);
    });
  }

  function setRepeatVisibility() {
    const mode = q('[data-maint-item-form] input[name="scheduleMode"]:checked')?.value || "once";
    const repeat = q("[data-maint-repeat]");
    if (repeat) repeat.hidden = mode !== "recurring";
  }

  function openItemForm(itemId = "", assetId = "") {
    editingItemId = itemId || "";
    const item = itemId ? itemById(itemId) : null;
    const form = q("[data-maint-item-form]");
    if (!form) return;
    form.reset();
    showMessage(q("[data-maint-item-message]"), "");
    q("[data-maint-item-title]").textContent = item ? "Ubah Perawatan" : "Tambah Perawatan";

    fillAssetSelect(item?.asset_id || assetId || data.assets[0]?.id || "");
    if (item?.asset_id || assetId) form.elements.asset.value = item?.asset_id || assetId;
    form.elements.title.value = item?.title || "";
    form.elements.due.value = item?.next_due_on || window.RuangKithaMaintenance.todayISO();
    form.elements.note.value = item?.note || "";
    const mode = item?.schedule_mode || "once";
    const modeEl = form.querySelector(`input[name="scheduleMode"][value="${mode}"]`);
    if (modeEl) modeEl.checked = true;
    form.elements.intervalValue.value = item?.interval_value || 3;
    form.elements.intervalUnit.value = item?.interval_unit || "month";
    reminderSelection = new Set(item ? (item.reminder_days || []) : [7, 3]);
    renderReminderOptions();
    setRepeatVisibility();
    setLayer("[data-maint-item-layer]", true);
    setTimeout(() => form.elements.title?.focus(), 80);
  }

  async function submitItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = q("[data-maint-item-message]");
    showMessage(message, "");
    const mode = form.elements.scheduleMode.value;
    if (!form.elements.asset.value) return showMessage(message, "Tambahkan atau pilih aset terlebih dahulu.");
    const button = q("[data-maint-item-submit]");
    button.disabled = true;
    button.textContent = "Menyimpan...";
    try {
      const id = await window.RuangKithaMaintenance.saveItem({
        familyId,
        itemId: editingItemId || null,
        assetId: form.elements.asset.value,
        title: form.elements.title.value,
        nextDueOn: form.elements.due.value,
        scheduleMode: mode,
        intervalValue: mode === "recurring" ? form.elements.intervalValue.value : null,
        intervalUnit: mode === "recurring" ? form.elements.intervalUnit.value : null,
        reminderDays: [...reminderSelection],
        note: form.elements.note.value
      });
      setLayer("[data-maint-item-layer]", false);
      showToast(editingItemId ? "Perawatan diperbarui." : "Perawatan ditambahkan.");
      await refresh({ silent: true });
      const openedId = String(id || editingItemId || "");
      if (openedId) await openItemDetail(openedId);
    } catch (error) {
      showMessage(message, error?.message || "Perawatan gagal disimpan.");
    } finally {
      button.disabled = false;
      button.textContent = "Simpan Perawatan";
    }
  }

  function detailHero(asset, helper = "") {
    const hero = document.createElement("div");
    hero.className = "maintenance-detail-hero";
    const small = document.createElement("small"); small.textContent = groupById(asset?.group_id)?.name || "Maintenance";
    const strong = document.createElement("strong"); strong.textContent = asset?.name || "Aset";
    const p = document.createElement("p"); p.textContent = helper;
    hero.append(small, strong, p);
    return hero;
  }

  async function openAssetDetail(assetId) {
    const asset = assetById(assetId);
    if (!asset) return;
    currentAssetId = assetId;
    currentItemId = "";
    q("[data-maint-detail-group]").textContent = groupById(asset.group_id)?.name || "Maintenance";
    q("[data-maint-detail-title]").textContent = asset.name;
    const root = q("[data-maint-detail-body]");
    root.replaceChildren();

    const items = itemsForAsset(assetId);
    root.appendChild(detailHero(asset, items.length ? `${items.length} jenis perawatan tersimpan untuk aset ini.` : "Belum ada perawatan untuk aset ini."));

    const actions = document.createElement("div");
    actions.className = "maintenance-detail-actions";
    const add = document.createElement("button");
    add.type = "button"; add.className = "is-primary"; add.textContent = "+ Tambah perawatan";
    add.addEventListener("click", () => openItemForm("", assetId));
    const manage = document.createElement("button");
    manage.type = "button"; manage.textContent = "Kelola aset";
    manage.addEventListener("click", () => { setLayer("[data-maint-detail-layer]", false); openManage(); });
    actions.append(add, manage);
    root.appendChild(actions);

    const list = document.createElement("div");
    list.className = "maintenance-asset-items";
    if (!items.length) {
      const empty = document.createElement("div"); empty.className = "maintenance-empty-group"; empty.textContent = "Tambahkan perawatan pertama untuk mulai menjaga siklus aset ini."; list.appendChild(empty);
    } else {
      items.forEach(item => {
        const state = dueState(item);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "maintenance-asset-item";
        const copy = document.createElement("span");
        const strong = document.createElement("strong"); strong.textContent = item.title;
        const small = document.createElement("small");
        small.textContent = item.next_due_on ? `${state.label} · ${item.schedule_mode === "recurring" ? "Berulang" : "Sekali"}` : "Selesai · tidak ada jadwal aktif";
        copy.append(strong, small);
        button.append(copy, icon("chevron-forward-outline"));
        button.addEventListener("click", () => openItemDetail(item.id));
        list.appendChild(button);
      });
    }
    root.appendChild(list);
    setLayer("[data-maint-detail-layer]", true);
  }

  function intervalLabel(item) {
    if (item.schedule_mode !== "recurring") return "Sekali";
    const unit = { day: "hari", week: "minggu", month: "bulan", year: "tahun" }[item.interval_unit] || item.interval_unit;
    return `Setiap ${item.interval_value} ${unit}`;
  }

  async function openItemDetail(itemId) {
    const item = itemById(itemId);
    if (!item) return;
    currentItemId = itemId;
    currentAssetId = item.asset_id;
    const asset = assetById(item.asset_id);
    q("[data-maint-detail-group]").textContent = `${item.group_name || "Maintenance"} · ${item.asset_name || "Aset"}`;
    q("[data-maint-detail-title]").textContent = item.title;
    const root = q("[data-maint-detail-body]");
    root.replaceChildren();
    root.appendChild(detailHero(asset, item.note || "Riwayat dan siklus perawatan tersimpan di aset ini."));

    const meta = document.createElement("div");
    meta.className = "maintenance-item-meta-grid";
    const due = document.createElement("div");
    const dueSmall = document.createElement("small"); dueSmall.textContent = item.next_due_on ? "Jadwal berikutnya" : "Status";
    const dueStrong = document.createElement("strong"); dueStrong.textContent = item.next_due_on ? formatDate(item.next_due_on) : "Selesai";
    due.append(dueSmall, dueStrong);
    const cycle = document.createElement("div");
    const cycleSmall = document.createElement("small"); cycleSmall.textContent = "Siklus";
    const cycleStrong = document.createElement("strong"); cycleStrong.textContent = intervalLabel(item);
    cycle.append(cycleSmall, cycleStrong);
    const last = document.createElement("div");
    const lastSmall = document.createElement("small"); lastSmall.textContent = "Terakhir dilakukan";
    const lastStrong = document.createElement("strong"); lastStrong.textContent = item.last_performed_on ? formatDate(item.last_performed_on) : "Belum ada";
    last.append(lastSmall, lastStrong);
    const historyCount = document.createElement("div");
    const countSmall = document.createElement("small"); countSmall.textContent = "Riwayat";
    const countStrong = document.createElement("strong"); countStrong.textContent = `${item.history_count || 0} kali`;
    historyCount.append(countSmall, countStrong);
    meta.append(due, cycle, last, historyCount);
    root.appendChild(meta);

    const reminders = document.createElement("div");
    reminders.className = "maintenance-reminder-chips";
    if (item.reminder_days?.length) item.reminder_days.forEach(days => {
      const chip = document.createElement("span"); chip.textContent = `${days} hari sebelum`; reminders.appendChild(chip);
    });
    else {
      const chip = document.createElement("span"); chip.textContent = "Tanpa pengingat awal"; reminders.appendChild(chip);
    }
    root.appendChild(reminders);

    if (item.next_due_on) {
      const actions = document.createElement("div");
      actions.className = "maintenance-detail-actions";
      const complete = document.createElement("button");
      complete.type = "button"; complete.className = "is-primary"; complete.textContent = "✓ Sudah dirawat";
      complete.addEventListener("click", () => openComplete(item.id));
      const edit = document.createElement("button");
      edit.type = "button"; edit.textContent = "Ubah jadwal";
      edit.addEventListener("click", () => openItemForm(item.id));
      actions.append(complete, edit);
      root.appendChild(actions);
    }

    const historySection = document.createElement("section");
    historySection.className = "maintenance-history-section";
    const h3 = document.createElement("h3"); h3.textContent = "Riwayat perawatan";
    const list = document.createElement("div"); list.className = "maintenance-history-list";
    const loading = document.createElement("div"); loading.className = "maintenance-empty-group"; loading.textContent = "Memuat riwayat…";
    list.appendChild(loading);
    historySection.append(h3, list);
    root.appendChild(historySection);

    const secondary = document.createElement("div");
    secondary.className = "maintenance-item-secondary-actions";
    const editAny = document.createElement("button"); editAny.type = "button"; editAny.textContent = "Ubah perawatan"; editAny.addEventListener("click", () => openItemForm(item.id));
    const archive = document.createElement("button"); archive.type = "button"; archive.className = "is-danger"; archive.textContent = "Arsipkan";
    archive.addEventListener("click", () => archiveItem(item.id));
    secondary.append(editAny, archive);
    root.appendChild(secondary);

    setLayer("[data-maint-detail-layer]", true);

    try {
      const rows = await window.RuangKithaMaintenance.history({ familyId, itemId, limit: 50 });
      if (currentItemId !== itemId) return;
      renderHistory(list, rows);
    } catch (error) {
      list.replaceChildren();
      const failed = document.createElement("div"); failed.className = "maintenance-empty-group"; failed.textContent = error?.message || "Riwayat belum dapat dimuat."; list.appendChild(failed);
    }
  }

  function renderHistory(root, rows) {
    root.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement("div"); empty.className = "maintenance-empty-group"; empty.textContent = "Belum ada riwayat perawatan."; root.appendChild(empty); return;
    }
    rows.forEach(row => {
      const card = document.createElement("article");
      card.className = "maintenance-history-row";
      const top = document.createElement("div"); top.className = "maintenance-history-top";
      const strong = document.createElement("strong"); strong.textContent = formatDate(row.performed_on);
      const scheduled = document.createElement("span"); scheduled.textContent = row.scheduled_for && row.scheduled_for !== row.performed_on ? `Jadwal ${formatDate(row.scheduled_for, { short: true })}` : "Sesuai kejadian nyata";
      top.append(strong, scheduled); card.appendChild(top);
      if (row.note) { const p = document.createElement("p"); p.textContent = row.note; card.appendChild(p); }

      const finance = document.createElement("div"); finance.className = "maintenance-history-finance";
      if (row.finance_transaction_id) {
        const text = document.createElement("span"); text.textContent = `${formatMoney(row.finance_amount)} · ${row.finance_wallet_name || "Keuangan"}`;
        const button = document.createElement("button"); button.type = "button"; button.textContent = "Lihat transaksi";
        button.addEventListener("click", () => { location.href = `detail-transaksi.html?id=${encodeURIComponent(row.finance_transaction_id)}`; });
        finance.append(text, button);
      } else {
        const text = document.createElement("span"); text.textContent = "Belum ada biaya tercatat";
        const button = document.createElement("button"); button.type = "button"; button.textContent = "+ Catat biaya";
        button.addEventListener("click", () => openCostForHistory(row.id));
        finance.append(text, button);
      }
      card.appendChild(finance);
      root.appendChild(card);
    });
  }

  async function archiveItem(itemId) {
    if (!confirm("Arsipkan perawatan ini? Riwayat yang sudah tercatat tetap disimpan.")) return;
    try {
      await window.RuangKithaMaintenance.archiveItem({ familyId, itemId });
      setLayer("[data-maint-detail-layer]", false);
      showToast("Perawatan diarsipkan. Riwayat tetap aman.");
      await refresh({ silent: true });
      if (currentAssetId) openAssetDetail(currentAssetId);
    } catch (error) {
      showToast(error?.message || "Perawatan gagal diarsipkan.");
    }
  }

  function resetFinanceSelection() {
    financeSelection = null;
    updateCostTrigger();
  }

  function updateCostTrigger() {
    const title = q("[data-maint-cost-title]");
    const copy = q("[data-maint-cost-copy]");
    if (!title || !copy) return;
    if (!financeSelection) {
      title.textContent = "Catat biaya ke Keuangan?";
      copy.textContent = "Opsional · isi dompet dan nominal jika ada pengeluaran.";
      return;
    }
    const wallet = financeOptionsCache?.wallets?.find(item => item.wallet_id === financeSelection.walletId);
    title.textContent = formatMoney(financeSelection.amount);
    copy.textContent = `${wallet?.name || "Dompet"} · akan dicatat sebagai Pengeluaran / Maintenance`;
  }

  function openComplete(itemId) {
    const item = itemById(itemId);
    if (!item) return;
    currentItemId = itemId;
    resetFinanceSelection();
    const form = q("[data-maint-complete-form]");
    form.reset();
    const today = window.RuangKithaMaintenance.todayISO();
    form.elements.performedOn.value = today;
    form.elements.performedOn.max = today;
    q("[data-maint-complete-subtitle]").textContent = `${item.title} · ${item.asset_name}`;
    showMessage(q("[data-maint-complete-message]"), "");
    setLayer("[data-maint-complete-layer]", true);
  }

  async function loadFinanceOptions() {
    financeOptionsCache = await window.RuangKithaMaintenance.financeOptions(familyId);
    const select = q("[data-maint-wallet-select]");
    select.replaceChildren();
    (financeOptionsCache.wallets || []).forEach(wallet => {
      const option = document.createElement("option");
      option.value = wallet.wallet_id;
      option.textContent = wallet.name;
      option.selected = wallet.wallet_id === (financeSelection?.walletId || financeOptionsCache.preferredWalletId);
      select.appendChild(option);
    });
    if (financeSelection?.walletId) select.value = financeSelection.walletId;
    return financeOptionsCache;
  }

  async function openCost({ mode = "completion", historyId = "" } = {}) {
    financeContext = { mode, historyId };
    showMessage(q("[data-maint-cost-message]"), "");
    const form = q("[data-maint-cost-form]");
    form.reset();
    const amountEl = q("[data-maint-cost-form] input[name='amount']");
    if (financeSelection?.amount) amountEl.value = new Intl.NumberFormat("id-ID").format(financeSelection.amount);
    setLayer("[data-maint-cost-layer]", true);
    try {
      const options = await loadFinanceOptions();
      if (!options.wallets.length) showMessage(q("[data-maint-cost-message]"), "Belum ada dompet aktif di Keuangan.");
      else if (!options.category) showMessage(q("[data-maint-cost-message]"), 'Kategori pengeluaran "Maintenance" tidak tersedia di Keuangan. Buat atau kembalikan kategori tersebut terlebih dahulu.');
    } catch (error) {
      showMessage(q("[data-maint-cost-message]"), error?.message || "Data Keuangan belum dapat dimuat.");
    }
  }

  function openCostForHistory(historyId) {
    financeSelection = null;
    openCost({ mode: "history", historyId });
  }

  async function submitCost(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = q("[data-maint-cost-message]");
    const amount = parseMoney(form.elements.amount.value);
    const walletId = form.elements.wallet.value;
    const category = financeOptionsCache?.category;
    if (!category) return showMessage(message, 'Kategori "Maintenance" di Keuangan belum tersedia.');
    if (!walletId) return showMessage(message, "Pilih dompet Keuangan.");
    if (!amount) return showMessage(message, "Nominal biaya harus lebih dari Rp 0.");

    if (financeContext.mode === "history") {
      const button = q("[data-maint-cost-apply]");
      button.disabled = true; button.textContent = "Mencatat...";
      try {
        await window.RuangKithaMaintenance.addHistoryExpense({
          familyId,
          historyId: financeContext.historyId,
          walletId,
          amount,
          financeAccountId: category.id
        });
        setLayer("[data-maint-cost-layer]", false);
        showToast("Biaya perawatan tercatat di Keuangan pada tanggal perawatan.");
        if (currentItemId) await openItemDetail(currentItemId);
      } catch (error) {
        showMessage(message, error?.message || "Biaya gagal dicatat.");
      } finally {
        button.disabled = false; button.textContent = "Gunakan biaya ini";
      }
      return;
    }

    financeSelection = { walletId, amount, financeAccountId: category.id };
    updateCostTrigger();
    setLayer("[data-maint-cost-layer]", false);
  }

  async function submitComplete(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const item = itemById(currentItemId);
    if (!item) return;
    const message = q("[data-maint-complete-message]");
    showMessage(message, "");
    const performedOn = form.elements.performedOn.value;
    if (!performedOn) return showMessage(message, "Tanggal perawatan dilakukan wajib dipilih.");
    if (performedOn > window.RuangKithaMaintenance.todayISO()) return showMessage(message, "Tanggal dilakukan tidak boleh berada di masa depan.");
    const button = q("[data-maint-complete-submit]");
    button.disabled = true; button.textContent = "Menyimpan...";
    try {
      const result = await window.RuangKithaMaintenance.complete({
        familyId,
        itemId: currentItemId,
        performedOn,
        note: form.elements.note.value,
        walletId: financeSelection?.walletId || null,
        amount: financeSelection?.amount || null,
        financeAccountId: financeSelection?.financeAccountId || null
      });
      setLayer("[data-maint-complete-layer]", false);
      setLayer("[data-maint-cost-layer]", false);
      showToast(result?.finance_transaction_id ? "Perawatan selesai dan pengeluaran tercatat di Keuangan." : "Perawatan selesai. Siklus berikutnya sudah diperbarui.");
      await refresh({ silent: true });
      await openItemDetail(currentItemId);
    } catch (error) {
      showMessage(message, error?.message || "Perawatan belum dapat diselesaikan.");
    } finally {
      button.disabled = false; button.textContent = "Simpan sebagai selesai";
    }
  }

  function renderManageList() {
    const root = q("[data-maint-manage-list]");
    if (!root) return;
    root.replaceChildren();
    data.groups.forEach(group => {
      const section = document.createElement("section"); section.className = "maintenance-manage-group";
      const head = document.createElement("div"); head.className = "maintenance-manage-group-head";
      const strong = document.createElement("strong"); strong.textContent = group.name;
      const actions = document.createElement("span"); actions.className = "maintenance-manage-row-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.setAttribute("aria-label", `Ubah ${group.name}`); edit.appendChild(icon("create-outline")); edit.addEventListener("click", () => openEditor("group", group.id));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "is-danger"; remove.setAttribute("aria-label", `Hapus ${group.name}`); remove.appendChild(icon("trash-outline")); remove.addEventListener("click", () => removeGroup(group.id));
      actions.append(edit, remove); head.append(strong, actions); section.appendChild(head);

      const assets = data.assets.filter(asset => asset.group_id === group.id);
      if (!assets.length) {
        const empty = document.createElement("div"); empty.className = "maintenance-manage-empty"; empty.textContent = "Belum ada aset."; section.appendChild(empty);
      } else assets.forEach(asset => {
        const row = document.createElement("div"); row.className = "maintenance-manage-asset";
        const name = document.createElement("span"); name.textContent = asset.name;
        const rowActions = document.createElement("span"); rowActions.className = "maintenance-manage-row-actions";
        const assetEdit = document.createElement("button"); assetEdit.type = "button"; assetEdit.setAttribute("aria-label", `Ubah ${asset.name}`); assetEdit.appendChild(icon("create-outline")); assetEdit.addEventListener("click", () => openEditor("asset", asset.id));
        const assetRemove = document.createElement("button"); assetRemove.type = "button"; assetRemove.className = "is-danger"; assetRemove.setAttribute("aria-label", `Hapus ${asset.name}`); assetRemove.appendChild(icon("trash-outline")); assetRemove.addEventListener("click", () => removeAsset(asset.id));
        rowActions.append(assetEdit, assetRemove); row.append(name, rowActions); section.appendChild(row);
      });
      root.appendChild(section);
    });
  }

  function openManage() {
    renderManageList();
    showMessage(q("[data-maint-manage-message]"), "");
    setLayer("[data-maint-manage-layer]", true);
  }

  function fillEditorGroups(selected = "") {
    const select = q("[data-maint-editor-group]");
    select.replaceChildren();
    data.groups.forEach(group => {
      const option = document.createElement("option"); option.value = group.id; option.textContent = group.name; option.selected = group.id === selected; select.appendChild(option);
    });
  }

  function openEditor(type, id = "", options = {}) {
    editorContext = { type, id, returnToItem: Boolean(options.returnToItem) };
    const form = q("[data-maint-editor-form]");
    form.reset();
    showMessage(q("[data-maint-editor-message]"), "");
    const isAsset = type === "asset";
    const existing = isAsset ? assetById(id) : groupById(id);
    q("[data-maint-editor-title]").textContent = `${id ? "Ubah" : "Tambah"} ${isAsset ? "Aset" : "Kelompok"}`;
    q("[data-maint-editor-subtitle]").textContent = isAsset ? "Aset adalah objek yang dapat dipilih untuk memiliki perawatan." : "Kelompok hanya menjadi heading untuk menyusun aset keluarga.";
    q("[data-maint-editor-name-label]").textContent = isAsset ? "Nama aset" : "Nama kelompok";
    const groupField = q("[data-maint-editor-group-field]");
    groupField.hidden = !isAsset;
    if (isAsset) {
      fillEditorGroups(existing?.group_id || data.groups[0]?.id || "");
      if (existing?.group_id) form.elements.group.value = existing.group_id;
    }
    form.elements.name.value = existing?.name || "";
    setLayer("[data-maint-editor-layer]", true);
    setTimeout(() => form.elements.name.focus(), 80);
  }

  async function submitEditor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = q("[data-maint-editor-message]");
    showMessage(message, "");
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true; submit.textContent = "Menyimpan...";
    try {
      let savedId = "";
      if (editorContext.type === "group") {
        savedId = await window.RuangKithaMaintenance.saveGroup({ familyId, groupId: editorContext.id || null, name: form.elements.name.value });
      } else {
        if (!form.elements.group.value) throw new Error("Buat kelompok terlebih dahulu.");
        savedId = await window.RuangKithaMaintenance.saveAsset({ familyId, assetId: editorContext.id || null, groupId: form.elements.group.value, name: form.elements.name.value });
      }
      const shouldReturnToItem = editorContext.type === "asset" && editorContext.returnToItem;
      setLayer("[data-maint-editor-layer]", false);
      showToast(`${editorContext.type === "group" ? "Kelompok" : "Aset"} tersimpan.`);
      await refresh({ silent: true });
      renderManageList();
      if (shouldReturnToItem && savedId) {
        fillAssetSelect(String(savedId));
        const itemForm = q("[data-maint-item-form]");
        if (itemForm?.elements?.asset) itemForm.elements.asset.value = String(savedId);
      }
    } catch (error) {
      showMessage(message, error?.message || "Perubahan belum dapat disimpan.");
    } finally {
      submit.disabled = false; submit.textContent = "Simpan";
    }
  }

  async function removeGroup(groupId) {
    const group = groupById(groupId);
    if (!group) return;
    const assetCount = data.assets.filter(asset => asset.group_id === groupId).length;
    const copy = assetCount ? `Hapus kelompok “${group.name}” beserta ${assetCount} aset yang belum pernah dipakai? Aset yang sudah punya jadwal/riwayat harus dipindahkan atau diarsipkan dulu.` : `Hapus kelompok “${group.name}”?`;
    if (!confirm(copy)) return;
    try {
      await window.RuangKithaMaintenance.removeGroup({ familyId, groupId });
      showToast("Kelompok dihapus.");
      await refresh({ silent: true });
    } catch (error) {
      showMessage(q("[data-maint-manage-message]"), error?.message || "Kelompok belum dapat dihapus.");
    }
  }

  async function removeAsset(assetId) {
    const asset = assetById(assetId);
    if (!asset || !confirm(`Hapus “${asset.name}”? Jika sudah punya jadwal atau riwayat, RuangKitha akan mengarsipkannya agar histori tidak hilang.`)) return;
    try {
      const result = await window.RuangKithaMaintenance.removeAsset({ familyId, assetId });
      showToast(result?.mode === "archived" ? "Aset diarsipkan karena memiliki riwayat." : "Aset dihapus.");
      await refresh({ silent: true });
    } catch (error) {
      showMessage(q("[data-maint-manage-message]"), error?.message || "Aset belum dapat dihapus.");
    }
  }

  function setupEvents() {
    q("[data-maint-add-item]")?.addEventListener("click", () => openItemForm());
    q("[data-maint-add-item-fab]")?.addEventListener("click", () => openItemForm());
    q("[data-maint-manage-open]")?.addEventListener("click", openManage);
    q("[data-maint-manage-close]")?.addEventListener("click", () => setLayer("[data-maint-manage-layer]", false));
    q("[data-maint-item-close]")?.addEventListener("click", () => setLayer("[data-maint-item-layer]", false));
    q("[data-maint-detail-close]")?.addEventListener("click", () => setLayer("[data-maint-detail-layer]", false));
    q("[data-maint-complete-close]")?.addEventListener("click", () => setLayer("[data-maint-complete-layer]", false));
    q("[data-maint-cost-close]")?.addEventListener("click", () => setLayer("[data-maint-cost-layer]", false));
    q("[data-maint-editor-close]")?.addEventListener("click", () => setLayer("[data-maint-editor-layer]", false));

    q("[data-maint-item-form]")?.addEventListener("submit", submitItem);
    qa('[data-maint-item-form] input[name="scheduleMode"]').forEach(input => input.addEventListener("change", setRepeatVisibility));
    q("[data-maint-custom-add]")?.addEventListener("click", () => {
      const input = q("[data-maint-custom-reminder]");
      const value = Number(input?.value || 0);
      if (!Number.isInteger(value) || value < 1 || value > 3650) return showMessage(q("[data-maint-item-message]"), "Pengingat khusus harus 1–3650 hari sebelum.");
      reminderSelection.add(value);
      input.value = "";
      renderReminderOptions();
      showMessage(q("[data-maint-item-message]"), "");
    });

    q("[data-maint-complete-form]")?.addEventListener("submit", submitComplete);
    q("[data-maint-cost-open]")?.addEventListener("click", () => openCost({ mode: "completion" }));
    q("[data-maint-cost-form]")?.addEventListener("submit", submitCost);
    q("[data-maint-cost-form] input[name='amount']")?.addEventListener("input", event => formatMoneyInput(event.currentTarget));
    q("[data-maint-cost-clear]")?.addEventListener("click", () => {
      if (financeContext.mode === "history") { setLayer("[data-maint-cost-layer]", false); return; }
      resetFinanceSelection();
      setLayer("[data-maint-cost-layer]", false);
    });

    q("[data-maint-group-add]")?.addEventListener("click", () => openEditor("group"));
    q("[data-maint-asset-add]")?.addEventListener("click", () => openEditor("asset"));
    q("[data-maint-quick-asset]")?.addEventListener("click", () => {
      if (!data.groups.length) {
        showMessage(q("[data-maint-item-message]"), "Buat kelompok terlebih dahulu sebelum menambahkan aset.");
        openEditor("group");
        return;
      }
      openEditor("asset", "", { returnToItem: true });
    });
    q("[data-maint-editor-form]")?.addEventListener("submit", submitEditor);

    qa(".maintenance-layer").forEach(layer => {
      layer.addEventListener("click", event => {
        if (event.target !== layer) return;
        if (layer.matches("[data-maint-cost-layer]")) setLayer("[data-maint-cost-layer]", false);
        else if (layer.matches("[data-maint-editor-layer]")) setLayer("[data-maint-editor-layer]", false);
        else if (layer.matches("[data-maint-complete-layer]")) setLayer("[data-maint-complete-layer]", false);
        else if (layer.matches("[data-maint-item-layer]")) setLayer("[data-maint-item-layer]", false);
        else if (layer.matches("[data-maint-detail-layer]")) setLayer("[data-maint-detail-layer]", false);
        else if (layer.matches("[data-maint-manage-layer]")) setLayer("[data-maint-manage-layer]", false);
      });
    });
  }

  async function init() {
    setupEvents();
    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }

    try {
      const session = await window.AuthService.ambilSession();
      if (!session) return;
      const families = await window.FamilyService.ambilKeluargaSaya();
      if (!families?.length) { location.replace("keluarga-awal.html"); return; }
      const pref = readPrefs();
      const family = families.find(item => item.id === pref.familyAktif) || families[0];
      familyId = family.id;
      writeFamily(familyId);
      await refresh();

      const itemParam = new URLSearchParams(location.search).get("item");
      if (itemParam && itemById(itemParam)) await openItemDetail(itemParam);
    } catch (error) {
      console.error("[Maintenance init]", error);
      showMessage(q("[data-maint-message]"), error?.message || "Maintenance belum dapat dibuka.");
      q("[data-maintenance-root]")?.setAttribute("aria-busy", "false");
    }
  }

  window.addEventListener("pageshow", event => { if (event.persisted && familyId) refresh({ silent: true }); });
  window.addEventListener("storage", event => { if (event.key === "ruangkitha:calendar:dirty" && familyId) refresh({ silent: true }); });
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
