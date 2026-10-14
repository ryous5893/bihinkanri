"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.createItemRepository = (storage, now = () => new Date()) => {
    const readItems = () => app.readLoanRecords(storage);
    const equipmentRepository = app.createEquipmentRepository(storage, now);
    async function selectedInput(input) {
      const equipment = await equipmentRepository.getAllEquipment();
      const selected = equipment.find((item) => item.id === input.equipmentId);
      if (!selected) throw new Error("登録済みの備品を選択してください。");
      return { ...input, itemName: selected.name, equipmentId: selected.id };
    }
    function requireNoConflict(items, candidate, today) {
      const conflict = app.findConflict(items, candidate, today);
      if (conflict) throw new Error(`${candidate.itemName}は${conflict.borrowerName}の貸出・予約と重複しています（${app.formatDate(conflict.startDate)}〜${app.formatDate(conflict.dueDate)}）。貸出中の場合は返却を確認してください。`);
    }
    function findItem(items, id, status) {
      const item = items.find((record) => record.id === id);
      if (!item) throw new Error("対象の記録が見つかりません。再読み込みしてください。");
      if (item.status !== status) throw new Error(status === app.ITEM_STATUS.BORROWED ? "この備品は貸出中ではありません（すでに返却済み、または予約中です）。" : "この記録は予約中ではありません。");
      return item;
    }
    function saveUpdate(items, updated) {
      storage.save(app.STORAGE_KEY, items.map((item) => item.id === updated.id ? updated : item));
      return updated;
    }
    async function addItems(inputs) {
      if (!Array.isArray(inputs) || !inputs.length) throw new Error("備品を選択してください。");
      const date = now();
      const today = app.toLocalDate(date);
      const equipment = await equipmentRepository.getAllEquipment();
      const items = readItems();
      const added = [];
      for (const input of inputs) {
        const selected = equipment.find((item) => item.id === input.equipmentId);
        if (!selected) throw new Error("登録済みの備品を選択してください。");
        const result = app.validateLoanInput({ ...input, itemName: selected.name }, today);
        if (!result.valid) throw new Error(Object.values(result.errors).join(" "));
        const item = app.createItem({ ...result.values, equipmentId: selected.id }, date);
        requireNoConflict([...items, ...added], item, today);
        added.push(item);
      }
      storage.save(app.STORAGE_KEY, [...items, ...added]);
      return added;
    }
    function startReservations(ids) {
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw new Error("貸出する予約を重複なく選択してください。");
      const items = readItems();
      const date = now();
      const today = app.toLocalDate(date);
      const updated = new Map();
      for (const id of ids) {
        const item = findItem(items, id, app.ITEM_STATUS.RESERVED);
        const error = app.reservationAvailability(item, items, today);
        if (error) throw new Error(`${item.itemName}：${error}`);
        const borrowed = { ...item, status: app.ITEM_STATUS.BORROWED, borrowedAt: date.toISOString() };
        requireNoConflict(items.map((record) => updated.get(record.id) || record), borrowed, today);
        updated.set(id, borrowed);
      }
      storage.save(app.STORAGE_KEY, items.map((item) => updated.get(item.id) || item));
      return Array.from(updated.values());
    }
    return {
      async getAllItems() { return readItems(); },
      async addItem(input) { return (await addItems([input]))[0]; },
      addItems,
      async startReservations(ids) { return startReservations(ids); },
      async returnItem(id) {
        const returnedAt = now().toISOString();
        const items = readItems();
        const item = findItem(items, id, app.ITEM_STATUS.BORROWED);
        return saveUpdate(items, { ...item, status: app.ITEM_STATUS.RETURNED, returnedAt });
      },
      async editReservation(id, input) {
        input = await selectedInput(input);
        const date = now();
        const result = app.validateLoanInput({ ...input, status: app.ITEM_STATUS.RESERVED }, app.toLocalDate(date));
        if (!result.valid) throw new Error(Object.values(result.errors).join(" "));
        const items = readItems();
        const item = findItem(items, id, app.ITEM_STATUS.RESERVED);
        const updated = { ...item, ...result.values, equipmentId: input.equipmentId, updatedAt: date.toISOString() };
        requireNoConflict(items, updated, app.toLocalDate(date));
        return saveUpdate(items, updated);
      },
      async startReservation(id) { return startReservations([id])[0]; },
      async cancelReservation(id) {
        const items = readItems();
        const item = findItem(items, id, app.ITEM_STATUS.RESERVED);
        return saveUpdate(items, { ...item, status: app.ITEM_STATUS.CANCELLED, cancelledAt: now().toISOString() });
      },
    };
  };
})();
