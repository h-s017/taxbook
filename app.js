const DB_NAME = 'hanaTaxBookDB';
const STORE = 'receipts';
const STORAGE_KEY = 'hanaTaxBookEntries';
const SETTINGS_KEY = 'hanaTaxBookSettings';

const incomeCategories = ['課程收入','調香體驗收入','商品收入','訂製服務收入','企業/品牌合作','補助/獎助收入','其他收入'];
const expenseCategories = ['原物料/香精','容器包材','場地租金','水電瓦斯','設備器材','課程教材','行銷廣告','網站/系統/平台','交通運費','平台手續費','外包/顧問','餐飲交際','辦公雜支','稅費/規費','其他支出'];
const assetCategories = ['器具設備','生財器具','裝潢/修繕','押金/保證金','存貨','其他資產'];
const transferCategories = ['現金提存','帳戶轉帳','業主往來','信用卡繳款','其他移轉'];

const accounts = [
  {code:'4110', name:'銷貨收入', kind:'income'},
  {code:'4120', name:'勞務收入／課程收入', kind:'income'},
  {code:'4130', name:'顧問／設計服務收入', kind:'income'},
  {code:'4140', name:'活動／企業合作收入', kind:'income'},
  {code:'4190', name:'其他營業收入', kind:'income'},
  {code:'5110', name:'進貨／原物料成本', kind:'expense'},
  {code:'5120', name:'包材／容器成本', kind:'expense'},
  {code:'5130', name:'課程材料成本', kind:'expense'},
  {code:'5140', name:'商品進貨成本', kind:'expense'},
  {code:'5210', name:'薪資支出／外包勞務', kind:'expense'},
  {code:'5220', name:'租金支出', kind:'expense'},
  {code:'5230', name:'水電瓦斯費', kind:'expense'},
  {code:'5240', name:'郵電費／網路費', kind:'expense'},
  {code:'5250', name:'文具用品／辦公費', kind:'expense'},
  {code:'5260', name:'旅費／交通費', kind:'expense'},
  {code:'5270', name:'運費', kind:'expense'},
  {code:'5280', name:'廣告行銷費', kind:'expense'},
  {code:'5290', name:'平台手續費／刷卡手續費', kind:'expense'},
  {code:'5310', name:'修繕費', kind:'expense'},
  {code:'5320', name:'保險費', kind:'expense'},
  {code:'5330', name:'稅捐／規費', kind:'expense'},
  {code:'5340', name:'交際費', kind:'expense'},
  {code:'5350', name:'訓練費／進修費', kind:'expense'},
  {code:'5360', name:'雜項購置', kind:'expense'},
  {code:'5390', name:'其他費用', kind:'expense'},
  {code:'1410', name:'存貨', kind:'asset'},
  {code:'1510', name:'生財器具／設備', kind:'asset'},
  {code:'1520', name:'租賃改良／裝修', kind:'asset'},
  {code:'1910', name:'押金／保證金', kind:'asset'},
  {code:'1110', name:'現金', kind:'transfer'},
  {code:'1120', name:'銀行存款', kind:'transfer'},
  {code:'2180', name:'業主往來／代墊', kind:'transfer'},
  {code:'2190', name:'其他應付／內部移轉', kind:'transfer'}
];

const internalTags = ['此域開幕籌備','此域固定營運','KPIA課程','Helori體驗','H.FUGUE產品','企業合作','國藝會/補助','網站SEO/行銷','品牌視覺/拍攝','私人代墊待沖','不可列帳但需追蹤','待分類'];

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('zh-TW');
let entries = [];
let db;
let editingId = null;

