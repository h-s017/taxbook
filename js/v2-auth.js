window.loadSyncSettings = function () {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(TaxBookV2.keys.sync) || '{}'); } catch {}
  $('supabaseUrl').value = s.url || '';
  $('supabaseKey').value = s.key || '';
  $('syncEmail').value = s.email || '';
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
  TaxBookV2.state.client = window.supabase.createClient(url, key);
  return TaxBookV2.state.client;
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

window.sendMagicLink = async function () {
  const client = TaxBookV2.state.client || createCloudClient();
  const email = $('syncEmail').value.trim();
  if (!client) return alert('請先填 Supabase Project URL 與 publishable/anon key。');
  if (!email) return alert('請輸入 Email。');
  saveSyncSettings();
  const result = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}${location.pathname}` }
  });
  alert(result.error ? `寄送失敗：${result.error.message}` : '登入連結已寄出，請到信箱點擊。');
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
