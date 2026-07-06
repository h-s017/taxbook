window.loadCompanyData = async function () {
  const state=TaxBookV2.state;
  if(!state.client||!state.currentCompany)return;
  const companyId=state.currentCompany.id;
  const [tx,ac,pr,ca]=await Promise.all([
    state.client.from('transactions').select('*,attachments(file_name,mime_type,storage_path),transaction_cash_flows(cash_account_id,status,direction,amount)').eq('company_id',companyId).is('deleted_at',null).order('date',{ascending:false}),
    state.client.from('accounting_accounts').select('*').eq('company_id',companyId).eq('is_active',true).order('code'),
    state.client.from('projects').select('*').eq('company_id',companyId).eq('is_active',true).order('name'),
    state.client.from('cash_accounts').select('*').eq('company_id',companyId).eq('is_active',true).order('name')
  ]);
  if(tx.error){loadCache();window.entries=state.entries;render();return alert(`雲端交易讀取失敗，已改用本機快取：${tx.error.message}`);}
  state.entries=(tx.data||[]).map(dbToEntry);
  state.accounts=(ac.data||[]).map(x=>({code:x.code,name:x.name,kind:x.kind}));
  state.projects=(pr.data||[]).map(x=>x.name);
  state.cashAccounts=ca.data||[];
  window.entries=state.entries;saveCache();updateCategoryOptions();updateInternalTags();updateCashAccountOptions();render();
};

window.isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''));

window.migrateLegacyData = async function () {
  const state=TaxBookV2.state;
  if(!state.user||!state.currentCompany)return alert('請先登入並選擇公司。');
  let legacy=[];
  try{legacy=JSON.parse(localStorage.getItem(TaxBookV2.keys.legacy)||'[]').map(migrateEntry);}catch{}
  if(!legacy.length)return alert('沒有舊資料。');
  if(!confirm(`將 ${legacy.length} 筆舊資料匯入「${state.currentCompany.name}」。原本本機資料不會刪除。確定？`))return;
  let ok=0,failed=0;
  for(const raw of legacy){
    const entry=migrateEntry({...raw,id:isUuid(raw.id)?raw.id:uid()});
    const result=await state.client.from('transactions').upsert(entryToDb(entry));
    if(result.error){failed++;continue;}
    ok++;
  }
  localStorage.setItem(`taxbookMigrationDone:${state.currentCompany.id}`,new Date().toISOString());
  await loadCompanyData();
  alert(`舊資料匯入完成：成功 ${ok} 筆，失敗 ${failed} 筆。原本本機資料仍保留。`);
};
