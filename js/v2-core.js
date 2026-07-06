window.TaxBookV2 = {
  schemaVersion: 2,
  sourceOfTruth: 'supabase',
  offlineCache: 'localStorage-indexedDB',
  state: {
    entries: [],
    companies: [],
    accounts: [],
    projects: [],
    cashAccounts: [],
    currentCompany: null,
    currentRole: 'viewer',
    user: null,
    client: null,
    editingId: null
  },
  keys: {
    legacy: 'hanaTaxBookEntries',
    sync: 'hanaTaxBookSyncSettings',
    company: 'taxbookCurrentCompany'
  }
};

window.$ = id => document.getElementById(id);
window.money = n => new Intl.NumberFormat('zh-TW').format(Number(n || 0));
window.uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
window.html = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
window.selectedYear = () => Number($('yearFilter')?.value || new Date().getFullYear());
window.isTaxBook = e => e.bookScope !== 'internal' && e.taxDeductible !== 'no';
window.isInternalBook = e => e.bookScope !== 'tax';
window.roleCanEdit = () => ['owner','admin','accountant','editor'].includes(TaxBookV2.state.currentRole);
window.cacheKey = () => `taxbookCacheV2:${TaxBookV2.state.currentCompany?.id || 'anonymous'}`;
window.pendingKey = () => `taxbookPendingV2:${TaxBookV2.state.currentCompany?.id || 'anonymous'}`;
window.saveCache = () => {
  if (TaxBookV2.state.currentCompany) localStorage.setItem(cacheKey(), JSON.stringify(TaxBookV2.state.entries));
};
window.loadCache = () => {
  try { TaxBookV2.state.entries = JSON.parse(localStorage.getItem(cacheKey()) || '[]').map(migrateEntry); }
  catch { TaxBookV2.state.entries = []; }
};
window.pendingOps = () => {
  try { return JSON.parse(localStorage.getItem(pendingKey()) || '[]'); }
  catch { return []; }
};
window.queueOp = op => {
  const q = pendingOps();
  q.push({...op, queuedAt: new Date().toISOString()});
  localStorage.setItem(pendingKey(), JSON.stringify(q));
};
