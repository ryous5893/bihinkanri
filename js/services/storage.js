"use strict";
(() => {
  class StorageError extends Error {}
  function createStorageService(getStorage = () => window.localStorage) {
    return {
      load(key) {
        let raw;
        try { raw = getStorage().getItem(key); }
        catch { throw new StorageError("ブラウザの保存領域を読み込めません。ブラウザの設定を確認し、再読み込みしてください。"); }
        if (raw === null) return [];
        try { return JSON.parse(raw); }
        catch { throw new StorageError("保存データが壊れているため読み込めません。データの上書きを防ぐため登録を停止しています。"); }
      },
      save(key, items) {
        try { getStorage().setItem(key, JSON.stringify(items)); }
        catch { throw new StorageError("データの保存に失敗しました。ブラウザの空き容量や保存設定を確認し、もう一度お試しください。"); }
      },
    };
  }
  window.EquipmentLoans.createStorageService = createStorageService;
})();
