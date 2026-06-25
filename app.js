const DB_NAME = 'hanaTaxBookDB';
const STORE = 'receipts';
const STORAGE_KEY = 'hanaTaxBookEntries';
const SETTINGS_KEY = 'hanaTaxBookSettings';
const SYNC_SETTINGS_KEY = 'hanaTaxBookSyncSettings';
const LOCAL_META_KEY = 'hanaTaxBookLocalMeta';
const BACKUP_META_KEY = 'hanaTaxBookBackupMeta';

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
let supabaseClient = null;
let currentUser = null;

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
function markLocalChanged(){ localStorage.setItem(LOCAL_META_KEY, JSON.stringify({updatedAt:new Date().toISOString()})); }
function localChangedAt(){ const meta=JSON.parse(localStorage.getItem(LOCAL_META_KEY)||'{}'); return meta.updatedAt || latestEntryTime(entries); }
function lastBackupAt(){ const meta=JSON.parse(localStorage.getItem(BACKUP_META_KEY)||'{}'); return meta.exportedAt || ''; }
function latestEntryTime(list){ return list.map(e=>e.updatedAt||e.createdAt||e.date).filter(Boolean).sort().at(-1) || ''; }
function fmtTime(value){ return value ? new Date(value).toLocaleString('zh-TW') : '無紀錄'; }
function saveEntriesChanged(){ saveEntries(); markLocalChanged(); }
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify({bizName:$('bizName').value,bizBan:$('bizBan').value,taxMode:$('taxMode').value,yearFilter:$('yearFilter').value})); }
function loadSettings(){ const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); $('bizName').value=s.bizName||'藏花香徑工作室'; $('bizBan').value=s.bizBan||'61269475'; $('taxMode').value=s.taxMode||'small'; $('yearFilter').value=s.yearFilter||new Date().getFullYear(); }

function saveSyncSettings(){ localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify({url:$('supabaseUrl').value.trim(),key:$('supabaseKey').value.trim(),email:$('syncEmail').value.trim()})); }
function loadSyncSettings(){ const s=JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY)||'{}'); $('supabaseUrl').value=s.url||''; $('supabaseKey').value=s.key||''; $('syncEmail').value=s.email||''; }
function updateCloudStatus(text, ok=false){ const el=$('cloudStatus'); if(!el) return; el.textContent=text; el.className = ok ? 'pill cloud-ok' : 'pill'; }
function redirectUrl(){ return `${location.origin}${location.pathname}`; }
function createCloudClient(){
  const url=$('supabaseUrl').value.trim();
  const key=$('supabaseKey').value.trim();
  if(!url || !key){ supabaseClient=null; updateCloudStatus('未設定'); return null; }
  if(!window.supabase){ updateCloudStatus('Supabase 程式未載入'); return null; }
  supabaseClient = window.supabase.createClient(url,key);
  updateCloudStatus(currentUser ? `已登入：${currentUser.email || '帳號'}` : '已設定，未登入', !!currentUser);
  return supabaseClient;
}
async function refreshCloudUser(){
  if(!supabaseClient) return;
  const { data } = await supabaseClient.auth.getUser();
  currentUser = data?.user || null;
  updateCloudStatus(currentUser ? `已登入：${currentUser.email || '帳號'}` : '已設定，未登入', !!currentUser);
}
async function saveCloudConfig(){ saveSyncSettings(); createCloudClient(); await refreshCloudUser(); alert('同步設定已儲存。'); }
async function sendMagicLink(){
  const client = supabaseClient || createCloudClient();
  if(!client) return alert('請先填 Supabase Project URL 與 anon/publishable key。');
  const email=$('syncEmail').value.trim();
  if(!email) return alert('請輸入登入 Email。');
  saveSyncSettings();
  const { error } = await client.auth.signInWithOtp({ email, options:{ emailRedirectTo: redirectUrl() } });
  if(error) return alert('寄送登入連結失敗：' + error.message);
  alert('已寄出登入連結。請到信箱點擊連結後，回到這個頁面同步。');
}
async function signOutCloud(){ if(!supabaseClient) return; await supabaseClient.auth.signOut(); currentUser=null; updateCloudStatus('已登出'); }
async function requireUser(){
  const client=supabaseClient || createCloudClient();
  if(!client) throw new Error('尚未設定 Supabase。');
  const { data, error } = await client.auth.getUser();
  if(error || !data?.user) throw new Error('尚未登入。請先寄登入連結並完成登入。');
  currentUser=data.user; updateCloudStatus(`已登入：${currentUser.email || '帳號'}`, true); return currentUser;
}

