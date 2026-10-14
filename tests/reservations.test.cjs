const { test } = require('node:test');
const assert = require('node:assert/strict');
const setup = require('./helpers/repository.cjs');
const loan = (overrides = {}) => ({ itemName: 'PC-01', borrowerName: '山田', ...overrides });
const reservation = (startDate, dueDate = startDate, overrides = {}) => loan({ status: 'reserved', startDate, dueDate, ...overrides });

test('当日返却を初期値とし、別の日の返却予定を保存できる', async () => {
  const { repository } = setup();
  const today = await repository.addItem(loan());
  assert.equal(today.startDate, '2026-10-07');
  assert.equal(today.dueDate, today.startDate);
  const longer = await repository.addItem(loan({ itemName: 'PC-02', dueDate: '2026-10-09' }));
  assert.equal(longer.dueDate, '2026-10-09');
});

test('開始日と返却予定日を含む重複を拒否し、翌日からの予約は許可する', async () => {
  const { repository } = setup();
  await repository.addItem(reservation('2026-10-10', '2026-10-12'));
  for (const [start, end] of [['2026-10-10', '2026-10-10'], ['2026-10-11', '2026-10-11'], ['2026-10-09', '2026-10-10'], ['2026-10-12', '2026-10-13'], ['2026-10-09', '2026-10-13']]) {
    await assert.rejects(repository.addItem(reservation(start, end, { borrowerName: '佐藤' })), /重複/);
  }
  await repository.addItem(reservation('2026-10-13'));
  await repository.addItem(reservation('2026-10-09'));
  await repository.addItem(reservation('2026-10-10', '2026-10-12', { itemName: 'PC-02' }));
  assert.equal((await repository.getAllItems()).length, 4);
});

test('貸出と予約の両方向で重複を防止する', async () => {
  const { repository } = setup();
  await repository.addItem(loan({ dueDate: '2026-10-09' }));
  await assert.rejects(repository.addItem(loan({ borrowerName: '佐藤' })), /重複/);
  await assert.rejects(repository.addItem(reservation('2026-10-09')), /重複/);
  await repository.addItem(reservation('2026-10-10'));
  await repository.addItem(reservation('2026-10-08', '2026-10-09', { itemName: 'PC-02' }));
  await assert.rejects(repository.addItem(loan({ itemName: 'PC-02', dueDate: '2026-10-08' })), /重複/);
});

test('予約は開始前には貸し出せず、開始日から貸出・返却できる', async () => {
  const { repository, setTime } = setup();
  const reserved = await repository.addItem(reservation('2026-10-08', '2026-10-09'));
  assert.equal(reserved.borrowedAt, null);
  assert.ok(reserved.createdAt);
  await assert.rejects(repository.startReservation(reserved.id), /利用開始日/);
  await assert.rejects(repository.returnItem(reserved.id), /貸出中ではありません/);
  setTime('2026-10-08T10:00:00+09:00');
  const started = await repository.startReservation(reserved.id);
  assert.equal(started.status, 'borrowed');
  assert.equal(started.id, reserved.id);
  assert.equal(started.dueDate, '2026-10-09');
  assert.ok(started.borrowedAt);
  await assert.rejects(repository.startReservation(reserved.id), /予約中ではありません/);
  await repository.returnItem(reserved.id);
  assert.equal((await repository.getAllItems())[0].status, 'returned');
});

test('未返却なら次の予約を貸し出せず、返却後は開始できる', async () => {
  const { app, repository, setTime } = setup();
  const borrowed = await repository.addItem(loan());
  const reserved = await repository.addItem(reservation('2026-10-08'));
  setTime('2026-10-08T10:00:00+09:00');
  assert.equal(app.isOverdue((await repository.getAllItems())[0], new Date('2026-10-08T10:00:00+09:00')), false);
  await assert.rejects(repository.startReservation(reserved.id), /まだ返却/);
  await assert.rejects(repository.addItem(loan({ borrowerName: '佐藤' })), /重複/);
  await repository.returnItem(borrowed.id);
  await repository.startReservation(reserved.id);
});

