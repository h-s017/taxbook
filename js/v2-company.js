window.injectCompanyUI = function () {
  if ($('companyWorkspace')) return;
  const sec = document.createElement('section');
  sec.id = 'companyWorkspace';
  sec.className = 'card';
  sec.innerHTML = `
    <div class="section-head">
      <div>
        <h2>目前公司</h2>
        <p>每家公司有獨立交易、附件、資金帳戶、專案與會計科目。</p>
      </div>
      <span id="companyRoleBadge" class="pill">未登入</span>
    </div>
    <div class="grid three">
      <label>公司<select id="companySelect"></select></label>
      <label>舊資料遷移<span id="legacyCount" class="inline-info">0 筆</span></label>
      <div class="form-actions">
        <button id="createCompanyBtn" type="button">建立公司</button>
        <button id="migrateLegacyBtn" type="button">匯入舊資料</button>
      </div>
    </div>
    <div id="onboardingBox" class="onboarding-box" hidden>
      <h3>建立公司記帳簿</h3>
      <div class="grid three">
        <label>公司名稱<input id="newCompanyName"></label>
        <label>統一編號<input id="newCompanyBan"></label>
        <label>稅籍型態
          <select id="newCompanyTaxMode">
            <option value="unknown">待確認</option>
            <option value="small">小規模／免用統一發票</option>
            <option value="invoice">使用統一發票</option>
          </select>
        </label>
      </div>
      <div class="form-actions">
        <button id="confirmCreateCompanyBtn" class="primary" type="button">建立</button>
        <button id="cancelCreateCompanyBtn" type="button">取消</button>
      </div>
    </div>`;
  const main = document.querySelector('main');
  main.insertBefore(sec, main.children[1] || null);
  $('companySelect').addEventListener('change', async e => {
    const c = TaxBookV2.state.companies.find(x => x.id === e.target.value);
    if (c) await selectCompany(c);
  });
  $('createCompanyBtn').onclick = () => { $('onboardingBox').hidden = false; };
  $('cancelCreateCompanyBtn').onclick = () => { $('onboardingBox').hidden = true; };
  $('confirmCreateCompanyBtn').onclick = createCompany;
  $('migrateLegacyBtn').onclick = migrateLegacyData;
};

window.renderCompanyUI = function () {
  injectCompanyUI();
  const state = TaxBookV2.state;
  const sel = $('companySelect');
  sel.innerHTML = state.companies.length
    ? state.companies.map(c => `<option value="${c.id}" ${c.id === state.currentCompany?.id ? 'selected' : ''}>${html(c.name)}</option>`).join('')
    : '<option>尚無公司</option>';
  $('companyRoleBadge').textContent = state.currentCompany
    ? `${state.currentCompany.name}｜${state.currentRole}`
    : (state.user ? '請建立公司' : '未登入');
  let legacy = [];
  try { legacy = JSON.parse(localStorage.getItem(TaxBookV2.keys.legacy) || '[]'); } catch {}
  $('legacyCount').textContent = `${legacy.length} 筆`;
};

window.loadCompanies = async function () {
  const state = TaxBookV2.state;
  let companies = [];

  const memberResult = await state.client
    .from('company_members')
    .select('company_id,role,companies(id,name,ban,tax_mode,owner_user_id)')
    .eq('user_id', state.user.id);

  if (!memberResult.error) {
    companies = (memberResult.data || [])
      .map(row => row.companies ? {...row.companies, role:row.role} : null)
      .filter(Boolean);
  }

  if (!companies.length) {
    const ownerResult = await state.client
      .from('companies')
      .select('id,name,ban,tax_mode,owner_user_id')
      .eq('owner_user_id', state.user.id)
      .order('created_at', {ascending:true});
    if (ownerResult.error && memberResult.error) {
      return alert(`公司資料讀取失敗：${ownerResult.error.message}`);
    }
    companies = (ownerResult.data || []).map(c => ({...c, role:'owner'}));
  }

  state.companies = companies;
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

  const rpcResult = await state.client.rpc('create_company_with_defaults', {
    p_name:name,
    p_ban:$('newCompanyBan').value.trim() || null,
    p_tax_mode:$('newCompanyTaxMode').value
  });

  if (rpcResult.error) {
    const inserted = await state.client.from('companies').insert({
      name,
      ban:$('newCompanyBan').value.trim() || null,
      tax_mode:$('newCompanyTaxMode').value,
      owner_user_id:state.user.id
    }).select().single();
    if (inserted.error) return alert(`建立公司失敗：${inserted.error.message}`);

    const companyId = inserted.data.id;
    const cashRows = [
      ['現金','cash'],['銀行帳戶','bank'],['信用卡','credit_card'],
      ['LINE Pay','wallet'],['平台代收','platform'],['私人代墊','personal_advance']
    ].map(([accountName,type]) => ({company_id:companyId,name:accountName,type}));
    const accountRows = fallbackAccounts.map(a => ({
      company_id:companyId,code:a.code,name:a.name,kind:a.kind,is_system:true
    }));
    const projectRows = ['一般營運','待分類'].map(projectName => ({company_id:companyId,name:projectName}));
    const memberRow = {company_id:companyId,user_id:state.user.id,role:'owner'};

    const results = await Promise.all([
      state.client.from('cash_accounts').insert(cashRows),
      state.client.from('accounting_accounts').insert(accountRows),
      state.client.from('projects').insert(projectRows),
      state.client.from('company_members').insert(memberRow)
    ]);
    const failed = results.find(r => r.error);
    if (failed) alert(`公司已建立，但部分預設資料未完整建立：${failed.error.message}`);
  }

  $('onboardingBox').hidden = true;
  await loadCompanies();
};

window.selectCompany = async function (company) {
  const state = TaxBookV2.state;
  state.currentCompany = company;
  state.currentRole = company.role || 'viewer';
  localStorage.setItem(TaxBookV2.keys.company, company.id);
  $('bizName').value = company.name || '';
  $('bizBan').value = company.ban || '';
  $('taxMode').value = company.tax_mode || 'unknown';
  await loadCompanyData();
  renderCompanyUI();
};