function listByKind(){ const k=$('kind').value; if(k==='income') return incomeCategories; if(k==='asset') return assetCategories; if(k==='transfer') return transferCategories; return expenseCategories; }
function updateCategoryOptions(){ $('category').innerHTML = listByKind().map(x=>`<option>${x}</option>`).join(''); updateAccountOptions(); }
function updateAccountOptions(){ const k=$('kind').value; const list=accounts.filter(a=>a.kind===k || (k==='asset' && a.kind==='asset') || (k==='transfer' && a.kind==='transfer')); $('accountCode').innerHTML=list.map(a=>`<option value="${a.code}">${a.code} ${a.name}</option>`).join(''); }
function updateInternalTags(){ $('internalTag').innerHTML = internalTags.map(x=>`<option>${x}</option>`).join(''); }
function accountName(code){ return accounts.find(a=>a.code===code)?.name || ''; }
function todayISO(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}
function money(n){ return fmt.format(Number(n || 0)); }
function selectedYear(){ return Number($('yearFilter').value || new Date().getFullYear()); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function isTaxBook(e){ return e.bookScope !== 'internal' && e.taxDeductible !== 'no'; }
function isInternalBook(e){ return e.bookScope !== 'tax'; }
function isNoDocNeeded(e){ return e.voucherStatus==='no-doc-needed'||e.voucherStatus==='no-voucher'||e.voucherType==='內帳無憑證/無需補件'; }
function needsVoucherReview(e){ return !isNoDocNeeded(e) && (e.voucherStatus!=='complete'||e.voucherType==='無憑證待補'||!e.receipt); }
function safeFileName(name){ return encodeURIComponent((name || 'receipt').replace(/[\\/]/g,'-')); }
function html(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function receiptPath(e){ return e.cloudReceiptPath || e.receipt?.cloudPath || ''; }

function getVisibleEntries(){ const q=$('searchInput').value.trim().toLowerCase(); return entries.filter(e=>new Date(e.date).getFullYear()===selectedYear()).filter(e=>!q||JSON.stringify(e).toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date)); }
async function putReceipt(id,file){ if(!file) return null; const data=await file.arrayBuffer(); await putReceiptRaw(id,file.name,file.type,data); return {name:file.name,type:file.type}; }
function putReceiptRaw(id,name,type,data){ return new Promise((resolve,reject)=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put({id,name,type,data,savedAt:new Date().toISOString()}); tx.oncomplete=()=>resolve({name,type}); tx.onerror=()=>reject(tx.error); }); }
function getReceipt(id){ return new Promise((resolve,reject)=>{ const tx=db.transaction(STORE,'readonly'); const request=tx.objectStore(STORE).get(id); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
function deleteReceipt(id){ return new Promise(resolve=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete=()=>resolve(); }); }

function formData(){
  const gross=Number($('grossAmount').value||0); const tax=Number($('taxAmount').value||0); const net=$('netAmount').value===''?Math.max(gross-tax,0):Number($('netAmount').value||0);
  return {date:$('date').value,kind:$('kind').value,bookScope:$('bookScope').value,accountCode:$('accountCode').value,accountName:accountName($('accountCode').value),internalTag:$('internalTag').value,voucherType:$('voucherType').value,voucherNo:$('voucherNo').value.trim(),counterparty:$('counterparty').value.trim(),counterpartyBan:$('counterpartyBan').value.trim(),category:$('category').value,paymentMethod:$('paymentMethod').value,project:$('project').value.trim(),netAmount:net,taxAmount:tax,grossAmount:gross,taxDeductible:$('taxDeductible').value,voucherStatus:$('voucherStatus').value,cashStatus:$('cashStatus').value,note:$('note').value.trim()};
}
function migrateEntry(e){
  const kind=e.kind||'expense';
  const fallback=accounts.find(a=>a.kind===kind) || accounts.find(a=>a.kind==='expense');
  const gross=Number(e.grossAmount ?? e.amount ?? 0);
  const tax=Number(e.taxAmount ?? 0);
  const net=e.netAmount==='' || e.netAmount == null ? Math.max(gross-tax,0) : Number(e.netAmount||0);
  return {
    id:e.id||uid(),
    date:e.date||todayISO(),
    kind,
    bookScope:e.bookScope||'both',
    accountCode:e.accountCode||fallback.code,
    accountName:e.accountName||accountName(e.accountCode)||fallback.name,
    internalTag:e.internalTag||'待分類',
    voucherType:e.voucherType||'無憑證待補',
    voucherNo:e.voucherNo||'',
    counterparty:e.counterparty||'',
    counterpartyBan:e.counterpartyBan||'',
    category:e.category||'',
    paymentMethod:e.paymentMethod||'現金',
    project:e.project||'',
    netAmount:net,
    taxAmount:tax,
    grossAmount:gross,
    taxDeductible:e.taxDeductible||'review',
    voucherStatus:e.voucherStatus||(e.voucherType==='無憑證待補'?'missing':'complete'),
    cashStatus:e.cashStatus||'paid',
    note:e.note||'',
    receipt:e.receipt||null,
    cloudReceiptPath:e.cloudReceiptPath||e.receipt?.cloudPath||'',
    createdAt:e.createdAt||e.date||new Date().toISOString(),
    updatedAt:e.updatedAt||e.createdAt||new Date().toISOString()
  };
}
function fillForm(e){
  e=migrateEntry(e); editingId=e.id; $('date').value=e.date; $('kind').value=e.kind; updateCategoryOptions(); updateInternalTags();
  $('bookScope').value=e.bookScope||'both'; $('accountCode').value=e.accountCode||$('accountCode').value; $('internalTag').value=e.internalTag||'待分類';
  $('voucherType').value=e.voucherType; $('voucherNo').value=e.voucherNo||''; $('counterparty').value=e.counterparty||''; $('counterpartyBan').value=e.counterpartyBan||'';
  $('category').value=e.category||$('category').value; $('paymentMethod').value=e.paymentMethod||'現金'; $('project').value=e.project||''; $('netAmount').value=e.netAmount??''; $('taxAmount').value=e.taxAmount??0; $('grossAmount').value=e.grossAmount??0;
  $('taxDeductible').value=e.taxDeductible||'review'; $('voucherStatus').value=e.voucherStatus||'complete'; $('cashStatus').value=e.cashStatus||'paid'; $('note').value=e.note||''; $('fileHint').textContent='編輯中：可重新上傳附件'; window.scrollTo({top:0,behavior:'smooth'});
}
function resetForm(){ editingId=null; $('entryForm').reset(); $('date').value=todayISO(); $('taxAmount').value=0; $('fileHint').textContent='未選擇檔案'; updateCategoryOptions(); updateInternalTags(); }
async function handleSubmit(ev){ ev.preventDefault(); const file=$('receiptFile').files[0]; const id=editingId||uid(); const old=entries.find(x=>x.id===id); const receipt=file?await putReceipt(id,file):old?.receipt||null; const payload={...migrateEntry({...old,...formData(),id,receipt,updatedAt:new Date().toISOString()})}; if(!editingId) payload.createdAt=new Date().toISOString(); entries=editingId?entries.map(x=>x.id===id?payload:x):[payload,...entries]; saveEntriesChanged(); saveSettings(); resetForm(); render(); }

function renderStats(list){ const taxList=list.filter(isTaxBook); const income=taxList.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.grossAmount||0),0); const expense=taxList.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.grossAmount||0),0); const missing=list.filter(e=>needsVoucherReview(e)||e.bookScope==='review'||e.taxDeductible==='review').length; $('sumIncome').textContent=money(income); $('sumExpense').textContent=money(expense); $('sumProfit').textContent=money(income-expense); $('missingDocs').textContent=missing; }
function renderSummary(list){ const rows=Array.from({length:12},(_,i)=>i+1).map(m=>{ const mList=list.filter(isTaxBook).filter(e=>Number(e.date.slice(5,7))===m); const income=mList.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.grossAmount||0),0); const expense=mList.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.grossAmount||0),0); const inputTax=mList.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.taxAmount||0),0); const smallDeduct=Math.floor(inputTax*.1); const review=mList.filter(e=>needsVoucherReview(e)||e.taxDeductible==='review').length; return `<tr><td>${selectedYear()}/${String(m).padStart(2,'0')}</td><td>${money(income)}</td><td>${money(expense)}</td><td>${money(income-expense)}</td><td>${money(inputTax)}</td><td>${money(smallDeduct)}</td><td class="${review?'danger':''}">${review}</td></tr>`; }).join(''); $('summaryTable').innerHTML=`<thead><tr><th>月份</th><th>外帳收入</th><th>外帳支出</th><th>外帳損益</th><th>進項稅額</th><th>小規模扣減估算</th><th>待確認</th></tr></thead><tbody>${rows}</tbody>`; }
function renderAccountSummary(list){ const taxList=list.filter(isTaxBook); const map=new Map(); taxList.forEach(e=>{ const key=e.accountCode||'未分類'; const r=map.get(key)||{code:key,name:e.accountName||accountName(key)||'未分類',income:0,expense:0,asset:0,count:0}; if(e.kind==='income') r.income+=Number(e.grossAmount||0); else if(e.kind==='asset') r.asset+=Number(e.grossAmount||0); else if(e.kind==='expense') r.expense+=Number(e.grossAmount||0); r.count++; map.set(key,r); }); const rows=[...map.values()].sort((a,b)=>String(a.code).localeCompare(String(b.code))).map(r=>`<tr><td>${html(r.code)}</td><td>${html(r.name)}</td><td>${money(r.income)}</td><td>${money(r.expense)}</td><td>${money(r.asset)}</td><td>${r.count}</td></tr>`).join(''); $('accountSummaryTable').innerHTML=`<thead><tr><th>科目代碼</th><th>科目名稱</th><th>收入</th><th>費用</th><th>資產/設備</th><th>筆數</th></tr></thead><tbody>${rows||'<tr><td colspan="6">尚無資料</td></tr>'}</tbody>`; }
function renderEntries(list){ const rows=list.map(raw=>{ const e=migrateEntry(raw); return `<tr><td>${html(e.date)}</td><td><span class="pill">${e.kind==='income'?'收入':e.kind==='expense'?'支出':e.kind==='asset'?'資產':'移轉'}</span></td><td>${e.bookScope==='both'?'外＋內':e.bookScope==='tax'?'外帳':e.bookScope==='internal'?'內帳':'待確認'}</td><td>${html(e.accountCode)} ${html(e.accountName||accountName(e.accountCode))}</td><td>${html(e.internalTag||'-')}</td><td>${html(e.counterparty||'-')}</td><td>${html(e.voucherType)}</td><td>${money(e.grossAmount)}</td><td>${e.receipt?`<button class="link-btn" data-view="${html(e.id)}">檢視</button>`:'<span class="danger">未附</span>'}</td><td><button class="link-btn" data-edit="${html(e.id)}">編輯</button> ｜ <button class="link-btn danger" data-delete="${html(e.id)}">刪除</button></td></tr>`; }).join(''); $('entriesTable').innerHTML=`<thead><tr><th>日期</th><th>類型</th><th>帳務</th><th>會計科目</th><th>內帳標籤</th><th>對象</th><th>憑證</th><th>金額</th><th>附件</th><th>操作</th></tr></thead><tbody>${rows||'<tr><td colspan="10">尚無資料</td></tr>'}</tbody>`; }
function render(){ const list=getVisibleEntries(); renderStats(list); renderSummary(list); renderAccountSummary(list); renderEntries(list); }

