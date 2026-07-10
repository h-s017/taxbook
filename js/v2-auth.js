window.TAXBOOK_DEFAULT_SUPABASE_URL = 'https://fomxcpizeonovubegfio.supabase.co';
window.TAXBOOK_DEFAULT_SUPABASE_KEY = 'sb_publishable_3j-yywRAZSIE7JkXgR8YUw_naVQZcvK';

window.loadSyncSettings = function () {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(TaxBookV2.keys.sync) || '{}'); } catch {}
  const oldProject = String(s.url || '').includes('dgsdfgikoyhxtdskjkrj.supabase.co');
  const url = oldProject ? TAXBOOK_DEFAULT_SUPABASE_URL : (s.url || TAXBOOK_DEFAULT_SUPABASE_URL);
  const key = oldProject ? TAXBOOK_DEFAULT_SUPABASE_KEY : (s.key || TAXBOOK_DEFAULT_SUPABASE_KEY);
  $('supabaseUrl').value = url;
  $('supabaseKey').value = key;
  $('syncEmail').value = s.email || '';
  if (oldProject) {
    localStorage.setItem(TaxBookV2.keys.sync, JSON.stringify({url,key,email:s.email || ''}));
  }
};

window.saveSyncSettings = function () {
  localStorage.setItem(TaxBookV2.keys.sync, JSON.stringify({
    url: $('supabaseUrl').value.trim(),
    key: $('supabaseKey').value.trim(),
    email: $('syncEmail').value.trim()
  }));
};

window.cloudStatus = function (text, ok) {
  const el = $('cloudStatus');
  if (!el) return;
  el.textContent = text;
  el.className = ok ? 'pill cloud-ok' : 'pill';
};

window.createCloudClient = function () {
  const url = $('supabaseUrl').value.trim();
  const key = $('supabaseKey').value.trim();
  if (!url || !key) {
    TaxBookV2.state.client = null;
    cloudStatus('未設定', false);
    return null;
  }
  try {
    TaxBookV2.state.client = window.supabase.createClient(url, key);
    return TaxBookV2.state.client;
  } catch (error) {
    TaxBookV2.state.client = null;
    cloudStatus('Supabase 設定錯誤', false);
    alert(`Supabase 連線設定錯誤：${error.message}`);
    return null;
  }
};

window.refreshSession = async function () {
  const state = TaxBookV2.state;
  if (!state.client) return;
  const result = await state.client.auth.getUser();
  state.user = result.data?.user || null;
  cloudStatus(state.user ? `已登入：${state.user.email}` : '已設定，未登入', Boolean(state.user));
  if (state.user && typeof loadCompanies === 'function') await loadCompanies();
};

window.saveCloudConfig = async function () {
  saveSyncSettings();
  createCloudClient();
  await refreshSession();
  alert('同步設定已儲存。');
};

window.authCredentials = function () {
  return {
    email: $('syncEmail').value.trim(),
    password: $('syncPassword')?.value || ''
  };
};

window.explainPasswordAuthError = function (error) {
  const msg = String(error?.message || error || '未知錯誤');
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Email 或密碼錯誤。';
  if (lower.includes('email not confirmed')) return '此帳號尚未完成 Email 確認，請由管理端處理帳號狀態。';
  if (lower.includes('password should be at least')) return '密碼長度不足，請至少使用 6 個字元。';
  return msg;
};

window.signInWithPassword = async function () {
  const client = TaxBookV2.state.client || createCloudClient();
  const {email,password} = authCredentials();
  if (!client) return alert('請先確認 Supabase Project URL 與 publishable key。');
  if (!email) return alert('請輸入 Email。');
  if (!password) return alert('請輸入密碼。');
  saveSyncSettings();
  cloudStatus('正在登入…', false);
  const result = await client.auth.signInWithPassword({email,password});
  if (result.error) {
    cloudStatus('登入失敗', false);
    return alert(`登入失敗：${explainPasswordAuthError(result.error)}`);
  }
  TaxBookV2.state.user = result.data?.user || null;
  if ($('syncPassword')) $('syncPassword').value = '';
  await refreshSession();
  cloudStatus(`已登入：${TaxBookV2.state.user?.email || email}`, true);
};

window.updatePasswordForCurrentUser = async function () {
  const client = TaxBookV2.state.client || createCloudClient();
  const password = $('syncPassword')?.value || '';
  if (!client) return alert('Supabase 尚未設定。');
  if (!TaxBookV2.state.user) return alert('請先登入後再變更密碼。');
  if (password.length < 6) return alert('新密碼至少需要 6 個字元。');
  const result = await client.auth.updateUser({password});
  if (result.error) return alert(`密碼更新失敗：${result.error.message}`);
  $('syncPassword').value = '';
  alert('密碼已更新。之後可直接使用 Email + 密碼登入。');
};

window.signOutCloud = async function () {
  const state = TaxBookV2.state;
  if (state.client) await state.client.auth.signOut();
  state.user = null;
  state.companies = [];
  state.currentCompany = null;
  state.entries = [];
  window.entries = state.entries;
  cloudStatus('已登出', false);
  if (typeof renderCompanyUI === 'function') renderCompanyUI();
  if (typeof render === 'function') render();
};
