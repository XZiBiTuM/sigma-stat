const http = require("http");

const HUB_ID = "456d9be7-593b-4ce0-bbbb-f26ff9ca37ed";
const PORT = process.env.PORT || 3000;
const INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

function pingEndpoint(path) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve(`[${res.statusCode}] ${path}`);
      });
    }).on("error", (err) => {
      resolve(`[ERROR] ${path}: ${err.message}`);
    });
  });
}

async function syncAll() {
  console.log(`[${new Date().toISOString()}] Starting background sync...`);
  try {
    const r1 = await pingEndpoint(`/api/faceit/hubs/${HUB_ID}/members`);
    const r2 = await pingEndpoint(`/api/faceit/hubs/${HUB_ID}/matches`);
    const r3 = await pingEndpoint(`/api/faceit/hubs/${HUB_ID}/tournaments`);
    const r4 = await pingEndpoint(`/api/faceit/hubs/${HUB_ID}/leaderboards/general?limit=50`);
    console.log(`[SYNC COMPLETE] ${r1} | ${r2} | ${r3} | ${r4}`);
  } catch (e) {
    console.error("Sync error:", e);
  }
}

// Run immediately, then every 3 minutes
syncAll();
setInterval(syncAll, INTERVAL_MS);
