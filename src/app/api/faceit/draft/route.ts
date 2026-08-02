import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const DRAFT_FILE = path.join(process.cwd(), "src/lib/draft_state.json");

interface DraftState {
  step: "setup" | "picking" | "finished";
  captains: [string, string, string, string];
  poolInput: string;
  availablePlayers: string[];
  teams: [string[], string[], string[], string[]];
  turnSequence: number[];
  currentStepIndex: number;
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
  updatedAt: Date.now()
};

function readDraftState(): DraftState {
  try {
    if (fs.existsSync(DRAFT_FILE)) {
      const content = fs.readFileSync(DRAFT_FILE, "utf8");
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
      const turnSequence: number[] = body.turnSequence || [];

      const newState: DraftState = {
        step: "picking",
        captains: captains as [string, string, string, string],
        poolInput,
        availablePlayers,
        teams: [[captains[0]], [captains[1]], [captains[2]], [captains[3]]],
        turnSequence,
        currentStepIndex: 0,
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
      currentState.teams[activeCapIdx].push(playerPick);
      currentState.availablePlayers = currentState.availablePlayers.filter(p => p !== playerPick);

      if (currentState.availablePlayers.length === 0 || currentState.currentStepIndex + 1 >= currentState.turnSequence.length) {
        currentState.step = "finished";
      } else {
        currentState.currentStepIndex += 1;
      }

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
