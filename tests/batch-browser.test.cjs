const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const createBrowser = require('./helpers/browser.cjs');

test('一括登録・検索・複数予約・まとめて貸出・CSVダウンロード', { timeout: 60000 }, async (t) => {
  const { evaluate, settle, navigate, reload, command } = await createBrowser(t);
  async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle(); }
  async function input(selector, value) {
    await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input')); input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  }
  await input('#bulk-equipment-names', 'PC-01\nPC-02\n\nケーブル-01');
  await evaluate("document.getElementById('bulk-equipment-form').requestSubmit()");
  await settle();
  assert.equal(await evaluate("document.querySelectorAll('#equipment-list li').length"), 3);
  await input('#bulk-equipment-names', 'PC-03\nPC-01');
  await evaluate("document.getElementById('bulk-equipment-form').requestSubmit()");
  await settle();
  assert.equal(await evaluate("document.querySelectorAll('#equipment-list li').length"), 3);
  assert.equal(await evaluate("document.getElementById('bulk-equipment-names').value"), 'PC-03\nPC-01');
  assert.equal(await evaluate(`document.querySelectorAll('a[href="reservation.html"]').length`), 1);
  await click('#new-reservation');
  assert.equal(await evaluate("document.querySelector('.page-nav [aria-current=page]').getAttribute('href')"), 'reservation.html');
  await input('#reservation-search', 'ｐｃ');
  assert.equal(await evaluate("document.querySelectorAll('#item-name option').length"), 3);
  const ids = await evaluate("Array.from(document.querySelectorAll('#item-name option')).filter(option => option.value).map(option => option.value)");
  for (const id of ids) await input('#item-name', id);
  assert.equal(await evaluate("document.querySelectorAll('.selection-chip').length"), 2);
  await input('#reservation-search', 'ケーブル');
  assert.equal(await evaluate("document.querySelectorAll('#item-name option').length"), 2);
  assert.equal(await evaluate("document.querySelectorAll('.selection-chip').length"), 2);
  await input('#reservation-search', '存在しない');
  assert.equal(await evaluate("document.querySelectorAll('#item-name option').length"), 1);
  await input('#borrower-name', '山田 太郎');
  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/bihinkanri-reservation.png', Buffer.from(screenshot.data, 'base64'));
  await evaluate("document.getElementById('loan-form').requestSubmit(); document.getElementById('loan-form').requestSubmit()");
  await settle();
  assert.ok(await evaluate("location.pathname.endsWith('index.html')"));
  assert.equal(await evaluate("document.querySelectorAll('#item-list tr').length"), 2);
  await input('#equipment-search', 'ｐｃ');
  await input('#borrower-search', '山田');
  assert.equal(await evaluate("document.querySelectorAll('#item-list tr').length"), 2);
  await input('#borrower-search', 'PC');
  assert.equal(await evaluate("document.querySelectorAll('#item-list tr').length"), 0, '備品名が利用者名の検索に一致しない');
  await input('#borrower-search', '山田');
  await input('#equipment-search', '山田');
  assert.equal(await evaluate("document.querySelectorAll('#item-list tr').length"), 0, '利用者名が備品名の検索に一致しない');
  await input('#equipment-search', 'ｐｃ');
  assert.equal(await evaluate("document.querySelectorAll('#item-list tr').length"), 2);
  await click('#select-all-reservations');
  assert.equal(await evaluate("document.getElementById('start-selected').disabled"), false);
  await click('#start-selected');
  assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').dataset.status"), 'borrowed');
  assert.equal(await evaluate("document.querySelectorAll('#item-list tr').length"), 2);
  assert.equal(await evaluate("document.querySelectorAll('#equipment-list .catalog-borrowed').length"), 2);
  await input('#borrower-search', '誰もいない');
  assert.equal(await evaluate("document.querySelectorAll('#item-list tr').length"), 0);
  assert.match(await evaluate("document.getElementById('empty-title').textContent"), /検索条件/);
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'equipment-csv-'));
  await command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  await click('#export-csv');
  let csv;
  for (let attempt = 0; attempt < 40; attempt++) {
    const file = fs.readdirSync(downloadDir).find((file) => file.endsWith('.csv'));
    if (file) { csv = fs.readFileSync(path.join(downloadDir, file), 'utf8'); break; }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(csv, 'CSVファイルがダウンロードされる');
  assert.ok(csv.includes('ケーブル-01'), '検索結果に含まれない備品も全件出力');
  assert.ok(csv.includes('"PC-01","0","1","0","0","0","1"'));
  await click('#clear-search');
  assert.equal(await evaluate("document.getElementById('equipment-search').value"), '');
  assert.equal(await evaluate("document.getElementById('borrower-search').value"), '');
  await reload();
  assert.equal(await evaluate("document.querySelectorAll('#equipment-list .catalog-borrowed').length"), 2);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  const shot = await command('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/bihinkanri-list.png', Buffer.from(shot.data, 'base64'));
  await input('#equipment-search', 'PC');
  await input('#borrower-search', '山田');
  for (const remaining of [1, 0]) {
    await click('#item-list [data-action=return]');
    assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').dataset.status"), 'borrowed');
    assert.equal(await evaluate("document.querySelectorAll('#item-list tr').length"), remaining);
    assert.equal(await evaluate("document.getElementById('equipment-search').value"), 'PC');
    assert.equal(await evaluate("document.getElementById('borrower-search').value"), '山田');
  }
  assert.equal(await evaluate("document.getElementById('count-returned').textContent"), '2');
  await reload();
  assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').dataset.status"), 'borrowed');
  // 過去日・未返却などの理由で開始不可の予約は一括選択の対象外。
  await navigate('reservation.html');
  await input('#reservation-search', 'ケーブル');
  const cableId = await evaluate("document.querySelectorAll('#item-name option')[1].value");
  await input('#item-name', cableId);
  await click('.selection-chip');
  assert.equal(await evaluate("document.querySelectorAll('.selection-chip').length"), 0);
  await input('#item-name', cableId);
  await input('#borrower-name', '佐藤');
  const tomorrow = await evaluate("(() => { const day = new Date(); day.setDate(day.getDate() + 1); return EquipmentLoans.toLocalDate(day); })()");
  await input('#start-date', tomorrow);
  await evaluate("document.getElementById('loan-form').requestSubmit()");
  await settle();
  assert.equal(await evaluate("document.querySelector('[data-reservation-id]').disabled"), true);
  assert.equal(await evaluate("document.getElementById('select-all-reservations').disabled"), true);
});