function openDB(){
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open(DB_NAME,1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE,{keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function saveEntries(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
function loadEntries(){ entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify({bizName:$('bizName').value,bizBan:$('bizBan').value,taxMode:$('taxMode').value,yearFilter:$('yearFilter').value})); }
function loadSettings(){ const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); $('bizName').value=s.bizName||'藏花香徑工作室'; $('bizBan').value=s.bizBan||'61269475'; $('taxMode').value=s.taxMode||'small'; $('yearFilter').value=s.yearFilter||new Date().getFullYear(); }

function listByKind(){ const k=$('kind').value; if(k==='income') return incomeCategories; if(k==='asset') return assetCategories; if(k==='transfer') return transferCategories; return expenseCategories; }
function updateCategoryOptions(){ $('category').innerHTML = listByKind().map(x=>`<option>${x}</option>`).join(''); updateAccountOptions(); }
function updateAccountOptions(){ const k=$('kind').value; const list=accounts.filter(a=>a.kind===k || (k==='asset' && a.kind==='asset') || (k==='transfer' && a.kind==='transfer')); $('accountCode').innerHTML=list.map(a=>`<option value="${a.code}">${a.code} ${a.name}</option>`).join(''); }
function updateInternalTags(){ $('internalTag').innerHTML = internalTags.map(x=>`<option>${x}</option>`).join(''); }
function accountName(code){ return accounts.find(a=>a.code===code)?.name || ''; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function money(n){ return fmt.format(Number(n || 0)); }
function selectedYear(){ return Number($('yearFilter').value || new Date().getFullYear()); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function isTaxBook(e){ return e.bookScope !== 'internal' && e.taxDeductible !== 'no'; }
function isInternalBook(e){ return e.bookScope !== 'tax'; }

function getVisibleEntries(){ const q=$('searchInput').value.trim().toLowerCase(); return entries.filter(e=>new Date(e.date).getFullYear()===selectedYear()).filter(e=>!q||JSON.stringify(e).toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date)); }
async function putReceipt(id,file){ if(!file) return null; const data=await file.arrayBuffer(); return new Promise((resolve,reject)=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put({id,name:file.name,type:file.type,data,savedAt:new Date().toISOString()}); tx.oncomplete=()=>resolve({name:file.name,type:file.type}); tx.onerror=()=>reject(tx.error); }); }
function getReceipt(id){ return new Promise((resolve,reject)=>{ const tx=db.transaction(STORE,'readonly'); const request=tx.objectStore(STORE).get(id); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
function deleteReceipt(id){ return new Promise(resolve=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete=()=>resolve(); }); }

function formData(){
  const gross=Number($('grossAmount').value||0); const tax=Number($('taxAmount').value||0); const net=$('netAmount').value===''?Math.max(gross-tax,0):Number($('netAmount').value||0);
  return {date:$('date').value,kind:$('kind').value,bookScope:$('bookScope').value,accountCode:$('accountCode').value,accountName:accountName($('accountCode').value),internalTag:$('internalTag').value,voucherType:$('voucherType').value,voucherNo:$('voucherNo').value.trim(),counterparty:$('counterparty').value.trim(),counterpartyBan:$('counterpartyBan').value.trim(),category:$('category').value,paymentMethod:$('paymentMethod').value,project:$('project').value.trim(),netAmount:net,taxAmount:tax,grossAmount:gross,taxDeductible:$('taxDeductible').value,voucherStatus:$('voucherStatus').value,cashStatus:$('cashStatus').value,note:$('note').value.trim()};
}
function migrateEntry(e){
  if(e.bookScope) return e;
  const kind=e.kind||'expense';
  const fallback=accounts.find(a=>a.kind===kind) || accounts.find(a=>a.kind==='expense');
  return {...e,bookScope:'both',accountCode:fallback.code,accountName:fallback.name,internalTag:'待分類',taxDeductible:'review',voucherStatus:e.voucherType==='無憑證待補'?'missing':'complete',cashStatus:'paid'};
}
function fillForm(e){
  e=migrateEntry(e); editingId=e.id; $('date').value=e.date; $('kind').value=e.kind; updateCategoryOptions(); updateInternalTags();
  $('bookScope').value=e.bookScope||'both'; $('accountCode').value=e.accountCode||$('accountCode').value; $('internalTag').value=e.internalTag||'待分類';
  $('voucherType').value=e.voucherType; $('voucherNo').value=e.voucherNo||''; $('counterparty').value=e.counterparty||''; $('counterpartyBan').value=e.counterpartyBan||'';
  $('category').value=e.category||$('category').value; $('paymentMethod').value=e.paymentMethod||'現金'; $('project').value=e.project||''; $('netAmount').value=e.netAmount??''; $('taxAmount').value=e.taxAmount??0; $('grossAmount').value=e.grossAmount??0;
  $('taxDeductible').value=e.taxDeductible||'review'; $('voucherStatus').value=e.voucherStatus||'complete'; $('cashStatus').value=e.cashStatus||'paid'; $('note').value=e.note||''; $('fileHint').textContent='編輯中：可重新上傳附件'; window.scrollTo({top:0,behavior:'smooth'});
}
function resetForm(){ editingId=null; $('entryForm').reset(); $('date').value=todayISO(); $('taxAmount').value=0; $('fileHint').textContent='未選擇檔案'; updateCategoryOptions(); updateInternalTags(); }
async function handleSubmit(ev){ ev.preventDefault(); const file=$('receiptFile').files[0]; const id=editingId||uid(); const old=entries.find(x=>x.id===id); const receipt=file?await putReceipt(id,file):old?.receipt||null; const payload={...formData(),id,receipt,updatedAt:new Date().toISOString()}; if(!editingId) payload.createdAt=new Date().toISOString(); entries=editingId?entries.map(x=>x.id===id?payload:x):[payload,...entries]; saveEntries(); saveSettings(); resetForm(); render(); }

function renderStats(list){ const taxList=list.filter(isTaxBook); const income=taxList.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.grossAmount||0),0); const expense=taxList.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.grossAmount||0),0); const missing=list.filter(e=>e.voucherStatus!=='complete'||e.bookScope==='review'||e.taxDeductible==='review'||e.voucherType==='無憑證待補'||!e.receipt).length; $('sumIncome').textContent=money(income); $('sumExpense').textContent=money(expense); $('sumProfit').textContent=money(income-expense); $('missingDocs').textContent=missing; }
function renderSummary(list){ const rows=Array.from({length:12},(_,i)=>i+1).map(m=>{ const mList=list.filter(isTaxBook).filter(e=>Number(e.date.slice(5,7))===m); const income=mList.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.grossAmount||0),0); const expense=mList.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.grossAmount||0),0); const inputTax=mList.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.taxAmount||0),0); const smallDeduct=Math.floor(inputTax*.1); const review=mList.filter(e=>e.voucherStatus!=='complete'||e.taxDeductible==='review'||!e.receipt).length; return `<tr><td>${selectedYear()}/${String(m).padStart(2,'0')}</td><td>${money(income)}</td><td>${money(expense)}</td><td>${money(income-expense)}</td><td>${money(inputTax)}</td><td>${money(smallDeduct)}</td><td class="${review?'danger':''}">${review}</td></tr>`; }).join(''); $('summaryTable').innerHTML=`<thead><tr><th>月份</th><th>外帳收入</th><th>外帳支出</th><th>外帳損益</th><th>進項稅額</th><th>小規模扣減估算</th><th>待確認</th></tr></thead><tbody>${rows}</tbody>`; }
function renderAccountSummary(list){ const taxList=list.filter(isTaxBook); const map=new Map(); taxList.forEach(e=>{ const key=e.accountCode||'未分類'; const r=map.get(key)||{code:key,name:e.accountName||accountName(key)||'未分類',income:0,expense:0,asset:0,count:0}; if(e.kind==='income') r.income+=Number(e.grossAmount||0); else if(e.kind==='asset') r.asset+=Number(e.grossAmount||0); else if(e.kind==='expense') r.expense+=Number(e.grossAmount||0); r.count++; map.set(key,r); }); const rows=[...map.values()].sort((a,b)=>String(a.code).localeCompare(String(b.code))).map(r=>`<tr><td>${r.code}</td><td>${r.name}</td><td>${money(r.income)}</td><td>${money(r.expense)}</td><td>${money(r.asset)}</td><td>${r.count}</td></tr>`).join(''); $('accountSummaryTable').innerHTML=`<thead><tr><th>科目代碼</th><th>科目名稱</th><th>收入</th><th>費用</th><th>資產/設備</th><th>筆數</th></tr></thead><tbody>${rows||'<tr><td colspan="6">尚無資料</td></tr>'}</tbody>`; }
function renderEntries(list){ const rows=list.map(raw=>{ const e=migrateEntry(raw); return `<tr><td>${e.date}</td><td><span class="pill">${e.kind==='income'?'收入':e.kind==='expense'?'支出':e.kind==='asset'?'資產':'移轉'}</span></td><td>${e.bookScope==='both'?'外＋內':e.bookScope==='tax'?'外帳':e.bookScope==='internal'?'內帳':'待確認'}</td><td>${e.accountCode} ${e.accountName||accountName(e.accountCode)}</td><td>${e.internalTag||'-'}</td><td>${e.counterparty||'-'}</td><td>${e.voucherType}</td><td>${money(e.grossAmount)}</td><td>${e.receipt?`<button class="link-btn" data-view="${e.id}">檢視</button>`:'<span class="danger">未附</span>'}</td><td><button class="link-btn" data-edit="${e.id}">編輯</button> ｜ <button class="link-btn danger" data-delete="${e.id}">刪除</button></td></tr>`; }).join(''); $('entriesTable').innerHTML=`<thead><tr><th>日期</th><th>類型</th><th>帳務</th><th>會計科目</th><th>內帳標籤</th><th>對象</th><th>憑證</th><th>金額</th><th>附件</th><th>操作</th></tr></thead><tbody>${rows||'<tr><td colspan="10">尚無資料</td></tr>'}</tbody>`; }
function render(){ const list=getVisibleEntries(); renderStats(list); renderSummary(list); renderAccountSummary(list); renderEntries(list); }

