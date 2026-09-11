import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const DRAFT_FILE = path.join(process.cwd(), "src/lib/draft_state.json");
const DRAFT_PERSISTENT = path.join(process.cwd(), "..", "sigma_persistent_draft_state.json");

interface DraftState {
  step: "setup" | "picking" | "finished";
  captains: [string, string, string, string];
  poolInput: string;
  availablePlayers: string[];
  teams: [string[], string[], string[], string[]];
  turnSequence: number[];
  currentStepIndex: number;
  roomAssignment: { vip: number[]; main: number[] } | null;
  updatedAt: number;
}

const defaultState: DraftState = {
  step: "setup",
  captains: ["Капитан 1", "Капитан 2", "Капитан 3", "Капитан 4"],
  poolInput: "",
  availablePlayers: [],
  teams: [[], [], [], []],
  turnSequence: [],
  currentStepIndex: 0,
  roomAssignment: null,
  updatedAt: Date.now()
};

function readDraftState(): DraftState {
  try {
    let target = DRAFT_FILE;
    if (fs.existsSync(DRAFT_PERSISTENT)) {
      target = DRAFT_PERSISTENT;
    }
    if (fs.existsSync(target)) {
      const content = fs.readFileSync(target, "utf8");
      return JSON.parse(content || "{}") as DraftState;
    }
  } catch (e) {
    console.error("Failed to read draft state file:", e);
  }
  return defaultState;
}

function writeDraftState(data: DraftState) {
  try {
    const dir = path.dirname(DRAFT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DRAFT_FILE, JSON.stringify(data, null, 2), "utf8");
    try {
      fs.writeFileSync(DRAFT_PERSISTENT, JSON.stringify(data, null, 2), "utf8");
    } catch {}
  } catch (e) {
    console.error("Failed to write draft state file:", e);
  }
}

