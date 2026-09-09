(() => {
  "use strict";

  const client = window.supabaseClient;
  const service = window.FinanceService;
  if (!client || !service) return;

  function throwIf(error) {
    if (error) throw error;
  }

  async function memberCreateWallet({
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
    const { data, error } = await client.rpc("ruangkitha_finance_create_wallet", {
      p_family_id: familyId,
      p_name: name,
      p_wallet_type: walletType,
      p_currency_code: currencyCode,
      p_opening_balance: openingBalance,
      p_icon_type: iconType,
      p_icon_value: iconValue,
      p_color: color,
      p_sort_order: sortOrder
    });
    throwIf(error);
    window.FinanceCache?.remove("wallets", familyId);
    return data;
  }

  async function memberCreateCategory({
    familyId,
    name,
    kind,
    parentId = null,
    iconType = "ionicon",
    iconValue = "ellipse-outline",
    color = null,
    sortOrder = 0
  }) {
    const { data, error } = await client.rpc("ruangkitha_finance_create_category", {
      p_family_id: familyId,
      p_name: name,
      p_kind: kind,
      p_parent_id: parentId || null,
      p_icon_type: iconType,
      p_icon_value: iconValue,
      p_color: color,
      p_sort_order: sortOrder
    });
    throwIf(error);
    window.FinanceCache?.remove("categories", familyId);
    return data;
  }

  async function memberUpdateCategory({
    accountId,
    name,
    kind,
    parentId = null,
    iconType = "ionicon",
    iconValue = "ellipse-outline",
    color = null,
    sortOrder = 0
  }) {
    const { data, error } = await client.rpc("ruangkitha_finance_update_category", {
      p_category_id: accountId,
      p_name: name,
      p_kind: kind,
      p_parent_id: parentId || null,
      p_icon_type: iconType,
      p_icon_value: iconValue,
      p_color: color,
      p_sort_order: sortOrder
    });
    throwIf(error);
    return data;
  }

  async function memberArchiveCategory(accountId) {
    const { data, error } = await client.rpc("ruangkitha_finance_archive_category", {
      p_category_id: accountId
    });
    throwIf(error);
    return data;
  }

  /* Only the operations whose product rule changed are replaced. Other Finance
     operations continue using the proven v1/v2 RPCs. */
  service.buatDompet = memberCreateWallet;
  service.buatKategori = memberCreateCategory;
  service.buatAkun = memberCreateCategory;
  service.ubahKategori = memberUpdateCategory;
  service.ubahAkun = memberUpdateCategory;
  service.hapusKategori = memberArchiveCategory;
  service.arsipAkun = memberArchiveCategory;
})();
