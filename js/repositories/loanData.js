"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.readLoanRecords = (storage) => {
    const saved = storage.load(app.STORAGE_KEY);
    const items = Array.isArray(saved) ? saved.map(app.normalizeItem) : saved;
    if (!Array.isArray(items) || !items.every(app.isValidItem) || new Set(items.map((item) => item.id)).size !== items.length) {
      throw new Error("保存データの形式が正しくありません。データの上書きを防ぐため登録を停止しています。");
    }
    return items;
  };
})();
