(() => {
  const RANGE_KEY = 'hanaTaxBookLedgerRange';

  function readRange(){
    try { return JSON.parse(localStorage.getItem(RANGE_KEY) || '{}'); } catch { return {}; }
  }

  function writeRange(){
    localStorage.setItem(RANGE_KEY, JSON.stringify({
      start: document.getElementById('ledgerStartDate')?.value || '',
      end: document.getElementById('ledgerEndDate')?.value || ''
    }));
  }

  function selectedRange(){
    return {
      start: document.getElementById('ledgerStartDate')?.value || '',
      end: document.getElementById('ledgerEndDate')?.value || ''
    };
  }

  function inSelectedRange(entry){
    const {start, end} = selectedRange();
    const date = String(entry?.date || '');
    if(start && date < start) return false;
    if(end && date > end) return false;
    return true;
  }

  function injectTableStyles(){
    if(document.getElementById('taxbookTableToolsStyle')) return;
    const style = document.createElement('style');
    style.id = 'taxbookTableToolsStyle';
    style.textContent = `
      .table-wrap{
        max-height: min(70vh, 720px);
        overflow: auto;
        position: relative;
        border: 1px solid rgba(0,0,0,.08);
        border-radius: 14px;
      }
      .table-wrap table{
        min-width: 980px;
        border-collapse: separate;
        border-spacing: 0;
      }
      .table-wrap th,
      .table-wrap td{
        white-space: nowrap;
        vertical-align: middle;
      }
      .table-wrap thead th{
        position: sticky;
        top: 0;
        z-index: 3;
        background: #fff;
      }
      #entriesTable th:last-child,
      #entriesTable td:last-child{
        position: sticky;
        right: 0;
        z-index: 2;
        background: #fff;
        min-width: 168px;
        box-shadow: -10px 0 18px rgba(255,255,255,.9), -1px 0 0 rgba(0,0,0,.08);
      }
      #entriesTable thead th:last-child{
        z-index: 4;
      }
      #entriesTable .row-actions{
        display: flex;
        align-items: center;
        gap: 6px;
        justify-content: flex-end;
      }
      #entriesTable .row-actions .link-btn{
        padding: 4px 6px;
      }
      .ledger-range-tools{
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
        margin-top: 8px;
      }
      .ledger-range-tools label{
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        margin: 0;
      }
      .ledger-range-tools input[type="date"]{
        width: 145px;
        min-width: 145px;
      }
      .ledger-totals{
        display: grid;
        grid-template-columns: repeat(5, minmax(120px, 1fr));
        gap: 10px;
        margin: 12px 0 0;
      }
      .ledger-total-card{
        border: 1px solid rgba(0,0,0,.08);
        border-radius: 12px;
        padding: 10px 12px;
        background: #fff;
      }
      .ledger-total-card span{
        display: block;
        font-size: 12px;
        opacity: .68;
        margin-bottom: 4px;
      }
      .ledger-total-card strong{
        font-size: 18px;
      }
      @media (max-width: 760px){
        .table-wrap{
          max-height: 62vh;
          border-radius: 10px;
        }
        .table-wrap table{
          min-width: 920px;
        }
        #entriesTable th:last-child,
        #entriesTable td:last-child{
          min-width: 154px;
        }
        .ledger-range-tools{
          justify-content: flex-start;
        }
        .ledger-totals{
          grid-template-columns: repeat(2, minmax(120px, 1fr));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function kindLabel(kind){
    if(kind === 'income') return '收入';
    if(kind === 'expense') return '支出';
    if(kind === 'asset') return '資產';
    return '移轉';
  }

  function scopeLabel(scope){
    if(scope === 'both') return '外＋內';
    if(scope === 'tax') return '外帳';
    if(scope === 'internal') return '內帳';
    return '待確認';
  }

  function injectLedgerRangeTools(){
    if(document.getElementById('ledgerRangeTools')) return;
    const table = document.getElementById('entriesTable');
    const card = table?.closest('.card');
    const head = card?.querySelector('.section-head');
    const tools = head?.querySelector('.entry-tools');
    if(!card || !head || !tools) return;

    const saved = readRange();
    const range = document.createElement('div');
    range.className = 'ledger-range-tools';
    range.id = 'ledgerRangeTools';
    range.innerHTML = `
      <label>起日<input id="ledgerStartDate" type="date" value="${saved.start || ''}"></label>
      <label>迄日<input id="ledgerEndDate" type="date" value="${saved.end || ''}"></label>
      <button id="ledgerClearRangeBtn" type="button">清除區間</button>
    `;
    tools.after(range);

    const rerender = () => { writeRange(); if(typeof window.render === 'function') window.render(); };
    document.getElementById('ledgerStartDate').addEventListener('change', rerender);
    document.getElementById('ledgerEndDate').addEventListener('change', rerender);
    document.getElementById('ledgerClearRangeBtn').addEventListener('click', () => {
      document.getElementById('ledgerStartDate').value = '';
      document.getElementById('ledgerEndDate').value = '';
      rerender();
    });

    const totals = document.createElement('div');
    totals.id = 'ledgerTotals';
    totals.className = 'ledger-totals';
    const wrap = table.closest('.table-wrap');
    wrap?.before(totals);
  }

  function applyLedgerRange(list){
    return list.map(migrateEntry).filter(inSelectedRange);
  }

  function renderLedgerTotals(list){
    const target = document.getElementById('ledgerTotals');
    if(!target) return;
    const scoped = list.map(migrateEntry);
    const income = scoped.filter(e => e.kind === 'income').reduce((sum, e) => sum + Number(e.grossAmount || 0), 0);
    const expense = scoped.filter(e => e.kind === 'expense').reduce((sum, e) => sum + Number(e.grossAmount || 0), 0);
    const asset = scoped.filter(e => e.kind === 'asset').reduce((sum, e) => sum + Number(e.grossAmount || 0), 0);
    const transfer = scoped.filter(e => e.kind === 'transfer').reduce((sum, e) => sum + Number(e.grossAmount || 0), 0);
    const net = income - expense;
    target.innerHTML = `
      <div class="ledger-total-card"><span>區間收入</span><strong>${money(income)}</strong></div>
      <div class="ledger-total-card"><span>區間支出</span><strong>${money(expense)}</strong></div>
      <div class="ledger-total-card"><span>區間淨額</span><strong>${money(net)}</strong></div>
      <div class="ledger-total-card"><span>資產/設備</span><strong>${money(asset)}</strong></div>
      <div class="ledger-total-card"><span>筆數</span><strong>${money(scoped.length)}</strong></div>
    `;
  }

  window.renderEntries = function(list){
    injectLedgerRangeTools();
    const rangedList = applyLedgerRange(list);
    renderLedgerTotals(rangedList);

    const rows = rangedList.map(raw => {
      const e = migrateEntry(raw);
      return `<tr>
        <td>${html(e.date)}</td>
        <td><span class="pill">${kindLabel(e.kind)}</span></td>
        <td>${scopeLabel(e.bookScope)}</td>
        <td>${html(e.accountCode)} ${html(e.accountName || accountName(e.accountCode))}</td>
        <td>${html(e.internalTag || '-')}</td>
        <td>${html(e.counterparty || '-')}</td>
        <td>${html(e.voucherType)}</td>
        <td>${money(e.grossAmount)}</td>
        <td>${e.receipt ? `<button class="link-btn" data-view="${html(e.id)}">檢視</button>` : '<span class="danger">未附</span>'}</td>
        <td><div class="row-actions"><button class="link-btn" data-edit="${html(e.id)}">編輯</button><button class="link-btn" data-duplicate="${html(e.id)}">複製</button><button class="link-btn danger" data-delete="${html(e.id)}">刪除</button></div></td>
      </tr>`;
    }).join('');
    const target = document.getElementById('entriesTable');
    if(!target) return;
    target.innerHTML = `<thead><tr><th>日期</th><th>類型</th><th>帳務</th><th>會計科目</th><th>內帳標籤</th><th>對象</th><th>憑證</th><th>金額</th><th>附件</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="10">此區間尚無資料</td></tr>'}</tbody>`;
  };

  function duplicateEntry(id){
    const source = entries.find(item => item.id === id);
    if(!source) return alert('找不到要複製的資料。');
    const copy = migrateEntry(source);
    copy.id = uid();
    copy.cloudTransactionId = '';
    copy.voucherNo = '';
    copy.receipt = null;
    copy.cloudReceiptPath = '';
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();
    entries = [copy, ...entries];
    saveEntriesChanged();
    if(typeof window.render === 'function') window.render();
    alert('已複製一筆。新資料未附憑證，請按「編輯」補上第二張發票或收據。');
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-duplicate]');
    if(!button) return;
    event.preventDefault();
    event.stopPropagation();
    duplicateEntry(button.dataset.duplicate);
  }, true);

  const previousRender = window.render;
  window.render = function(){
    const list = getVisibleEntries();
    renderStats(list);
    renderSummary(list);
    renderAccountSummary(list);
    renderEntries(list);
  };

  injectTableStyles();
  injectLedgerRangeTools();
  if(typeof previousRender === 'function') window.render();
})();
