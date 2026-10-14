"use strict";
(() => {
  const app = window.EquipmentLoans;
  function validateNames(input) {
    const values = {};
    const errors = {};
    for (const [field, label] of [["itemName", "備品名"], ["borrowerName", "借りた人"]]) {
      values[field] = typeof input[field] === "string" ? input[field].trim() : "";
      if (!values[field]) errors[field] = `${label}を入力してください。`;
      else if (values[field].length > app.MAX_INPUT_LENGTH) {
        errors[field] = `${label}は${app.MAX_INPUT_LENGTH}文字以内で入力してください。`;
      }
    }
    return { values, errors };
  }
  app.validateNames = validateNames;
  app.validateLoanInput = (input, today = app.today()) => {
    const { values, errors } = validateNames(input);
    values.status = input.status === undefined ? app.ITEM_STATUS.BORROWED : input.status;
    values.startDate = input.startDate === undefined ? today : input.startDate;
    values.dueDate = input.dueDate === undefined ? values.startDate : input.dueDate;
    if (![app.ITEM_STATUS.BORROWED, app.ITEM_STATUS.RESERVED].includes(values.status)) errors.status = "登録種別を選択してください。";
    if (!app.isValidDate(values.startDate)) errors.startDate = "利用開始日を正しく入力してください。";
    else if (values.startDate < today) errors.startDate = "利用開始日は今日以降を指定してください。";
    else if (values.status === app.ITEM_STATUS.BORROWED && values.startDate !== today) errors.startDate = "貸出の開始日は今日です。別の日に利用する場合は予約を選択してください。";
    if (!app.isValidDate(values.dueDate)) errors.dueDate = "返却予定日を正しく入力してください。";
    else if (app.isValidDate(values.startDate) && values.dueDate < values.startDate) errors.dueDate = "返却予定日は利用開始日以降を指定してください。";
    return { values, errors, valid: Object.keys(errors).length === 0 };
  };
})();
