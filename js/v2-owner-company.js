window.loadCompanies = async function () {
  const state = TaxBookV2.state;
  const result = await state.client.from('companies')
    .select('id,name,ban,tax_mode,owner_user_id')
    .eq('owner_user_id', state.user.id)
    .order('created_at', {ascending:true});
  if (result.error) return alert(`公司資料讀取失敗：${result.error.message}`);
  state.companies = (result.data || []).map(c => ({...c, role:'owner'}));
  renderCompanyUI();
  if (state.companies.length) {
    const saved = localStorage.getItem(TaxBookV2.keys.company);
    await selectCompany(state.companies.find(c => c.id === saved) || state.companies[0]);
  } else {
    $('onboardingBox').hidden = false;
  }
};

window.createCompany = async function () {
  const state = TaxBookV2.state;
  const name = $('newCompanyName').value.trim();
  if (!state.user) return alert('請先登入。');
  if (!name) return alert('請輸入公司名稱。');

  const inserted = await state.client.from('companies').insert({
    name,
    ban: $('newCompanyBan').value.trim() || null,
    tax_mode: $('newCompanyTaxMode').value,
    owner_user_id: state.user.id
  }).select().single();
  if (inserted.error) return alert(`建立公司失敗：${inserted.error.message}`);

  const companyId = inserted.data.id;
  const cashRows = [
    ['現金','cash'],['銀行帳戶','bank'],['信用卡','credit_card'],
    ['LINE Pay','wallet'],['平台代收','platform'],['私人代墊','personal_advance']
  ].map(([name,type]) => ({company_id:companyId,name,type}));
  const accountRows = fallbackAccounts.map(a => ({
    company_id:companyId,code:a.code,name:a.name,kind:a.kind,is_system:true
  }));

  const [cashResult, accountResult] = await Promise.all([
    state.client.from('cash_accounts').insert(cashRows),
    state.client.from('accounting_accounts').insert(accountRows)
  ]);
  if (cashResult.error || accountResult.error) {
    alert(`公司已建立，但預設資料未完整建立：${cashResult.error?.message || accountResult.error?.message}`);
  }
  $('onboardingBox').hidden = true;
  await loadCompanies();
};

window.selectCompany = async function (company) {
  const state = TaxBookV2.state;
  state.currentCompany = company;
  state.currentRole = 'owner';
  localStorage.setItem(TaxBookV2.keys.company, company.id);
  $('bizName').value = company.name || '';
  $('bizBan').value = company.ban || '';
  $('taxMode').value = company.tax_mode || 'unknown';
  await loadCompanyData();
  renderCompanyUI();
};
