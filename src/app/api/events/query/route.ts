import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// Read round history cache
const CACHE_FILE = path.join(process.cwd(), "src/lib/round_history_cache.json");

function getRoundCache(): Record<string, any> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(content || "{}");
    }
  } catch (e) {
    console.error("Error reading round cache:", e);
  }
  return {};
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { prompt = "", role = "USER" } = body;

    const lowerPrompt = prompt.toLowerCase().trim();
    const roundCache = getRoundCache();

    let eventType: "knife" | "ninja_defuse" | "collateral" | "noscope" | "ace" | "wallbang" | "general" = "general";
    let title = "Эвент статистика Mr.Chillout";
    let metricName = "Показатель";
    let description = "Специальная статистика по матчам Хаба";

    if (lowerPrompt.includes("нож") || lowerPrompt.includes("knife")) {
      eventType = "knife";
      title = "🔪 Король Ножевых Ранений";
      metricName = "Убийств с ножа";
      description = "Убийства холодным оружием (исключая разминочные раунды)";
    } else if (lowerPrompt.includes("ниндзя") || lowerPrompt.includes("ninja") || lowerPrompt.includes("дефуз") || lowerPrompt.includes("defuse")) {
      eventType = "ninja_defuse";
      title = "🥷 Ниндзя Разминирования (Ninja Defuse)";
      metricName = "Ninja Defuse";
      description = "Разминирование бомбы при наличии живых игроков в команде соперника";
    } else if (lowerPrompt.includes("коллатерал") || lowerPrompt.includes("collateral") || lowerPrompt.includes("1 выстрел") || lowerPrompt.includes("2 кил")) {
      eventType = "collateral";
      title = "🎯 Коллатерали (1 выстрел — 2 килла)";
      metricName = "Коллатералей";
      description = "Убийство 2 и более соперников одним выстрелом из снайперской винтовки";
    } else if (lowerPrompt.includes("носкоуп") || lowerPrompt.includes("noscope") || lowerPrompt.includes("без скопа") || lowerPrompt.includes("без прицела")) {
      eventType = "noscope";
      title = "🎯 Снайпер без скопа (Noscope)";
      metricName = "Noscope убийств";
      description = "Точные выстрелы из снайперской винтовки без прицеливания";
    } else if (lowerPrompt.includes("эйс") || lowerPrompt.includes("ace") || lowerPrompt.includes("5k") || lowerPrompt.includes("5 килл")) {
      eventType = "ace";
      title = "💥 Мастер Эйсов (5K Aces)";
      metricName = "Эйсов (5K)";
      description = "Уничтожение всей вражеской команды одним игроком за 1 раунд";
    } else if (lowerPrompt.includes("прострел") || lowerPrompt.includes("wallbang") || lowerPrompt.includes("сквозь")) {
      eventType = "wallbang";
      title = "🧱 Мастер Прострелов (Wallbangs)";
      metricName = "Прострелов";
      description = "Убийства соперников сквозь стены и препятствия";
    } else {
      title = "⭐ Эвент от Mr.Chillout: Специальная аналитика";
      metricName = "Баллы эвента";
      description = `Запрос: "${prompt}"`;
    }

    // Player stats accumulator: player_name -> { count, details: [...] }
    const playerMap: Record<string, { nickname: string; count: number; details: any[] }> = {};

    function addStat(player: string, detail: any) {
      if (!player || player === "Unknown" || player === "Bot") return;
      if (!playerMap[player]) {
        playerMap[player] = { nickname: player, count: 0, details: [] };
      }
      playerMap[player].count += 1;
      if (playerMap[player].details.length < 10) {
        playerMap[player].details.push(detail);
      }
    }

    // Scan all cached matches and round events
    for (const matchKey of Object.keys(roundCache)) {
      const matchData = roundCache[matchKey];
      if (!matchData) continue;

      const rounds = matchData.rounds || [];
      const deaths = matchData.deaths || [];

      if (eventType === "knife") {
        deaths.forEach((d: any) => {
          if (d.round > 1) {
            const w = (d.weapon || "").toLowerCase();
            if (w.includes("knife") || w.includes("bayonet") || w.includes("karambit") || w.includes("butterfly")) {
              addStat(d.attacker, {
                matchId: matchKey.split("_")[0],
                round: d.round,
                victim: d.victim,
                weapon: "Knife"
              });
            }
          }
        });
      } else if (eventType === "noscope") {
        deaths.forEach((d: any) => {
          if (d.noscope === true || d.isNoscope === true) {
            addStat(d.attacker, {
              matchId: matchKey.split("_")[0],
              round: d.round,
              victim: d.victim,
              weapon: d.weapon || "Sniper"
            });
          }
        });
      } else if (eventType === "wallbang") {
        deaths.forEach((d: any) => {
          if (d.thrusmoke === true || d.penetration === true || d.wallbang === true) {
            addStat(d.attacker, {
              matchId: matchKey.split("_")[0],
              round: d.round,
              victim: d.victim,
              weapon: d.weapon || "Rifle"
            });
          }
        });
      } else if (eventType === "ninja_defuse") {
        rounds.forEach((r: any) => {
          if (r.reason === "bomb_defused" || r.win_reason === "bomb_defused") {
            const livingEnemies = r.living_terrorists || r.living_t_count || 1;
            if (livingEnemies > 0 && r.defuser) {
              addStat(r.defuser, {
                matchId: matchKey.split("_")[0],
                round: r.round,
                livingEnemies: livingEnemies
              });
            }
          }
        });
      } else if (eventType === "ace") {
        const roundKills: Record<string, Record<string, number>> = {};
        deaths.forEach((d: any) => {
          if (!d.attacker) return;
          const key = `${matchKey}_r${d.round}`;
          if (!roundKills[key]) roundKills[key] = {};
          roundKills[key][d.attacker] = (roundKills[key][d.attacker] || 0) + 1;
        });

        Object.keys(roundKills).forEach((rk) => {
          const players = roundKills[rk];
          Object.keys(players).forEach((p) => {
            if (players[p] >= 5) {
              addStat(p, {
                matchId: matchKey.split("_")[0],
                kills: players[p]
              });
            }
          });
        });
      } else if (eventType === "collateral") {
        const killsByRound: Record<string, any[]> = {};
        deaths.forEach((d: any) => {
          if (!d.attacker) return;
          const key = `${matchKey}_r${d.round}_${d.attacker}`;
          if (!killsByRound[key]) killsByRound[key] = [];
          killsByRound[key].push(d);
        });

        Object.keys(killsByRound).forEach((key) => {
          const kills = killsByRound[key];
          if (kills.length >= 2) {
            kills.sort((a, b) => (a.time || 0) - (b.time || 0));
            for (let i = 0; i < kills.length - 1; i++) {
              const diff = Math.abs((kills[i + 1].time || 0) - (kills[i].time || 0));
              if (diff <= 0.15) {
                addStat(kills[i].attacker, {
                  matchId: matchKey.split("_")[0],
                  round: kills[i].round,
                  victims: [kills[i].victim, kills[i + 1].victim]
                });
                break;
              }
            }
          }
        });
      }
    }

    const leaderboard = Object.values(playerMap)
      .sort((a, b) => b.count - a.count)
      .map((item, index) => ({
        rank: index + 1,
        nickname: item.nickname,
        count: item.count,
        details: item.details
      }));

    return NextResponse.json({
      success: true,
      title,
      description,
      metricName,
      eventType,
      prompt,
      leaderboard
    });
  } catch (error: any) {
    console.error("Error in event query route:", error);
    return NextResponse.json({ error: error.message || "Ошибка при выполнении запроса" }, { status: 500 });
  }
}
