const assert = require('node:assert/strict');

module.exports = async function verifyTabs({ evaluate, navigate, reload, settle }) {
  // 正常な少数データだけに戻して、状態ごとの表示・件数・順序を検証する。
  await navigate('reservation.html');
  await evaluate(`localStorage.setItem(EquipmentLoans.STORAGE_KEY, '[]')`);
  await navigate('#reserved');
  await evaluate(`(async () => {
    const app = EquipmentLoans; const storage = app.createStorageService(); const equipment = app.createEquipmentRepository(storage);
    const first = await equipment.addEquipment('タブ用PC-1'); const second = await equipment.addEquipment('タブ用PC-2');
    const third = await equipment.addEquipment('タブ用PC-3'); const fourth = await equipment.addEquipment('タブ用PC-4');
    const loans = app.createItemRepository(storage);
    await loans.addItem({ equipmentId: first.id, borrowerName: '予約者', status: 'reserved' });
    await loans.addItem({ equipmentId: second.id, borrowerName: '利用者' });
    const returned = await loans.addItem({ equipmentId: third.id, borrowerName: '返却者' }); await loans.returnItem(returned.id);
    const cancelled = await loans.addItem({ equipmentId: fourth.id, borrowerName: '取消者', status: 'reserved' }); await loans.cancelReservation(cancelled.id);
  })()`);
  await reload();
  async function select(status) { await evaluate(`document.getElementById('tab-${status}').click()`); await settle(); }
  const states = ['reserved', 'borrowed', 'returned'];
  for (const state of states) {
    assert.equal(await evaluate(`document.getElementById('count-${state}').textContent`), '1');
    await select(state);
    assert.equal(await evaluate("document.querySelectorAll('#item-list tr').length"), 1);
    assert.equal(await evaluate("document.querySelector('#item-list tr').cells[1].textContent"), { reserved: '予約者', borrowed: '利用者', returned: '返却者' }[state]);
    assert.equal(await evaluate("document.querySelectorAll('[role=tab][aria-selected=true]').length"), 1);
    assert.equal(await evaluate("document.getElementById('loan-panel').getAttribute('aria-labelledby')"), `tab-${state}`);
    if (await evaluate('location.protocol') === 'file:') {
      assert.equal(await evaluate('EquipmentLoans.createStorageService().load(EquipmentLoans.SELECTED_TAB_STORAGE_KEY)'), state);
    } else {
      assert.equal(await evaluate('location.hash'), `#${state}`);
    }
    assert.equal(await evaluate("document.getElementById('returned-at-heading').hidden"), state !== 'returned');
    assert.equal(await evaluate("document.getElementById('action-heading').hidden"), state === 'returned');
    await reload();
    assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').dataset.status"), state);
  }
  assert.equal(await evaluate("document.getElementById('count-cancelled').textContent"), '1件');
  assert.equal(await evaluate("document.querySelector('#cancelled-list tr').cells[1].textContent"), '取消者');
  await evaluate("document.getElementById('tab-returned').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}))");
  assert.equal(await evaluate('document.activeElement.id'), 'tab-reserved');
  await evaluate("document.getElementById('tab-reserved').dispatchEvent(new KeyboardEvent('keydown', {key:'End', bubbles:true}))");
  assert.equal(await evaluate('document.activeElement.id'), 'tab-returned');
  await evaluate("document.getElementById('tab-returned').dispatchEvent(new KeyboardEvent('keydown', {key:'Home', bubbles:true}))");
  assert.equal(await evaluate('document.activeElement.id'), 'tab-reserved');
  // 貸出後は貸出中へ移動し、返却後も貸出中を維持して続けて返却できる。
  await evaluate("document.querySelector('#item-list [data-action=start]').click()");
  await settle();
  assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').dataset.status"), 'borrowed');
  assert.equal(await evaluate("document.getElementById('count-reserved').textContent"), '0');
  assert.equal(await evaluate("document.getElementById('count-borrowed').textContent"), '2');
  await evaluate("document.querySelector('#item-list [data-action=return]').click()");
  await settle();
  assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').dataset.status"), 'borrowed');
  assert.equal(await evaluate("document.getElementById('count-returned').textContent"), '2');
  await evaluate("document.querySelector('#item-list [data-action=return]').click()");
  await settle();
  assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').dataset.status"), 'borrowed');
  assert.equal(await evaluate("document.getElementById('count-borrowed').textContent"), '0');
  assert.equal(await evaluate("document.getElementById('count-returned').textContent"), '3');
  await select('returned');
  const returnedDates = await evaluate("Array.from(document.querySelectorAll('#item-list tr')).map(row => row.cells[5].textContent)");
  assert.equal(returnedDates[0] >= returnedDates[1], true);
  await select('reserved');
  assert.equal(await evaluate("document.getElementById('empty-state').hidden"), false);
  assert.match(await evaluate("document.getElementById('empty-title').textContent"), /予約中/);
  await evaluate("window.dispatchEvent(new Event('focus'))");
  await settle();
  assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').dataset.status"), 'reserved');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
};
