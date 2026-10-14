"use strict";
(() => {
  const app = window.EquipmentLoans;
  function createId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  app.createId = createId;
  app.legacyEquipmentId = (name) => `legacy:${encodeURIComponent(name)}`;
  app.createItem = (values, now = new Date()) => ({
    id: createId(), itemName: values.itemName, borrowerName: values.borrowerName,
    equipmentId: values.equipmentId,
    status: values.status ?? app.ITEM_STATUS.BORROWED,
    startDate: values.startDate ?? app.toLocalDate(now), dueDate: values.dueDate ?? values.startDate ?? app.toLocalDate(now),
    createdAt: now.toISOString(),
    borrowedAt: values.status === app.ITEM_STATUS.RESERVED ? null : now.toISOString(),
    returnedAt: null, cancelledAt: null,
  });
  app.normalizeItem = (item) => {
    // 旧形式の記録は元の貸出日を当日返却の予定日として補完する。
    if (item && item.startDate === undefined && item.dueDate === undefined &&
      [app.ITEM_STATUS.BORROWED, app.ITEM_STATUS.RETURNED].includes(item.status) &&
      typeof item.borrowedAt === "string" && Number.isFinite(Date.parse(item.borrowedAt))) {
      const startDate = app.toLocalDate(new Date(item.borrowedAt));
      item = { ...item, startDate, dueDate: startDate, createdAt: item.borrowedAt, cancelledAt: null };
    }
    if (item && typeof item.itemName === "string" && item.equipmentId === undefined) {
      return { ...item, equipmentId: app.legacyEquipmentId(item.itemName) };
    }
    return item;
  };
  app.isValidItem = (item) => {
    if (!item || typeof item !== "object") return false;
    const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
    const { BORROWED, RETURNED, RESERVED, CANCELLED } = app.ITEM_STATUS;
    const validStatus = [BORROWED, RETURNED, RESERVED, CANCELLED].includes(item.status);
    const validBorrowedAt = [BORROWED, RETURNED].includes(item.status) ? validDate(item.borrowedAt) : item.borrowedAt === null;
    return typeof item.id === "string" && Boolean(item.id.trim()) &&
      typeof item.equipmentId === "string" && Boolean(item.equipmentId.trim()) &&
      Object.keys(app.validateNames(item).errors).length === 0 && validStatus && validDate(item.createdAt) &&
      app.isValidDate(item.startDate) && app.isValidDate(item.dueDate) && item.startDate <= item.dueDate && validBorrowedAt &&
      (item.status === RETURNED ? validDate(item.returnedAt) : item.returnedAt === null) &&
      (item.status === CANCELLED ? validDate(item.cancelledAt) : item.cancelledAt === null);
  };
})();
