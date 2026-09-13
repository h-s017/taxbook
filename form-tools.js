(() => {
  const byId = id => document.getElementById(id);
  const round = value => Math.round(Number(value || 0));

  function calculateTaxFromGross(){
    const grossInput = byId('grossAmount');
    const netInput = byId('netAmount');
    const taxInput = byId('taxAmount');
    if(!grossInput || !netInput || !taxInput) return;

    const gross = Number(grossInput.value || 0);
    if(!gross){
      netInput.value = '';
      taxInput.value = 0;
      return;
    }

    const net = round(gross / 1.05);
    const tax = gross - net;
    netInput.value = net;
    taxInput.value = tax;
  }

  function preventEnterSubmit(event){
    if(event.key !== 'Enter') return;
    const tag = event.target?.tagName?.toLowerCase();
    const type = event.target?.type?.toLowerCase();
    if(tag === 'textarea') return;
    if(type === 'submit' || type === 'button') return;
    event.preventDefault();
  }

  function injectHint(){
    const grossInput = byId('grossAmount');
    if(!grossInput || grossInput.dataset.taxHintAdded) return;
    grossInput.dataset.taxHintAdded = 'true';
    grossInput.placeholder = grossInput.placeholder || '輸入含稅總金額';
    const label = grossInput.closest('label');
    if(label && !label.querySelector('.tax-calc-hint')){
      const hint = document.createElement('span');
      hint.className = 'tax-calc-hint';
      hint.textContent = '輸入後自動反推未稅與 5% 營業稅';
      label.appendChild(hint);
    }
  }

  function renameKpiaTag(){
    const select = byId('internalTag');
    if(select){
      [...select.options].forEach(option => {
        if(option.textContent === 'KPIA課程') option.textContent = '課程教材';
        if(option.value === 'KPIA課程') option.value = '課程教材';
      });
      if(select.value === 'KPIA課程') select.value = '課程教材';
    }

    if(Array.isArray(window.entries)){
      let changed = false;
      window.entries.forEach(entry => {
        if(entry?.internalTag === 'KPIA課程'){
          entry.internalTag = '課程教材';
          changed = true;
        }
      });
      if(changed && typeof window.saveEntriesChanged === 'function') window.saveEntriesChanged();
    }
  }

  function bind(){
    const form = byId('entryForm');
    const grossInput = byId('grossAmount');
    const kindInput = byId('kind');
    const resetBtn = byId('resetFormBtn');

    if(form && !form.dataset.preventEnterSubmit){
      form.dataset.preventEnterSubmit = 'true';
      form.addEventListener('keydown', preventEnterSubmit);
    }
    if(grossInput && !grossInput.dataset.autoTaxBound){
      grossInput.dataset.autoTaxBound = 'true';
      grossInput.addEventListener('input', calculateTaxFromGross);
      grossInput.addEventListener('change', calculateTaxFromGross);
    }
    if(kindInput && !kindInput.dataset.kpiaRenameBound){
      kindInput.dataset.kpiaRenameBound = 'true';
      kindInput.addEventListener('change', () => setTimeout(renameKpiaTag, 0));
    }
    if(resetBtn && !resetBtn.dataset.kpiaRenameBound){
      resetBtn.dataset.kpiaRenameBound = 'true';
      resetBtn.addEventListener('click', () => setTimeout(renameKpiaTag, 0));
    }

    injectHint();
    renameKpiaTag();
    setTimeout(renameKpiaTag, 0);
    setTimeout(renameKpiaTag, 300);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind);
  }else{
    bind();
  }
})();
