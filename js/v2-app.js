window.saveBusinessSettings = async function () {
  const state = TaxBookV2.state;
  if (!state.user || !state.currentCompany || !roleCanEdit()) return;

  const payload = {
    name: $('bizName').value.trim(),
    ban: $('bizBan').value.trim() || null,
    tax_mode: $('taxMode').value
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
  $('entryForm').addEventListener('submit', handleSubmit);
  $('kind').addEventListener('change', () => {
    updateCategoryOptions();
    updateCashAccountOptions();
  });

  $('receiptFile').addEventListener('change', event => {
    $('fileHint').textContent = event.target.files[0]?.name || '尚未選擇檔案';
  });

  $('resetFormBtn').onclick = resetForm;
  $('entriesTable').addEventListener('click', handleTableClick);
  $('searchInput').addEventListener('input', render);
  $('bookFilter')?.addEventListener('change', render);
  $('yearFilter').addEventListener('change', render);
  ['bizName', 'bizBan', 'taxMode'].forEach(id => {
    $(id)?.addEventListener('change', saveBusinessSettings);
  });

  $('exportCsvBtn').onclick = () => exportCsv('full');
  $('exportTaxCsvBtn').onclick = () => exportCsv('tax');
  $('exportInternalCsvBtn').onclick = () => exportCsv('internal');
  $('exportJsonBtn').onclick = exportJson;
  $('importJsonInput').onchange = event => importJson(event.target.files[0]);
  $('printBtn').onclick = () => window.print();
  $('closeDialog').onclick = () => $('receiptDialog').close();

  $('saveCloudConfigBtn').onclick = saveCloudConfig;
  $('passwordLoginBtn').onclick = signInWithPassword;
  $('passwordSignUpBtn').onclick = signUpWithPassword;
  $('setPasswordBtn').onclick = updatePasswordForCurrentUser;
  $('googleLoginBtn').onclick = () => alert('Google 登入尚未啟用。之後可接 Supabase Google OAuth。');
  $('pushCloudBtn').onclick = pushCloud;
  $('pullCloudBtn').onclick = pullCloud;
  $('signOutBtn').onclick = signOutCloud;
};
