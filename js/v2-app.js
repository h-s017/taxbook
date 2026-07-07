const taxBookBootstrap = document.createElement('script');
taxBookBootstrap.src = 'js/v2-bootstrap.js';
taxBookBootstrap.onload = () => console.info('TaxBook v2 bootstrap loaded');
taxBookBootstrap.onerror = () => alert('TaxBook 啟動模組載入失敗，請重新整理頁面。');
document.head.appendChild(taxBookBootstrap);
