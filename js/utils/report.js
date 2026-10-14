"use strict";
(() => {
  const app = window.EquipmentLoans;
  app.matchesSearch = (query, ...values) => {
    const normalize = (text) => text.normalize("NFKC").toLocaleLowerCase();
    const haystack = normalize(values.join(" "));
    return normalize(query).trim().split(/\s+/u).every((word) => haystack.includes(word));
  };
  app.equipmentStatistics = (equipment, items, now = new Date()) => equipment.map((entry) => {
    const records = items.filter((item) => item.equipmentId === entry.id);
    const count = (status) => records.filter((item) => item.status === status).length;
    return [entry.name, count("reserved"), count("borrowed"), count("returned"), count("cancelled"),
      records.filter((item) => app.isOverdue(item, now)).length, records.filter((item) => item.borrowedAt).length];
  });
  app.createStatisticsCsv = (equipment, items, now = new Date()) => {
    const escape = (value) => {
      let text = String(value);
      // 表計算ソフトで利用者の入力を数式として実行させない。
      if (/^[\s]*[=+@\-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [["備品名", "予約中件数", "貸出中件数", "返却済件数", "予約取消件数", "期限超過件数", "累計貸出回数"], ...app.equipmentStatistics(equipment, items, now)];
    return "\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
  };
  app.downloadStatistics = (equipment, items) => {
    const url = URL.createObjectURL(new Blob([app.createStatisticsCsv(equipment, items)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `備品利用統計_${app.today()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
