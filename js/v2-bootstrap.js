window.initTaxBookV2 = async function () {
  injectCompanyUI();
  loadSyncSettings();
  bindV2();
  updateCategoryOptions();
  updateInternalTags();
  updateCashAccountOptions();
  resetForm();
  renderCompanyUI();
  createCloudClient();
  if (TaxBookV2.state.client) {
    await refreshSession();
    TaxBookV2.state.client.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user || null;
      const changed = nextUser?.id !== TaxBookV2.state.user?.id;
      TaxBookV2.state.user = nextUser;
      cloudStatus(nextUser ? `已登入：${nextUser.email}` : '已設定，未登入', Boolean(nextUser));
      if (nextUser && changed) await loadCompanies();
    });
  } else {
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem(TaxBookV2.keys.legacy) || '[]'); } catch {}
    TaxBookV2.state.entries = legacy.map(migrateEntry);
    window.entries = TaxBookV2.state.entries;
    render();
  }
  window.addEventListener('online', () => {
    if (pendingOps().length) cloudStatus(`已連線｜${pendingOps().length} 筆待同步`, true);
  });
  window.addEventListener('offline', () => cloudStatus('離線模式', false));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
};

initTaxBookV2().catch(error => {
  console.error(error);
  alert(`初始化失敗：${error.message}`);
});
