window.entries = TaxBookV2.state.entries;

window.getVisibleEntries = function () {
  const state=TaxBookV2.state;
  const q=$('searchInput').value.trim().toLowerCase();
  const scope=$('bookFilter')?.value || 'all';
  return state.entries
    .filter(e=>new Date(e.date).getFullYear()===selectedYear())
    .filter(e=>scope==='all'||(scope==='tax'&&isTaxBook(e))||(scope==='internal'&&isInternalBook(e))||(scope==='review'&&e.bookScope==='review'))
    .filter(e=>!q||JSON.stringify(e).toLowerCase().includes(q))
    .sort((a,b)=>b.date.localeCompare(a.date));
};

window.renderStats = function (list) {
  const tax=list.filter(isTaxBook);
  const income=tax.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.grossAmount||0),0);
  const expense=tax.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.grossAmount||0),0);
  const missing=list.filter(e=>e.bookScope==='review'||e.taxDeductible==='review'||(e.voucherStatus!=='complete'&&e.voucherStatus!=='no-doc-needed')).length;
  $('sumIncome').textContent=money(income);$('sumExpense').textContent=money(expense);$('sumProfit').textContent=money(income-expense);$('missingDocs').textContent=missing;
};

window.renderSummary = function (list) {
  const rows=Array.from({length:12},(_,i)=>i+1).map(m=>{
    const x=list.filter(isTaxBook).filter(e=>Number(e.date.slice(5,7))===m);
    const inc=x.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.grossAmount||0),0);
    const exp=x.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.grossAmount||0),0);
    const tax=x.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.taxAmount||0),0);
    const review=x.filter(e=>e.taxDeductible==='review'||e.voucherStatus==='review'||e.voucherStatus==='missing').length;
    return `<tr><td>${selectedYear()}/${String(m).padStart(2,'0')}</td><td>${money(inc)}</td><td>${money(exp)}</td><td>${money(inc-exp)}</td><td>${money(tax)}</td><td>${money(Math.floor(tax*.1))}</td><td>${review}</td></tr>`;
  }).join('');
  $('summaryTable').innerHTML=`<thead><tr><th>月份</th><th>外帳收入</th><th>外帳支出</th><th>外帳損益</th><th>進項稅額</th><th>10% 提醒值</th><th>待確認</th></tr></thead><tbody>${rows}</tbody>`;
};

window.renderAccountSummary = function (list) {
  const map=new Map();
  list.filter(isTaxBook).forEach(e=>{
    const key=e.accountCode||'未分類';
    const row=map.get(key)||{code:key,name:e.accountName||accountName(key),income:0,expense:0,asset:0,count:0};
    if(e.kind==='income')row.income+=Number(e.grossAmount||0);
    else if(e.kind==='expense')row.expense+=Number(e.grossAmount||0);
    else if(e.kind==='asset')row.asset+=Number(e.grossAmount||0);
    row.count++;map.set(key,row);
  });
  $('accountSummaryTable').innerHTML=`<thead><tr><th>科目代碼</th><th>科目名稱</th><th>收入</th><th>費用</th><th>資產</th><th>筆數</th></tr></thead><tbody>${[...map.values()].map(r=>`<tr><td>${html(r.code)}</td><td>${html(r.name)}</td><td>${money(r.income)}</td><td>${money(r.expense)}</td><td>${money(r.asset)}</td><td>${r.count}</td></tr>`).join('')||'<tr><td colspan="6">尚無資料</td></tr>'}</tbody>`;
};

window.renderEntries = function (list) {
  $('entriesTable').innerHTML=`<thead><tr><th>日期</th><th>類型</th><th>帳務</th><th>會計科目</th><th>內帳標籤</th><th>對象</th><th>付款方式</th><th>現金流</th><th>金額</th><th>附件</th><th>操作</th></tr></thead><tbody>${list.map(e=>`<tr><td>${html(e.date)}</td><td>${e.kind==='income'?'收入':e.kind==='expense'?'支出':e.kind==='asset'?'資產':'移轉'}</td><td>${e.bookScope==='both'?'外＋內':e.bookScope==='tax'?'外帳':e.bookScope==='internal'?'內帳':'待確認'}</td><td>${html(e.accountCode)} ${html(e.accountName)}</td><td>${html(e.internalTag)}</td><td>${html(e.counterparty||'-')}</td><td>${html(e.paymentMethod||'-')}</td><td>${html(e.cashStatus||'-')}</td><td>${money(e.grossAmount)}</td><td>${e.receipt?`<button class="link-btn" data-view="${e.id}">檢視</button>`:'-'}</td><td><button class="link-btn" data-edit="${e.id}">編輯</button> ｜ <button class="link-btn danger" data-delete="${e.id}">刪除</button></td></tr>`).join('')||'<tr><td colspan="11">尚無資料</td></tr>'}</tbody>`;
};

window.render = function () {
  window.entries=TaxBookV2.state.entries;
  const list=getVisibleEntries();
  renderStats(list);renderSummary(list);renderAccountSummary(list);renderEntries(list);
};

