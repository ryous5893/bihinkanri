const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

module.exports = function setup(initialTime = '2026-10-07T10:00:00+09:00') {
  const data = new Map();
  const localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const context = vm.createContext({ window: { localStorage }, crypto: webcrypto });
  for (const file of ['constants', 'utils/dates', 'utils/validation', 'models/item', 'models/loanRules', 'services/storage', 'repositories/loanData', 'repositories/equipmentRepository', 'repositories/itemRepository']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js', `${file}.js`), 'utf8'), context);
  }
  const app = context.window.EquipmentLoans;
  let currentTime = initialTime;
  const now = () => new Date(currentTime);
  const storage = app.createStorageService();
  const equipmentRepository = app.createEquipmentRepository(storage, now);
  const rawRepository = app.createItemRepository(storage, now);
  // 既存の業務ルールテスト用に、名前で指定した備品を事前登録する。
  async function selected(input) {
    if (input.equipmentId) return input;
    const name = typeof input.itemName === 'string' ? input.itemName.trim() : '';
    const equipment = (await equipmentRepository.getAllEquipment()).find((item) => item.name === name) || await equipmentRepository.addEquipment(name);
    return { ...input, equipmentId: equipment.id };
  }
  const repository = {
    ...rawRepository,
    addItem: async (input) => rawRepository.addItem(await selected(input)),
    editReservation: async (id, input) => rawRepository.editReservation(id, await selected(input)),
  };
  return { app, data, localStorage, now, rawRepository, equipmentRepository, setTime: (value) => { currentTime = value; }, repository };
};
