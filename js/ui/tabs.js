"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.createStatusTabs = (onChange) => {
    const fileMode = window.location.protocol === "file:";
    const storage = app.createStorageService();
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const validStatuses = tabs.map((tab) => tab.dataset.status);
    let requested = window.location.hash.slice(1);
    if (fileMode) {
      try { requested = storage.load(app.SELECTED_TAB_STORAGE_KEY); }
      catch (error) { app.showMessage(error.message, "error"); }
    }
    const result = new URLSearchParams(window.location.search).get("result");
    // 登録画面から戻ったときは操作結果を、再読み込み時は保存したタブを優先する。
    if (fileMode && window.performance.getEntriesByType("navigation")[0]?.type !== "reload") {
      if (result === "borrowed") requested = app.ITEM_STATUS.BORROWED;
      else if (["reserved", "edited"].includes(result)) requested = app.ITEM_STATUS.RESERVED;
    }
    let selected = validStatuses.includes(requested) ? requested : result === "borrowed" ? app.ITEM_STATUS.BORROWED : app.ITEM_STATUS.RESERVED;
    function select(status, focus = false, notify = true) {
      if (!validStatuses.includes(status)) return;
      selected = status;
      for (const tab of tabs) {
        const active = tab.dataset.status === status;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active && focus) tab.focus();
      }
      document.getElementById("loan-panel").setAttribute("aria-labelledby", `tab-${status}`);
      if (fileMode) {
        // file://ではURLを変更せず、選択を保存領域に保持する。
        try { storage.save(app.SELECTED_TAB_STORAGE_KEY, status); }
        catch (error) { app.showMessage(error.message, "error"); }
      } else {
        window.history.replaceState(null, "", `#${status}`);
      }
      if (notify) onChange(status);
    }
    for (const tab of tabs) {
      tab.addEventListener("click", () => select(tab.dataset.status));
      tab.addEventListener("keydown", (event) => {
        const index = tabs.indexOf(tab);
        const targets = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
        if (targets[event.key] === undefined) return;
        event.preventDefault();
        select(tabs[targets[event.key]].dataset.status, true);
      });
    }
    window.addEventListener("hashchange", () => select(window.location.hash.slice(1)));
    select(selected, false, false);
    return { select, getSelected: () => selected };
  };
})();