window.toCsvValue=v=>'"'+String(v??'').replaceAll('"','""')+'"';
window.downloadText=function(text,name,type){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();URL.revokeObjectURL(a.href);};
window.exportCsv=function(mode='full'){
  const head=['日期','類型','帳務視圖','會計科目代碼','會計科目名稱','內帳標籤','交易對象','對方統編','憑證類型','憑證號碼','付款方式','專案','未稅','營業稅','總金額','外帳判定','憑證狀態','現金流狀態','備註'];
  const rows=getVisibleEntries().filter(e=>mode==='tax'?isTaxBook(e):mode==='internal'?isInternalBook(e):true).map(e=>[e.date,e.kind,e.bookScope,e.accountCode,e.accountName,e.internalTag,e.counterparty,e.counterpartyBan,e.voucherType,e.voucherNo,e.paymentMethod,e.project,e.netAmount,e.taxAmount,e.grossAmount,e.taxDeductible,e.voucherStatus,e.cashStatus,e.note]);
  const csv='\ufeff'+[head,...rows].map(r=>r.map(toCsvValue).join(',')).join('\n');downloadText(csv,`taxbook_${mode}_${selectedYear()}.csv`,'text/csv;charset=utf-8');
};
window.exportJson=function(){const s=TaxBookV2.state;downloadText(JSON.stringify({schema_version:2,exported_at:new Date().toISOString(),company:s.currentCompany,transactions:s.entries,cash_accounts:s.cashAccounts,projects:s.projects,accounting_accounts:s.accounts},null,2),`taxbook_v2_${todayISO()}.json`,'application/json');};
window.importJson=function(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result),list=d.transactions||d.entries;if(!Array.isArray(list))throw new Error('格式不符');localStorage.setItem(TaxBookV2.keys.legacy,JSON.stringify(list));renderCompanyUI();alert('已載入舊資料區，請按「匯入舊資料」寫入目前公司。');}catch(e){alert(`匯入失敗：${e.message}`);}};r.readAsText(file);};

window.migrateLegacyData=async function(){
  const s=TaxBookV2.state;if(!s.user||!s.currentCompany)return alert('請先登入並選擇公司。');
  let legacy=[];try{legacy=JSON.parse(localStorage.getItem(TaxBookV2.keys.legacy)||'[]').map(migrateEntry);}catch{}
  if(!legacy.length)return alert('沒有舊資料。');
  if(!confirm(`將 ${legacy.length} 筆舊資料匯入「${s.currentCompany.name}」。原本 localStorage 不會刪除。確定？`))return;
  let ok=0;
  for(const e of legacy){
    const result=await s.client.from('transactions').upsert(entryToDb(e));
    if(!result.error){
      try{await saveCashFlow(e);ok++;}catch(error){console.error(error);}
    }
  }
  localStorage.setItem(`taxbookMigrationDone:${s.currentCompany.id}`,new Date().toISOString());
  await loadCompanyData();alert(`完成匯入 ${ok}/${legacy.length} 筆。`);
};

window.pushCloud=async function(){
  const s=TaxBookV2.state;if(!s.user||!s.currentCompany)return alert('請先登入並選擇公司。');
  const q=pendingOps();if(!q.length)return alert('沒有待同步資料。');let remaining=[];
  for(const rawOp of q){
    const op={...rawOp,status:'pending',error:null};
    try{
      if(op.type==='delete'){
        const r=await s.client.from('transactions').update({deleted_at:new Date().toISOString()}).eq('id',op.id).eq('company_id',s.currentCompany.id);
        if(r.error)remaining.push({...op,status:'error',error:r.error.message});
        continue;
      }
      const entry=migrateEntry(op.entry);
      const remote=await s.client.from('transactions').select('updated_at').eq('id',entry.id).eq('company_id',s.currentCompany.id).maybeSingle();
      if(remote.error){remaining.push({...op,status:'error',error:remote.error.message});continue;}
      if(remote.data?.updated_at&&entry.updatedAt&&new Date(remote.data.updated_at).getTime()>new Date(entry.updatedAt).getTime()){
        remaining.push({...op,status:'conflict',error:'Remote transaction is newer than the queued local edit.'});
        continue;
      }
      const r=await s.client.from('transactions').upsert(entryToDb(entry)).select().single();
      if(r.error){remaining.push({...op,status:'error',error:r.error.message});continue;}
      entry.updatedAt=r.data?.updated_at||entry.updatedAt;
      try{await saveCashFlow(entry);}catch(error){console.error(error);remaining.push({...op,status:'error',error:error.message});}
    }catch(error){
      remaining.push({...op,status:'error',error:error.message});
    }
  }
  localStorage.setItem(pendingKey(),JSON.stringify(remaining));
  if(typeof updateSyncStatusUI==='function')updateSyncStatusUI();
  await loadCompanyData();
  const errors=remaining.filter(op=>op.status==='error').length,conflicts=remaining.filter(op=>op.status==='conflict').length;
  alert(remaining.length?`同步未完成：${errors} 筆失敗，${conflicts} 筆衝突。`:'待同步資料已完成。');
};
window.pullCloud=async function(){if(!TaxBookV2.state.user||!TaxBookV2.state.currentCompany)return alert('請先登入並選擇公司。');await loadCompanyData();alert('已重新載入雲端資料。');};
