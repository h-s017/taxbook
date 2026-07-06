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

  const originalRender = render;
  render = function patchedRender() {
    originalRender();
    renderCashFlow();
  };

  document.getElementById('cashFlowBookFilter')?.addEventListener('change', renderCashFlow);
  document.addEventListener('DOMContentLoaded', renderCashFlow);
  setTimeout(renderCashFlow, 0);
})();
