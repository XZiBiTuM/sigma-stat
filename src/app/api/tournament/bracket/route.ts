import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const BRACKET_FILE = path.join(process.cwd(), "src/lib/tournament_bracket.json");
const PERSISTENT_FILE = path.join(process.cwd(), "..", "sigma_persistent_tournament_bracket.json");

export interface TeamLogo {
  mascot: string;
  badgeShape: "shield" | "hexagon" | "diamond" | "circle";
  primaryColor: string;
  secondaryColor: string;
  bgGradient: string;
}

export interface BracketTeam {
  id: string; // e.g. "team_1"
  name: string; // e.g. "Team nycujan"
  captain: string;
  players: string[];
  logo: TeamLogo;
}

export interface BracketMatch {
  id: string; // "m1", "m2", ... "m6"
  round: number; // 1, 2, 3
  team1Id: string;
  team2Id: string;
  score1: number | null;
  score2: number | null;
  map: string; // e.g. "de_mirage"
  status: "UPCOMING" | "LIVE" | "FINISHED";
  roomZone?: "vip" | "main" | null;
  scheduledTime?: string;
}

export interface BracketState {
  tournamentTitle: string;
  status: "NOT_STARTED" | "LIVE" | "COMPLETED";
  teams: BracketTeam[];
  matches: BracketMatch[];
  updatedAt: number;
}

const PRESET_LOGOS: TeamLogo[] = [
  {
    mascot: "🐺",
    badgeShape: "shield",
    primaryColor: "#00e5ff",
    secondaryColor: "#0070f3",
    bgGradient: "linear-gradient(135deg, rgba(0, 229, 255, 0.25), rgba(0, 112, 243, 0.45))"
  },
  {
    mascot: "🦅",
    badgeShape: "hexagon",
    primaryColor: "#c084fc",
    secondaryColor: "#7c4dff",
    bgGradient: "linear-gradient(135deg, rgba(192, 132, 252, 0.25), rgba(124, 77, 255, 0.45))"
  },
  {
    mascot: "🐯",
    badgeShape: "diamond",
    primaryColor: "#ff9100",
    secondaryColor: "#ff5252",
    bgGradient: "linear-gradient(135deg, rgba(255, 145, 0, 0.25), rgba(255, 82, 82, 0.45))"
  },
  {
    mascot: "⚡",
    badgeShape: "shield",
    primaryColor: "#ffd700",
    secondaryColor: "#ffab00",
    bgGradient: "linear-gradient(135deg, rgba(255, 215, 0, 0.25), rgba(255, 171, 0, 0.45))"
  }
];

export function generateDefaultBracket(captains: string[] = ["nycujan", "nika_jok", "XZiBiTuM", "massao61"], rosters: string[][] = []): BracketState {
  const teams: BracketTeam[] = [0, 1, 2, 3].map((idx) => {
    const cap = captains[idx] || ("Капитан " + (idx + 1));
    const roster = rosters[idx] && rosters[idx].length > 0 ? rosters[idx] : [cap];
    return {
      id: "team_" + (idx + 1),
      name: "Team " + cap,
      captain: cap,
      players: roster,
      logo: PRESET_LOGOS[idx % PRESET_LOGOS.length]
    };
  });

  // Standard 4-Team Round-Robin (3 Rounds, 2 matches per round = 6 matches total)
  // Round 1: Team 1 vs Team 4, Team 2 vs Team 3
  // Round 2: Team 1 vs Team 3, Team 4 vs Team 2
  // Round 3: Team 1 vs Team 2, Team 3 vs Team 4
  const matches: BracketMatch[] = [
    { id: "m1", round: 1, team1Id: "team_1", team2Id: "team_4", score1: null, score2: null, map: "de_mirage", status: "UPCOMING", roomZone: "vip" },
    { id: "m2", round: 1, team1Id: "team_2", team2Id: "team_3", score1: null, score2: null, map: "de_dust2", status: "UPCOMING", roomZone: "main" },
    { id: "m3", round: 2, team1Id: "team_1", team2Id: "team_3", score1: null, score2: null, map: "de_inferno", status: "UPCOMING", roomZone: "vip" },
    { id: "m4", round: 2, team1Id: "team_4", team2Id: "team_2", score1: null, score2: null, map: "de_nuke", status: "UPCOMING", roomZone: "main" },
    { id: "m5", round: 3, team1Id: "team_1", team2Id: "team_2", score1: null, score2: null, map: "de_ancient", status: "UPCOMING", roomZone: "vip" },
    { id: "m6", round: 3, team1Id: "team_3", team2Id: "team_4", score1: null, score2: null, map: "de_anubis", status: "UPCOMING", roomZone: "main" }
  ];

  return {
    tournamentTitle: "Sigma Cyber Cup: Round-Robin 5x5",
    status: "LIVE",
    teams,
    matches,
    updatedAt: Date.now()
  };
}

