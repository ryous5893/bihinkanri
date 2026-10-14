"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.createEquipmentRepository = (storage, now = () => new Date()) => {
    function readEquipment() {
      const equipment = storage.load(app.EQUIPMENT_STORAGE_KEY);
      if (!Array.isArray(equipment) || !equipment.every((item) => item && typeof item.id === "string" && item.id.trim() &&
        typeof item.name === "string" && item.name.trim() === item.name && item.name.length > 0 && item.name.length <= app.MAX_INPUT_LENGTH &&
        typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt))) ||
        new Set(equipment.map((item) => item.id)).size !== equipment.length || new Set(equipment.map((item) => item.name)).size !== equipment.length) {
        throw new Error("備品の保存データの形式が正しくありません。上書きを防ぐため登録を停止しています。");
      }
      const merged = new Map(equipment.map((item) => [item.id, item]));
      // 従来の貸出・予約に登場する備品も、保存データを消さず選択肢へ引き継ぐ。
      for (const item of app.readLoanRecords(storage)) {
        if (!merged.has(item.equipmentId)) merged.set(item.equipmentId, { id: item.equipmentId, name: item.itemName, createdAt: item.createdAt });
      }
      const items = Array.from(merged.values());
      if (new Set(items.map((item) => item.name)).size !== items.length) throw new Error("備品名が複数の管理IDに登録されています。保存データを確認してください。");
      return items;
    }
    return {
      async getAllEquipment() { return readEquipment(); },
      async addEquipment(value) {
        const name = typeof value === "string" ? value.trim() : "";
        if (!name) throw new Error("備品名を入力してください。");
        if (name.length > app.MAX_INPUT_LENGTH) throw new Error(`備品名は${app.MAX_INPUT_LENGTH}文字以内で入力してください。`);
        const equipment = readEquipment();
        if (equipment.some((item) => item.name === name)) throw new Error("この備品名はすでに登録されています。複数台ある場合は名前を分けてください。");
        const item = { id: app.createId(), name, createdAt: now().toISOString() };
        storage.save(app.EQUIPMENT_STORAGE_KEY, [...equipment, item]);
        return item;
      },
    };
  };
})();