export async function GET() {
  const state = readDraftState();
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentState = readDraftState();

    if (body.action === "setup") {
      const rawCaptains = body.captains || ["Капитан 1", "Капитан 2", "Капитан 3", "Капитан 4"];
      const poolInput = body.poolInput || "";
      const availablePlayers: string[] = body.availablePlayers || [];

      // Randomly shuffle captains so Team 1 is 1st pick, Team 2 is 2nd, etc.
      let captains = [...rawCaptains];
      if (body.randomize !== false) {
        for (let i = captains.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [captains[i], captains[j]] = [captains[j], captains[i]];
        }
      }

      // Standard Snake Sequence: 0, 1, 2, 3, 3, 2, 1, 0...
      const totalPicks = availablePlayers.length > 0 ? availablePlayers.length : 16;
      const turnSequence: number[] = [];
      let round = 0;
      while (turnSequence.length < totalPicks) {
        if (round % 2 === 0) turnSequence.push(0, 1, 2, 3);
        else turnSequence.push(3, 2, 1, 0);
        round++;
      }
      const finalTurnSeq = turnSequence.slice(0, totalPicks);

      const newState: DraftState = {
        step: "picking",
        captains: captains as [string, string, string, string],
        poolInput,
        availablePlayers,
        teams: [[captains[0]], [captains[1]], [captains[2]], [captains[3]]],
        turnSequence: finalTurnSeq,
        currentStepIndex: 0,
        roomAssignment: null,
        updatedAt: Date.now()
      };

      writeDraftState(newState);
      return NextResponse.json(newState);
    }

    if (body.action === "reroll_order") {
      if (currentState.step === "picking" && currentState.currentStepIndex === 0) {
        const captains = [...currentState.captains];
        for (let i = captains.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [captains[i], captains[j]] = [captains[j], captains[i]];
        }
        currentState.captains = captains as [string, string, string, string];
        currentState.teams = [[captains[0]], [captains[1]], [captains[2]], [captains[3]]];
        currentState.currentStepIndex = 0;
        currentState.updatedAt = Date.now();
        writeDraftState(currentState);
        return NextResponse.json(currentState);
      }
      return NextResponse.json(currentState);
    }

    if (body.action === "pick") {
      const playerPick = body.playerPick;
      if (!playerPick || currentState.step !== "picking") {
        return NextResponse.json(currentState);
      }

      if (currentState.currentStepIndex >= currentState.turnSequence.length) {
        currentState.step = "finished";
        writeDraftState(currentState);
        return NextResponse.json(currentState);
      }

      const activeCapIdx = currentState.turnSequence[currentState.currentStepIndex];
      const activeCapName = (currentState.captains[activeCapIdx] || "").trim();

      // Authorization verification: only the active captain or Admin can pick
      let sessionUser: any = null;
      try {
        const sessionCookie = request.cookies.get("sigma_user_session")?.value;
        if (sessionCookie) {
          sessionUser = JSON.parse(Buffer.from(sessionCookie, "base64").toString("utf8"));
        }
      } catch (e) {
        console.warn("Failed to parse sigma_user_session cookie in draft pick:", e);
      }

      // Check admin privileges via body passcode or session role
      const isAdmin =
        body.passcode === "demon323161" ||
        body.passcode === "sigmaadmin" ||
        sessionUser?.role === "ADMIN" ||
        body.isAdmin === true;

      // Verify captain identity
      const activeCapLower = activeCapName.toLowerCase();
      const isCaptain = sessionUser && (
        (sessionUser.faceit?.nickname && sessionUser.faceit.nickname.toLowerCase() === activeCapLower) ||
        (sessionUser.steamName && sessionUser.steamName.toLowerCase() === activeCapLower) ||
        (body.captainSteamId && sessionUser.steamId === body.captainSteamId)
      );

      if (!isAdmin && !isCaptain) {
        return NextResponse.json(
          {
            error: `Сейчас ход капитана «${activeCapName}». Только он может пикать игроков. Пожалуйста, авторизуйтесь через Steam.`,
            currentState
          },
          { status: 403 }
        );
      }
      
      // If active team already has 5 players, don't add
      if (currentState.teams[activeCapIdx].length >= 5) {
        return NextResponse.json(currentState);
      }

      currentState.teams[activeCapIdx].push(playerPick);
      currentState.availablePlayers = currentState.availablePlayers.filter(p => p !== playerPick);

      const allTeamsFull = currentState.teams.every(t => t.length >= 5);
      if (currentState.availablePlayers.length === 0 || currentState.currentStepIndex + 1 >= currentState.turnSequence.length || allTeamsFull) {
        currentState.step = "finished";
      } else {
        currentState.currentStepIndex += 1;
      }

      currentState.updatedAt = Date.now();
      writeDraftState(currentState);
      return NextResponse.json(currentState);
    }

    if (body.action === "auto_shuffle") {
      const captains = body.captains || ["Капитан 1", "Капитан 2", "Капитан 3", "Капитан 4"];
      const teams = body.teams || [[], [], [], []];
      const poolInput = body.poolInput || "";
      const remainingAvailable = body.availablePlayers || [];

      const newState: DraftState = {
        step: "finished",
        captains: captains as [string, string, string, string],
        poolInput,
        availablePlayers: remainingAvailable,
        teams: teams as [string[], string[], string[], string[]],
        turnSequence: [],
        currentStepIndex: 0,
        roomAssignment: null,
        updatedAt: Date.now()
      };

      writeDraftState(newState);
      return NextResponse.json(newState);
    }

    if (body.action === "roll_rooms") {
      const indices = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      currentState.roomAssignment = {
        vip: [indices[0], indices[1]],
        main: [indices[2], indices[3]]
      };
      currentState.updatedAt = Date.now();
      writeDraftState(currentState);
      return NextResponse.json(currentState);
    }

    if (body.action === "reset") {
      const resetState: DraftState = {
        ...defaultState,
        updatedAt: Date.now()
      };
      writeDraftState(resetState);
      return NextResponse.json(resetState);
    }

    return NextResponse.json(currentState);
  } catch (error: any) {
    console.error("Error in draft API:", error);
    return NextResponse.json({ error: error.message || "Draft API error" }, { status: 500 });
  }
}
