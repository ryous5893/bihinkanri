"use strict";
(() => {
  const app = window.EquipmentLoans;
  function cell(text) {
    const element = document.createElement("td");
    element.textContent = text;
    return element;
  }
  function actionButton(item, action, text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-return";
    button.dataset.action = action;
    button.dataset.itemId = item.id;
    if (action === "return") button.dataset.returnId = item.id;
    button.textContent = text;
    button.setAttribute("aria-label", `${item.itemName}（${item.borrowerName}）: ${text}`);
    return button;
  }
  const views = {
    reserved: { label: "予約中", description: "利用開始日の近い予約から表示します。", empty: "「予約・貸出を登録する」から新しい予約を登録できます。" },
    borrowed: { label: "貸出中", description: "期限超過を先頭に、返却予定日の近い順に表示します。翌朝10時までは猶予があります。", empty: "予約中の備品で「貸出する」を押すと、ここに表示されます。" },
    returned: { label: "返却済", description: "返却した日時が新しい順に表示します。", empty: "備品を返却すると、返却日時と一緒にここに記録されます。" },
  };
  app.renderItemList = (items, now = new Date(), status = app.ITEM_STATUS.RESERVED) => {
    const today = app.toLocalDate(now);
    const rows = document.createDocumentFragment();
    const ordered = items.filter((item) => item.status === status).sort((left, right) => {
      if (status === app.ITEM_STATUS.RETURNED) return Date.parse(right.returnedAt) - Date.parse(left.returnedAt);
      const overdueOrder = Number(app.isOverdue(right, now)) - Number(app.isOverdue(left, now));
      if (overdueOrder) return overdueOrder;
      const dateField = status === app.ITEM_STATUS.RESERVED ? "startDate" : "dueDate";
      return left[dateField].localeCompare(right[dateField]) || Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
    for (const item of ordered) {
      const overdue = app.isOverdue(item, now);
      const row = document.createElement("tr");
      if (overdue) row.className = "overdue-row";
      const dueCell = cell(app.formatDate(item.dueDate));
      if (overdue) {
        const note = document.createElement("span");
        note.className = "overdue-note";
        note.textContent = `${app.daysBetween(item.dueDate, today)}日超過・未返却`;
        dueCell.append(note);
      }
      row.append(cell(item.itemName), cell(item.borrowerName), cell(app.formatDate(item.startDate)), dueCell);
      const statusCell = cell("");
      const badge = document.createElement("span");
      badge.className = `status-badge status-${overdue ? "overdue" : item.status}`;
      badge.textContent = overdue ? "期限超過" : app.STATUS_LABELS[item.status];
      statusCell.append(badge);
      const actionCell = cell("");
      if (item.status === app.ITEM_STATUS.BORROWED) {
        actionCell.append(actionButton(item, "return", "返却"));
      } else if (item.status === app.ITEM_STATUS.RESERVED) {
        const start = actionButton(item, "start", "貸出する");
        const unavailable = app.reservationAvailability(item, items, today);
        start.disabled = Boolean(unavailable);
        actionCell.append(start, actionButton(item, "edit", "編集"), actionButton(item, "cancel", "予約取消"));
        if (unavailable) {
          const note = document.createElement("p");
          note.className = "action-note";
          note.textContent = unavailable;
          actionCell.append(note);
        }
        if (item.dueDate < today) badge.textContent = "予約期間終了";
      } else {
        actionCell.textContent = "完了";
        actionCell.className = "completed";
      }
      const returnedCell = cell(app.formatDateTime(item.returnedAt));
      returnedCell.hidden = status !== app.ITEM_STATUS.RETURNED;
      actionCell.hidden = status === app.ITEM_STATUS.RETURNED;
      row.append(statusCell, returnedCell, actionCell);
      rows.append(row);
    }
    document.getElementById("item-list").replaceChildren(rows);
    document.getElementById("empty-state").hidden = ordered.length !== 0;
    document.getElementById("table-container").hidden = ordered.length === 0;
    document.getElementById("item-count").textContent = `${ordered.length}件`;
    for (const state of Object.keys(views)) document.getElementById(`count-${state}`).textContent = String(items.filter((item) => item.status === state).length);
    const view = views[status];
    document.getElementById("list-title").textContent = `${view.label}の備品`;
    document.getElementById("list-description").textContent = view.description;
    document.getElementById("empty-title").textContent = `${view.label}の備品はありません`;
    document.getElementById("empty-description").textContent = view.empty;
    document.getElementById("loan-table").dataset.status = status;
    document.getElementById("returned-at-heading").hidden = status !== app.ITEM_STATUS.RETURNED;
    document.getElementById("action-heading").hidden = status === app.ITEM_STATUS.RETURNED;
    const overdueCount = items.filter((item) => app.isOverdue(item, now)).length;
    const summary = document.getElementById("overdue-summary");
    summary.hidden = overdueCount === 0;
    summary.textContent = `返却期限を過ぎた貸出が${overdueCount}件あります。「貸出中」タブで利用者に返却を確認してください。`;
    const cancelled = items.filter((item) => item.status === app.ITEM_STATUS.CANCELLED).sort((left, right) => Date.parse(right.cancelledAt) - Date.parse(left.cancelledAt));
    document.getElementById("cancelled-history").hidden = cancelled.length === 0;
    document.getElementById("count-cancelled").textContent = `${cancelled.length}件`;
    document.getElementById("cancelled-list").replaceChildren(...cancelled.map((item) => {
      const row = document.createElement("tr");
      row.append(cell(item.itemName), cell(item.borrowerName), cell(app.formatDate(item.startDate)), cell(app.formatDate(item.dueDate)), cell(app.formatDateTime(item.cancelledAt)));
      return row;
    }));
  };
  app.renderEquipment = (equipment) => {
    const list = document.getElementById("equipment-list");
    const names = equipment.map((item) => {
      const entry = document.createElement("li");
      entry.textContent = item.name;
      return entry;
    });
    list.replaceChildren(...names);
    document.getElementById("equipment-empty").hidden = equipment.length !== 0;
  };
})();