async function viewReceipt(id){ const r=await getReceipt(id); if(!r){ alert('找不到附件。可能尚未從雲端下載，或已清除瀏覽器資料。'); return; } const blob=new Blob([r.data],{type:r.type||'application/octet-stream'}); const url=URL.createObjectURL(blob); $('receiptPreview').innerHTML=r.type?.includes('pdf')?`<iframe src="${url}"></iframe>`:`<img src="${url}" alt="receipt">`; $('receiptDialog').showModal(); }
async function handleTableClick(ev){ const id=ev.target.dataset.view||ev.target.dataset.edit||ev.target.dataset.delete; if(!id) return; const e=entries.find(x=>x.id===id); if(ev.target.dataset.view) viewReceipt(id); if(ev.target.dataset.edit&&e) fillForm(e); if(ev.target.dataset.delete&&confirm('確定刪除這筆資料與本機附件？雲端附件會在下次上傳後不再出現在流水帳，但 Storage 內舊檔仍需到 Supabase 後台清理。')){ entries=entries.filter(x=>x.id!==id); await deleteReceipt(id); saveEntriesChanged(); render(); } }
function toCsvValue(v){ return '"'+String(v??'').replaceAll('"','""')+'"'; }
function csvRows(list,mode='full'){ const headerFull=['營業人名稱','統一編號','日期','類型','帳務視圖','會計科目代碼','會計科目名稱','內帳標籤','補充分類','交易對象','對方統編','憑證類型','憑證號碼','付款方式','專案/用途','未稅金額','營業稅額','總金額','是否可列外帳','憑證狀態','現金流狀態','備註','有無附件','附件檔名','附件類型','附件雲端路徑']; const headerTax=['營業人名稱','統一編號','日期','類型','會計科目代碼','會計科目名稱','交易對象','對方統編','憑證類型','憑證號碼','未稅金額','營業稅額','總金額','是否可列帳','憑證狀態','備註']; const headerInternal=['日期','類型','內帳標籤','專案/用途','補充分類','交易對象','付款方式','總金額','現金流狀態','是否列外帳','備註']; const rows=list.map(migrateEntry).filter(e=>mode==='tax'?isTaxBook(e):mode==='internal'?isInternalBook(e):true).map(e=> mode==='tax' ? [$('bizName').value,$('bizBan').value,e.date,e.kind,e.accountCode,e.accountName,e.counterparty,e.counterpartyBan,e.voucherType,e.voucherNo,e.netAmount,e.taxAmount,e.grossAmount,e.taxDeductible,e.voucherStatus,e.note] : mode==='internal' ? [e.date,e.kind,e.internalTag,e.project,e.category,e.counterparty,e.paymentMethod,e.grossAmount,e.cashStatus,e.bookScope,e.note] : [$('bizName').value,$('bizBan').value,e.date,e.kind,e.bookScope,e.accountCode,e.accountName,e.internalTag,e.category,e.counterparty,e.counterpartyBan,e.voucherType,e.voucherNo,e.paymentMethod,e.project,e.netAmount,e.taxAmount,e.grossAmount,e.taxDeductible,e.voucherStatus,e.cashStatus,e.note,e.receipt?'有':'無',e.receipt?.name||'',e.receipt?.type||'',receiptPath(e)]); return [mode==='tax'?headerTax:mode==='internal'?headerInternal:headerFull, ...rows]; }
function exportCsv(mode='full'){ const csv='\ufeff'+csvRows(getVisibleEntries(),mode).map(r=>r.map(toCsvValue).join(',')).join('\n'); const suffix=mode==='tax'?'external_tax':mode==='internal'?'internal':'full'; downloadText(csv,`taxbook_${suffix}_${selectedYear()}.csv`,'text/csv;charset=utf-8'); }
function exportJson(){ const exportedAt=new Date().toISOString(); const data={version:3,exportedAt,settings:JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'),entries}; localStorage.setItem(BACKUP_META_KEY,JSON.stringify({exportedAt})); downloadText(JSON.stringify(data,null,2),`taxbook_backup_${exportedAt.slice(0,10)}.json`,'application/json'); alert('JSON 備份包含流水帳資料，但不包含附件影像/PDF。附件請用雲端同步或另外保存原始檔。'); }
function downloadText(text,filename,type){ const blob=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }
function importJson(file){ if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result); if(!Array.isArray(data.entries)) throw new Error('格式不符'); entries=data.entries.map(migrateEntry); saveEntriesChanged(); if(data.settings) localStorage.setItem(SETTINGS_KEY,JSON.stringify(data.settings)); loadSettings(); render(); alert('匯入完成。提醒：JSON 不含附件影像/PDF。'); }catch(err){ alert('匯入失敗：' + err.message); } }; reader.onerror=()=>alert('匯入失敗'); reader.readAsText(file); }

