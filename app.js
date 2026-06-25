const DB_NAME = 'hanaTaxBookDB';
const STORE = 'receipts';
const STORAGE_KEY = 'hanaTaxBookEntries';
const SETTINGS_KEY = 'hanaTaxBookSettings';

const incomeCategories = ['課程收入','調香體驗收入','商品收入','訂製服務收入','企業/品牌合作','補助/獎助收入','其他收入'];
const expenseCategories = ['原物料/香精','容器包材','場地租金','水電瓦斯','設備器材','課程教材','行銷廣告','網站/系統/平台','交通運費','平台手續費','外包/顧問','餐飲交際','辦公雜支','稅費/規費','其他支出'];

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
function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    bizName:$('bizName').value,
    bizBan:$('bizBan').value,
    taxMode:$('taxMode').value,
    yearFilter:$('yearFilter').value
  }));
}
function loadSettings(){
  const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  $('bizName').value = s.bizName || '藏花香徑工作室';
  $('bizBan').value = s.bizBan || '61269475';
  $('taxMode').value = s.taxMode || 'small';
  $('yearFilter').value = s.yearFilter || new Date().getFullYear();
}

function updateCategoryOptions(){
  const list = $('kind').value === 'income' ? incomeCategories : expenseCategories;
  $('category').innerHTML = list.map(x=>`<option>${x}</option>`).join('');
}

function todayISO(){ return new Date().toISOString().slice(0,10); }
function money(n){ return fmt.format(Number(n || 0)); }
function selectedYear(){ return Number($('yearFilter').value || new Date().getFullYear()); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }

function getVisibleEntries(){
  const q = $('searchInput').value.trim().toLowerCase();
  return entries
    .filter(e => new Date(e.date).getFullYear() === selectedYear())
    .filter(e => !q || JSON.stringify(e).toLowerCase().includes(q))
    .sort((a,b)=> b.date.localeCompare(a.date));
}

async function putReceipt(id, file){
  if(!file) return null;
  const data = await file.arrayBuffer();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put({id, name:file.name, type:file.type, data, savedAt:new Date().toISOString()});
    tx.oncomplete = () => resolve({name:file.name,type:file.type});
    tx.onerror = () => reject(tx.error);
  });
}

function getReceipt(id){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteReceipt(id){
  return new Promise((resolve)=>{
    const tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
  });
}

function formData(){
  const gross = Number($('grossAmount').value || 0);
  const tax = Number($('taxAmount').value || 0);
  const net = $('netAmount').value === '' ? Math.max(gross - tax, 0) : Number($('netAmount').value || 0);
  return {
    date:$('date').value,
    kind:$('kind').value,
    voucherType:$('voucherType').value,
    voucherNo:$('voucherNo').value.trim(),
    counterparty:$('counterparty').value.trim(),
    counterpartyBan:$('counterpartyBan').value.trim(),
    category:$('category').value,
    paymentMethod:$('paymentMethod').value,
    project:$('project').value.trim(),
    netAmount:net,
    taxAmount:tax,
    grossAmount:gross,
    note:$('note').value.trim()
  };
}

function fillForm(e){
  editingId = e.id;
  $('date').value=e.date; $('kind').value=e.kind; updateCategoryOptions();
  $('voucherType').value=e.voucherType; $('voucherNo').value=e.voucherNo || '';
  $('counterparty').value=e.counterparty || ''; $('counterpartyBan').value=e.counterpartyBan || '';
  $('category').value=e.category; $('paymentMethod').value=e.paymentMethod || '現金';
  $('project').value=e.project || ''; $('netAmount').value=e.netAmount ?? '';
  $('taxAmount').value=e.taxAmount ?? 0; $('grossAmount').value=e.grossAmount ?? 0;
  $('note').value=e.note || ''; $('fileHint').textContent='編輯中：可重新上傳附件';
  window.scrollTo({top:0,behavior:'smooth'});
}

function resetForm(){
  editingId = null;
  $('entryForm').reset();
  $('date').value = todayISO();
  $('taxAmount').value = 0;
  $('fileHint').textContent = '未選擇檔案';
  updateCategoryOptions();
}

async function handleSubmit(ev){
  ev.preventDefault();
  const file = $('receiptFile').files[0];
  const id = editingId || uid();
  const old = entries.find(x=>x.id===id);
  const receipt = file ? await putReceipt(id,file) : old?.receipt || null;
  const payload = {...formData(), id, receipt, updatedAt:new Date().toISOString()};
  if(!editingId) payload.createdAt = new Date().toISOString();
  entries = editingId ? entries.map(x=>x.id===id ? payload : x) : [payload, ...entries];
  saveEntries(); saveSettings(); resetForm(); render();
}

function renderStats(list){
  const income = list.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.grossAmount||0),0);
  const expense = list.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.grossAmount||0),0);
  const missing = list.filter(e=>e.voucherType==='無憑證待補' || !e.receipt).length;
  $('sumIncome').textContent = money(income);
  $('sumExpense').textContent = money(expense);
  $('sumProfit').textContent = money(income-expense);
  $('missingDocs').textContent = missing;
}

