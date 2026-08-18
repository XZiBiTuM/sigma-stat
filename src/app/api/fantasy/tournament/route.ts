import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const LOCAL_FILE = path.join(process.cwd(), "src", "lib", "fantasy_tournament.json");
const PERSISTENT_FILE = path.join(process.cwd(), "..", "sigma_persistent_fantasy_tournament.json");

interface FantasyTournament {
  id: string;
  title: string;
  startTime: string; // ISO or YYYY-MM-DDTHH:mm
  status: "DRAFT_OPEN" | "LIVE" | "COMPLETED";
  winnerSteamId?: string;
  winnerNickname?: string;
  updatedAt: string;
}

async function getTournament(): Promise<FantasyTournament> {
  let fileToRead = LOCAL_FILE;
  try {
    const pStat = await fs.stat(PERSISTENT_FILE).catch(() => null);
    if (pStat) fileToRead = PERSISTENT_FILE;
    const data = await fs.readFile(fileToRead, "utf8");
    return JSON.parse(data);
  } catch {
    // Default initial upcoming tournament (7 days from now)
    const defaultDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    return {
      id: "tour_1",
      title: "Sigma Cup: Season 3",
      startTime: defaultDate,
      status: "DRAFT_OPEN",
      updatedAt: new Date().toISOString()
    };
  }
}

async function saveTournament(data: FantasyTournament) {
  const jsonStr = JSON.stringify(data, null, 2);
  try {
    const dir = path.dirname(LOCAL_FILE);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    await fs.writeFile(LOCAL_FILE, jsonStr, "utf8");
  } catch (e) {}
  try {
    await fs.writeFile(PERSISTENT_FILE, jsonStr, "utf8");
  } catch (e) {}
}

export async function GET() {
  const tournament = await getTournament();
  return NextResponse.json({ success: true, tournament });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { passcode, title, startTime, status, winnerSteamId, winnerNickname } = body;

    const p = (passcode || "").toString().trim().toLowerCase();
    if (p !== "demon323161" && p !== "sigmaadmin" && p !== "admin") {
      return NextResponse.json({ error: "Доступ запрещен. Только для Администратора!" }, { status: 403 });
    }

    const current = await getTournament();
    const updated: FantasyTournament = {
      ...current,
      title: title !== undefined ? title.trim() : current.title,
      startTime: startTime !== undefined ? startTime : current.startTime,
      status: status || current.status,
      winnerSteamId: winnerSteamId !== undefined ? winnerSteamId : current.winnerSteamId,
      winnerNickname: winnerNickname !== undefined ? winnerNickname : current.winnerNickname,
      updatedAt: new Date().toISOString()
    };

    await saveTournament(updated);
    return NextResponse.json({ success: true, tournament: updated, message: "Настройки турнира успешно сохранены!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ошибка сервера" }, { status: 500 });
  }
}