async function getCloudRecord(user){
  const { data, error } = await supabaseClient.from('taxbook_records').select('data,updated_at').eq('user_id', user.id).maybeSingle();
  if(error) throw error;
  return data || null;
}
function confirmCloudOverwrite(remoteUpdatedAt, localUpdatedAt){
  const remoteIsNewer = remoteUpdatedAt && localUpdatedAt && new Date(remoteUpdatedAt) > new Date(localUpdatedAt);
  const msg = remoteIsNewer
    ? `雲端資料比本機新（雲端：${fmtTime(remoteUpdatedAt)}；本機：${fmtTime(localUpdatedAt)}）。上傳會覆蓋雲端資料，可能造成另一台裝置的新資料遺失。仍要上傳？`
    : `上傳會以這台裝置的資料覆蓋雲端備份。\n本機更新：${fmtTime(localUpdatedAt)}\n雲端更新：${fmtTime(remoteUpdatedAt)}\n確定上傳？`;
  return confirm(msg);
}
function confirmLocalOverwrite(remoteUpdatedAt, localUpdatedAt){
  const backupAt=lastBackupAt();
  const backupIsCurrent = backupAt && localUpdatedAt && new Date(backupAt) >= new Date(localUpdatedAt);
  const localIsNewer = remoteUpdatedAt && localUpdatedAt && new Date(localUpdatedAt) > new Date(remoteUpdatedAt);
  const backupLine = backupIsCurrent ? `最近 JSON 備份：${fmtTime(backupAt)}` : `尚未看到最新本機資料的 JSON 備份紀錄，建議先按「備份 JSON」。`;
  const newerLine = localIsNewer ? '注意：本機資料比雲端新，下載會覆蓋這台裝置的新資料。' : '下載會覆蓋這台裝置目前的本機流水帳。';
  return confirm(`${newerLine}\n${backupLine}\n\n本機更新：${fmtTime(localUpdatedAt)}\n雲端更新：${fmtTime(remoteUpdatedAt)}\n確定下載？`);
}

