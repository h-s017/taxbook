(() => {
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

  window.renderEntries = function(list){
    const rows = list.map(raw => {
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
    target.innerHTML = `<thead><tr><th>日期</th><th>類型</th><th>帳務</th><th>會計科目</th><th>內帳標籤</th><th>對象</th><th>憑證</th><th>金額</th><th>附件</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="10">尚無資料</td></tr>'}</tbody>`;
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
  if(typeof previousRender === 'function') window.render();
})();
