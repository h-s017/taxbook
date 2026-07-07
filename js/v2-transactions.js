window.loadCompanyData = async function () {
  const state = TaxBookV2.state;
  if (!state.client || !state.currentCompany) return;
  const companyId = state.currentCompany.id;
  const [tx, ac, pr, ca] = await Promise.all([
    state.client.from('transactions')
      .select('*,attachments(file_name,mime_type,storage_path),transaction_cash_flows(cash_account_id,status,direction,amount)')
      .eq('company_id', companyId).is('deleted_at', null).order('date', {ascending:false}),
    state.client.from('accounting_accounts').select('*').eq('company_id', companyId).eq('is_active', true).order('code'),
    state.client.from('projects').select('*').eq('company_id', companyId).eq('is_active', true).order('name'),
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
  state.projects = (pr.data || []).map(x => x.name);
  state.cashAccounts = ca.data || [];
  window.entries = state.entries;
  saveCache();
  updateCategoryOptions();
  updateInternalTags();
  updateCashAccountOptions();
  render();
};

window.updateCategoryOptions = function () {
  const kind = $('kind').value;
  const lists = {
    income:['課程收入','調香體驗收入','商品收入','訂製服務收入','企業/品牌合作','補助/獎助收入','其他收入'],
    expense:['原物料/香精','容器包材','場地租金','水電瓦斯','設備器材','課程教材','行銷廣告','網站/系統/平台','交通運費','平台手續費','外包/顧問','餐飲交際','辦公雜支','稅費/規費','其他支出'],
    asset:['器具設備','生財器具','裝潢/修繕','押金/保證金','存貨','其他資產'],
    transfer:['現金提存','帳戶轉帳','業主往來','信用卡繳款','其他移轉']
  };
  $('category').innerHTML = (lists[kind] || []).map(x => `<option>${html(x)}</option>`).join('');
  const source = TaxBookV2.state.accounts.length ? TaxBookV2.state.accounts : fallbackAccounts;
  $('accountCode').innerHTML = source.filter(a => a.kind === kind).map(a => `<option value="${a.code}">${html(a.code)} ${html(a.name)}</option>`).join('');
};

window.updateInternalTags = function () {
  const list = TaxBookV2.state.projects.length ? TaxBookV2.state.projects : ['一般營運','待分類'];
  $('internalTag').innerHTML = list.map(x => `<option>${html(x)}</option>`).join('');
};

window.updateCashAccountOptions = function () {
  const ensureSelect = (id, text, afterEl) => {
    let sel = $(id);
    if (sel) return sel;
    sel = document.createElement('select');
    sel.id = id;
    const label = document.createElement('label');
    label.id = `${id}Label`;
    label.textContent = text;
    label.appendChild(sel);
    afterEl.after(label);
    return sel;
  };
  const paymentLabel = $('paymentMethod').closest('label');
  const cash = ensureSelect('cashAccountId', '資金帳戶', paymentLabel);
  const from = ensureSelect('fromCashAccountId', '轉出帳戶', cash.closest('label'));
  const to = ensureSelect('toCashAccountId', '轉入帳戶', from.closest('label'));
  const options = '<option value="">未指定</option>' + TaxBookV2.state.cashAccounts.map(a => `<option value="${a.id}">${html(a.name)}</option>`).join('');
  [cash, from, to].forEach(sel => { sel.innerHTML = options; });
  const isTransfer = $('kind')?.value === 'transfer';
  cash.closest('label').classList.toggle('is-hidden', isTransfer);
  from.closest('label').classList.toggle('is-hidden', !isTransfer);
  to.closest('label').classList.toggle('is-hidden', !isTransfer);
};

window.formData = function () {
  const gross = Number($('grossAmount').value || 0);
  const tax = Number($('taxAmount').value || 0);
  const net = $('netAmount').value === '' ? Math.max(gross - tax, 0) : Number($('netAmount').value || 0);
  return {
    date:$('date').value,kind:$('kind').value,bookScope:$('bookScope').value,
    accountCode:$('accountCode').value,accountName:accountName($('accountCode').value),
    internalTag:$('internalTag').value,voucherType:$('voucherType').value,voucherNo:$('voucherNo').value.trim(),
    counterparty:$('counterparty').value.trim(),counterpartyBan:$('counterpartyBan').value.trim(),
    category:$('category').value,paymentMethod:$('paymentMethod').value,project:$('project').value.trim(),
    netAmount:net,taxAmount:tax,grossAmount:gross,taxDeductible:$('taxDeductible').value,
    voucherStatus:$('voucherStatus').value,cashStatus:$('cashStatus').value,
    cashAccountId:$('cashAccountId')?.value || '',
    fromCashAccountId:$('fromCashAccountId')?.value || '',toCashAccountId:$('toCashAccountId')?.value || '',
    note:$('note').value.trim()
  };
};

window.resetForm = function () {
  TaxBookV2.state.editingId = null;
  $('entryForm').reset();
  $('date').value = todayISO();
  $('taxAmount').value = 0;
  $('fileHint').textContent = '未選擇檔案';
  updateCategoryOptions();
  updateInternalTags();
  updateCashAccountOptions();
};

window.fillForm = function (raw) {
  const e = migrateEntry(raw);
  TaxBookV2.state.editingId = e.id;
  $('date').value=e.date;$('kind').value=e.kind;updateCategoryOptions();updateCashAccountOptions();
  $('bookScope').value=e.bookScope;$('accountCode').value=e.accountCode;updateInternalTags();$('internalTag').value=e.internalTag;
  $('voucherType').value=e.voucherType;$('voucherNo').value=e.voucherNo;$('counterparty').value=e.counterparty;$('counterpartyBan').value=e.counterpartyBan;
  $('category').value=e.category;$('paymentMethod').value=e.paymentMethod;$('project').value=e.project;$('netAmount').value=e.netAmount;$('taxAmount').value=e.taxAmount;$('grossAmount').value=e.grossAmount;
  $('taxDeductible').value=e.taxDeductible;$('voucherStatus').value=e.voucherStatus;$('cashStatus').value=e.cashStatus;$('note').value=e.note;
  if ($('cashAccountId')) $('cashAccountId').value=e.cashAccountId || '';
  if ($('fromCashAccountId')) $('fromCashAccountId').value=e.fromCashAccountId || '';
  if ($('toCashAccountId')) $('toCashAccountId').value=e.toCashAccountId || '';
  $('fileHint').textContent='編輯中：可重新上傳附件';
  scrollTo({top:0,behavior:'smooth'});
};

window.uploadAttachment = async function (transactionId, file) {
  if (!file) return null;
  const state = TaxBookV2.state;
  const safeName = encodeURIComponent(file.name.replace(/[\\/]/g,'-'));
  const path = `${state.user.id}/${state.currentCompany.id}/${transactionId}/${safeName}`;
  const up = await state.client.storage.from('receipts').upload(path, file, {upsert:true,contentType:file.type || 'application/octet-stream'});
  if (up.error) throw up.error;
  await state.client.from('attachments').delete().eq('transaction_id', transactionId);
  const row = await state.client.from('attachments').insert({
    company_id:state.currentCompany.id,transaction_id:transactionId,user_id:state.user.id,
    file_name:file.name,mime_type:file.type,storage_path:path,file_size:file.size
  });
  if (row.error) throw row.error;
  return {name:file.name,type:file.type,cloudPath:path};
};

window.saveCashFlow = async function (entry) {
  const state = TaxBookV2.state;
  const deleted = await state.client.from('transaction_cash_flows').delete().eq('transaction_id', entry.id);
  if (deleted.error) throw deleted.error;
  const settled_at = entry.cashStatus === 'paid' ? new Date().toISOString() : null;
  let rows = [];
  if (entry.kind === 'transfer') {
    if (!entry.fromCashAccountId || !entry.toCashAccountId) return;
    rows = [
      {cash_account_id:entry.fromCashAccountId,direction:'out'},
      {cash_account_id:entry.toCashAccountId,direction:'in'}
    ];
  } else if (entry.cashAccountId) {
    rows = [{cash_account_id:entry.cashAccountId,direction:entry.kind === 'income' ? 'in' : 'out'}];
  }
  if (!rows.length) return;
  const result = await state.client.from('transaction_cash_flows').insert(rows.map(row => ({
    company_id:state.currentCompany.id,transaction_id:entry.id,cash_account_id:row.cash_account_id,
    direction:row.direction,amount:Number(entry.grossAmount || 0),status:entry.cashStatus,settled_at
  })));
  if (result.error) throw result.error;
};

window.remoteIsNewer = async function (entry) {
  const state = TaxBookV2.state;
  if (!state.editingId || !entry.updatedAt) return false;
  const result = await state.client.from('transactions').select('updated_at').eq('id', entry.id).eq('company_id', state.currentCompany.id).maybeSingle();
  if (result.error || !result.data?.updated_at) return false;
  return new Date(result.data.updated_at).getTime() > new Date(entry.updatedAt).getTime();
};

window.handleSubmit = async function (event) {
  event.preventDefault();
  const state=TaxBookV2.state;
  if (!state.currentCompany || !state.user) return alert('請先登入並選擇公司。');
  if (!roleCanEdit()) return alert('目前權限不可編輯。');
  const old=state.entries.find(x=>x.id===state.editingId);
  const entry=migrateEntry({...old,...formData(),id:state.editingId || uid(),updatedAt:new Date().toISOString()});
  if (entry.kind === 'transfer' && (!entry.fromCashAccountId || !entry.toCashAccountId)) return alert('內部移轉需選擇轉出與轉入帳戶。');
  if (entry.kind === 'transfer' && entry.fromCashAccountId === entry.toCashAccountId) return alert('轉出與轉入帳戶不可相同。');
  const file=$('receiptFile').files[0];

  if (!navigator.onLine) {
    state.entries=state.editingId?state.entries.map(x=>x.id===entry.id?entry:x):[entry,...state.entries];
    window.entries=state.entries;queueOp({type:'upsert',entry,status:'pending'});saveCache();resetForm();render();
    if (typeof updateSyncStatusUI === 'function') updateSyncStatusUI();
    return alert('目前離線，已存入本機待同步。');
  }

  if (old && await remoteIsNewer(old)) {
    const overwrite = confirm('雲端版本比目前本機編輯版本更新。\n\n按「確定」仍以本機修改覆蓋；按「取消」重新載入雲端版本。');
    if (!overwrite) {
      await loadCompanyData();
      resetForm();
      return;
    }
  }

  const result=await state.client.from('transactions').upsert(entryToDb(entry)).select().single();
  if (result.error) return alert(`儲存失敗：${result.error.message}`);
  try {
    if (file) entry.receipt=await uploadAttachment(entry.id,file);
    await saveCashFlow(entry);
  } catch (error) { return alert(`交易已儲存，但附件或現金流失敗：${error.message}`); }
  entry.updatedAt = result.data.updated_at || entry.updatedAt;
  state.entries=state.editingId?state.entries.map(x=>x.id===entry.id?entry:x):[entry,...state.entries];
  window.entries=state.entries;saveCache();resetForm();render();
  if (typeof updateSyncStatusUI === 'function') updateSyncStatusUI();
};

window.handleTableClick = async function (event) {
  const id=event.target.dataset.view || event.target.dataset.edit || event.target.dataset.delete;
  if (!id) return;
  const state=TaxBookV2.state, entry=state.entries.find(x=>x.id===id);
  if (event.target.dataset.edit && entry) return fillForm(entry);
  if (event.target.dataset.view && entry?.receipt?.cloudPath) {
    const result=await state.client.storage.from('receipts').download(entry.receipt.cloudPath);
    if (result.error) return alert(`附件下載失敗：${result.error.message}`);
    const url=URL.createObjectURL(result.data);
    $('receiptPreview').innerHTML=entry.receipt.type?.includes('pdf')?`<iframe src="${url}"></iframe>`:`<img src="${url}" alt="receipt">`;
    return $('receiptDialog').showModal();
  }
  if (event.target.dataset.delete && confirm('確定刪除？此筆會採軟刪除保留歷史。')) {
    if (navigator.onLine) {
      const result=await state.client.from('transactions').update({deleted_at:new Date().toISOString()}).eq('id',id).eq('company_id',state.currentCompany.id);
      if (result.error) return alert(`刪除失敗：${result.error.message}`);
    } else queueOp({type:'delete',id,status:'pending'});
    state.entries=state.entries.filter(x=>x.id!==id);window.entries=state.entries;saveCache();render();
    if (typeof updateSyncStatusUI === 'function') updateSyncStatusUI();
  }
};