async function viewReceipt(id){ const r=await getReceipt(id); if(!r){ alert('找不到附件。可能已清除瀏覽器資料。'); return; } const blob=new Blob([r.data],{type:r.type||'application/octet-stream'}); const url=URL.createObjectURL(blob); $('receiptPreview').innerHTML=r.type?.includes('pdf')?`<iframe src="${url}"></iframe>`:`<img src="${url}" alt="receipt">`; $('receiptDialog').showModal(); }
async function handleTableClick(ev){ const id=ev.target.dataset.view||ev.target.dataset.edit||ev.target.dataset.delete; if(!id) return; const e=entries.find(x=>x.id===id); if(ev.target.dataset.view) viewReceipt(id); if(ev.target.dataset.edit&&e) fillForm(e); if(ev.target.dataset.delete&&confirm('確定刪除這筆資料與本機附件？')){ entries=entries.filter(x=>x.id!==id); await deleteReceipt(id); saveEntries(); render(); } }
function toCsvValue(v){ return '"'+String(v??'').replaceAll('"','""')+'"'; }
function csvRows(list,mode='full'){ const headerFull=['營業人名稱','統一編號','日期','類型','帳務視圖','會計科目代碼','會計科目名稱','內帳標籤','補充分類','交易對象','對方統編','憑證類型','憑證號碼','付款方式','專案/用途','未稅金額','營業稅額','總金額','是否可列外帳','憑證狀態','現金流狀態','備註','有無附件']; const headerTax=['營業人名稱','統一編號','日期','類型','會計科目代碼','會計科目名稱','交易對象','對方統編','憑證類型','憑證號碼','未稅金額','營業稅額','總金額','是否可列帳','憑證狀態','備註']; const headerInternal=['日期','類型','內帳標籤','專案/用途','補充分類','交易對象','付款方式','總金額','現金流狀態','是否列外帳','備註']; const rows=list.map(migrateEntry).filter(e=>mode==='tax'?isTaxBook(e):mode==='internal'?isInternalBook(e):true).map(e=> mode==='tax' ? [$('bizName').value,$('bizBan').value,e.date,e.kind,e.accountCode,e.accountName,e.counterparty,e.counterpartyBan,e.voucherType,e.voucherNo,e.netAmount,e.taxAmount,e.grossAmount,e.taxDeductible,e.voucherStatus,e.note] : mode==='internal' ? [e.date,e.kind,e.internalTag,e.project,e.category,e.counterparty,e.paymentMethod,e.grossAmount,e.cashStatus,e.bookScope,e.note] : [$('bizName').value,$('bizBan').value,e.date,e.kind,e.bookScope,e.accountCode,e.accountName,e.internalTag,e.category,e.counterparty,e.counterpartyBan,e.voucherType,e.voucherNo,e.paymentMethod,e.project,e.netAmount,e.taxAmount,e.grossAmount,e.taxDeductible,e.voucherStatus,e.cashStatus,e.note,e.receipt?'有':'無']); return [mode==='tax'?headerTax:mode==='internal'?headerInternal:headerFull, ...rows]; }
function exportCsv(mode='full'){ const csv='\ufeff'+csvRows(getVisibleEntries(),mode).map(r=>r.map(toCsvValue).join(',')).join('\n'); const suffix=mode==='tax'?'external_tax':mode==='internal'?'internal':'full'; downloadText(csv,`taxbook_${suffix}_${selectedYear()}.csv`,'text/csv;charset=utf-8'); }
function exportJson(){ const data={version:2,exportedAt:new Date().toISOString(),settings:JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'),entries}; downloadText(JSON.stringify(data,null,2),`taxbook_backup_${new Date().toISOString().slice(0,10)}.json`,'application/json'); alert('JSON 備份包含流水帳資料，但不包含附件影像/PDF。附件仍需另外保存原始檔。'); }
function downloadText(text,filename,type){ const blob=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }
function importJson(file){ if(!file) return; const reader=new FileReader(); reader.onload=()=>{ const data=JSON.parse(reader.result); if(!Array.isArray(data.entries)) throw new Error('格式不符'); entries=data.entries.map(migrateEntry); localStorage.setItem(STORAGE_KEY,JSON.stringify(entries)); if(data.settings) localStorage.setItem(SETTINGS_KEY,JSON.stringify(data.settings)); loadSettings(); render(); alert('匯入完成。提醒：JSON 不含附件影像/PDF。'); }; reader.onerror=()=>alert('匯入失敗'); reader.readAsText(file); }
function bind(){ $('entryForm').addEventListener('submit',handleSubmit); $('kind').addEventListener('change',updateCategoryOptions); $('receiptFile').addEventListener('change',e=>$('fileHint').textContent=e.target.files[0]?.name||'未選擇檔案'); $('resetFormBtn').addEventListener('click',resetForm); $('entriesTable').addEventListener('click',handleTableClick); $('searchInput').addEventListener('input',render); ['bizName','bizBan','taxMode','yearFilter'].forEach(id=>$(id).addEventListener('change',()=>{saveSettings();render();})); $('exportCsvBtn').addEventListener('click',()=>exportCsv('full')); $('exportTaxCsvBtn').addEventListener('click',()=>exportCsv('tax')); $('exportInternalCsvBtn').addEventListener('click',()=>exportCsv('internal')); $('exportJsonBtn').addEventListener('click',exportJson); $('importJsonInput').addEventListener('change',e=>importJson(e.target.files[0])); $('printBtn').addEventListener('click',()=>window.print()); $('closeDialog').addEventListener('click',()=>$('receiptDialog').close()); }
async function init(){ db=await openDB(); loadSettings(); loadEntries(); entries=entries.map(migrateEntry); saveEntries(); bind(); resetForm(); render(); if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{}); }
init().catch(err=>{ console.error(err); alert('初始化失敗，請確認瀏覽器支援 IndexedDB。'); });
