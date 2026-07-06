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

window.authRedirectUrl = function () {
  return 'https://h-s017.github.io/taxbook/';
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

window.explainAuthEmailError = function (error) {
  const msg = String(error?.message || error || '未知錯誤');
  const lower = msg.toLowerCase();
  if (lower.includes('email address not authorized')) {
    return '此 Email 不在 Supabase 專案允許名單內。請改用專案成員 Email，或設定 Custom SMTP。';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Supabase 寄信次數已達限制。TaxBook 已切換到新的 active project；請重新整理後再試。';
  }
  if (lower.includes('redirect') || lower.includes('url')) {
    return `登入回跳網址可能未允許。請在 Supabase Auth URL Configuration 加入：${authRedirectUrl()}`;
  }
  return msg;
};

window.sendMagicLink = async function () {
  const client = TaxBookV2.state.client || createCloudClient();
  const email = $('syncEmail').value.trim();
  if (!client) return alert('請先確認 Supabase Project URL 與 publishable key。');
  if (!email) return alert('請輸入 Email。');
  saveSyncSettings();
  cloudStatus('正在寄送登入信…', false);
  const result = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: authRedirectUrl(),
      shouldCreateUser: true
    }
  });
  if (result.error) {
    cloudStatus('登入信寄送失敗', false);
    return alert(`登入信寄送失敗：\n${explainAuthEmailError(result.error)}`);
  }
  cloudStatus('登入信已寄出', true);
  alert(`登入連結已寄出。\n\n回跳網址：${authRedirectUrl()}\n\n請到信箱點擊登入連結。`);
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
