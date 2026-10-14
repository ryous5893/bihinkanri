"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.createListControls = ({ repository, equipmentRepository, refresh, run, ready, tabs }) => {
    const equipmentSearch = document.getElementById("equipment-search");
    const borrowerSearch = document.getElementById("borrower-search");
    const selected = new Set();
    const all = document.getElementById("select-all-reservations");
    const start = document.getElementById("start-selected");
    let items = [];
    let equipment = [];
    function sync() {
      const eligible = Array.from(document.querySelectorAll('[data-reservation-id]:not(:disabled)'));
      all.checked = eligible.length > 0 && eligible.every((input) => selected.has(input.dataset.reservationId));
      all.indeterminate = eligible.some((input) => selected.has(input.dataset.reservationId)) && !all.checked;
      all.disabled = !ready() || !eligible.length;
      start.disabled = !ready() || !selected.size;
      start.textContent = `選択した予約をまとめて貸出（${selected.size}件）`;
      document.getElementById("bulk-register-button").disabled = !ready();
      document.getElementById("export-csv").disabled = !ready();
    }
    function render() {
      const filters = { equipment: equipmentSearch.value, borrower: borrowerSearch.value };
      app.renderItemList(items, new Date(), tabs().getSelected(), filters, selected);
      app.renderEquipment(equipment, items, filters);
      sync();
    }
    for (const search of [equipmentSearch, borrowerSearch]) search.addEventListener("input", () => { selected.clear(); render(); });
    document.getElementById("clear-search").addEventListener("click", () => { equipmentSearch.value = borrowerSearch.value = ""; selected.clear(); render(); equipmentSearch.focus(); });
    document.getElementById("item-list").addEventListener("change", (event) => {
      if (!event.target.matches("[data-reservation-id]")) return;
      const id = event.target.dataset.reservationId;
      if (event.target.checked) selected.add(id); else selected.delete(id);
      sync();
    });
    all.addEventListener("change", () => {
      document.querySelectorAll('[data-reservation-id]:not(:disabled)').forEach((input) => {
        input.checked = all.checked;
        if (all.checked) selected.add(input.dataset.reservationId); else selected.delete(input.dataset.reservationId);
      });
      sync();
    });
    start.addEventListener("click", () => void run(async () => {
      const borrowed = await repository.startReservations(Array.from(selected));
      selected.clear();
      await refresh();
      tabs().select(app.ITEM_STATUS.BORROWED);
      app.showMessage(`${borrowed.length}件の予約からまとめて貸出を開始しました。`);
    }));
    document.getElementById("bulk-equipment-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void run(async () => {
        const input = document.getElementById("bulk-equipment-names");
        const error = document.getElementById("bulk-equipment-error");
        error.hidden = true;
        input.setAttribute("aria-invalid", "false");
        try {
          const values = input.value.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
          const added = await equipmentRepository.addEquipmentBatch(values);
          input.value = "";
          await refresh();
          app.showMessage(`${added.length}件の備品を一括登録しました。`);
        } catch (failure) {
          error.textContent = failure.message;
          error.hidden = false;
          input.setAttribute("aria-invalid", "true");
          input.focus();
          throw failure;
        }
      });
    });
    document.getElementById("export-csv").addEventListener("click", () => void run(async () => {
      await refresh();
      app.downloadStatistics(equipment, items);
      app.showMessage("全備品・全期間の利用統計CSVを出力しました。");
    }));
    return {
      sync,
      render,
      clearSelection() { selected.clear(); },
      update(records, catalog) {
        items = records;
        equipment = catalog;
        for (const id of selected) {
          const item = items.find((record) => record.id === id);
          if (!item || item.status !== app.ITEM_STATUS.RESERVED || app.reservationAvailability(item, items)) selected.delete(id);
        }
        document.getElementById("stat-equipment").textContent = equipment.length;
        for (const status of ["reserved", "borrowed", "returned"]) document.getElementById(`stat-${status}`).textContent = items.filter((item) => item.status === status).length;
        render();
      },
    };
  };
})();
