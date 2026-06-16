// Supabase Edge Function - 自助卡密领取系统 API
// 部署: supabase functions deploy website1 --project-ref <PROJECT_REF>

const BASE_URL = "https://hxdf.goo7ch.top";
const USERNAME = "benben29";
const PASSWORD = "ee240b4c134aee7b598ef2252e8215d0";
const IS_SUB = 0;

const CHANNELS = [
  { id: 3052, name: "79折小小额Q币，单笔1-40，押金30", group: "Q币充值" },
  { id: 40142, name: "86折小额Q币，单笔10-50，押金70", group: "Q币充值" },
  { id: 40163, name: "9折中额Q币，单笔50-99，押金250", group: "Q币充值" },
  { id: 40153, name: "83折王者点券，单笔100起，押金70", group: "王者点券" },
  { id: 40168, name: "88折王者点券，单笔500起，押金250", group: "王者点券" },
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function loginToWebsite2() {
  const formData = new URLSearchParams();
  formData.append("username", USERNAME);
  formData.append("sid", "");
  formData.append("is_sub", String(IS_SUB));
  formData.append("password", PASSWORD);
  formData.append("googleCode", "");

  const res = await fetch(`${BASE_URL}/api_group/Login/DoLogin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  const result = await res.json();
  if (result.status === 0) {
    return { success: true, sid: result.data.sid };
  }
  return { success: false, error: result.msg ?? "登录失败" };
}

async function generateCard(sid, channelId, cardName) {
  const body = JSON.stringify({
    username: USERNAME,
    sid,
    is_sub: IS_SUB,
    is_batch: 0,
    pay_types: channelId,
    limit_order_money: 0,
    limit_order_amount: 4,
    state: 1,
    monicker: cardName,
  });

  const res = await fetch(`${BASE_URL}/api_group/Account/generateCardKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const result = await res.json();
  if (result.status === 0) {
    return { success: true, url: result.data.url };
  }
  return { success: false, error: result.msg ?? "生成卡密失败" };
}

const STATIC_CACHE = new Map();

async function loadStaticFiles() {
  const files = ["index.html", "styles.css", "app.js", "bg.png"];
  for (const name of files) {
    try {
      const data = await Deno.readFile(`./static/${name}`);
      const ext = name.match(/\.\w+$/)?.[0] ?? "";
      STATIC_CACHE.set(name, { data, mime: MIME_TYPES[ext] ?? "application/octet-stream" });
    } catch {}
  }
}

const staticLoadPromise = loadStaticFiles();

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function staticResponse(cached) {
  return new Response(cached.data, {
    status: 200,
    headers: {
      "Content-Type": cached.mime,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function notFoundResponse() {
  return new Response("404 Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function handler(req) {
  const url = new URL(req.url);
  const method = req.method;
  await staticLoadPromise;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }});
  }

  const p = url.pathname;

  if (p === "/api/channels" && method === "GET") {
    return jsonResponse({ success: true, channels: CHANNELS });
  }

  if (p === "/api/generate-card" && method === "POST") {
    try {
      const { channelId } = await req.json();
      if (!channelId) return jsonResponse({ success: false, error: "请选择充值档位" });
      const login = await loginToWebsite2();
      if (!login.success) return jsonResponse({ success: false, error: "系统登录失败: " + login.error });
      const name = "auto_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const card = await generateCard(login.sid, channelId, name);
      return jsonResponse(card.success ? { success: true, url: card.url } : { success: false, error: card.error });
    } catch {
      return jsonResponse({ success: false, error: "请求格式错误" });
    }
  }

  const fn = p === "/" || p === "" ? "index.html" : p.slice(1);
  if (fn.includes("..")) return notFoundResponse();
  const cached = STATIC_CACHE.get(fn);
  return cached ? staticResponse(cached) : notFoundResponse();
}

Deno.serve(handler);