test('取消した予約・返却済みの記録は期間を占有しない', async () => {
  const { repository } = setup();
  const reserved = await repository.addItem(reservation('2026-10-07'));
  await repository.cancelReservation(reserved.id);
  await assert.rejects(repository.cancelReservation(reserved.id), /予約中ではありません/);
  const borrowed = await repository.addItem(loan());
  await repository.returnItem(borrowed.id);
  await repository.addItem(loan());
  assert.equal((await repository.getAllItems()).length, 3);
});

test('予約期間終了後は貸出できないが取消できる', async () => {
  const { repository, setTime } = setup();
  const reserved = await repository.addItem(reservation('2026-10-07'));
  setTime('2026-10-08T12:00:00+09:00');
  await assert.rejects(repository.startReservation(reserved.id), /予約期間が終了/);
  await repository.cancelReservation(reserved.id);
});

test('空の日付・実在しない日付・過去・逆転する期間を拒否する', async () => {
  const { repository } = setup();
  for (const fields of [
    { startDate: '' }, { dueDate: '' }, { startDate: '2026-02-30' }, { dueDate: '2026-13-01' },
    { startDate: '2026-10-06' }, { startDate: '2026-10-08' }, { dueDate: '2026-10-06' },
    { status: 'returned' }, { status: 'reserved', startDate: '2026-10-10', dueDate: '2026-10-09' },
  ]) await assert.rejects(repository.addItem(loan(fields)));
  assert.equal((await repository.getAllItems()).length, 0);
});

test('翌朝10時までは許容し、その直後から貸出中だけを超過にする', async () => {
  const { app, repository } = setup();
  const borrowed = await repository.addItem(loan());
  assert.equal(app.isOverdue(borrowed, new Date('2026-10-07T23:59:59+09:00')), false);
  assert.equal(app.isOverdue(borrowed, new Date('2026-10-08T09:59:59+09:00')), false);
  assert.equal(app.isOverdue(borrowed, new Date('2026-10-08T10:00:00+09:00')), false);
  assert.equal(app.isOverdue(borrowed, new Date('2026-10-08T10:00:00.001+09:00')), true);
  const returned = await repository.returnItem(borrowed.id);
  assert.equal(app.isOverdue(returned, new Date('2026-10-08T12:00:00+09:00')), false);
  const reserved = await repository.addItem(reservation('2026-10-07'));
  assert.equal(app.isOverdue(reserved, new Date('2026-10-08T12:00:00+09:00')), false);
});

test('旧データを当日返却として補完し、IDと返却履歴を保持する', async () => {
  const { app, data, repository } = setup();
  const legacy = [
    { id: 'legacy-1', itemName: '旧PC', borrowerName: '山田', status: 'borrowed', borrowedAt: '2026-10-06T10:00:00+09:00', returnedAt: null },
    { id: 'legacy-2', itemName: '旧PC', borrowerName: '佐藤', status: 'returned', borrowedAt: '2026-10-05T10:00:00+09:00', returnedAt: '2026-10-06T10:00:00+09:00' },
  ];
  const original = JSON.stringify(legacy);
  data.set(app.STORAGE_KEY, original);
  const items = await repository.getAllItems();
  assert.equal(items[0].dueDate, '2026-10-06');
  assert.equal(items[1].id, 'legacy-2');
  assert.equal(items[1].returnedAt, legacy[1].returnedAt);
  assert.equal(data.get(app.STORAGE_KEY), original);
  await repository.returnItem('legacy-1');
  assert.equal(JSON.parse(data.get(app.STORAGE_KEY))[0].dueDate, '2026-10-06');
});

test('予約開始・取消の保存に失敗しても元の予約を保持する', async () => {
  const { repository, localStorage } = setup();
  const reserved = await repository.addItem(reservation('2026-10-07'));
  localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(repository.startReservation(reserved.id), /保存に失敗/);
  await assert.rejects(repository.cancelReservation(reserved.id), /保存に失敗/);
  assert.equal((await repository.getAllItems())[0].status, 'reserved');
});

test('日付を厳密に検証し、月・年の境界でも日数を正しく計算する', () => {
  const { app } = setup();
  assert.equal(app.isValidDate('2028-02-29'), true);
  assert.equal(app.isValidDate('2026-02-29'), false);
  assert.equal(app.isValidDate('2026-04-31'), false);
  assert.equal(app.daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(app.daysBetween('2028-02-28', '2028-03-01'), 2);
});
