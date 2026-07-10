(() => {
  const originalRenderSummary = window.renderSummary;
  const originalRender = window.render;

  function selectedReportMonth(){
    const el = document.getElementById('summaryMonthFilter');
    return el ? el.value : 'all';
  }

  function getAmount(list, kind){
    return list.filter(e => e.kind === kind).reduce((sum, e) => sum + Number(e.grossAmount || 0), 0);
  }

  function getTax(list){
    return list.filter(e => e.kind === 'expense').reduce((sum, e) => sum + Number(e.taxAmount || 0), 0);
  }

  function profitOf(list){
    return getAmount(list, 'income') - getAmount(list, 'expense');
  }

  function injectSummaryMonthFilter(){
    if(document.getElementById('summaryMonthFilter')) return;
    const summaryTable = document.getElementById('summaryTable');
    const card = summaryTable?.closest('.card');
    const head = card?.querySelector('.section-head');
    if(!head) return;

    const tools = document.createElement('div');
    tools.className = 'entry-tools';
    tools.innerHTML = `
      <select id="summaryMonthFilter" aria-label="月報月份篩選">
        <option value="all">全年</option>
        ${Array.from({length:12},(_,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')} 月</option>`).join('')}
      </select>
    `;
    head.appendChild(tools);
    document.getElementById('summaryMonthFilter').addEventListener('change', () => {
      if(typeof window.render === 'function') window.render();
    });
  }

  window.renderSummary = function(list){
    const monthFilter = selectedReportMonth();
    const months = monthFilter === 'all' ? Array.from({length:12},(_,i)=>i+1) : [Number(monthFilter)];

    const rows = months.map(month => {
      const mList = list.map(migrateEntry).filter(e => Number(e.date.slice(5,7)) === month);
      const taxList = mList.filter(isTaxBook).filter(e => e.kind === 'income' || e.kind === 'expense');
      const internalList = mList.filter(isInternalBook).filter(e => e.kind === 'income' || e.kind === 'expense');
      const combinedList = mList.filter(e => e.kind === 'income' || e.kind === 'expense');

      const taxIncome = getAmount(taxList, 'income');
      const taxExpense = getAmount(taxList, 'expense');
      const internalIncome = getAmount(internalList, 'income');
      const internalExpense = getAmount(internalList, 'expense');
      const combinedIncome = getAmount(combinedList, 'income');
      const combinedExpense = getAmount(combinedList, 'expense');
      const inputTax = getTax(taxList);
      const smallDeduct = Math.floor(inputTax * 0.1);
      const review = mList.filter(e => needsVoucherReview(e) || e.taxDeductible === 'review' || e.bookScope === 'review').length;

      return `<tr>
        <td>${selectedYear()}/${String(month).padStart(2,'0')}</td>
        <td>${money(taxIncome)}</td><td>${money(taxExpense)}</td><td>${money(taxIncome - taxExpense)}</td>
        <td>${money(internalIncome)}</td><td>${money(internalExpense)}</td><td>${money(internalIncome - internalExpense)}</td>
        <td>${money(combinedIncome)}</td><td>${money(combinedExpense)}</td><td>${money(combinedIncome - combinedExpense)}</td>
        <td>${money(inputTax)}</td><td>${money(smallDeduct)}</td><td class="${review ? 'danger' : ''}">${review}</td>
      </tr>`;
    }).join('');

    const target = document.getElementById('summaryTable');
    if(!target) return originalRenderSummary?.(list);
    target.innerHTML = `<thead>
      <tr>
        <th rowspan="2">月份</th>
        <th colspan="3">外帳</th>
        <th colspan="3">內帳</th>
        <th colspan="3">內外合併</th>
        <th rowspan="2">進項稅額</th>
        <th rowspan="2">小規模扣減估算</th>
        <th rowspan="2">待確認</th>
      </tr>
      <tr>
        <th>收入</th><th>支出</th><th>損益</th>
        <th>收入</th><th>支出</th><th>損益</th>
        <th>收入</th><th>支出</th><th>損益</th>
      </tr>
    </thead><tbody>${rows || '<tr><td colspan="13">尚無資料</td></tr>'}</tbody>`;
  };

  window.render = function(){
    const list = getVisibleEntries();
    renderStats(list);
    renderSummary(list);
    renderAccountSummary(list);
    renderEntries(list);
  };

  injectSummaryMonthFilter();
  if(typeof window.render === 'function') window.render();
})();
