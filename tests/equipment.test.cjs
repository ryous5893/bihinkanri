const { test } = require('node:test');
const assert = require('node:assert/strict');
const setup = require('./helpers/repository.cjs');

test('備品を登録・保存して管理IDで予約できる', async () => {
  const { equipmentRepository, rawRepository } = setup();
  const equipment = await equipmentRepository.addEquipment(' PC-01 ');
  assert.equal(equipment.name, 'PC-01');
  assert.equal((await equipmentRepository.getAllEquipment())[0].id, equipment.id);
  const reservation = await rawRepository.addItem({ equipmentId: equipment.id, borrowerName: '山田', status: 'reserved' });
  assert.equal(reservation.equipmentId, equipment.id);
  assert.equal(reservation.itemName, 'PC-01');
});

test('空の備品名・重複名・長すぎる名前・未登録の選択を拒否する', async () => {
  const { equipmentRepository, rawRepository } = setup();
  for (const value of ['', '　 ', 'あ'.repeat(101)]) await assert.rejects(equipmentRepository.addEquipment(value));
  await equipmentRepository.addEquipment('PC-01');
  await assert.rejects(equipmentRepository.addEquipment(' PC-01 '), /すでに登録/);
  await assert.rejects(rawRepository.addItem({ equipmentId: 'missing', borrowerName: '山田' }), /登録済み/);
  await assert.rejects(rawRepository.addItem({ itemName: '自由入力', borrowerName: '山田' }), /登録済み/);
});

test('旧記録の備品を一覧に引き継いで同じIDで重複を防ぐ', async () => {
  const { app, data, equipmentRepository, rawRepository } = setup();
  const old = { id: 'old', itemName: '旧PC', borrowerName: '山田', status: 'borrowed', borrowedAt: '2026-10-07T09:00:00+09:00', returnedAt: null };
  data.set(app.STORAGE_KEY, JSON.stringify([old]));
  const equipment = await equipmentRepository.getAllEquipment();
  assert.equal(equipment[0].name, old.itemName);
  assert.equal((await rawRepository.getAllItems())[0].equipmentId, equipment[0].id);
  await assert.rejects(equipmentRepository.addEquipment('旧PC'), /すでに登録/);
  await assert.rejects(rawRepository.addItem({ equipmentId: equipment[0].id, borrowerName: '佐藤' }), /重複/);
  assert.equal(data.get(app.STORAGE_KEY), JSON.stringify([old]));
});

test('予約を編集し、ID・作成日時・状態を保持する', async () => {
  const { repository, setTime } = setup();
  const original = await repository.addItem({ itemName: 'PC-01', borrowerName: '山田', status: 'reserved', startDate: '2026-10-08' });
  setTime('2026-10-07T12:34:56+09:00');
  const edited = await repository.editReservation(original.id, { itemName: 'PC-02', borrowerName: '佐藤', startDate: '2026-10-09', dueDate: '2026-10-10' });
  assert.equal(edited.id, original.id);
  assert.equal(edited.createdAt, original.createdAt);
  assert.equal(edited.status, 'reserved');
  assert.equal(edited.borrowerName, '佐藤');
  assert.equal(edited.dueDate, '2026-10-10');
  assert.equal(edited.itemName, 'PC-02');
  assert.equal(edited.updatedAt, '2026-10-07T03:34:56.000Z');
  assert.equal((await repository.getAllItems()).length, 1);
});

test('編集でも期間重複・過去日を拒否し、元の予約を保持する', async () => {
  const { repository } = setup();
  const first = await repository.addItem({ itemName: 'PC-01', borrowerName: '山田', status: 'reserved', startDate: '2026-10-08' });
  await repository.addItem({ itemName: 'PC-01', borrowerName: '佐藤', status: 'reserved', startDate: '2026-10-09' });
  await assert.rejects(repository.editReservation(first.id, { itemName: 'PC-01', borrowerName: '山田', startDate: '2026-10-09' }), /重複/);
  await assert.rejects(repository.editReservation(first.id, { itemName: 'PC-01', borrowerName: '山田', startDate: '2026-10-06' }), /今日以降/);
  assert.equal((await repository.getAllItems())[0].startDate, first.startDate);
  await repository.editReservation(first.id, { itemName: 'PC-01', borrowerName: '変更した人', startDate: '2026-10-08' });
});

test('貸出開始済み・取消済みの予約は編集できない', async () => {
  const { repository } = setup();
  const borrowed = await repository.addItem({ itemName: 'PC-01', borrowerName: '山田' });
  await assert.rejects(repository.editReservation(borrowed.id, { itemName: 'PC-01', borrowerName: '佐藤' }), /予約中ではありません/);
  const reservation = await repository.addItem({ itemName: 'PC-02', borrowerName: '山田', status: 'reserved' });
  await repository.cancelReservation(reservation.id);
  await assert.rejects(repository.editReservation(reservation.id, { itemName: 'PC-02', borrowerName: '佐藤' }), /予約中ではありません/);
});

test('返却ボタン処理の日時を秒・ミリ秒まで保存し再返却で上書きしない', async () => {
  const { repository, setTime } = setup();
  const item = await repository.addItem({ itemName: 'PC-01', borrowerName: '山田' });
  setTime('2026-10-08T09:12:34.567+09:00');
  const returned = await repository.returnItem(item.id);
  assert.equal(returned.returnedAt, '2026-10-08T00:12:34.567Z');
  setTime('2026-10-08T11:00:00+09:00');
  await assert.rejects(repository.returnItem(item.id));
  assert.equal((await repository.getAllItems())[0].returnedAt, returned.returnedAt);
});

test('備品・編集の保存失敗と破損データを上書きしない', async () => {
  const { app, data, localStorage, repository, equipmentRepository } = setup();
  const reserved = await repository.addItem({ itemName: 'PC-01', borrowerName: '山田', status: 'reserved' });
  localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(equipmentRepository.addEquipment('PC-02'), /保存に失敗/);
  await assert.rejects(repository.editReservation(reserved.id, { itemName: 'PC-01', borrowerName: '佐藤' }), /保存に失敗/);
  assert.equal((await repository.getAllItems())[0].borrowerName, '山田');
  data.set(app.EQUIPMENT_STORAGE_KEY, '{broken');
  await assert.rejects(equipmentRepository.getAllEquipment());
  assert.equal(data.get(app.EQUIPMENT_STORAGE_KEY), '{broken');
});
