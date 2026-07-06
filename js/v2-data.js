window.fallbackAccounts = [
  ['4110','銷貨收入','income'],['4120','勞務收入／課程收入','income'],['4130','顧問／設計服務收入','income'],['4140','活動／企業合作收入','income'],['4190','其他營業收入','income'],
  ['5110','進貨／原物料成本','expense'],['5120','包材／容器成本','expense'],['5130','課程材料成本','expense'],['5140','商品進貨成本','expense'],['5210','薪資支出／外包勞務','expense'],['5220','租金支出','expense'],['5230','水電瓦斯費','expense'],['5240','郵電費／網路費','expense'],['5250','文具用品／辦公費','expense'],['5260','旅費／交通費','expense'],['5270','運費','expense'],['5280','廣告行銷費','expense'],['5290','平台手續費／刷卡手續費','expense'],['5310','修繕費','expense'],['5320','保險費','expense'],['5330','稅捐／規費','expense'],['5340','交際費','expense'],['5350','訓練費／進修費','expense'],['5360','雜項購置','expense'],['5390','其他費用','expense'],
  ['1410','存貨','asset'],['1510','生財器具／設備','asset'],['1520','租賃改良／裝修','asset'],['1910','押金／保證金','asset'],['1110','現金','transfer'],['1120','銀行存款','transfer'],['2180','業主往來／代墊','transfer'],['2190','其他應付／內部移轉','transfer']
].map(([code,name,kind]) => ({code,name,kind}));

window.accountName = code => {
  const s = TaxBookV2.state;
  return s.accounts.find(a => a.code === code)?.name || fallbackAccounts.find(a => a.code === code)?.name || '';
};

window.migrateEntry = e => {
  const kind = e?.kind || 'expense';
  const source = TaxBookV2.state.accounts.length ? TaxBookV2.state.accounts : fallbackAccounts;
  const fallback = source.find(a => a.kind === kind) || fallbackAccounts[5];
  const gross = Number(e?.grossAmount ?? e?.amount ?? 0);
  const tax = Number(e?.taxAmount ?? 0);
  return {
    id: e?.id || uid(), date: e?.date || todayISO(), kind,
    bookScope: e?.bookScope || 'both',
    accountCode: e?.accountCode || fallback.code,
    accountName: e?.accountName || accountName(e?.accountCode) || fallback.name,
    internalTag: e?.internalTag || '待分類',
    voucherType: e?.voucherType || '無憑證待補', voucherNo: e?.voucherNo || '',
    counterparty: e?.counterparty || '', counterpartyBan: e?.counterpartyBan || '',
    category: e?.category || '', paymentMethod: e?.paymentMethod || '現金', project: e?.project || '',
    netAmount: e?.netAmount == null ? Math.max(gross - tax, 0) : Number(e.netAmount || 0),
    taxAmount: tax, grossAmount: gross,
    taxDeductible: e?.taxDeductible || 'review',
    voucherStatus: e?.voucherStatus || (e?.voucherType === '無憑證待補' ? 'missing' : 'complete'),
    cashStatus: e?.cashStatus || 'paid', cashAccountId: e?.cashAccountId || '',
    fromCashAccountId: e?.fromCashAccountId || '', toCashAccountId: e?.toCashAccountId || '',
    note: e?.note || '', receipt: e?.receipt || null,
    createdAt: e?.createdAt || new Date().toISOString(), updatedAt: e?.updatedAt || new Date().toISOString()
  };
};

window.dbToEntry = r => {
  const flows = r.transaction_cash_flows || [];
  const outFlow = flows.find(f => f.direction === 'out');
  const inFlow = flows.find(f => f.direction === 'in');
  const singleFlow = flows[0] || null;
  return migrateEntry({
    id:r.id,date:r.date,kind:r.kind,bookScope:r.book_scope,accountCode:r.account_code,accountName:r.account_name,
    internalTag:r.internal_tag,voucherType:r.voucher_type,voucherNo:r.voucher_no,counterparty:r.counterparty,
    counterpartyBan:r.counterparty_ban,category:r.category,paymentMethod:r.payment_method,project:r.project,
    netAmount:r.net_amount,taxAmount:r.tax_amount,grossAmount:r.gross_amount,taxDeductible:r.tax_deductible,
    voucherStatus:r.voucher_status,cashStatus:singleFlow?.status || r.cash_status,
    cashAccountId:r.kind === 'transfer' ? '' : (singleFlow?.cash_account_id || ''),
    fromCashAccountId:outFlow?.cash_account_id || '',
    toCashAccountId:inFlow?.cash_account_id || '',
    note:r.note,createdAt:r.created_at,updatedAt:r.updated_at,
    receipt:r.attachments?.[0] ? {name:r.attachments[0].file_name,type:r.attachments[0].mime_type,cloudPath:r.attachments[0].storage_path} : null
  });
};

window.entryToDb = e => ({
  id:e.id, company_id:TaxBookV2.state.currentCompany.id, user_id:TaxBookV2.state.user.id,
  date:e.date, kind:e.kind, book_scope:e.bookScope, account_code:e.accountCode, account_name:e.accountName,
  internal_tag:e.internalTag, voucher_type:e.voucherType, voucher_no:e.voucherNo || null,
  counterparty:e.counterparty || null, counterparty_ban:e.counterpartyBan || null, category:e.category || null,
  payment_method:e.paymentMethod || null, project:e.project || null, net_amount:Number(e.netAmount || 0),
  tax_amount:Number(e.taxAmount || 0), gross_amount:Number(e.grossAmount || 0), tax_deductible:e.taxDeductible,
  voucher_status:e.voucherStatus, cash_status:e.cashStatus, note:e.note || null, updated_at:new Date().toISOString(), deleted_at:null
});
