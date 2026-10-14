"use strict";
window.EquipmentLoans = {
  ITEM_STATUS: Object.freeze({ BORROWED: "borrowed", RETURNED: "returned", RESERVED: "reserved", CANCELLED: "cancelled" }),
  STATUS_LABELS: Object.freeze({ borrowed: "貸出中", returned: "返却済み", reserved: "予約中", cancelled: "予約取消済み" }),
  STORAGE_KEY: "equipment-loan-items",
  EQUIPMENT_STORAGE_KEY: "equipment-loan-equipment",
  SELECTED_TAB_STORAGE_KEY: "equipment-loan-selected-tab",
  MAX_INPUT_LENGTH: 100,
};
