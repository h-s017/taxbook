window.loadCompanyData = async function () {
  const state = TaxBookV2.state;
  if (!state.client || !state.currentCompany) return;
  const companyId = state.currentCompany.id;
  const [tx, ac, ca] = await Promise.all([
    state.client.from('transactions')
      .select('*,attachments(file_name,mime_type,storage_path),transaction_cash_flows(cash_account_id,status,direction,amount)')
      .eq('company_id', companyId).is('deleted_at', null).order('date', {ascending:false}),
    state.client.from('accounting_accounts').select('*').eq('company_id', companyId).eq('is_active', true).order('code'),
    state.client.from('cash_accounts').select('*').eq('company_id', companyId).eq('is_active', true).order('name')
  ]);
  if (tx.error) {
    loadCache();
    window.entries = state.entries;
    render();
    return alert(`雲端交易讀取失敗，已改用本機快取：${tx.error.message}`);
  }
  state.entries = (tx.data || []).map(dbToEntry);
  state.accounts = (ac.data || []).map(x => ({code:x.code,name:x.name,kind:x.kind}));
  state.projects = ['一般營運','待分類'];
  state.cashAccounts = ca.data || [];
  window.entries = state.entries;
  saveCache();
  updateCategoryOptions();
  updateInternalTags();
  updateCashAccountOptions();
  render();
};

window.uploadAttachment = async function (transactionId, file) {
  if (!file) return null;
  const state = TaxBookV2.state;
  const safeName = encodeURIComponent(file.name.replace(/[\\/]/g,'-'));
  const path = `${state.user.id}/${state.currentCompany.id}/${transactionId}/${safeName}`;
  const up = await state.client.storage.from('receipts').upload(path, file, {
    upsert:true,
    contentType:file.type || 'application/octet-stream'
  });
  if (up.error) throw up.error;
  await state.client.from('attachments').delete().eq('transaction_id', transactionId);
  const row = await state.client.from('attachments').insert({
    company_id:state.currentCompany.id,
    transaction_id:transactionId,
    user_id:state.user.id,
    file_name:file.name,
    mime_type:file.type,
    storage_path:path,
    file_size:file.size
  });
  if (row.error) throw row.error;
  return {name:file.name,type:file.type,cloudPath:path};
};
