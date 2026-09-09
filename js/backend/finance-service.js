(() => {
  "use strict";

  const client = window.supabaseClient;

  if (!client) {
    throw new Error("supabaseClient belum tersedia.");
  }

  function lemparJikaError(error) {
    if (error) throw error;
  }

  function operationIdBaru() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    throw new Error(
      "Browser tidak mendukung crypto.randomUUID()."
    );
  }

  async function ambilSaldoDompet(familyId) {
    let query = client
      .from("finance_wallet_balances")
      .select(
        "wallet_id,family_id,name,wallet_type,currency_code,opening_balance,transaction_delta,current_balance,icon_type,icon_value,color,sort_order,archived_at"
      )
      .is("archived_at", null)
      .order("sort_order", { ascending: true });

    if (familyId) {
      query = query.eq("family_id", familyId);
    }

    const { data, error } = await query;
    lemparJikaError(error);
    return data;
  }

  async function ambilTotalKeluarga(familyId) {
    let query = client
      .from("finance_family_balances")
      .select("family_id,currency_code,wallet_count,total_balance");

    if (familyId) {
      query = query.eq("family_id", familyId);
    }

    const { data, error } = await query;
    lemparJikaError(error);
    return data;
  }

  async function ambilAkun(familyId, kind = null) {
    let query = client
      .from("finance_accounts")
      .select(
        "id,family_id,name,kind,parent_id,icon_type,icon_value,color,sort_order,created_by,created_at,updated_at,archived_at"
      )
      .is("archived_at", null)
      .order("sort_order", { ascending: true });

    if (familyId) {
      query = query.eq("family_id", familyId);
    }

    if (kind) {
      query = query.eq("kind", kind);
    }

    const { data, error } = await query;
    lemparJikaError(error);
    return data;
  }

  async function ambilTransaksi({
    familyId,
    kind = null,
    startDate = null,
    endDate = null,
    limit = 100
  } = {}) {
    let query = client
      .from("finance_transactions")
      .select(
        "id,family_id,kind,account_id,amount,transfer_fee,transfer_fee_mode,occurred_on,note,created_by,created_by_name,client_operation_id,created_at,updated_at,voided_at"
      )
      .is("voided_at", null)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (familyId) {
      query = query.eq("family_id", familyId);
    }

    if (kind) {
      query = query.eq("kind", kind);
    }

    if (startDate) {
      query = query.gte("occurred_on", startDate);
    }

    if (endDate) {
      query = query.lte("occurred_on", endDate);
    }

    const { data, error } = await query;
    lemparJikaError(error);
    return data;
  }

  async function ambilRingkasanPeriodeDompet({
    familyId,
    walletId,
    startDate = null,
    endDate = null
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!walletId) throw new Error("walletId wajib diisi.");

    const { data, error } = await client.rpc(
      "finance_wallet_period_summary",
      {
        p_family_id: familyId,
        p_wallet_id: walletId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      }
    );

    lemparJikaError(error);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      incomeTotal: Number(row?.income_total || 0),
      expenseTotal: Number(row?.expense_total || 0)
    };
  }

  async function ambilTransaksiDompet({
    familyId,
    walletId,
    kind = null,
    startDate = null,
    endDate = null,
    limit = 300
  } = {}) {
    if (!familyId) {
      throw new Error("familyId wajib diisi.");
    }

    if (!walletId) {
      throw new Error("walletId wajib diisi.");
    }

    /* v1.1.7: transaction_id difilter di PostgreSQL berdasarkan wallet + periode
       terlebih dahulu. Ini menghindari mengambil seluruh ledger wallet ke browser. */
    const {
      data: idRows,
      error: idError
    } = await client.rpc(
      "finance_wallet_transaction_ids",
      {
        p_family_id: familyId,
        p_wallet_id: walletId,
        p_kind: kind || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_limit: limit
      }
    );

    lemparJikaError(idError);

    const transactionIds = (idRows || [])
      .map(item => item.transaction_id)
      .filter(Boolean);

    if (!transactionIds.length) {
      return [];
    }

    let query = client
      .from("finance_transactions")
      .select(
        "id,family_id,kind,account_id,amount,transfer_fee,transfer_fee_mode,occurred_on,note,created_by,created_by_name,client_operation_id,created_at,updated_at,voided_at"
      )
      .eq("family_id", familyId)
      .in("id", transactionIds)
      .is("voided_at", null)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (kind) {
      query = query.eq("kind", kind);
    }

    const {
      data: transactions,
      error: transactionError
    } = await query;

    lemparJikaError(transactionError);

    if (!transactions.length) {
      return [];
    }

    const selectedIds = transactions.map(item => item.id);

    const {
      data: allEntries,
      error: allEntryError
    } = await client
      .from("finance_transaction_entries")
      .select("id,transaction_id,family_id,wallet_id,amount_delta,created_at")
      .eq("family_id", familyId)
      .in("transaction_id", selectedIds);

    lemparJikaError(allEntryError);

    const walletIds = [
      ...new Set(
        (allEntries || [])
          .map(item => item.wallet_id)
          .filter(Boolean)
      )
    ];

    let wallets = [];

    if (walletIds.length) {
      const { data, error } = await client
        .from("finance_wallets")
        .select(
          "id,family_id,name,wallet_type,currency_code,icon_type,icon_value,color,archived_at"
        )
        .in("id", walletIds);

      lemparJikaError(error);
      wallets = data || [];
    }

    const walletMap = new Map(
      wallets.map(item => [item.id, item])
    );

    const entriesByTransaction = new Map();

    (allEntries || []).forEach(entry => {
      if (!entriesByTransaction.has(entry.transaction_id)) {
        entriesByTransaction.set(entry.transaction_id, []);
      }

      entriesByTransaction
        .get(entry.transaction_id)
        .push({
          ...entry,
          wallet: walletMap.get(entry.wallet_id) || null
        });
    });

    return transactions.map(transaction => {
      const transactionEntries =
        entriesByTransaction.get(transaction.id) || [];

      const activeEntry =
        transactionEntries.find(
          entry => entry.wallet_id === walletId
        ) || null;

      return {
        ...transaction,
        wallet_id: walletId,
        amount_delta: activeEntry?.amount_delta ?? null,
        entries: transactionEntries
      };
    });
  }

  async function buatDompet({
    familyId,
    name,
    walletType = "other",
    currencyCode = "IDR",
    openingBalance = 0,
    iconType = "ionicon",
    iconValue = "wallet-outline",
    color = null,
    sortOrder = 0
  }) {
    const { data, error } = await client.rpc(
      "finance_create_wallet",
      {
        p_family_id: familyId,
        p_name: name,
        p_wallet_type: walletType,
        p_currency_code: currencyCode,
        p_opening_balance: openingBalance,
        p_icon_type: iconType,
        p_icon_value: iconValue,
        p_color: color,
        p_sort_order: sortOrder
      }
    );

    lemparJikaError(error);
    return data;
  }

  async function buatKategori({
    familyId,
    name,
    kind,
    parentId = null,
    iconType = "ionicon",
    iconValue = "ellipse-outline",
    color = null,
    sortOrder = 0
  }) {
    const { data, error } = await client.rpc(
      "finance_create_category",
      {
        p_family_id: familyId,
        p_name: name,
        p_kind: kind,
        p_parent_id: parentId || null,
        p_icon_type: iconType,
        p_icon_value: iconValue,
        p_color: color,
        p_sort_order: sortOrder
      }
    );

    lemparJikaError(error);
    if (window.FinanceCache) window.FinanceCache.remove("categories", familyId);
    return data;
  }

  async function buatAkun(args) {
    return buatKategori(args);
  }

  async function ambilAkunById(accountId, familyId = null) {
    if (!accountId) {
      throw new Error("categoryId wajib diisi.");
    }

    let query = client
      .from("finance_accounts")
      .select(
        "id,family_id,name,kind,parent_id,icon_type,icon_value,color,sort_order,created_by,created_at,updated_at,archived_at"
      )
      .eq("id", accountId);

    if (familyId) query = query.eq("family_id", familyId);

    const { data, error } = await query.maybeSingle();
    lemparJikaError(error);
    return data;
  }

  async function ubahKategori({
    accountId,
    name,
    kind,
    parentId = null,
    iconType = "ionicon",
    iconValue = "ellipse-outline",
    color = null,
    sortOrder = 0
  }) {
    if (!accountId) throw new Error("categoryId wajib diisi.");

    const { data, error } = await client.rpc(
      "finance_update_category",
      {
        p_category_id: accountId,
        p_name: name,
        p_kind: kind,
        p_parent_id: parentId || null,
        p_icon_type: iconType,
        p_icon_value: iconValue,
        p_color: color,
        p_sort_order: sortOrder
      }
    );

    lemparJikaError(error);
    return data;
  }

  async function ubahAkun(args) {
    return ubahKategori(args);
  }

  async function hapusKategori(accountId) {
    if (!accountId) throw new Error("categoryId wajib diisi.");

    const { data, error } = await client.rpc(
      "finance_remove_category",
      { p_category_id: accountId }
    );

    lemparJikaError(error);
    return data;
  }

  async function arsipAkun(accountId) {
    return hapusKategori(accountId);
  }

  async function buatTransaksi({
    familyId,
    kind,
    amount,
    occurredOn,
    walletId,
    accountId = null,
    destinationWalletId = null,
    adjustmentDirection = null,
    note = null,
    transferFee = 0,
    transferFeeMode = null,
    operationId = null
  }) {
    const opId =
      operationId || operationIdBaru();

    const { data, error } = await client.rpc(
      "finance_create_transaction",
      {
        p_family_id: familyId,
        p_kind: kind,
        p_amount: amount,
        p_occurred_on: occurredOn,
        p_client_operation_id: opId,
        p_wallet_id: walletId,
        p_account_id: accountId,
        p_destination_wallet_id: destinationWalletId,
        p_adjustment_direction: adjustmentDirection,
        p_note: note,
        p_transfer_fee: transferFee,
        p_transfer_fee_mode: transferFeeMode
      }
    );

    lemparJikaError(error);

    return {
      transactionId: data,
      operationId: opId
    };
  }

  async function buatPengeluaran(args) {
    return buatTransaksi({
      ...args,
      kind: "expense"
    });
  }

  async function buatPemasukan(args) {
    return buatTransaksi({
      ...args,
      kind: "income"
    });
  }

  async function transfer({
    familyId,
    amount,
    occurredOn,
    sourceWalletId,
    destinationWalletId,
    transferFee = 0,
    transferFeeMode = null,
    note = null,
    operationId = null
  }) {
    return buatTransaksi({
      familyId,
      kind: "transfer",
      amount,
      occurredOn,
      walletId: sourceWalletId,
      destinationWalletId,
      transferFee,
      transferFeeMode,
      note,
      operationId
    });
  }

  async function adjustment({
    familyId,
    amount,
    occurredOn,
    walletId,
    direction,
    note = null,
    operationId = null
  }) {
    return buatTransaksi({
      familyId,
      kind: "adjustment",
      amount,
      occurredOn,
      walletId,
      adjustmentDirection: direction,
      note,
      operationId
    });
  }


  async function ambilDetailTransaksi(transactionId) {
    if (!transactionId) {
      throw new Error("transactionId wajib diisi.");
    }

    const {
      data: transaction,
      error: transactionError
    } = await client
      .from("finance_transactions")
      .select(
        "id,family_id,kind,account_id,amount,transfer_fee,transfer_fee_mode,occurred_on,note,created_by,created_by_name,updated_by,updated_by_name,last_edited_at,client_operation_id,created_at,updated_at,voided_at,voided_by,void_reason"
      )
      .eq("id", transactionId)
      .maybeSingle();

    lemparJikaError(transactionError);

    if (!transaction) {
      return null;
    }

    const accountPromise = transaction.account_id
      ? client
          .from("finance_accounts")
          .select("id,family_id,name,kind,icon_type,icon_value,color,archived_at")
          .eq("id", transaction.account_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const entriesPromise = client
      .from("finance_transaction_entries")
      .select("id,transaction_id,family_id,wallet_id,amount_delta,created_at")
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: true });

    const [accountResult, entriesResult] = await Promise.all([
      accountPromise,
      entriesPromise
    ]);

    lemparJikaError(accountResult.error);
    lemparJikaError(entriesResult.error);

    const entries = entriesResult.data || [];
    const walletIds = [
      ...new Set(entries.map(item => item.wallet_id).filter(Boolean))
    ];

    let wallets = [];

    if (walletIds.length) {
      const { data, error } = await client
        .from("finance_wallets")
        .select("id,family_id,name,wallet_type,currency_code,icon_type,icon_value,color,archived_at")
        .in("id", walletIds);

      lemparJikaError(error);
      wallets = data || [];
    }

    const walletMap = new Map(
      wallets.map(item => [item.id, item])
    );

    return {
      ...transaction,
      account: accountResult.data || null,
      entries: entries.map(entry => ({
        ...entry,
        wallet: walletMap.get(entry.wallet_id) || null
      }))
    };
  }

  async function updateTransaksi({
    transactionId,
    kind,
    amount,
    occurredOn,
    walletId,
    accountId = null,
    destinationWalletId = null,
    adjustmentDirection = null,
    note = null,
    transferFee = 0,
    transferFeeMode = null
  }) {
    if (!transactionId) {
      throw new Error("transactionId wajib diisi.");
    }

    const { data, error } = await client.rpc(
      "finance_update_transaction",
      {
        p_transaction_id: transactionId,
        p_kind: kind,
        p_amount: amount,
        p_occurred_on: occurredOn,
        p_wallet_id: walletId,
        p_account_id: accountId,
        p_destination_wallet_id: destinationWalletId,
        p_adjustment_direction: adjustmentDirection,
        p_note: note,
        p_transfer_fee: transferFee,
        p_transfer_fee_mode: transferFeeMode
      }
    );

    lemparJikaError(error);
    return data;
  }

  async function voidTransaksi(transactionId, reason = null) {
    if (!transactionId) {
      throw new Error("transactionId wajib diisi.");
    }

    const alasan = String(reason || "").trim();

    const { data, error } = await client.rpc(
      "finance_void_transaction",
      {
        p_transaction_id: transactionId,
        p_reason: alasan || null
      }
    );

    lemparJikaError(error);
    return data;
  }


  async function ambilDompetById(walletId, familyId = null) {
    if (!walletId) {
      throw new Error("walletId wajib diisi.");
    }

    let query = client
      .from("finance_wallet_balances")
      .select(
        "wallet_id,family_id,name,wallet_type,currency_code,opening_balance,transaction_delta,current_balance,icon_type,icon_value,color,sort_order,archived_at"
      )
      .eq("wallet_id", walletId)
      .is("archived_at", null);

    if (familyId) {
      query = query.eq("family_id", familyId);
    }

    const { data, error } = await query.maybeSingle();
    lemparJikaError(error);
    return data;
  }

  async function ubahDompet({
    walletId,
    name,
    walletType,
    iconType = "ionicon",
    iconValue = "wallet-outline",
    color = null,
    sortOrder = 0
  }) {
    if (!walletId) {
      throw new Error("walletId wajib diisi.");
    }

    const { data, error } = await client.rpc(
      "finance_update_wallet_safe",
      {
        p_wallet_id: walletId,
        p_name: name,
        p_wallet_type: walletType,
        p_icon_type: iconType,
        p_icon_value: iconValue,
        p_color: color,
        p_sort_order: sortOrder
      }
    );

    lemparJikaError(error);
    return data;
  }

  async function arsipDompet(walletId) {
    if (!walletId) {
      throw new Error("walletId wajib diisi.");
    }

    const { data, error } = await client.rpc(
      "finance_archive_wallet_safe",
      { p_wallet_id: walletId }
    );

    lemparJikaError(error);
    return data;
  }


  function normalizeBudgetRows(data) {
    return (data || []).map(item => ({
      ...item,
      budget_amount: Number(item.budget_amount || 0),
      spent_amount: Number(item.spent_amount || 0),
      remaining_amount: Number(item.remaining_amount || 0),
      progress_percent: Number(item.progress_percent || 0),
      warning_percent: Number(item.warning_percent || 80)
    }));
  }

  async function ambilPeriodeBudget(familyId) {
    if (!familyId) throw new Error("familyId wajib diisi.");

    const { data, error } = await client.rpc(
      "finance_budget_period_list",
      { p_family_id: familyId }
    );

    lemparJikaError(error);
    return (data || []).map(item => ({
      ...item,
      budget_count: Number(item.budget_count || 0)
    }));
  }

  async function simpanPeriodeBudget({
    familyId,
    periodId = null,
    startDate,
    endDate
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!startDate) throw new Error("Tanggal mulai budget wajib diisi.");
    if (!endDate) throw new Error("Tanggal selesai budget wajib diisi.");

    const { data, error } = await client.rpc(
      "finance_budget_period_save",
      {
        p_family_id: familyId,
        p_period_id: periodId || null,
        p_start_date: startDate,
        p_end_date: endDate
      }
    );

    lemparJikaError(error);
    return data;
  }

  async function simpanBudgetDenganRentang({
    familyId,
    accountId,
    startDate,
    endDate,
    amount,
    warningPercent = 80
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!accountId) throw new Error("Kategori budget wajib dipilih.");
    if (!startDate || !endDate) throw new Error("Tanggal mulai dan selesai budget wajib dipilih.");

    const { data, error } = await client.rpc(
      "finance_budget_save_with_range",
      {
        p_family_id: familyId,
        p_account_id: accountId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_amount: Number(amount || 0),
        p_warning_percent: Number(warningPercent || 80)
      }
    );

    lemparJikaError(error);
    const row = Array.isArray(data) ? data[0] : data;
    const periodId = row?.period_id || row?.periodId || null;
    const budgetId = row?.budget_id || row?.budgetId || null;
    if (!periodId || !budgetId) {
      throw new Error("Budget tersimpan tetapi ID periode/budget tidak diterima. Muat ulang lalu coba lagi.");
    }
    return { periodId, budgetId };
  }

  async function ambilBudgetPeriode({
    familyId,
    periodId
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!periodId) throw new Error("Periode budget wajib dipilih.");

    const { data, error } = await client.rpc(
      "finance_budget_list_period",
      {
        p_family_id: familyId,
        p_period_id: periodId
      }
    );

    lemparJikaError(error);
    return normalizeBudgetRows(data);
  }

  async function simpanBudget({
    familyId,
    accountId,
    periodId = null,
    periodMonth = null,
    amount,
    warningPercent = 80
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!accountId) throw new Error("Kategori budget wajib dipilih.");

    const rpcName = periodId ? "finance_budget_upsert_range" : "finance_budget_upsert";
    if (!periodId && !periodMonth) throw new Error("Periode budget wajib dipilih.");

    const params = periodId
      ? {
          p_family_id: familyId,
          p_account_id: accountId,
          p_period_id: periodId,
          p_amount: Number(amount || 0),
          p_warning_percent: Number(warningPercent || 80)
        }
      : {
          p_family_id: familyId,
          p_account_id: accountId,
          p_period_month: periodMonth,
          p_amount: Number(amount || 0),
          p_warning_percent: Number(warningPercent || 80)
        };

    const { data, error } = await client.rpc(rpcName, params);
    lemparJikaError(error);
    return data;
  }

  async function hapusBudget(budgetId) {
    if (!budgetId) throw new Error("budgetId wajib diisi.");

    const { data, error } = await client.rpc(
      "finance_budget_remove",
      { p_budget_id: budgetId }
    );

    lemparJikaError(error);
    return data;
  }

  // Legacy compatibility untuk tab lama yang masih tersisa di cache.
  // UI v1.2.0c tidak lagi menampilkan atau memakai siklus budget.
  async function ambilSiklusBudget(familyId) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    const { data, error } = await client.rpc("finance_budget_cycle_get", { p_family_id: familyId });
    lemparJikaError(error);
    const row = Array.isArray(data) ? data[0] : data;
    const cycleDay = Number(row?.cycle_day || 1);
    return Math.min(31, Math.max(1, cycleDay));
  }

  async function simpanSiklusBudget({ familyId, cycleDay } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    const day = Number(cycleDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error("Tanggal siklus budget harus antara 1 sampai 31.");
    }
    const { data, error } = await client.rpc("finance_budget_cycle_set", {
      p_family_id: familyId,
      p_cycle_day: day
    });
    lemparJikaError(error);
    return Number(data || day);
  }

  async function ambilBudgetSiklus({ familyId, periodMonth, cycleDay } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!periodMonth) throw new Error("periodMonth wajib diisi.");
    const day = Number(cycleDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error("Tanggal siklus budget harus antara 1 sampai 31.");
    }
    const { data, error } = await client.rpc("finance_budget_list_cycle", {
      p_family_id: familyId,
      p_period_month: periodMonth,
      p_cycle_day: day
    });
    lemparJikaError(error);
    return normalizeBudgetRows(data);
  }

  async function ubahSiklusBudget({
    familyId,
    cycleDay,
    fromPeriodMonth,
    fromCycleDay,
    toPeriodMonth,
    copyBudget = false
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    const { data, error } = await client.rpc("finance_budget_cycle_change", {
      p_family_id: familyId,
      p_cycle_day: Number(cycleDay),
      p_from_period_month: fromPeriodMonth,
      p_from_cycle_day: Number(fromCycleDay),
      p_to_period_month: toPeriodMonth,
      p_copy_budget: Boolean(copyBudget)
    });
    lemparJikaError(error);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      cycleDay: Number(row?.cycle_day || cycleDay),
      copiedCount: Number(row?.copied_count || 0)
    };
  }

  async function ambilBudgetBulan({ familyId, periodMonth } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!periodMonth) throw new Error("periodMonth wajib diisi.");
    const { data, error } = await client.rpc("finance_budget_list_month", {
      p_family_id: familyId,
      p_period_month: periodMonth
    });
    lemparJikaError(error);
    return normalizeBudgetRows(data);
  }

  function normalizeBillRows(data) {
    return (data || []).map(item => ({
      ...item,
      amount: Number(item.amount || 0),
      due_day: Number(item.due_day || 1)
    }));
  }

  async function ambilTagihanRingkas({
    familyId,
    today = null
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");

    const { data, error } = await client.rpc(
      "finance_bill_list_overview",
      {
        p_family_id: familyId,
        p_today: today || null
      }
    );

    lemparJikaError(error);
    return normalizeBillRows(data);
  }

  async function ambilTagihanBulan({
    familyId,
    periodMonth
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!periodMonth) throw new Error("periodMonth wajib diisi.");

    const { data, error } = await client.rpc(
      "finance_bill_list_month",
      {
        p_family_id: familyId,
        p_period_month: periodMonth
      }
    );

    lemparJikaError(error);
    return normalizeBillRows(data);
  }

  async function simpanTagihan({
    familyId,
    billId = null,
    dueDate,
    name,
    amount,
    accountId,
    note = null
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!String(name || "").trim()) throw new Error("Nama tagihan wajib diisi.");
    if (!accountId) throw new Error("Kategori pengeluaran wajib dipilih.");

    const nominal = Number(amount || 0);
    if (!Number.isFinite(nominal) || nominal <= 0) {
      throw new Error("Nominal tagihan harus lebih dari Rp 0.");
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dueDate || ""));
    if (!match) throw new Error("Tanggal jatuh tempo wajib dipilih.");

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      throw new Error("Tanggal jatuh tempo tidak valid.");
    }

    const effectiveMonth = `${match[1]}-${match[2]}-01`;
    const { data, error } = await client.rpc(
      "finance_bill_save",
      {
        p_family_id: familyId,
        p_bill_id: billId || null,
        p_effective_month: effectiveMonth,
        p_name: String(name).trim(),
        p_amount: Math.round(nominal),
        p_due_day: day,
        p_account_id: accountId,
        p_note: String(note || "").trim() || null
      }
    );

    lemparJikaError(error);
    return data;
  }

  async function arsipTagihan({
    billId,
    periodMonth
  } = {}) {
    if (!billId) throw new Error("billId wajib diisi.");
    if (!periodMonth) throw new Error("Periode penghentian tagihan wajib diisi.");

    const { data, error } = await client.rpc(
      "finance_bill_archive",
      {
        p_bill_id: billId,
        p_effective_month: periodMonth
      }
    );

    lemparJikaError(error);
    return data;
  }

  async function bayarTagihan({
    periodId,
    walletId,
    paidOn,
    amount,
    operationId = null
  } = {}) {
    if (!periodId) throw new Error("Periode tagihan wajib dipilih.");
    if (!walletId) throw new Error("Dompet pembayaran wajib dipilih.");
    if (!paidOn) throw new Error("Tanggal pembayaran wajib diisi.");

    const paymentAmount = Number(amount);
    if (!Number.isSafeInteger(paymentAmount) || paymentAmount <= 0) {
      throw new Error("Nominal pembayaran harus lebih dari Rp 0.");
    }

    const opId = operationId || operationIdBaru();
    const { data, error } = await client.rpc(
      "finance_bill_pay",
      {
        p_period_id: periodId,
        p_wallet_id: walletId,
        p_paid_on: paidOn,
        p_payment_amount: paymentAmount,
        p_client_operation_id: opId
      }
    );

    lemparJikaError(error);
    return {
      transactionId: data,
      operationId: opId
    };
  }



  async function ambilAkunLaporan(familyId) {
    if (!familyId) throw new Error("familyId wajib diisi.");

    const { data, error } = await client
      .from("finance_accounts")
      .select(
        "id,family_id,name,kind,parent_id,icon_type,icon_value,color,sort_order,created_by,created_at,updated_at,archived_at"
      )
      .eq("family_id", familyId)
      .order("sort_order", { ascending: true });

    lemparJikaError(error);
    return data || [];
  }

  async function ambilTransaksiRentangLengkap({
    familyId,
    startDate,
    endDate,
    pageSize = 1000,
    maxRows = 20000
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!startDate || !endDate) throw new Error("Rentang tanggal laporan wajib diisi.");
    if (String(endDate) < String(startDate)) throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");

    const safePageSize = Math.min(1000, Math.max(100, Number(pageSize || 1000)));
    const safeMaxRows = Math.max(safePageSize, Number(maxRows || 20000));
    const rows = [];
    let offset = 0;

    while (offset < safeMaxRows) {
      const take = Math.min(safePageSize, safeMaxRows - offset);
      const { data, error } = await client
        .from("finance_transactions")
        .select(
          "id,family_id,kind,account_id,amount,transfer_fee,transfer_fee_mode,occurred_on,note,created_by,created_by_name,client_operation_id,created_at,updated_at,voided_at"
        )
        .eq("family_id", familyId)
        .is("voided_at", null)
        .gte("occurred_on", startDate)
        .lte("occurred_on", endDate)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + take - 1);

      lemparJikaError(error);
      const batch = data || [];
      rows.push(...batch);

      if (batch.length < take) return rows;
      offset += batch.length;
    }

    throw new Error("Transaksi pada periode ini terlalu banyak untuk satu laporan. Perkecil rentang tanggal lalu coba lagi.");
  }

  async function ambilTagihanRentang({
    familyId,
    startDate,
    endDate
  } = {}) {
    if (!familyId) throw new Error("familyId wajib diisi.");
    if (!startDate || !endDate) throw new Error("Rentang tanggal tagihan wajib diisi.");
    if (String(endDate) < String(startDate)) throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");

    const { data, error } = await client.rpc(
      "finance_bill_list_range",
      {
        p_family_id: familyId,
        p_start_date: startDate,
        p_end_date: endDate
      }
    );

    lemparJikaError(error);
    return (data || []).map(item => ({
      ...item,
      amount: Number(item.amount || 0),
      paid_amount: Number(item.paid_amount || 0),
      remaining_amount: Number(item.remaining_amount || 0),
      payment_count: Number(item.payment_count || 0),
      due_day: Number(item.due_day || 1)
    }));
  }

  window.FinanceService = {
    ambilAkunLaporan,
    ambilTransaksiRentangLengkap,
    ambilTagihanRentang,
    ambilTagihanRingkas,
    ambilTagihanBulan,
    simpanTagihan,
    arsipTagihan,
    bayarTagihan,
    ambilPeriodeBudget,
    simpanPeriodeBudget,
    simpanBudgetDenganRentang,
    ambilBudgetPeriode,
    simpanBudget,
    hapusBudget,
    ambilSiklusBudget,
    simpanSiklusBudget,
    ambilBudgetSiklus,
    ubahSiklusBudget,
    ambilBudgetBulan,
    ambilSaldoDompet,
    ambilDompetById,
    ambilTotalKeluarga,
    ambilAkun,
    ambilAkunById,
    ambilTransaksi,
    ambilTransaksiDompet,
    ambilRingkasanPeriodeDompet,
    ambilDetailTransaksi,
    updateTransaksi,
    voidTransaksi,
    buatDompet,
    ubahDompet,
    arsipDompet,
    buatKategori,
    ubahKategori,
    hapusKategori,
    buatAkun,
    ubahAkun,
    arsipAkun,
    buatTransaksi,
    buatPengeluaran,
    buatPemasukan,
    transfer,
    adjustment,
    operationIdBaru
  };
})();