function readBracket(): BracketState {
  try {
    let target = BRACKET_FILE;
    if (fs.existsSync(PERSISTENT_FILE)) {
      target = PERSISTENT_FILE;
    }
    if (fs.existsSync(target)) {
      const data = fs.readFileSync(target, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to read bracket state:", e);
  }

  // Attempt to auto-initialize from active draft state if present
  try {
    const draftPath = path.join(process.cwd(), "src/lib/draft_state.json");
    const persistentDraft = path.join(process.cwd(), "..", "sigma_persistent_draft_state.json");
    let dTarget = draftPath;
    if (fs.existsSync(persistentDraft)) dTarget = persistentDraft;
    if (fs.existsSync(dTarget)) {
      const dData = JSON.parse(fs.readFileSync(dTarget, "utf8"));
      if (dData.captains && dData.teams) {
        const initial = generateDefaultBracket(dData.captains, dData.teams);
        writeBracket(initial);
        return initial;
      }
    }
  } catch {}

  const defaultBracket = generateDefaultBracket();
  writeBracket(defaultBracket);
  return defaultBracket;
}

function writeBracket(data: BracketState) {
  try {
    const dir = path.dirname(BRACKET_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BRACKET_FILE, JSON.stringify(data, null, 2), "utf8");
    try {
      fs.writeFileSync(PERSISTENT_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch {}
  } catch (e) {
    console.error("Failed to write bracket state:", e);
  }
}

export async function GET() {
  const bracket = readBracket();
  return NextResponse.json({ success: true, bracket });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const p = (body.passcode || "").toString().trim().toLowerCase();
    const isAdmin = p === "demon323161" || p === "sigmaadmin" || p === "admin" || p === "chillout";

    if (!isAdmin) {
      return NextResponse.json({ error: "Доступ запрещен. Только для Администратора!" }, { status: 403 });
    }

    const current = readBracket();

    // 1. Action: import from Draft
    if (body.action === "import_draft") {
      const draftPath = path.join(process.cwd(), "src/lib/draft_state.json");
      const persistentDraft = path.join(process.cwd(), "..", "sigma_persistent_draft_state.json");
      let dTarget = draftPath;
      if (fs.existsSync(persistentDraft)) dTarget = persistentDraft;
      if (!fs.existsSync(dTarget)) {
        return NextResponse.json({ error: "Файл драфта не найден. Сначала сформируйте команды в Captain's Draft." }, { status: 404 });
      }

      const dData = JSON.parse(fs.readFileSync(dTarget, "utf8"));
      const captains = dData.captains || ["Капитан 1", "Капитан 2", "Капитан 3", "Капитан 4"];
      const teams = dData.teams || [[], [], [], []];

      const newBracket = generateDefaultBracket(captains, teams);
      if (body.title) newBracket.tournamentTitle = body.title.trim();
      writeBracket(newBracket);
      return NextResponse.json({ success: true, bracket: newBracket, message: "Команды успешно импортированы из драфта!" });
    }

    // 2. Action: update match score / status / map
    if (body.action === "update_match") {
      const { matchId, score1, score2, status, map, roomZone } = body;
      const mIdx = current.matches.findIndex(m => m.id === matchId);
      if (mIdx === -1) {
        return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
      }

      const match = current.matches[mIdx];
      if (score1 !== undefined) match.score1 = score1 === null || score1 === "" ? null : Number(score1);
      if (score2 !== undefined) match.score2 = score2 === null || score2 === "" ? null : Number(score2);
      if (status) match.status = status;
      if (map) match.map = map;
      if (roomZone !== undefined) match.roomZone = roomZone;

      current.updatedAt = Date.now();
      writeBracket(current);
      return NextResponse.json({ success: true, bracket: current, message: "Матч успешно обновлен!" });
    }

    // 3. Action: update team name / logo / mascot
    if (body.action === "update_team") {
      const { teamId, name, mascot, primaryColor, secondaryColor, players } = body;
      const tIdx = current.teams.findIndex(t => t.id === teamId);
      if (tIdx === -1) {
        return NextResponse.json({ error: "Команда не найдена" }, { status: 404 });
      }

      if (name) current.teams[tIdx].name = name.trim();
      if (players && Array.isArray(players)) current.teams[tIdx].players = players;
      if (mascot) current.teams[tIdx].logo.mascot = mascot;
      if (primaryColor) current.teams[tIdx].logo.primaryColor = primaryColor;
      if (secondaryColor) current.teams[tIdx].logo.secondaryColor = secondaryColor;

      current.updatedAt = Date.now();
      writeBracket(current);
      return NextResponse.json({ success: true, bracket: current, message: "Команда успешно обновлена!" });
    }

    // 4. Action: save whole bracket
    if (body.bracket) {
      body.bracket.updatedAt = Date.now();
      writeBracket(body.bracket);
      return NextResponse.json({ success: true, bracket: body.bracket, message: "Сетка турнира успешно сохранена!" });
    }

    return NextResponse.json({ success: true, bracket: current });
  } catch (error: any) {
    console.error("Error in bracket API:", error);
    return NextResponse.json({ error: error.message || "Ошибка сервера" }, { status: 500 });
  }
}
