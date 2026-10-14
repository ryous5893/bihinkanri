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
    return {
      async getAllItems() { return readItems(); },
      async addItem(input) {
        const date = now();
        const today = app.toLocalDate(date);
        input = await selectedInput(input);
        const result = app.validateLoanInput(input, today);
        if (!result.valid) throw new Error(Object.values(result.errors).join(" "));
        const items = readItems();
        const item = app.createItem({ ...result.values, equipmentId: input.equipmentId }, date);
        requireNoConflict(items, item, today);
        storage.save(app.STORAGE_KEY, [...items, item]);
        return item;
      },
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
      async startReservation(id) {
        const items = readItems();
        const item = findItem(items, id, app.ITEM_STATUS.RESERVED);
        const date = now();
        const today = app.toLocalDate(date);
        const error = app.reservationAvailability(item, items, today);
        if (error) throw new Error(error);
        const borrowed = { ...item, status: app.ITEM_STATUS.BORROWED, borrowedAt: date.toISOString() };
        requireNoConflict(items, borrowed, today);
        return saveUpdate(items, borrowed);
      },
      async cancelReservation(id) {
        const items = readItems();
        const item = findItem(items, id, app.ITEM_STATUS.RESERVED);
        return saveUpdate(items, { ...item, status: app.ITEM_STATUS.CANCELLED, cancelledAt: now().toISOString() });
      },
    };
  };
})();
