"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.showMessage = (text, type = "success") => {
    const message = document.getElementById("message");
    message.textContent = text;
    message.className = type === "error" ? "message message-error" : "message";
    message.hidden = !text;
  };
  app.showFieldErrors = (errors) => {
    const fields = { itemName: "item-name", borrowerName: "borrower-name", status: "registration-type", startDate: "start-date", dueDate: "due-date" };
    for (const [field, id] of Object.entries(fields)) {
      const input = document.getElementById(id);
      const message = document.getElementById(`${id}-error`);
      input.setAttribute("aria-invalid", String(Boolean(errors[field])));
      message.textContent = errors[field] || "";
      message.hidden = !errors[field];
    }
    const firstField = Object.keys(errors)[0];
    if (firstField) document.getElementById(fields[firstField]).focus();
  };
})();
