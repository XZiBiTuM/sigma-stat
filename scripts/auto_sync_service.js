const http = require("http");

const HUB_ID = "d0701937-8eba-4df9-8830-22137001c0bd";
const PORT = process.env.PORT || 3000;
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

function fetchJson(path) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(null);
        }
      });
    }).on("error", (err) => {
      resolve(null);
    });
  });
}

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
  console.log(`[${new Date().toISOString()}] Starting background sync for hub ${HUB_ID}...`);
  try {
    const r1 = await pingEndpoint(`/api/faceit/hubs/${HUB_ID}/members`);
    const r3 = await pingEndpoint(`/api/faceit/hubs/${HUB_ID}/tournaments`);
    const r4 = await pingEndpoint(`/api/faceit/hubs/${HUB_ID}/leaderboards/general?limit=50`);
    
    // Fetch matches and ensure their stats are cached
    const matchesData = await fetchJson(`/api/faceit/hubs/${HUB_ID}/matches?limit=30`);
    let statsPings = 0;
    if (matchesData && Array.isArray(matchesData.items)) {
      for (const m of matchesData.items.slice(0, 15)) {
        if (m.match_id) {
          await pingEndpoint(`/api/faceit/matches/${m.match_id}/stats`);
          statsPings++;
        }
      }
    }

    console.log(`[SYNC COMPLETE] ${r1} | ${r3} | ${r4} | Synced ${statsPings} match stats`);
  } catch (e) {
    console.error("Sync error:", e);
  }
}

// Run immediately, then every 2 minutes
syncAll();
setInterval(syncAll, INTERVAL_MS);
