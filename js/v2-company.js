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
  const result = await state.client
    .from('company_members')
    .select('company_id,role,companies(id,name,ban,tax_mode)')
    .eq('user_id', state.user.id);
  if (result.error) return alert(`公司資料讀取失敗：${result.error.message}`);
  state.companies = (result.data || []).map(row => ({...row.companies, role: row.role})).filter(Boolean);
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
  const result = await state.client.rpc('create_company_with_defaults', {
    p_name: name,
    p_ban: $('newCompanyBan').value.trim() || null,
    p_tax_mode: $('newCompanyTaxMode').value
  });
  if (result.error) return alert(`建立公司失敗：${result.error.message}`);
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
