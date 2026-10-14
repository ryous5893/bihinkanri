const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const setup = require('./helpers/repository.cjs');

test('備品一括登録は入力内重複・登録済み・長すぎる名前で全件を保存しない', async () => {
  const { equipmentRepository: catalog, data, app } = setup();
  await catalog.addEquipmentBatch(['PC-01', 'PC-02']);
  const before = data.get(app.EQUIPMENT_STORAGE_KEY);
  for (const names of [['PC-03', 'PC-03'], ['PC-03', 'PC-01'], ['PC-03', 'あ'.repeat(101)], []]) {
    await assert.rejects(catalog.addEquipmentBatch(names));
    assert.equal(data.get(app.EQUIPMENT_STORAGE_KEY), before);
  }
});

test('まとめて予約・貸出は衝突や不正な備品で部分保存せず、全件成功時だけ保存する', async () => {
  const { equipmentRepository: catalog, rawRepository: loans, data, app } = setup();
  const equipment = await catalog.addEquipmentBatch(['PC-01', 'PC-02', 'PC-03']);
  const input = (entry) => ({ equipmentId: entry.id, borrowerName: '山田', status: 'reserved' });
  const existing = await loans.addItem(input(equipment[0]));
  const before = data.get(app.STORAGE_KEY);
  await assert.rejects(loans.addItems([input(equipment[1]), input(equipment[0])]), /重複/);
  await assert.rejects(loans.addItems([input(equipment[1]), { equipmentId: 'missing' }]), /登録済み/);
  await assert.rejects(loans.addItems([input(equipment[1]), input(equipment[1])]), /重複/);
  assert.equal(data.get(app.STORAGE_KEY), before);
  const added = await loans.addItems(equipment.slice(1).map(input));
  assert.equal(added.length, 2);
  const borrowed = await loans.startReservations([existing.id, ...added.map((item) => item.id)]);
  assert.equal(borrowed.length, 3);
  assert.ok(borrowed.every((item) => item.status === 'borrowed'));
  assert.equal(new Set(borrowed.map((item) => item.borrowedAt)).size, 1);
});

test('まとめて貸出で未来の予約・取消・不存在・重複IDが含まれても状態を変更しない', async () => {
  const { equipmentRepository: catalog, rawRepository: loans, data, app } = setup();
  const equipment = await catalog.addEquipmentBatch(['PC-01', 'PC-02']);
  const current = await loans.addItem({ equipmentId: equipment[0].id, borrowerName: '山田', status: 'reserved' });
  const future = await loans.addItem({ equipmentId: equipment[1].id, borrowerName: '山田', status: 'reserved', startDate: '2026-10-08', dueDate: '2026-10-08' });
  const before = data.get(app.STORAGE_KEY);
  for (const ids of [[current.id, future.id], [current.id, 'missing'], [current.id, current.id], []]) {
    await assert.rejects(loans.startReservations(ids));
    assert.equal(data.get(app.STORAGE_KEY), before);
  }
  await loans.cancelReservation(future.id);
  const cancelled = data.get(app.STORAGE_KEY);
  await assert.rejects(loans.startReservations([current.id, future.id]));
  assert.equal(data.get(app.STORAGE_KEY), cancelled);
});

test('一括処理の保存失敗時も元データを保持する', async () => {
  const { equipmentRepository: catalog, rawRepository: loans, localStorage, data, app } = setup();
  const equipment = await catalog.addEquipmentBatch(['PC-01', 'PC-02']);
  const records = await loans.addItems(equipment.map((item) => ({ equipmentId: item.id, borrowerName: '山田', status: 'reserved' })));
  const before = data.get(app.STORAGE_KEY);
  localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(loans.startReservations(records.map((item) => item.id)), /保存に失敗/);
  await assert.rejects(catalog.addEquipmentBatch(['PC-03', 'PC-04']), /保存に失敗/);
  assert.equal(data.get(app.STORAGE_KEY), before);
});

test('検索は全角・半角と英字大小を吸収し、CSVは全備品・状態別件数・数式対策を含む', async () => {
  const { app, equipmentRepository: catalog, rawRepository: loans } = setup();
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/utils/report.js'), 'utf8'), { window: { EquipmentLoans: app } });
  assert.ok(app.matchesSearch('ｐｃ 山田', 'PC-01', '山田 太郎'));
  assert.ok(!app.matchesSearch('佐藤', 'PC-01', '山田'));
  const equipment = await catalog.addEquipmentBatch(['=1+1', 'PC,"02"', '未利用']);
  const records = await loans.addItems(equipment.slice(0, 2).map((item) => ({ equipmentId: item.id, borrowerName: '山田' })));
  await loans.returnItem(records[1].id);
  const items = await loans.getAllItems();
  const csv = app.createStatisticsCsv(equipment, items, new Date('2026-10-09T12:00:00+09:00'));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=1+1","0","1","0","0","1","1"'));
  assert.ok(csv.includes('"PC,""02""","0","0","1","0","0","1"'));
  assert.ok(csv.includes('"未利用","0","0","0","0","0","0"'));
});
