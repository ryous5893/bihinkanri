"use strict";
(() => {
  const app = window.EquipmentLoans;
  const storage = app.createStorageService();
  const repository = app.createItemRepository(storage);
  const equipmentRepository = app.createEquipmentRepository(storage);
  const form = document.getElementById("equipment-form");
  const input = document.getElementById("equipment-name");
  const button = document.getElementById("equipment-register-button");
  let busy = false;
  let readable = false;
  let tabs;
  const controls = app.createListControls({ repository, equipmentRepository, refresh, run: performOperation, ready: () => readable && !busy, tabs: () => tabs });
  tabs = app.createStatusTabs(() => { controls.clearSelection(); controls.render(); });
  async function refresh() {
    const [items, equipment] = await Promise.all([repository.getAllItems(), equipmentRepository.getAllEquipment()]);
    controls.update(items, equipment);
  }
  async function initialize() {
    button.disabled = true;
    try {
      await refresh();
      readable = true;
      const result = new URLSearchParams(window.location.search).get("result");
      const messages = { reserved: "予約を登録しました。", borrowed: "貸出を登録しました。", edited: "予約の変更を保存しました。" };
      if (messages[result]) app.showMessage(messages[result]);
    } catch (error) { app.showMessage(error.message, "error"); }
    finally { button.disabled = !readable; controls.sync(); }
  }
  async function performOperation(action) {
    if (busy || !readable) return;
    busy = true;
    button.disabled = true;
    controls.sync();
    const buttons = Array.from(document.querySelectorAll("[data-action]"), (element) => ({ element, disabled: element.disabled }));
    buttons.forEach(({ element }) => { element.disabled = true; });
    try { await action(); }
    catch (error) { app.showMessage(error.message, "error"); }
    finally {
      busy = false;
      button.disabled = !readable;
      buttons.forEach(({ element, disabled }) => { element.disabled = disabled; });
      controls.sync();
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy || !readable) return;
    const error = document.getElementById("equipment-error");
    error.hidden = true;
    input.setAttribute("aria-invalid", "false");
    void performOperation(async () => {
      try {
        const equipment = await equipmentRepository.addEquipment(input.value);
        input.value = "";
        await refresh();
        app.showMessage(`${equipment.name}を備品として登録しました。`);
        input.focus();
      } catch (failure) {
        error.textContent = failure.message;
        error.hidden = false;
        input.setAttribute("aria-invalid", "true");
        input.focus();
        throw failure;
      }
    });
  });
  document.getElementById("item-list").addEventListener("click", (event) => {
    const element = event.target.closest("[data-action]");
    if (!element || element.disabled || busy) return;
    if (element.dataset.action === "edit") {
      window.location.assign(`reservation.html?edit=${encodeURIComponent(element.dataset.itemId)}`);
      return;
    }
    void performOperation(async () => {
      const actions = {
        return: { run: repository.returnItem, message: "返却を記録しました。" },
        start: { run: repository.startReservation, message: "予約から貸出を開始しました。" },
        cancel: { run: repository.cancelReservation, message: "予約を取り消しました。" },
      };
      const action = actions[element.dataset.action];
      const item = await action.run(element.dataset.itemId);
      await refresh();
      if (element.dataset.action === "start") tabs.select(app.ITEM_STATUS.BORROWED);
      app.showMessage(`${item.itemName}の${action.message}`);
    });
  });
  // 翌朝10時をまたいだときも、日付変更を待たず警告を更新する。
  const checkTime = () => {
    if (readable && !busy && !document.hidden) void refresh().catch((error) => app.showMessage(error.message, "error"));
  };
  window.addEventListener("focus", checkTime);
  document.addEventListener("visibilitychange", checkTime);
  window.setInterval(checkTime, 60000);
  void initialize();
})();