async function uploadLocalReceipts(user, payloadEntries){
  for(const e of payloadEntries){
    const local = await getReceipt(e.id);
    if(!local) continue;
    const path = `${user.id}/${e.id}/${safeFileName(local.name)}`;
    const blob = new Blob([local.data], { type: local.type || 'application/octet-stream' });
    const { error } = await supabaseClient.storage.from('receipts').upload(path, blob, { upsert:true, contentType: local.type || 'application/octet-stream' });
    if(error) throw new Error(`附件上傳失敗：${local.name}｜${error.message}`);
    e.cloudReceiptPath = path;
    e.receipt = { ...(e.receipt || {}), name: local.name, type: local.type, cloudPath: path };
  }
}
async function downloadCloudReceipts(payloadEntries){
  const failed = [];
  for(const e of payloadEntries){
    const path = e.cloudReceiptPath || e.receipt?.cloudPath;
    if(!path) continue;
    const exists = await getReceipt(e.id);
    if(exists) continue;
    const { data, error } = await supabaseClient.storage.from('receipts').download(path);
    if(error){ failed.push(e.receipt?.name || path); continue; }
    const buffer = await data.arrayBuffer();
    const fileName = e.receipt?.name || path.split('/').pop() || 'receipt';
    const type = e.receipt?.type || data.type || 'application/octet-stream';
    await putReceiptRaw(e.id, fileName, type, buffer);
  }
  return failed;
}
async function pushCloud(){
  try{
    const user = await requireUser();
    const remote = await getCloudRecord(user);
    const localUpdatedAt = localChangedAt();
    const remoteUpdatedAt = remote?.updated_at || remote?.data?.savedAt || '';
    if(remote && !confirmCloudOverwrite(remoteUpdatedAt, localUpdatedAt)) return;
    const payloadEntries = entries.map(migrateEntry);
    await uploadLocalReceipts(user, payloadEntries);
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
    const payload = { settings, entries: payloadEntries, savedAt: new Date().toISOString() };
    const { error } = await supabaseClient.from('taxbook_records').upsert({ user_id:user.id, data:payload, updated_at:new Date().toISOString() }, { onConflict:'user_id' });
    if(error) throw error;
    entries = payloadEntries; saveEntries(); render();
    alert('已上傳到雲端。手機與電腦可用同一個 Email 登入後下載。');
  }catch(err){ alert('雲端上傳失敗：' + err.message); }
}
async function pullCloud(){
  try{
    const user = await requireUser();
    const data = await getCloudRecord(user);
    if(!data?.data?.entries) return alert('雲端目前沒有資料。');
    if(entries.length && !confirmLocalOverwrite(data.updated_at || data.data.savedAt || '', localChangedAt())) return;
    entries = data.data.entries.map(migrateEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    if(data.data.settings){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.data.settings)); loadSettings(); }
    const failedReceipts = await downloadCloudReceipts(entries);
    saveEntries();
    localStorage.setItem(LOCAL_META_KEY, JSON.stringify({updatedAt:data.updated_at || data.data.savedAt || new Date().toISOString()}));
    render();
    alert(failedReceipts.length ? `已從雲端下載流水帳，但有 ${failedReceipts.length} 個附件未下載成功。請確認 Storage bucket 與 RLS policy 設定。` : '已從雲端下載。');
  }catch(err){ alert('雲端下載失敗：' + err.message); }
}

