"use strict";
(() => {
  const app = window.EquipmentLoans;
  const { BORROWED, RESERVED } = app.ITEM_STATUS;
  app.isOverdue = (item, now = new Date()) => item.status === BORROWED && now.getTime() > app.returnDeadline(item.dueDate).getTime();
  app.reservationAvailability = (item, items, today = app.today()) => {
    if (item.startDate > today) return "利用開始日から貸出できます。";
    if (item.dueDate < today) return "予約期間が終了しています。取消後に登録し直してください。";
    if (items.some((other) => other.id !== item.id && other.equipmentId === item.equipmentId && other.status === BORROWED)) {
      return "前の利用者がまだ返却していないため貸出できません。";
    }
    return "";
  };
  app.findConflict = (items, candidate, today = app.today()) => items.find((item) => {
    if (item.id === candidate.id || item.equipmentId !== candidate.equipmentId || ![BORROWED, RESERVED].includes(item.status)) return false;
    // 貸出時は予定日に関係なく、現物が返却されるまで二重貸出しない。
    if (candidate.status === BORROWED && item.status === BORROWED) return true;
    const endDate = item.status === BORROWED && item.dueDate < today ? today : item.dueDate;
    return candidate.startDate <= endDate && item.startDate <= candidate.dueDate;
  });
})();
