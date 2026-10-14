const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');

module.exports = async function createBrowser(t) {
  const root = path.resolve(__dirname, '../..');
  const fileMode = process.env.BROWSER_FILE_MODE === '1';
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'text/plain');
      response.end(data);
    });
  });
  if (!fileMode) {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'equipment-browser-'));
  const viewportWidth = Number(process.env.BROWSER_WIDTH || 390);
  const chrome = spawn(process.env.CHROME_PATH || '/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0',
    `--window-size=${viewportWidth},844`,
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let closeBrowser;
  t.after(async () => { if (closeBrowser) await closeBrowser(); chrome.kill(); });
  const browserUrl = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Chromeを起動できません: ${output.slice(-1200)}`)), 15000);
    chrome.on('error', (error) => { clearTimeout(timeout); reject(error); });
    chrome.on('exit', (code) => { clearTimeout(timeout); reject(new Error(`Chrome終了(${code}): ${output.slice(-1200)}`)); });
    chrome.stderr.on('data', (data) => {
      output += data.toString();
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const socket = new WebSocket(browserUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let requestId = 0;
  const pending = new Map();
  const exceptions = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (!message.id) return;
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    clearTimeout(task.timeout);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  };
  socket.onclose = () => {
    for (const task of pending.values()) {
      clearTimeout(task.timeout);
      task.reject(new Error(`Chromeとの接続が切断されました: ${task.description}`));
    }
    pending.clear();
  };
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const description = `${method} ${params.expression?.slice(0, 120) || ''}`;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chrome操作がタイムアウトしました: ${description}`));
      }, 10000);
      pending.set(id, { resolve, reject, timeout, description });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  closeBrowser = async () => { await send('Browser.close').catch(() => {}); socket.close(); };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const command = (method, params) => send(method, params, sessionId);
  await command('Runtime.enable');
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async function ready() {
    const started = Date.now();
    while (Date.now() - started < 5000) {
      const loaded = await evaluate(`Boolean(!window.navigationPending && document.readyState === 'complete' && window.EquipmentLoans &&
        (!(document.getElementById('register-button') || document.getElementById('equipment-register-button')).disabled || !document.getElementById('message').hidden))`);
      if (loaded) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('ページ起動タイムアウト');
  }
  async function settle() { await new Promise(resolve => setTimeout(resolve, 50)); await ready(); }

  const url = fileMode ? pathToFileURL(path.join(root, 'index.html')).href : `http://127.0.0.1:${server.address().port}/`;
  async function navigate(relativeUrl = '') {
    await evaluate('window.navigationPending = true');
    await command('Page.navigate', { url: new URL(relativeUrl, url).href });
    await ready();
  }
  async function reload() {
    await evaluate('window.navigationPending = true');
    await command('Page.reload');
    await ready();
  }
  await command('Page.navigate', { url });
  await ready();
  return { evaluate, command, ready, settle, navigate, reload, viewportWidth };
};
