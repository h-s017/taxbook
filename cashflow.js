(() => {
  const statusLabels = {
    paid: '已收／已付',
    receivable: '應收未收',
    payable: '應付未付',
    deposit: '訂金／預收預付'
  };

  function pickEntries() {
    const scope = document.getElementById('cashFlowBookFilter')?.value || 'all';
    const year = typeof selectedYear === 'function' ? selectedYear() : new Date().getFullYear();
    const source = Array.isArray(entries) ? entries.map(migrateEntry) : [];
    return source.filter(e => new Date(e.date).getFullYear() === year).filter(e => {
      if (scope === 'tax') return isTaxBook(e);
      if (scope === 'internal') return isInternalBook(e);
      return true;
    });
  }

  function amountByKind(e) {
    const amount = Number(e.grossAmount || 0);
    if (e.kind === 'income') return { inflow: amount, outflow: 0 };
    if (e.kind === 'expense' || e.kind === 'asset') return { inflow: 0, outflow: amount };
    return { inflow: 0, outflow: 0 };
  }

  function aggregate(list, keyFn) {
    const map = new Map();
    for (const e of list) {
      const key = keyFn(e) || '未分類';
      const row = map.get(key) || { key, inflow: 0, outflow: 0, net: 0, count: 0 };
      const { inflow, outflow } = amountByKind(e);
      row.inflow += inflow;
      row.outflow += outflow;
      row.net = row.inflow - row.outflow;
      row.count += 1;
      map.set(key, row);
    }
    return [...map.values()];
  }

  function tableHtml(rows, labelTitle) {
    const body = rows.map(r => `
      <tr>
        <td>${html(r.key)}</td>
        <td>${money(r.inflow)}</td>
        <td>${money(r.outflow)}</td>
        <td class="${r.net < 0 ? 'danger' : ''}">${money(r.net)}</td>
        <td>${r.count}</td>
      </tr>`).join('');
    return `
      <thead><tr><th>${labelTitle}</th><th>流入</th><th>流出</th><th>淨額</th><th>筆數</th></tr></thead>
      <tbody>${body || '<tr><td colspan="5">尚無資料</td></tr>'}</tbody>`;
  }

  function renderEntriesWithCashStatus(list) {
    const rows = list.map(raw => {
      const e = migrateEntry(raw);
      const cashLabel = statusLabels[e.cashStatus] || e.cashStatus || '未設定';
      const cashClass = e.cashStatus === 'payable' ? 'danger' : '';
      return `<tr><td>${html(e.date)}</td><td><span class="pill">${e.kind === 'income' ? '收入' : e.kind === 'expense' ? '支出' : e.kind === 'asset' ? '資產' : '移轉'}</span></td><td>${e.bookScope === 'both' ? '外＋內' : e.bookScope === 'tax' ? '外帳' : e.bookScope === 'internal' ? '內帳' : '待確認'}</td><td>${html(e.accountCode)} ${html(e.accountName || accountName(e.accountCode))}</td><td>${html(e.internalTag || '-')}</td><td>${html(e.counterparty || '-')}</td><td>${html(e.voucherType)}</td><td>${money(e.grossAmount)}</td><td class="${cashClass}">${html(cashLabel)}</td><td>${e.receipt ? `<button class="link-btn" data-view="${html(e.id)}">檢視</button>` : '<span class="danger">未附</span>'}</td><td><button class="link-btn" data-edit="${html(e.id)}">編輯</button> ｜ <button class="link-btn danger" data-delete="${html(e.id)}">刪除</button></td></tr>`;
    }).join('');
    document.getElementById('entriesTable').innerHTML = `<thead><tr><th>日期</th><th>類型</th><th>帳務</th><th>會計科目</th><th>內帳標籤</th><th>對象</th><th>憑證</th><th>金額</th><th>現金流狀態</th><th>附件</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="11">尚無資料</td></tr>'}</tbody>`;
  }

  function renderCashFlow() {
    const list = pickEntries();

    const realized = list.filter(e => e.cashStatus === 'paid');
    const receivable = list.filter(e => e.cashStatus === 'receivable' && e.kind === 'income')
      .reduce((s, e) => s + Number(e.grossAmount || 0), 0);
    const payable = list.filter(e => e.cashStatus === 'payable' && (e.kind === 'expense' || e.kind === 'asset'))
      .reduce((s, e) => s + Number(e.grossAmount || 0), 0);
    const deposits = list.filter(e => e.cashStatus === 'deposit')
      .reduce((s, e) => s + Number(e.grossAmount || 0), 0);

    const realizedIn = realized.filter(e => e.kind === 'income').reduce((s,e)=>s+Number(e.grossAmount||0),0);
    const realizedOut = realized.filter(e => e.kind === 'expense' || e.kind === 'asset').reduce((s,e)=>s+Number(e.grossAmount||0),0);
    const realizedNet = realizedIn - realizedOut;

    const summary = document.getElementById('cashFlowSummary');
    if (summary) {
      summary.innerHTML = `
        <article class="cashflow-stat"><span>已實現流入</span><strong>${money(realizedIn)}</strong></article>
        <article class="cashflow-stat"><span>已實現流出</span><strong>${money(realizedOut)}</strong></article>
        <article class="cashflow-stat"><span>已實現淨現金流</span><strong class="${realizedNet < 0 ? 'danger' : ''}">${money(realizedNet)}</strong></article>
        <article class="cashflow-stat"><span>應收未收</span><strong>${money(receivable)}</strong></article>
        <article class="cashflow-stat"><span>應付未付</span><strong class="${payable ? 'danger' : ''}">${money(payable)}</strong></article>
        <article class="cashflow-stat"><span>訂金／預收預付</span><strong>${money(deposits)}</strong></article>`;
    }

    const byStatus = aggregate(list, e => statusLabels[e.cashStatus] || e.cashStatus || '未設定')
      .sort((a,b) => a.key.localeCompare(b.key, 'zh-Hant'));
    const byPayment = aggregate(list, e => e.paymentMethod || '未設定')
      .sort((a,b) => a.key.localeCompare(b.key, 'zh-Hant'));

    const statusTable = document.getElementById('cashStatusTable');
    const paymentTable = document.getElementById('paymentMethodTable');
    if (statusTable) statusTable.innerHTML = tableHtml(byStatus, '現金流狀態');
    if (paymentTable) paymentTable.innerHTML = tableHtml(byPayment, '付款方式');
  }

  renderEntries = renderEntriesWithCashStatus;

  const originalRender = render;
  render = function patchedRender() {
    originalRender();
    renderCashFlow();
  };

  document.getElementById('cashFlowBookFilter')?.addEventListener('change', renderCashFlow);
  document.addEventListener('DOMContentLoaded', renderCashFlow);
  setTimeout(renderCashFlow, 0);
})();
