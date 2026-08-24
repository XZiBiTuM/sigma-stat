export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { loadWeeklySkillData, performWeeklyRecalibration, getISOWeekKey } from "@/lib/weekly_skill";

export async function GET(request: NextRequest) {
  try {
    // Optionally check if we should auto-recalibrate if week changed
    const autoRecalib = request.nextUrl.searchParams.get("checkAuto") === "1";
    if (autoRecalib) {
      await performWeeklyRecalibration(false);
    }

    const data = await loadWeeklySkillData();
    return NextResponse.json({
      success: true,
      currentWeek: data.currentWeek,
      lastRecalibratedAt: data.lastRecalibratedAt,
      players: data.players
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load weekly skill snapshots" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body?.force);

    const result = await performWeeklyRecalibration(force);
    return NextResponse.json({
      success: true,
      result
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to perform weekly skill recalibration" },
      { status: 500 }
    );
  }
}
