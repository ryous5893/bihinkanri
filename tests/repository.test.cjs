const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const setup = require('./helpers/repository.cjs');

test('登録・返却・再読み込みでIDと記録を維持する', async () => {
  const { app, repository, now } = setup();
  const item = await repository.addItem({ itemName: ' ノートPC ', borrowerName: ' 山田太郎 ' });
  assert.equal(item.itemName, 'ノートPC');
  assert.equal(item.borrowerName, '山田太郎');
  assert.equal(item.status, 'borrowed');
  assert.equal(item.returnedAt, null);
  assert.ok(Number.isFinite(Date.parse(item.borrowedAt)));
  const reloaded = app.createItemRepository(app.createStorageService(), now);
  assert.equal((await reloaded.getAllItems())[0].id, item.id);
  await reloaded.returnItem(item.id);
  const returned = (await repository.getAllItems())[0];
  assert.equal(returned.status, 'returned');
  assert.ok(Number.isFinite(Date.parse(returned.returnedAt)));
  assert.equal(returned.borrowedAt, item.borrowedAt);
  await assert.rejects(repository.returnItem(item.id), /すでに返却済み/);
});

test('空欄・空白のみ・長すぎる入力を拒否する', async () => {
  const { repository } = setup();
  for (const input of [
    { itemName: '', borrowerName: '山田' },
    { itemName: 'PC', borrowerName: '' },
    { itemName: '', borrowerName: '' },
    { itemName: ' \t　', borrowerName: '山田' },
    { itemName: 'PC', borrowerName: '　 ' },
    { itemName: 'あ'.repeat(101), borrowerName: '山田' },
    { itemName: 'PC', borrowerName: 'あ'.repeat(101) },
  ]) await assert.rejects(repository.addItem(input));
  assert.equal((await repository.getAllItems()).length, 0);
  await repository.addItem({ itemName: 'あ'.repeat(100), borrowerName: 'い'.repeat(100) });
  assert.equal((await repository.getAllItems()).length, 1);
});

test('異なる備品を100件登録しても一意のIDがある', async () => {
  const { repository } = setup();
  for (let index = 0; index < 100; index++) {
    await repository.addItem({ itemName: `ノートPC-${index}`, borrowerName: `利用者${index}` });
  }
  const items = await repository.getAllItems();
  assert.equal(items.length, 100);
  assert.equal(new Set(items.map((item) => item.id)).size, 100);
});

test('破損JSONや不正な保存形式を上書きしない', async () => {
  const { app, data, repository } = setup();
  for (const raw of ['{broken', 'null', '{}', '[null]', '[{"status":"unknown"}]']) {
    data.set(app.STORAGE_KEY, raw);
    await assert.rejects(repository.getAllItems());
    await assert.rejects(repository.addItem({ itemName: 'PC', borrowerName: '山田' }));
    assert.equal(data.get(app.STORAGE_KEY), raw);
  }
});

test('保存失敗時は登録・返却の成功を返さず、保存済みデータを維持する', async () => {
  const { localStorage, repository } = setup();
  const item = await repository.addItem({ itemName: 'PC', borrowerName: '山田' });
  localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(repository.addItem({ itemName: 'HDMI', borrowerName: '佐藤' }), /保存に失敗/);
  await assert.rejects(repository.returnItem(item.id), /保存に失敗/);
  const items = await repository.getAllItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'borrowed');
});

test('保存領域にアクセスできない場合にエラーを返す', async () => {
  const { app } = setup();
  const storage = app.createStorageService(() => { throw new Error('denied'); });
  await assert.rejects(app.createItemRepository(storage).getAllItems(), /読み込めません/);
});

test('UUIDフォールバックでも一意のIDを生成する', () => {
  const context = vm.createContext({ window: {}, crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } });
  for (const file of ['constants', 'utils/dates', 'models/item']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', `${file}.js`), 'utf8'), context);
  }
  const ids = Array.from({ length: 100 }, () => context.window.EquipmentLoans.createItem({}).id);
  assert.equal(new Set(ids).size, 100);
  assert.match(ids[0], /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
