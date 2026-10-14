"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.createLoanForm = (form) => {
    const type = form.elements.status;
    const start = form.elements.startDate;
    const due = form.elements.dueDate;
    const picker = app.createEquipmentPicker(form.elements.equipmentId);
    let previousStart = "";
    let editing = false;
    function syncDates() {
      const today = app.today();
      start.min = today;
      start.readOnly = type.value === app.ITEM_STATUS.BORROWED;
      document.querySelector('[data-calendar-for="start-date"]').disabled = start.readOnly;
      if (start.readOnly) start.value = today;
      if (!due.value || due.value === previousStart) due.value = start.value;
      due.min = start.value || today;
      previousStart = start.value;
      document.getElementById("register-button").textContent = editing ? "変更を保存する" : start.readOnly ? "貸出を登録する" : "予約を登録する";
    }
    type.addEventListener("change", syncDates);
    start.addEventListener("change", syncDates);
    const reset = () => {
      form.reset();
      start.value = due.value = app.today();
      syncDates();
      app.showFieldErrors({});
    };
    form.elements.borrowerName.maxLength = app.MAX_INPUT_LENGTH;
    reset();
    return {
      reset,
      read: () => ({
        ...Object.fromEntries(["borrowerName", "status", "startDate", "dueDate"].map((field) => [field, form.elements[field].value])),
        equipmentId: picker.getSelected()[0]?.id || "",
        itemName: picker.getSelected()[0]?.name || "",
      }),
      readAll() {
        const common = this.read();
        return picker.getSelected().map((item) => ({ ...common, equipmentId: item.id, itemName: item.name }));
      },
      setEquipment: picker.setEquipment,
      edit(item) {
        editing = true;
        type.value = app.ITEM_STATUS.RESERVED;
        type.disabled = true;
        picker.edit(item);
        form.elements.borrowerName.value = item.borrowerName;
        start.value = item.startDate;
        due.value = item.dueDate;
        previousStart = item.startDate;
        syncDates();
      },
      syncDates,
    };
  };
})();
