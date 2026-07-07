window.updateSyncQueueStatus = function () {
  let el = $('syncQueueStatus');
  if (!el) {
    el = document.createElement('p');
    el.id = 'syncQueueStatus';
    el.className = 'sync-note';
    const card = $('cloudStatus')?.closest('.sync-card');
    card?.appendChild(el);
  }
  const queue = pendingOps();
  const errors = queue.filter(item => item.status === 'error').length;
  const conflicts = queue.filter(item => item.status === 'conflict').length;
  const pending = queue.length - errors - conflicts;
  el.textContent = `待同步 ${pending} 筆｜失敗 ${errors} 筆｜衝突 ${conflicts} 筆`;
};
window.updateSyncStatusUI = window.updateSyncQueueStatus;

window.initTaxBookV2 = async function () {
  injectCompanyUI();
  loadSyncSettings();
  bindV2();
  updateCategoryOptions();
  updateInternalTags();
  updateCashAccountOptions();
  resetForm();
  renderCompanyUI();
  updateSyncQueueStatus();
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
    updateSyncQueueStatus();
    if (pendingOps().length) cloudStatus(`已連線｜${pendingOps().length} 筆待同步`, true);
  });
  window.addEventListener('offline', () => {
    updateSyncQueueStatus();
    cloudStatus('離線模式', false);
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
};

initTaxBookV2().catch(error => {
  console.error(error);
  alert(`初始化失敗：${error.message}`);
});
