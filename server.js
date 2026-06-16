const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.WEBSITE2_URL || 'https://hxdf.goo7ch.top';

const CONFIG = {
  username: process.env.WEBSITE2_USERNAME || '',
  password: process.env.WEBSITE2_PASSWORD || '',
  is_sub: 0
};

const CHANNELS = [
  { id: 3052, name: '79折小小额Q币，单笔1-40，押金30', group: 'Q币充值', prompt: '' },
  { id: 40142, name: '86折小额Q币，单笔10-50，押金70', group: 'Q币充值', prompt: '' },
  { id: 40163, name: '9折中额Q币，单笔50-99，押金250', group: 'Q币充值', prompt: '' },
  { id: 40153, name: '83折王者点券，单笔100起，押金70', group: '王者点券', prompt: '' },
  { id: 40168, name: '88折王者点券，单笔500起，押金250', group: '王者点券', prompt: '' }
];

function httpsRequest(url, method, data, contentType) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = { hostname: urlObj.hostname, port: 443, path: urlObj.pathname + urlObj.search, method, headers: { 'User-Agent': 'Mozilla/5.0' }, rejectUnauthorized: false };
    if (data) { options.headers['Content-Type'] = contentType || 'application/x-www-form-urlencoded'; options.headers['Content-Length'] = Buffer.byteLength(data); }
    const req = https.request(options, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { resolve({ status: 1, msg: b }); } }); });
    req.on('error', e => reject(e));
    if (data) req.write(data);
    req.end();
  });
}

async function loginToWebsite2() {
  if (!CONFIG.username || !CONFIG.password) return { success: false, error: '请在环境变量中配置网站2的账号密码' };
  const fd = `username=${CONFIG.username}&sid=&is_sub=${CONFIG.is_sub}&password=${CONFIG.password}&googleCode=`;
  const r = await httpsRequest(BASE_URL + '/api_group/Login/DoLogin', 'POST', fd, 'application/x-www-form-urlencoded');
  return r.status === 0 ? { success: true, sid: r.data.sid } : { success: false, error: r.msg };
}

async function generateCard(sid, channelId, cardName) {
  const pd = JSON.stringify({ username: CONFIG.username, sid, is_sub: CONFIG.is_sub, is_batch: 0, pay_types: channelId, limit_order_money: 0, limit_order_amount: 4, state: 1, monicker: cardName });
  const r = await httpsRequest(BASE_URL + '/api_group/Account/generateCardKey', 'POST', pd, 'application/json');
  return r.status === 0 ? { success: true, url: r.data.url } : { success: false, error: r.msg };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url === '/api/channels' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true, channels: CHANNELS })); return; }
  if (req.url === '/api/generate-card' && req.method === 'POST') {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', async () => {
      try {
        const { channelId } = JSON.parse(b);
        if (!channelId) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: '请选择充值档位' })); return; }
        const login = await loginToWebsite2();
        if (!login.success) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: login.error })); return; }
        const cn = 'auto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const card = await generateCard(login.sid, channelId, cn);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(card.success ? { success: true, url: card.url } : { success: false, error: card.error }));
      } catch(e) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: '请求格式错误' })); }
    });
    return;
  }
  let fp = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  try { const c = fs.readFileSync(fp); res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(c); }
  catch(e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); }
});

server.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
