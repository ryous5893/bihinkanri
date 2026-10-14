const { test } = require('node:test');
const createBrowser = require('./helpers/browser.cjs');
const verifyWorkflow = require('./helpers/workflow-browser.cjs');
const verifyTabs = require('./helpers/tabs-browser.cjs');

test('備品登録・予約・編集・カレンダー・返却・猶予とページ遷移をブラウザで検証', { timeout: 60000 }, async (t) => {
  const browser = await createBrowser(t);
  await verifyWorkflow(browser);
  await verifyTabs(browser);
});
