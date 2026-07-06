(() => {
  function yearEntries() {
    const year = typeof selectedYear === 'function' ? selectedYear() : new Date().getFullYear();
    return (Array.isArray(entries) ? entries : [])
      .map(migrateEntry)
      .filter(e => new Date(e.date).getFullYear() === year)
      .filter(e => e.kind === 'income' || e.kind === 'expense');
  }

  function calc(list) {
    const income = list.filter(e => e.kind === 'income')
      .reduce((sum, e) => sum + Number(e.grossAmount || 0), 0);
    const expense = list.filter(e => e.kind === 'expense')
      .reduce((sum, e) => sum + Number(e.grossAmount || 0), 0);
    return { income, expense, profit: income - expense, count: list.length };
  }

  function profitClass(value) {
    return value < 0 ? 'danger' : '';
  }

  function renderProfitLoss() {
    const base = yearEntries();
    const external = calc(base.filter(isTaxBook));
    const internal = calc(base.filter(isInternalBook));
    const combined = calc(base); // every source transaction appears once only

    const summary = document.getElementById('profitLossSummary');
    if (summary) {
      summary.innerHTML = `
        <article class="profitloss-card">
          <span>外帳損益</span>
          <strong class="${profitClass(external.profit)}">${money(external.profit)}</strong>
          <small>收入 ${money(external.income)} ／ 支出 ${money(external.expense)}</small>
        </article>
        <article class="profitloss-card">
          <span>內帳損益</span>
          <strong class="${profitClass(internal.profit)}">${money(internal.profit)}</strong>
          <small>收入 ${money(internal.income)} ／ 支出 ${money(internal.expense)}</small>
        </article>
        <article class="profitloss-card emphasized">
          <span>內外合併損益</span>
          <strong class="${profitClass(combined.profit)}">${money(combined.profit)}</strong>
          <small>收入 ${money(combined.income)} ／ 支出 ${money(combined.expense)}</small>
        </article>`;
    }

    const rows = [
      ['外帳', external],
      ['內帳', internal],
      ['內外合併（每筆只算一次）', combined]
    ].map(([label, r]) => `
      <tr>
        <td>${html(label)}</td>
        <td>${money(r.income)}</td>
        <td>${money(r.expense)}</td>
        <td class="${profitClass(r.profit)}">${money(r.profit)}</td>
        <td>${r.count}</td>
      </tr>`).join('');

    const table = document.getElementById('profitLossTable');
    if (table) {
      table.innerHTML = `
        <thead><tr><th>損益口徑</th><th>收入</th><th>支出</th><th>損益</th><th>收入/支出筆數</th></tr></thead>
        <tbody>${rows}</tbody>`;
    }
  }

  const previousRender = render;
  render = function profitLossPatchedRender() {
    previousRender();
    renderProfitLoss();
  };

  document.addEventListener('DOMContentLoaded', renderProfitLoss);
  setTimeout(renderProfitLoss, 0);
})();
