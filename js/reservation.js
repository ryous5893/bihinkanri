"use strict";
(() => {
  const app = window.EquipmentLoans;
  const storage = app.createStorageService();
  const repository = app.createItemRepository(storage);
  const equipmentRepository = app.createEquipmentRepository(storage);
  const form = document.getElementById("loan-form");
  const button = document.getElementById("register-button");
  const loanForm = app.createLoanForm(form);
  const editingId = new URLSearchParams(window.location.search).get("edit");
  let busy = false;
  let readable = false;
  app.initializeCalendar();
  async function initialize() {
    button.disabled = true;
    try {
      const equipment = await equipmentRepository.getAllEquipment();
      loanForm.setEquipment(equipment);
      if (editingId) {
        const item = (await repository.getAllItems()).find((record) => record.id === editingId);
        if (!item || item.status !== app.ITEM_STATUS.RESERVED) throw new Error("編集できる予約が見つかりません。一覧に戻って確認してください。");
        loanForm.edit(item);
        document.getElementById("registration-title").textContent = "予約の編集";
        document.title = "予約の編集 | 備品貸出管理";
      }
      readable = equipment.length > 0;
      if (!readable) app.showMessage("まず一覧ページで備品名を登録してください。", "error");
    } catch (error) { app.showMessage(error.message, "error"); }
    finally { button.disabled = !readable; }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy || !readable) return;
    const result = app.validateLoanInput(loanForm.read());
    app.showFieldErrors(result.errors);
    if (!result.valid) { app.showMessage("入力内容を確認してください。", "error"); return; }
    busy = true;
    button.disabled = true;
    const save = editingId ? repository.editReservation(editingId, loanForm.read()) : repository.addItem(loanForm.read());
    void save.then((item) => {
      const result = editingId ? "edited" : item.status === app.ITEM_STATUS.RESERVED ? "reserved" : "borrowed";
      window.location.assign(`index.html?result=${result}`);
    }).catch((error) => {
      app.showMessage(error.message, "error");
      busy = false;
      button.disabled = false;
    });
  });
  window.addEventListener("focus", () => loanForm.syncDates());
  void initialize();
})();
