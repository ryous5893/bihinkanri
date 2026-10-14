"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.createEquipmentPicker = (select) => {
    const search = document.getElementById("reservation-search");
    const chips = document.getElementById("selected-equipment");
    const count = document.getElementById("selection-count");
    let equipment = [];
    let selected = new Set();
    let editing = false;
    function render() {
      const value = select.value;
      const query = search.value.trim().normalize("NFKC").toLocaleLowerCase();
      const matches = equipment.filter((item) => item.name.normalize("NFKC").toLocaleLowerCase().includes(query));
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = !equipment.length ? "一覧ページで備品を登録してください" : !matches.length ? "一致する備品がありません" : "備品を選択してください";
      const options = matches.map((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        return option;
      });
      select.replaceChildren(placeholder, ...options);
      select.value = matches.some((item) => item.id === value) ? value : "";
      select.disabled = !equipment.length;
      chips.replaceChildren(...Array.from(selected, (id) => {
        const item = equipment.find((entry) => entry.id === id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "selection-chip";
        button.textContent = `${item.name} ×`;
        button.setAttribute("aria-label", `${item.name}の選択を解除`);
        button.addEventListener("click", () => {
          selected.delete(id);
          if (select.value === id) select.value = "";
          render();
        });
        return button;
      }));
      count.textContent = `${selected.size}件選択中`;
    }
    search.addEventListener("input", render);
    select.addEventListener("change", () => {
      if (select.value) {
        if (editing) selected.clear();
        selected.add(select.value);
      } else if (editing) selected.clear();
      render();
    });
    return {
      setEquipment(items) { equipment = items; render(); },
      edit(item) { editing = true; selected = new Set([item.equipmentId]); select.value = item.equipmentId; render(); },
      getSelected: () => equipment.filter((item) => selected.has(item.id)),
    };
  };
})();
