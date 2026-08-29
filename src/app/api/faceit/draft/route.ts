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
      const captains = body.captains || ["Капитан 1", "Капитан 2", "Капитан 3", "Капитан 4"];
      const poolInput = body.poolInput || "";
      const availablePlayers: string[] = body.availablePlayers || [];
      // Standard 5v5 Snake Draft (4 captains + 4 picks per team = 16 total picks)
      const turnSequence: number[] = [
        0, 1, 2, 3,
        3, 2, 1, 0,
        0, 1, 2, 3,
        3, 2, 1, 0
      ];

      const newState: DraftState = {
        step: "picking",
        captains: captains as [string, string, string, string],
        poolInput,
        availablePlayers,
        teams: [[captains[0]], [captains[1]], [captains[2]], [captains[3]]],
        turnSequence,
        currentStepIndex: 0,
        roomAssignment: null,
        updatedAt: Date.now()
      };

      writeDraftState(newState);
      return NextResponse.json(newState);
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
