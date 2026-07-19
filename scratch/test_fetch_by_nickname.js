const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let apiKey = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('FACEIT_API_KEY=')) {
    apiKey = line.split('=')[1].trim().replace(/['"]/g, '');
  }
});

if (!apiKey) {
  console.error("FACEIT_API_KEY not found in .env.local!");
  process.exit(1);
}

async function test() {
  const url = "https://open.faceit.com/data/v4/players?nickname=XZiBiTuM";
  console.log(`Fetching from: ${url}`);
  
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    }
  });
  
  if (!res.ok) {
    console.error(`Error: ${res.status}`, await res.text());
    return;
  }
  
  const data = await res.json();
  console.log("Success! Player ID is:", data?.player_id);
  console.log("Nickname matches:", data?.nickname);
}

test();