function renderSummary(list){
  const months = Array.from({length:12},(_,i)=>i+1);
  const rows = months.map(m=>{
    const mList = list.filter(e=>Number(e.date.slice(5,7))===m);
    const income = mList.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.grossAmount||0),0);
    const expense = mList.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.grossAmount||0),0);
    const inputTax = mList.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.taxAmount||0),0);
    const smallDeduct = Math.floor(inputTax * 0.1);
    const missing = mList.filter(e=>e.voucherType==='無憑證待補' || !e.receipt).length;
    return `<tr><td>${selectedYear()}/${String(m).padStart(2,'0')}</td><td>${money(income)}</td><td>${money(expense)}</td><td>${money(income-expense)}</td><td>${money(inputTax)}</td><td>${money(smallDeduct)}</td><td class="${missing?'danger':''}">${missing}</td></tr>`;
  }).join('');
  $('summaryTable').innerHTML = `<thead><tr><th>月份</th><th>收入</th><th>支出</th><th>損益</th><th>進項稅額</th><th>小規模扣減估算</th><th>待補憑證</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderEntries(list){
  const rows = list.map(e=>`<tr>
    <td>${e.date}</td><td><span class="pill">${e.kind==='income'?'收入':'支出'}</span></td><td>${e.category}</td><td>${e.counterparty || '-'}</td><td>${e.voucherType}</td><td>${e.voucherNo || '-'}</td><td>${money(e.grossAmount)}</td><td>${e.receipt?`<button class="link-btn" data-view="${e.id}">檢視憑證</button>`:'<span class="danger">未附</span>'}</td><td><button class="link-btn" data-edit="${e.id}">編輯</button> ｜ <button class="link-btn danger" data-delete="${e.id}">刪除</button></td>
  </tr>`).join('');
  $('entriesTable').innerHTML = `<thead><tr><th>日期</th><th>類型</th><th>分類</th><th>對象</th><th>憑證</th><th>號碼</th><th>金額</th><th>附件</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="9">尚無資料</td></tr>'}</tbody>`;
}

function render(){
  const list = getVisibleEntries();
  renderStats(list); renderSummary(list); renderEntries(list);
}

async function viewReceipt(id){
  const r = await getReceipt(id);
  if(!r){ alert('找不到附件。可能已清除瀏覽器資料。'); return; }
  const blob = new Blob([r.data], {type:r.type || 'application/octet-stream'});
  const url = URL.createObjectURL(blob);
  $('receiptPreview').innerHTML = r.type?.includes('pdf') ? `<iframe src="${url}"></iframe>` : `<img src="${url}" alt="receipt">`;
  $('receiptDialog').showModal();
}

async function handleTableClick(ev){
  const id = ev.target.dataset.view || ev.target.dataset.edit || ev.target.dataset.delete;
  if(!id) return;
  const e = entries.find(x=>x.id===id);
  if(ev.target.dataset.view) viewReceipt(id);
  if(ev.target.dataset.edit && e) fillForm(e);
  if(ev.target.dataset.delete){
    if(confirm('確定刪除這筆資料與本機附件？')){
      entries = entries.filter(x=>x.id!==id);
      await deleteReceipt(id); saveEntries(); render();
    }
  }
}

function toCsvValue(v){ return '"' + String(v ?? '').replaceAll('"','""') + '"'; }
function exportCsv(){
  const header = ['營業人名稱','統一編號','日期','類型','分類','交易對象','對方統編','憑證類型','憑證號碼','付款方式','專案/用途','未稅金額','營業稅額','總金額','備註','有無附件'];
  const rows = getVisibleEntries().map(e=>[$('bizName').value,$('bizBan').value,e.date,e.kind==='income'?'收入':'支出',e.category,e.counterparty,e.counterpartyBan,e.voucherType,e.voucherNo,e.paymentMethod,e.project,e.netAmount,e.taxAmount,e.grossAmount,e.note,e.receipt?'有':'無']);
  const csv = '\ufeff' + [header,...rows].map(r=>r.map(toCsvValue).join(',')).join('\n');
  downloadText(csv, `taxbook_${selectedYear()}.csv`, 'text/csv;charset=utf-8');
}

function exportJson(){
  const data = {version:1, exportedAt:new Date().toISOString(), settings:JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'), entries};
  downloadText(JSON.stringify(data,null,2), `taxbook_backup_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
  alert('JSON 備份包含流水帳資料，但不包含附件影像/PDF。附件仍需另外保存原始檔。');
}

function downloadText(text, filename, type){
  const blob = new Blob([text], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = JSON.parse(reader.result);
    if(!Array.isArray(data.entries)) throw new Error('格式不符');
    entries = data.entries;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    if(data.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
    loadSettings(); render(); alert('匯入完成。提醒：JSON 不含附件影像/PDF。');
  };
  reader.onerror = () => alert('匯入失敗');
  reader.readAsText(file);
}

function bind(){
  $('entryForm').addEventListener('submit', handleSubmit);
  $('kind').addEventListener('change', updateCategoryOptions);
  $('receiptFile').addEventListener('change', e=> $('fileHint').textContent = e.target.files[0]?.name || '未選擇檔案');
  $('resetFormBtn').addEventListener('click', resetForm);
  $('entriesTable').addEventListener('click', handleTableClick);
  $('summaryTable').addEventListener('click', ()=>{});
  $('searchInput').addEventListener('input', render);
  ['bizName','bizBan','taxMode','yearFilter'].forEach(id=>$(id).addEventListener('change',()=>{saveSettings();render();}));
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('exportJsonBtn').addEventListener('click', exportJson);
  $('importJsonInput').addEventListener('change', e=>importJson(e.target.files[0]));
  $('printBtn').addEventListener('click', ()=>window.print());
  $('closeDialog').addEventListener('click', ()=>$('receiptDialog').close());
}

async function init(){
  db = await openDB();
  loadSettings(); loadEntries(); bind(); resetForm(); render();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

init().catch(err=>{ console.error(err); alert('初始化失敗，請確認瀏覽器支援 IndexedDB。'); });
