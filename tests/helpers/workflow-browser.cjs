const assert = require('node:assert/strict');

module.exports = async function verifyWorkflow({ evaluate, settle, navigate, reload }) {
  const today = await evaluate('EquipmentLoans.today()');
  const day = (offset) => {
    const value = new Date(`${today}T12:00:00`);
    value.setDate(value.getDate() + offset);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  };
  const row = (name) => `Array.from(document.querySelectorAll('#item-list tr')).find(row => row.cells[0].textContent === ${JSON.stringify(name)})`;
  const count = () => evaluate("document.querySelectorAll('#item-list tr').length");
  async function click(expression) { await evaluate(`${expression}.click()`); await settle(); }
  async function fill(fields) {
    await evaluate(`(() => { const form = document.getElementById('loan-form');
      for (const [field, value] of Object.entries(${JSON.stringify(fields)})) {
        form.elements[field].value = value; form.elements[field].dispatchEvent(new Event('change'));
      } })()`);
  }
  async function submit(twice = false) {
    await evaluate(`(() => { const form = document.getElementById('loan-form'); form.requestSubmit(); ${twice ? 'form.requestSubmit();' : ''} })()`);
    await settle();
  }
  async function equipment(name) {
    await evaluate(`document.getElementById('equipment-name').value = ${JSON.stringify(name)}; document.getElementById('equipment-form').requestSubmit()`);
    await settle();
  }
  async function reserve(equipmentId, startDate = today, dueDate = startDate, status = 'reserved') {
    await navigate('reservation.html');
    await fill({ status, equipmentId, borrowerName: '山田', startDate, dueDate });
    await submit();
  }
  assert.equal(await count(), 0);
  assert.equal(await evaluate("Boolean(document.getElementById('loan-form'))"), false);
  await click("document.getElementById('new-reservation')");
  assert.equal(await evaluate("document.getElementById('register-button').disabled"), true);
  await navigate();
  for (const value of ['', '　 ', 'あ'.repeat(101)]) {
    await equipment(value);
    assert.equal(await evaluate("document.getElementById('equipment-name').getAttribute('aria-invalid')"), 'true');
  }
  await equipment(' PC-01 ');
  await equipment('PC-02');
  const html = '<img src=x onerror="window.xssExecuted=true">';
  await equipment(html);
  assert.equal(await evaluate("document.querySelectorAll('#equipment-list img').length"), 0);
  await equipment('PC-01');
  assert.match(await evaluate("document.getElementById('message').textContent"), /すでに登録/);
  const catalog = await evaluate('EquipmentLoans.createEquipmentRepository(EquipmentLoans.createStorageService()).getAllEquipment()');
  const pc1 = catalog.find((item) => item.name === 'PC-01').id;
  const pc2 = catalog.find((item) => item.name === 'PC-02').id;

  await navigate('reservation.html');
  assert.equal(await evaluate("document.getElementById('item-name').tagName"), 'SELECT');
  assert.equal(await evaluate("document.getElementById('due-date').value"), today);
  await submit();
  assert.equal(await evaluate("document.getElementById('item-name').getAttribute('aria-invalid')"), 'true');
  await fill({ equipmentId: pc1, borrowerName: '山田', startDate: day(-1), dueDate: day(-1) });
  await submit();
  assert.equal(await evaluate("document.getElementById('start-date').getAttribute('aria-invalid')"), 'true');
  await fill({ startDate: today, dueDate: today });
  await click("document.querySelector('[data-calendar-for=start-date]')");
  assert.equal(await evaluate("document.getElementById('calendar-dialog').open"), true);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('[data-date]')).filter(button => button.dataset.date < ${JSON.stringify(today)}).every(button => button.disabled)`), true);
  assert.equal(await evaluate("document.getElementById('calendar-previous').disabled"), true);
  await click("document.getElementById('calendar-next')");
  const chosen = await evaluate("document.querySelector('#calendar-days button:not(:disabled)').dataset.date");
  await click("document.querySelector('#calendar-days button:not(:disabled)')");
  assert.equal(await evaluate("document.getElementById('start-date').value"), chosen);
  assert.equal(await evaluate("document.getElementById('due-date').value"), chosen);
  await fill({ startDate: today, dueDate: today });
  await submit(true);
  assert.equal(await evaluate('location.pathname.endsWith("index.html")'), true);
  assert.equal(await count(), 1);

  await click(`${row('PC-01')}.querySelector('[data-action=edit]')`);
  assert.equal(await evaluate("document.getElementById('registration-title').textContent"), '予約の編集');
  assert.equal(await evaluate("document.getElementById('item-name').value"), pc1);
  await fill({ borrowerName: '変更した人', dueDate: day(1) });
  await submit();
  assert.equal(await count(), 1);
  assert.equal(await evaluate(`${row('PC-01')}.cells[1].textContent`), '変更した人');
  await reserve(pc1, day(2));
  await evaluate("Array.from(document.querySelectorAll('#item-list tr')).find(row => row.cells[1].textContent === '山田').querySelector('[data-action=cancel]').click()");
  await settle();
  assert.equal(await evaluate("document.querySelectorAll('#cancelled-list tr').length"), 1);
  assert.equal(await evaluate("document.getElementById('count-reserved').textContent"), '1');
  await click("Array.from(document.querySelectorAll('#item-list tr')).find(row => row.cells[1].textContent === '変更した人').querySelector('[data-action=edit]')");
  await fill({ startDate: day(2), dueDate: day(2) });
  await submit();
  assert.equal(await count(), 1);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('#item-list tr')).find(row => row.cells[1].textContent === '変更した人').querySelector('[data-action=start]').disabled"), true);
  await click("Array.from(document.querySelectorAll('#item-list tr')).find(row => row.cells[1].textContent === '変更した人').querySelector('[data-action=cancel]')");

  await reserve(pc1);
  await click(`${row('PC-01')}.querySelector('[data-action=start]')`);
  assert.equal(await evaluate(`${row('PC-01')}.cells[4].textContent`), '貸出中');
  await reserve(pc1, today, today, 'borrowed');
  assert.equal(await evaluate('location.pathname.endsWith("reservation.html")'), true);
  assert.match(await evaluate("document.getElementById('message').textContent"), /重複/);
  await navigate('#borrowed');
  const before = Date.now();
  await click(`${row('PC-01')}.querySelector('[data-action=return]')`);
  const returnedAt = await evaluate(`EquipmentLoans.createItemRepository(EquipmentLoans.createStorageService()).getAllItems().then(items => items.find(item => item.itemName === 'PC-01' && item.status === 'returned').returnedAt)`);
  assert.ok(Date.parse(returnedAt) >= before && Date.parse(returnedAt) <= Date.now());
  assert.match(await evaluate(`${row('PC-01')}.cells[5].textContent`), /\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
  await reload();
  assert.equal(await evaluate(`${row('PC-01')}.cells[4].textContent`), '返却済み');

  await reserve(pc2, day(1));
  await click(`${row('PC-02')}.querySelector('[data-action=edit]')`);
  await fill({ borrowerName: '保存失敗の人' });
  await evaluate("Storage.prototype.setItem = function () { throw new Error('quota'); }");
  await submit();
  assert.equal(await evaluate('location.pathname.endsWith("reservation.html")'), true);
  assert.equal(await evaluate("document.getElementById('borrower-name').value"), '保存失敗の人');
  assert.match(await evaluate("document.getElementById('message').textContent"), /保存に失敗/);
  await navigate();
  assert.equal(await evaluate(`${row('PC-02')}.cells[1].textContent`), '山田');

  await evaluate(`(() => {
    const app = EquipmentLoans; const items = JSON.parse(localStorage.getItem(app.STORAGE_KEY));
    items.push({ id: 'grace-loan', equipmentId: ${JSON.stringify(pc2)}, itemName: 'PC-02', borrowerName: '未返却の人', status: 'borrowed',
      startDate: ${JSON.stringify(day(-1))}, dueDate: ${JSON.stringify(day(-1))}, createdAt: new Date(${JSON.stringify(day(-1))} + 'T12:00:00').toISOString(),
      borrowedAt: new Date(${JSON.stringify(day(-1))} + 'T12:00:00').toISOString(), returnedAt: null, cancelledAt: null });
    localStorage.setItem(app.STORAGE_KEY, JSON.stringify(items));
  })()`);
  await reload();
  await click("document.getElementById('tab-borrowed')");
  for (const [time, expected] of [['09:59:59', false], ['10:00:00', false], ['10:00:00.001', true]]) {
    await evaluate(`EquipmentLoans.createItemRepository(EquipmentLoans.createStorageService()).getAllItems().then(items => EquipmentLoans.renderItemList(items, new Date(${JSON.stringify(today)} + 'T' + ${JSON.stringify(time)}), 'borrowed'))`);
    assert.equal(await evaluate("Boolean(document.querySelector('.overdue-row'))"), expected);
  }
  assert.equal(await evaluate("document.querySelector('#item-list tr').cells[1].textContent"), '未返却の人');
  await click("document.querySelector('[data-item-id=grace-loan][data-action=return]')");
  assert.equal(await evaluate("document.getElementById('overdue-summary').hidden"), true);
  await evaluate(`(async () => { const app = EquipmentLoans; const storage = app.createStorageService(); const catalog = app.createEquipmentRepository(storage); const loans = app.createItemRepository(storage);
    for (let index = 0; index < 100; index++) { const item = await catalog.addEquipment('追加備品' + index); await loans.addItem({ equipmentId: item.id, borrowerName: '利用者' + index }); }
  })()`);
  await reload();
  await click("document.getElementById('tab-borrowed')");
  assert.ok(await count() >= 100);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await evaluate("localStorage.setItem(EquipmentLoans.STORAGE_KEY, '{broken')");
  await reload();
  assert.equal(await count(), 0);
  assert.equal(await evaluate("document.getElementById('equipment-register-button').disabled"), true);
  assert.match(await evaluate("document.getElementById('message').textContent"), /保存データが壊れている/);
  assert.equal(await evaluate('localStorage.getItem(EquipmentLoans.STORAGE_KEY)'), '{broken');
};
