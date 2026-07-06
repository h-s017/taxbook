window.saveBusinessSettings = async function () {
  const s=TaxBookV2.state;
  if(!s.user||!s.currentCompany||!roleCanEdit())return;
  const payload={name:$('bizName').value.trim(),ban:$('bizBan').value.trim()||null,tax_mode:$('taxMode').value};
  const result=await s.client.from('companies').update(payload).eq('id',s.currentCompany.id);
  if(result.error)return alert(`公司資料更新失敗：${result.error.message}`);
  Object.assign(s.currentCompany,payload);renderCompanyUI();
};

window.bindV2 = function () {
  $('entryForm').addEventListener('submit', handleSubmit);
  $('kind').addEventListener('change', () => { updateCategoryOptions(); updateCashAccountOptions(); });
  $('receiptFile').addEventListener('change', e => $('fileHint').textContent=e.target.files[0]?.name||'未選擇檔案');
  $('resetFormBtn').onclick=resetForm;
  $('entriesTable').addEventListener('click', handleTableClick);
  $('searchInput').addEventListener('input', render);
  $('bookFilter')?.addEventListener('change', render);
  $('yearFilter').addEventListener('change', render);
  ['bizName','bizBan','taxMode'].forEach(id=>$(id).addEventListener('change',saveBusinessSettings));
  $('exportCsvBtn').onclick=()=>exportCsv('full');
  $('exportTaxCsvBtn').onclick=()=>exportCsv('tax');
  $('exportInternalCsvBtn').onclick=()=>exportCsv('internal');
  $('exportJsonBtn').onclick=exportJson;
  $('importJsonInput').onchange=e=>importJson(e.target.files[0]);
  $('printBtn').onclick=()=>window.print();
  $('closeDialog').onclick=()=>$('receiptDialog').close();
  $('saveCloudConfigBtn').onclick=saveCloudConfig;
  $('sendMagicLinkBtn').onclick=sendMagicLink;
  $('pushCloudBtn').onclick=pushCloud;
  $('pullCloudBtn').onclick=pullCloud;
  $('signOutBtn').onclick=signOutCloud;
};

window.initV2 = async function () {
  injectCompanyUI();
  loadSyncSettings();
  bindV2();
  updateCategoryOptions();
  updateInternalTags();
  updateCashAccountOptions();
  resetForm();
  renderCompanyUI();
  createCloudClient();
  if(TaxBookV2.state.client){
    await refreshSession();
    TaxBookV2.state.client.auth.onAuthStateChange(async(_event,session)=>{
      TaxBookV2.state.user=session?.user||null;
      cloudStatus(TaxBookV2.state.user?`已登入：${TaxBookV2.state.user.email}`:'已設定，未登入',Boolean(TaxBookV2.state.user));
      if(TaxBookV2.state.user)await loadCompanies();
    });
  } else {
    let legacy=[];try{legacy=JSON.parse(localStorage.getItem(TaxBookV2.keys.legacy)||'[]');}catch{}
    TaxBookV2.state.entries=legacy.map(migrateEntry);window.entries=TaxBookV2.state.entries;render();
  }
  window.addEventListener('online',()=>{if(pendingOps().length)cloudStatus(`已連線｜${pendingOps().length} 筆待同步`,true);});
  window.addEventListener('offline',()=>cloudStatus('離線模式',false));
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
};

window.loadScriptOnce = function (src) {
  return new Promise(resolve => {
    const script=document.createElement('script');
    script.src=src;
    script.onload=resolve;
    script.onerror=resolve;
    document.head.appendChild(script);
  });
};

window.loadV2OverridesThenInit = async function () {
  await loadScriptOnce('js/v2-patches.js');
  await loadScriptOnce('js/v2-owner-company.js');
  await loadScriptOnce('js/v2-owner-data.js');
  await initV2();
};

loadV2OverridesThenInit().catch(error=>{console.error(error);alert(`初始化失敗：${error.message}`);});
