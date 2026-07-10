(() => {
  const SYNC_KEY = 'hanaTaxBookSyncV2Settings';
  let client = null;
  const byId = id => document.getElementById(id);
  const trim = value => String(value ?? '').trim();

  function readSettings(){
    try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch { return {}; }
  }

  function writeSettings(){
    localStorage.setItem(SYNC_KEY, JSON.stringify({
      url: trim(byId('syncUrl')?.value),
      key: trim(byId('syncKey')?.value),
      email: trim(byId('syncEmail2')?.value)
    }));
  }

  function setStatus(message, ok = false){
    const el = byId('syncStatus2');
    if(!el) return;
    el.textContent = message;
    el.className = ok ? 'pill cloud-ok' : 'pill';
  }

  function injectPanel(){
    if(byId('taxbookSyncPanel')) return;
    const saved = readSettings();
    const anchor = [...document.querySelectorAll('.card')].find(card => card.textContent.includes('本機資料模式'));
    const section = document.createElement('section');
    section.className = 'card sync-card';
    section.id = 'taxbookSyncPanel';
    section.innerHTML = `
      <div class="section-head">
        <div><h2>手機同步與憑證上傳</h2><p>可選擇啟用同步。啟用後，手機與電腦可共用同一份流水帳與憑證。</p></div>
        <span id="syncStatus2" class="pill">未設定</span>
      </div>
      <div class="grid two">
        <label>Supabase Project URL<input id="syncUrl" placeholder="https://xxxx.supabase.co" value="${saved.url || ''}"></label>
        <label>Supabase publishable key<input id="syncKey" placeholder="sb_publishable_..." value="${saved.key || ''}"></label>
        <label>Email<input id="syncEmail2" type="email" autocomplete="username" placeholder="你的 email" value="${saved.email || ''}"></label>
        <label>登入密碼<input id="syncPass2" type="password" autocomplete="current-password" placeholder="至少 6 個字元"></label>
      </div>
      <div class="form-actions sync-actions">
        <button id="syncLoginBtn" type="button" class="primary">登入同步</button>
        <button id="syncLogoutBtn" type="button">登出</button>
        <button id="syncPushBtn" type="button">上傳本機資料與憑證</button>
        <button id="syncPullBtn" type="button">從雲端下載</button>
      </div>
      <p class="sync-note">本機資料仍保留。請先在 Supabase 建好資料表與 private bucket：receipts。</p>
    `;
    (anchor || document.querySelector('main')?.firstElementChild)?.after(section);

    byId('syncLoginBtn').addEventListener('click', login);
    byId('syncLogoutBtn').addEventListener('click', logout);
    byId('syncPushBtn').addEventListener('click', () => alert('同步核心尚未啟用：請先確認 Supabase 設定後再接交易與憑證同步。'));
    byId('syncPullBtn').addEventListener('click', () => alert('同步核心尚未啟用：請先確認 Supabase 設定後再接交易與憑證同步。'));
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
      writeSettings();
      client = null;
      const email = trim(byId('syncEmail2')?.value);
      const password = byId('syncPass2')?.value || '';
      if(!email) throw new Error('請輸入 Email。');
      if(password.length < 6) throw new Error('密碼至少需要 6 個字元。');
      setStatus('登入中…');
      const {data, error} = await getClient().auth.signInWithPassword({email, password});
      if(error) throw error;
      byId('syncPass2').value = '';
      setStatus(`已登入：${data.user?.email || email}`, true);
    }catch(error){
      setStatus('登入失敗');
      alert('登入失敗：' + (error.message || error));
    }
  }

  async function logout(){
    try{
      await getClient().auth.signOut();
      setStatus('已登出');
    }catch(error){ alert('登出失敗：' + (error.message || error)); }
  }

  injectPanel();
})();
