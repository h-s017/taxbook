(function () {
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let currentDraft = null;
  let currentFile = null;
  let isBound = false;

  function normalizeText(text) {
    return String(text || '')
      .replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .replace(/[，]/g, ',')
      .replace(/[．]/g, '.')
      .replace(/[：]/g, ':')
      .replace(/\r/g, '\n');
  }

  function parseAmount(raw) {
    if (!raw) return 0;
    const cleaned = raw.replace(/[^\d.]/g, '');
    return Math.round(Number(cleaned || 0));
  }

  function extractDate(text) {
    const now = new Date();
    const year = now.getFullYear();
    const patterns = [
      /(\d{4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/,
      /(\d{1,2})[\/.\-月](\d{1,2})[日]?/
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const y = match.length === 4 ? Number(match[1]) : year;
      const m = Number(match.length === 4 ? match[2] : match[1]);
      const d = Number(match.length === 4 ? match[3] : match[2]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return currentDateISO();
  }

  function extractAmount(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const keywordPattern = /(總計|合計|應付|實付|付款金額|訂單金額|總金額|小計|total|amount)/i;
    const amounts = [];
    for (const line of lines) {
      const matches = [...line.matchAll(/(?:NT\$|NTD|TWD|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi)];
      for (const match of matches) {
        const value = parseAmount(match[1]);
        if (value > 0) amounts.push({value, weighted: keywordPattern.test(line)});
      }
    }
    const preferred = amounts.filter(item => item.weighted).sort((a, b) => b.value - a.value)[0];
    const fallback = amounts.sort((a, b) => b.value - a.value)[0];
    return (preferred || fallback)?.value || 0;
  }

  function extractTax(text) {
    const match = text.match(/(?:營業稅|稅額|tax)\D{0,8}([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
    return match ? parseAmount(match[1]) : 0;
  }

  function extractCounterparty(text) {
    const ignored = /(訂單|日期|時間|金額|總計|合計|付款|發票|統編|編號|配送|地址|電話|email|tax|total|amount)/i;
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length >= 2);
    const candidate = lines.find(line => !ignored.test(line) && /[\u4e00-\u9fffA-Za-z]/.test(line));
    return candidate ? candidate.slice(0, 40) : '';
  }

  function extractVoucherNo(text) {
    const match = text.match(/(?:訂單編號|訂單號碼|交易序號|發票號碼|invoice|order)\s*[:：#號碼-]*\s*([A-Z0-9\-]{6,})/i);
    return match ? match[1].trim() : '';
  }

  function extractPaymentMethod(text) {
    if (/line\s*pay/i.test(text)) return 'LINE Pay';
    if (/信用卡|visa|master|jcb|card/i.test(text)) return '信用卡';
    if (/apple\s*pay/i.test(text)) return 'Apple Pay';
    if (/轉帳|匯款/i.test(text)) return '銀行轉帳';
    if (/現金/i.test(text)) return '現金';
    return '';
  }

  function inferCategory(text) {
    if (/運費|物流|宅配|配送|超取/i.test(text)) return '運費/物流';
    if (/廣告|meta|facebook|instagram|google/i.test(text)) return '廣告行銷';
    if (/列印|印刷|包材|紙|瓶|罐|材料|香精|酒精|精油/i.test(text)) return '材料/耗材';
    if (/課程|書|資料|軟體|訂閱|canva|notion|adobe/i.test(text)) return '工具/學習';
    return '採購支出';
  }

  function buildDraft(rawText) {
    const text = normalizeText(rawText);
    const grossAmount = extractAmount(text);
    const taxAmount = extractTax(text);
    return {
      date: extractDate(text),
      kind: 'expense',
      bookScope: 'both',
      counterparty: extractCounterparty(text),
      voucherNo: extractVoucherNo(text),
      category: inferCategory(text),
      paymentMethod: extractPaymentMethod(text),
      netAmount: Math.max(grossAmount - taxAmount, 0),
      taxAmount,
      grossAmount,
      taxDeductible: 'review',
      voucherStatus: 'photo-only',
      cashStatus: 'paid',
      note: '由採購截圖辨識建立，請確認金額、店家與憑證資訊。'
    };
  }

  function setStatus(text, good) {
    const el = getEl('screenshotStatus');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('ok', Boolean(good));
  }

  function getEl(id) {
    return typeof $ === 'function' ? $(id) : document.getElementById(id);
  }

  function formatMoney(value) {
    return typeof money === 'function'
      ? money(value)
      : new Intl.NumberFormat('zh-TW').format(Number(value || 0));
  }

  function escapeHtml(value) {
    if (typeof html === 'function') return html(value);
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function currentDateISO() {
    if (typeof todayISO === 'function') return todayISO();
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function renderDraft(draft) {
    const el = getEl('screenshotDraftPreview');
    if (!el) return;
    if (!draft) {
      el.innerHTML = '';
      return;
    }
    const rows = [
      ['日期', draft.date],
      ['店家', draft.counterparty || '待補'],
      ['總額', formatMoney(draft.grossAmount)],
      ['稅額', formatMoney(draft.taxAmount)],
      ['付款', draft.paymentMethod || '待補'],
      ['分類', draft.category]
    ];
    el.innerHTML = rows.map(([key, value]) => `<span><strong>${escapeHtml(key)}</strong>${escapeHtml(value)}</span>`).join('');
  }

  function ensureOption(select, value) {
    if (!select || !value) return;
    const exists = [...select.options].some(option => option.value === value || option.textContent === value);
    if (!exists) select.add(new Option(value, value));
  }

  function setField(id, value) {
    const el = getEl(id);
    if (!el || value == null || value === '') return;
    if (el.tagName === 'SELECT') ensureOption(el, value);
    el.value = value;
    el.dispatchEvent(new Event('change', {bubbles: true}));
  }

  function copyFileToReceiptInput(file) {
    if (!file || !getEl('receiptFile') || typeof DataTransfer === 'undefined') return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    getEl('receiptFile').files = transfer.files;
    getEl('fileHint').textContent = file.name;
  }

  function applyDraft() {
    if (!currentDraft) return;
    setField('date', currentDraft.date);
    setField('kind', currentDraft.kind);
    if (typeof updateCategoryOptions === 'function') updateCategoryOptions();
    setField('bookScope', currentDraft.bookScope);
    setField('counterparty', currentDraft.counterparty);
    setField('voucherNo', currentDraft.voucherNo);
    setField('category', currentDraft.category);
    setField('paymentMethod', currentDraft.paymentMethod);
    setField('netAmount', currentDraft.netAmount);
    setField('taxAmount', currentDraft.taxAmount);
    setField('grossAmount', currentDraft.grossAmount);
    setField('taxDeductible', currentDraft.taxDeductible);
    setField('voucherStatus', currentDraft.voucherStatus);
    setField('cashStatus', currentDraft.cashStatus);
    setField('note', currentDraft.note);
    copyFileToReceiptInput(currentFile);
    setStatus('已套用，請確認後儲存', true);
  }

  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TESSERACT_URL;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('無法載入截圖辨識元件'));
      document.head.appendChild(script);
    });
    return window.Tesseract;
  }

  async function recognizeScreenshot() {
    const file = getEl('screenshotReceiptInput')?.files?.[0] || null;
    const pastedText = getEl('screenshotOcrText')?.value.trim();
    currentFile = file;
    if (!file && !pastedText) return alert('請先上傳採購截圖，或貼上下單文字。');
    setStatus(file ? '辨識中' : '分析文字中', false);
    let text = pastedText;
    if (file) {
      const Tesseract = await loadTesseract();
      const result = await Tesseract.recognize(file, 'chi_tra+eng', {
        logger: info => {
          if (info.status === 'recognizing text') setStatus(`辨識中 ${Math.round(info.progress * 100)}%`, false);
        }
      });
      text = result.data.text || '';
      getEl('screenshotOcrText').value = text;
    }
    currentDraft = buildDraft(text);
    renderDraft(currentDraft);
    getEl('applyScreenshotDraftBtn').disabled = false;
    setStatus('已產生草稿', true);
  }

  window.bindScreenshotBookkeeping = function () {
    if (isBound) return;
    isBound = true;
    getEl('recognizeScreenshotBtn')?.addEventListener('click', () => recognizeScreenshot().catch(error => {
      console.error(error);
      setStatus('辨識失敗', false);
      alert(error.message || '截圖辨識失敗，請改貼文字後再試一次。');
    }));
    getEl('applyScreenshotDraftBtn')?.addEventListener('click', applyDraft);
    getEl('screenshotOcrText')?.addEventListener('input', () => {
      currentDraft = buildDraft(getEl('screenshotOcrText').value);
      renderDraft(currentDraft);
      getEl('applyScreenshotDraftBtn').disabled = !getEl('screenshotOcrText').value.trim();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.bindScreenshotBookkeeping);
  } else {
    window.bindScreenshotBookkeeping();
  }
})();
