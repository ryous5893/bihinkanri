"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.toLocalDate = (date) => {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  app.today = () => app.toLocalDate(new Date());
  app.isValidDate = (value) => {
    if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
  };
  app.formatDate = (value) => value.replaceAll("-", "/");
  app.formatDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    const pad = (part) => String(part).padStart(2, "0");
    return `${app.formatDate(app.toLocalDate(date))} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };
  app.returnDeadline = (dueDate) => {
    const [year, month, day] = dueDate.split("-").map(Number);
    return new Date(year, month - 1, day + 1, 10, 0, 0);
  };
  app.daysBetween = (start, end) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
})();
