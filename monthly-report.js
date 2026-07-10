(() => {
  function selectedReportMonth(){
    const el = document.getElementById('summaryMonthFilter');
    return el ? el.value : 'all';
  }

  function monthList(){
    const value = selectedReportMonth();
    return value === 'all' ? Array.from({length:12},(_,i)=>i+1) : [Number(value)];
  }

  function incomeOf(list){
    return list.filter(e => e.kind === 'income').reduce((sum, e) => sum + Number(e.grossAmount || 0), 0);
  }

  function expenseOf(list){
    return list.filter(e => e.kind === 'expense').reduce((sum, e) => sum + Number(e.grossAmount || 0), 0);
  }

  function inputTaxOf(list){
    return list.filter(e => e.kind === 'expense').reduce((sum, e) => sum + Number(e.taxAmount || 0), 0);
  }

  function reviewCount(list){
    return list.filter(e => needsVoucherReview(e) || e.taxDeductible === 'review' || e.bookScope === 'review').length;
  }

  function reportRows(list, filterFn, options = {}){
    return monthList().map(month => {
      const mList = list.map(migrateEntry).filter(e => Number(e.date.slice(5,7)) === month);
      const scoped = mList.filter(filterFn).filter(e => e.kind === 'income' || e.kind === 'expense');
      const income = incomeOf(scoped);
      const expense = expenseOf(scoped);
      const cells = [
        `<td>${selectedYear()}/${String(month).padStart(2,'0')}</td>`,
        `<td>${money(income)}</td>`,
        `<td>${money(expense)}</td>`,
        `<td>${money(income - expense)}</td>`
      ];
      if(options.taxColumns){
        const inputTax = inputTaxOf(scoped);
        const smallDeduct = Math.floor(inputTax * 0.1);
        const review = reviewCount(mList.filter(filterFn));
        cells.push(`<td>${money(inputTax)}</td>`);
        cells.push(`<td>${money(smallDeduct)}</td>`);
        cells.push(`<td class="${review ? 'danger' : ''}">${review}</td>`);
      }
      return `<tr>${cells.join('')}</tr>`;
    }).join('');
  }

  function baseHeader(extra = ''){
    return `<thead><tr><th>月份</th><th>收入</th><th>支出</th><th>損益</th>${extra}</tr></thead>`;
  }

  function injectReportControls(){
    if(document.getElementById('summaryMonthFilter')) return;
    const summaryTable = document.getElementById('summaryTable');
    const card = summaryTable?.closest('.card');
    const head = card?.querySelector('.section-head');
    if(!head || !card) return;

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

    const internalSection = document.createElement('section');
    internalSection.className = 'card';
    internalSection.innerHTML = `<div class="section-head"><div><h2>內帳月報</h2><p>只統計內帳使用的收入與支出；不含只列外帳的資料。</p></div></div><div class="table-wrap"><table id="internalSummaryTable"></table></div>`;

    const combinedSection = document.createElement('section');
    combinedSection.className = 'card';
    combinedSection.innerHTML = `<div class="section-head"><div><h2>內外帳合計月報</h2><p>統計全部收入與支出；每筆交易只計一次，避免外帳＋內帳重複加總。</p></div></div><div class="table-wrap"><table id="combinedSummaryTable"></table></div>`;

    card.after(combinedSection);
    card.after(internalSection);
  }

  window.renderSummary = function(list){
    const taxRows = reportRows(list, isTaxBook, {taxColumns:true});
    const internalRows = reportRows(list, isInternalBook);
    const combinedRows = reportRows(list, e => e.kind === 'income' || e.kind === 'expense');

    const summary = document.getElementById('summaryTable');
    const internal = document.getElementById('internalSummaryTable');
    const combined = document.getElementById('combinedSummaryTable');

    if(summary){
      summary.innerHTML = `${baseHeader('<th>進項稅額</th><th>小規模扣減估算</th><th>待確認</th>')}<tbody>${taxRows || '<tr><td colspan="7">尚無資料</td></tr>'}</tbody>`;
    }
    if(internal){
      internal.innerHTML = `${baseHeader()}<tbody>${internalRows || '<tr><td colspan="4">尚無資料</td></tr>'}</tbody>`;
    }
    if(combined){
      combined.innerHTML = `${baseHeader()}<tbody>${combinedRows || '<tr><td colspan="4">尚無資料</td></tr>'}</tbody>`;
    }
  };

  const originalRender = window.render;
  window.render = function(){
    const list = getVisibleEntries();
    renderStats(list);
    renderSummary(list);
    renderAccountSummary(list);
    renderEntries(list);
  };

  injectReportControls();
  if(typeof originalRender === 'function') window.render();
})();
