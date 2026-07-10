window.saveBusinessSettings = async function () {
  const state = TaxBookV2.state;
  if (!state.user || !state.currentCompany || !roleCanEdit()) return;

  const payload = {
    name: $('bizName')?.value.trim() || '',
    ban: $('bizBan')?.value.trim() || null,
    tax_mode: $('taxMode')?.value || 'unknown'
  };
  const result = await state.client
    .from('companies')
    .update(payload)
    .eq('id', state.currentCompany.id);
  if (result.error) return alert(`公司資料更新失敗：${result.error.message}`);

  Object.assign(state.currentCompany, payload);
  renderCompanyUI();
};

window.bindV2 = function () {
  const on = (id, eventName, handler) => {
    const el = $(id);
    if (!el) {
      console.warn(`[TaxBook] 找不到元素 #${id}，略過 ${eventName} 綁定。`);
      return;
    }
    el.addEventListener(eventName, handler);
  };
  const click = (id, handler) => on(id, 'click', handler);

  on('entryForm', 'submit', handleSubmit);
  on('kind', 'change', () => {
    updateCategoryOptions();
    updateCashAccountOptions();
  });
  on('receiptFile', 'change', event => {
    const hint = $('fileHint');
    if (hint) hint.textContent = event.target.files[0]?.name || '尚未選擇檔案';
  });

  click('resetFormBtn', resetForm);
  on('entriesTable', 'click', handleTableClick);
  on('searchInput', 'input', render);
  on('bookFilter', 'change', render);
  on('yearFilter', 'change', render);

  ['bizName', 'bizBan', 'taxMode'].forEach(id => on(id, 'change', saveBusinessSettings));

  click('exportCsvBtn', () => exportCsv('full'));
  click('exportTaxCsvBtn', () => exportCsv('tax'));
  click('exportInternalCsvBtn', () => exportCsv('internal'));
  click('exportJsonBtn', exportJson);
  on('importJsonInput', 'change', event => importJson(event.target.files[0]));
  click('printBtn', () => window.print());
  click('closeDialog', () => $('receiptDialog')?.close());

  click('saveCloudConfigBtn', saveCloudConfig);
  click('passwordLoginBtn', signInWithPassword);
  click('setPasswordBtn', updatePasswordForCurrentUser);
  click('pushCloudBtn', pushCloud);
  click('pullCloudBtn', pullCloud);
  click('signOutBtn', signOutCloud);
};