function bind(){
  $('entryForm').addEventListener('submit',handleSubmit);
  $('kind').addEventListener('change',updateCategoryOptions);
  $('receiptFile').addEventListener('change',e=>$('fileHint').textContent=e.target.files[0]?.name||'未選擇檔案');
  $('resetFormBtn').addEventListener('click',resetForm);
  $('entriesTable').addEventListener('click',handleTableClick);
  $('searchInput').addEventListener('input',render);
  ['bizName','bizBan','taxMode','yearFilter'].forEach(id=>$(id).addEventListener('change',()=>{saveSettings();render();}));
  $('exportCsvBtn').addEventListener('click',()=>exportCsv('full'));
  $('exportTaxCsvBtn').addEventListener('click',()=>exportCsv('tax'));
  $('exportInternalCsvBtn').addEventListener('click',()=>exportCsv('internal'));
  $('exportJsonBtn').addEventListener('click',exportJson);
  $('importJsonInput').addEventListener('change',e=>importJson(e.target.files[0]));
  $('printBtn').addEventListener('click',()=>window.print());
  $('closeDialog').addEventListener('click',()=>$('receiptDialog').close());
  $('saveCloudConfigBtn').addEventListener('click',saveCloudConfig);
  $('sendMagicLinkBtn').addEventListener('click',sendMagicLink);
  $('pushCloudBtn').addEventListener('click',pushCloud);
  $('pullCloudBtn').addEventListener('click',pullCloud);
  $('signOutBtn').addEventListener('click',signOutCloud);
}
async function init(){
  db=await openDB(); loadSettings(); loadSyncSettings(); loadEntries(); entries=entries.map(migrateEntry); saveEntries(); bind(); resetForm(); render();
  createCloudClient();
  if(supabaseClient){ await refreshCloudUser(); supabaseClient.auth.onAuthStateChange((_event,session)=>{ currentUser=session?.user||null; updateCloudStatus(currentUser?`已登入：${currentUser.email || '帳號'}`:'已設定，未登入',!!currentUser); }); }
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}
init().catch(err=>{ console.error(err); alert('初始化失敗，請確認瀏覽器支援 IndexedDB。'); });
