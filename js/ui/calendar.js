"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.initializeCalendar = () => {
    const dialog = document.getElementById("calendar-dialog");
    const grid = document.getElementById("calendar-days");
    const heading = document.getElementById("calendar-month");
    const previous = document.getElementById("calendar-previous");
    let input;
    let displayed;
    function render() {
      const year = displayed.getFullYear();
      const month = displayed.getMonth();
      heading.textContent = `${year}年${month + 1}月`;
      const minimum = input.min > app.today() ? input.min : app.today();
      previous.disabled = `${year}-${String(month + 1).padStart(2, "0")}` <= minimum.slice(0, 7);
      const cells = [];
      const firstWeekday = new Date(year, month, 1).getDay();
      for (let index = 0; index < firstWeekday; index++) cells.push(document.createElement("span"));
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= lastDay; day++) {
        const value = app.toLocalDate(new Date(year, month, day));
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(day);
        button.dataset.date = value;
        button.disabled = value < minimum;
        button.setAttribute("aria-label", `${year}年${month + 1}月${day}日`);
        button.setAttribute("aria-pressed", String(input.value === value));
        if (value === app.today()) button.setAttribute("aria-current", "date");
        cells.push(button);
      }
      grid.replaceChildren(...cells);
    }
    document.querySelectorAll("[data-calendar-for]").forEach((button) => {
      button.addEventListener("click", () => {
        input = document.getElementById(button.dataset.calendarFor);
        if (input.readOnly) return;
        const minimum = input.min > app.today() ? input.min : app.today();
        const initial = app.isValidDate(input.value) && input.value >= minimum ? input.value : minimum;
        displayed = new Date(`${initial}T12:00:00`);
        displayed.setDate(1);
        document.getElementById("calendar-title").textContent = input.id === "start-date" ? "利用開始日を選択" : "返却予定日を選択";
        render();
        dialog.showModal();
      });
    });
    previous.addEventListener("click", () => { displayed.setMonth(displayed.getMonth() - 1); render(); });
    document.getElementById("calendar-next").addEventListener("click", () => { displayed.setMonth(displayed.getMonth() + 1); render(); });
    document.getElementById("calendar-close").addEventListener("click", () => dialog.close());
    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-date]");
      if (!button || button.disabled) return;
      input.value = button.dataset.date;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      dialog.close();
      input.focus();
    });
  };
})();
