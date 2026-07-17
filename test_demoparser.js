const fs = require('fs');
const path = require('path');

async function test() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const apiKey = envContent.match(/FACEIT_API_KEY=(.*)/)[1].trim();
  const matchId = "1-ffa58f00-441c-44be-ae01-8e3c0de5dce1";
  
  console.log("Fetching match details from FACEIT...");
  const res = await fetch(`https://open.faceit.com/data/v4/matches/${matchId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const matchData = await res.json();
  const demoUrl = matchData.demo_url[0];
  console.log("Demo URL:", demoUrl);
  
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  
  const compressedPath = path.join(tmpDir, 'test.dem.zst');
  const decompressedPath = path.join(tmpDir, 'test.dem');
  
  console.log("Downloading demo...");
  const demoRes = await fetch(demoUrl);
  const buffer = await demoRes.arrayBuffer();
  fs.writeFileSync(compressedPath, Buffer.from(buffer));
  console.log("Downloaded. Decompressing...");
  
  const fzstd = require('fzstd');
  const compressedData = fs.readFileSync(compressedPath);
  const decompressedData = fzstd.decompress(compressedData);
  fs.writeFileSync(decompressedPath, decompressedData);
  console.log("Decompressed. Parsing...");
  
  const demoparser = require('@laihoe/demoparser2');
  const rawDeaths = demoparser.parseEvent(decompressedPath, "player_death", ["X", "Y"]);
  
  console.log("=== PARSED DEATH SAMPLE ===");
  if (rawDeaths.length > 0) {
    console.log(JSON.stringify(rawDeaths[0], null, 2));
  } else {
    console.log("No deaths parsed.");
  }
}

test().catch(console.error);
