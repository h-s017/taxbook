(() => {
  const SYNC_KEY = 'hanaTaxBookSyncV2Settings';
  const BUCKET = 'receipts';
  let client = null;
  let currentCompanyId = '';
  const byId = id => document.getElementById(id);
  const trim = value => String(value ?? '').trim();
  const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

  function readSettings(){ try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch { return {}; } }
  function writeSettings(){ localStorage.setItem(SYNC_KEY, JSON.stringify({url:trim(byId('syncUrl')?.value), key:trim(byId('syncKey')?.value), email:trim(byId('syncEmail2')?.value)})); }
  function setStatus(message, ok = false){ const el = byId('syncStatus2'); if(el){ el.textContent = message; el.className = ok ? 'pill cloud-ok' : 'pill'; } }

  function injectPanel(){
    if(byId('taxbookSyncPanel')) return;
    const saved = readSettings();
    const anchor = [...document.querySelectorAll('.card')].find(card => card.textContent.includes('本機資料模式'));
    const section = document.createElement('section');
    section.className = 'card sync-card';
    section.id = 'taxbookSyncPanel';
    section.innerHTML = `<div class="section-head"><div><h2>手機同步與憑證上傳</h2><p>可選擇啟用同步。啟用後，手機與電腦可共用同一份流水帳與憑證。</p></div><span id="syncStatus2" class="pill">未設定</span></div><div class="grid two"><label>Supabase Project URL<input id="syncUrl" placeholder="https://xxxx.supabase.co" value="${saved.url || ''}"></label><label>Supabase publishable key<input id="syncKey" placeholder="sb_publishable_..." value="${saved.key || ''}"></label><label>Email<input id="syncEmail2" type="email" autocomplete="username" placeholder="你的 email" value="${saved.email || ''}"></label><label>登入密碼<input id="syncPass2" type="password" autocomplete="current-password" placeholder="至少 6 個字元"></label></div><div class="form-actions sync-actions"><button id="syncLoginBtn" type="button" class="primary">登入同步</button><button id="syncLogoutBtn" type="button">登出</button><button id="syncPushBtn" type="button">上傳本機資料與憑證</button><button id="syncPullBtn" type="button">從雲端下載</button></div><p class="sync-note">本機資料仍保留。交易寫入 Supabase Database，憑證寫入 private Storage bucket：receipts。</p>`;
    (anchor || document.querySelector('main')?.firstElementChild)?.after(section);
    byId('syncLoginBtn').addEventListener('click', login);
    byId('syncLogoutBtn').addEventListener('click', logout);
    byId('syncPushBtn').addEventListener('click', pushSync);
    byId('syncPullBtn').addEventListener('click', pullSync);
  }

  function getClient(){
    if(!window.supabase) throw new Error('Supabase 程式尚未載入。');
    const url = trim(byId('syncUrl')?.value);
    const key = trim(byId('syncKey')?.value);
    if(!url || !key) throw new Error('請輸入 Supabase Project URL 與 publishable key。');
    if(!client) client = window.supabase.createClient(url, key);
    return client;
  }

  async function login(){
    try{
      writeSettings(); client = null;
      const email = trim(byId('syncEmail2')?.value);
      const password = byId('syncPass2')?.value || '';
      if(!email) throw new Error('請輸入 Email。');
      if(password.length < 6) throw new Error('密碼至少需要 6 個字元。');
      setStatus('登入中…');
      const {data, error} = await getClient().auth.signInWithPassword({email, password});
      if(error) throw error;
      byId('syncPass2').value = '';
      setStatus(`已登入：${data.user?.email || email}`, true);
    }catch(error){ setStatus('登入失敗'); alert('登入失敗：' + (error.message || error)); }
  }

  async function logout(){ try{ await getClient().auth.signOut(); currentCompanyId=''; setStatus('已登出'); }catch(error){ alert('登出失敗：' + (error.message || error)); } }

  async function requireUser(){
    const {data, error} = await getClient().auth.getUser();
    if(error || !data?.user) throw new Error('尚未登入同步帳號。');
    setStatus(`已登入：${data.user.email}`, true);
    return data.user;
  }

  async function ensureCompany(user){
    if(currentCompanyId) return currentCompanyId;
    const c = getClient();
    const m = await c.from('company_members').select('company_id, companies(id,name,ban,tax_mode)').eq('user_id', user.id).limit(1);
    if(m.error) throw m.error;
    if(m.data?.[0]?.company_id){ currentCompanyId = m.data[0].company_id; return currentCompanyId; }
    const created = await c.from('companies').insert({name:trim(byId('bizName')?.value)||'我的帳本', ban:trim(byId('bizBan')?.value)||null, tax_mode:byId('taxMode')?.value||'unknown', owner_user_id:user.id}).select('id').single();
    if(created.error) throw created.error;
    currentCompanyId = created.data.id;
    const member = await c.from('company_members').insert({company_id:currentCompanyId, user_id:user.id, role:'owner'});
    if(member.error) throw member.error;
    return currentCompanyId;
  }

  function cloudId(entry){
    if(isUuid(entry.cloudTransactionId)) return entry.cloudTransactionId;
    if(isUuid(entry.id)) return entry.id;
    entry.cloudTransactionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    return entry.cloudTransactionId;
  }

  function existingCloudId(entry){ return isUuid(entry.cloudTransactionId) ? entry.cloudTransactionId : (isUuid(entry.id) ? entry.id : ''); }

  function toRow(entry, user, companyId){
    const e = migrateEntry(entry);
    return {id:cloudId(entry), company_id:companyId, user_id:user.id, date:e.date, kind:e.kind, book_scope:e.bookScope, account_code:e.accountCode, account_name:e.accountName, internal_tag:e.internalTag, voucher_type:e.voucherType, voucher_no:e.voucherNo, counterparty:e.counterparty, counterparty_ban:e.counterpartyBan, category:e.category, payment_method:e.paymentMethod, project:e.project, net_amount:Number(e.netAmount||0), tax_amount:Number(e.taxAmount||0), gross_amount:Number(e.grossAmount||0), tax_deductible:e.taxDeductible, voucher_status:e.voucherStatus, cash_status:e.cashStatus, note:e.note, updated_at:new Date().toISOString(), deleted_at:null};
  }

  function fromRow(row, attachment, localId){
    return migrateEntry({id:localId || row.id, cloudTransactionId:row.id, date:row.date, kind:row.kind, bookScope:row.book_scope, accountCode:row.account_code, accountName:row.account_name, internalTag:row.internal_tag, voucherType:row.voucher_type, voucherNo:row.voucher_no, counterparty:row.counterparty, counterpartyBan:row.counterparty_ban, category:row.category, paymentMethod:row.payment_method, project:row.project, netAmount:Number(row.net_amount||0), taxAmount:Number(row.tax_amount||0), grossAmount:Number(row.gross_amount||0), taxDeductible:row.tax_deductible, voucherStatus:row.voucher_status, cashStatus:row.cash_status, note:row.note, receipt:attachment?{name:attachment.file_name,type:attachment.mime_type,cloudPath:attachment.storage_path}:null, cloudReceiptPath:attachment?.storage_path||'', createdAt:row.created_at, updatedAt:row.updated_at});
  }

  async function uploadReceipt(entry, user, companyId){
    const local = await getReceipt(entry.id);
    if(!local) return;
    const transactionId = cloudId(entry);
    const path = `${user.id}/${companyId}/${transactionId}/${safeFileName(local.name)}`;
    const blob = new Blob([local.data], {type:local.type || 'application/octet-stream'});
    const uploaded = await getClient().storage.from(BUCKET).upload(path, blob, {upsert:true, contentType:local.type || 'application/octet-stream'});
    if(uploaded.error) throw new Error(`憑證上傳失敗：${local.name}｜${uploaded.error.message}`);
    await getClient().from('attachments').delete().eq('transaction_id', transactionId);
    const saved = await getClient().from('attachments').insert({company_id:companyId, transaction_id:transactionId, user_id:user.id, file_name:local.name, mime_type:local.type || 'application/octet-stream', storage_path:path, file_size:local.data?.byteLength || null});
    if(saved.error) throw saved.error;
    entry.cloudReceiptPath = path;
    entry.receipt = {...(entry.receipt || {}), name:local.name, type:local.type, cloudPath:path};
  }

  async function pushSync(){
    try{
      const user = await requireUser();
      const cid = await ensureCompany(user);
      setStatus('上傳交易中…');
      entries = entries.map(e => migrateEntry(e));
      const rows = entries.map(e => toRow(e, user, cid));
      if(rows.length){ const result = await getClient().from('transactions').upsert(rows, {onConflict:'id'}); if(result.error) throw result.error; }
      setStatus('上傳憑證中…');
      for(const entry of entries) await uploadReceipt(entry, user, cid);
      saveEntriesChanged(); render();
      setStatus(`已上傳：${new Date().toLocaleString('zh-TW')}`, true);
      alert('已上傳本機資料與憑證。');
    }catch(error){ setStatus('上傳失敗'); alert('上傳失敗：' + (error.message || error)); }
  }

  async function pullSync(){
    try{
      const user = await requireUser();
      const cid = await ensureCompany(user);
      if(entries.length && !confirm('將從雲端下載並合併到本機。相同雲端交易會以雲端版本覆蓋；本機未同步資料會保留。繼續？')) return;
      setStatus('下載交易中…');
      const tx = await getClient().from('transactions').select('*').eq('company_id', cid).is('deleted_at', null).order('date', {ascending:false});
      if(tx.error) throw tx.error;
      const att = await getClient().from('attachments').select('*').eq('company_id', cid).order('created_at', {ascending:false});
      if(att.error) throw att.error;
      const latest = new Map();
      (att.data || []).forEach(a => { if(!latest.has(a.transaction_id)) latest.set(a.transaction_id, a); });
      const localIdByCloud = new Map();
      entries.forEach(e => { const id = existingCloudId(e); if(id) localIdByCloud.set(id, e.id); });
      const remote = (tx.data || []).map(row => fromRow(row, latest.get(row.id), localIdByCloud.get(row.id)));
      const remoteIds = new Set(remote.map(existingCloudId).filter(Boolean));
      const localOnly = entries.filter(e => !remoteIds.has(existingCloudId(e)));
      entries = [...remote, ...localOnly].map(migrateEntry).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      saveEntriesChanged();
      setStatus('下載憑證中…');
      let failed = 0;
      for(const entry of entries){
        const a = latest.get(existingCloudId(entry));
        if(!a?.storage_path) continue;
        if(await getReceipt(entry.id)) continue;
        const file = await getClient().storage.from(BUCKET).download(a.storage_path);
        if(file.error){ failed++; continue; }
        await putReceiptRaw(entry.id, a.file_name, a.mime_type || file.data.type || 'application/octet-stream', await file.data.arrayBuffer());
      }
      saveEntriesChanged(); render();
      setStatus(`已下載：${new Date().toLocaleString('zh-TW')}`, true);
      alert(failed ? `已下載交易，但有 ${failed} 個憑證無法下載。` : '已從雲端下載並合併到本機。');
    }catch(error){ setStatus('下載失敗'); alert('下載失敗：' + (error.message || error)); }
  }

  injectPanel();
})();
