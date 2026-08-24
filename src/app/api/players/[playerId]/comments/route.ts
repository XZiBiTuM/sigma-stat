export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import { getPersistentPath, getStoragePath } from "@/lib/storage";

const persistentCommentsPath = getPersistentPath("player_comments.json");
const fallbackCommentsPath = getStoragePath("player_comments.json");

function getActiveCommentsPath(): string {
  if (fs.existsSync(persistentCommentsPath)) return persistentCommentsPath;
  if (fs.existsSync(fallbackCommentsPath)) return fallbackCommentsPath;
  return persistentCommentsPath;
}

function readComments(): Record<string, any[]> {
  try {
    const targetPath = getActiveCommentsPath();
    if (fs.existsSync(targetPath)) {
      const raw = fs.readFileSync(targetPath, "utf8");
      return JSON.parse(raw || "{}");
    }
    return {};
  } catch (err) {
    console.error("Error reading player_comments.json:", err);
    return {};
  }
}

function writeComments(data: Record<string, any[]>) {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    // Write to persistent path outside git
    fs.writeFileSync(persistentCommentsPath, jsonStr, "utf8");
    // Also write to local project path if exists
    try {
      fs.writeFileSync(fallbackCommentsPath, jsonStr, "utf8");
    } catch {}
  } catch (err) {
    console.error("Error writing player_comments.json:", err);
  }
}

function getSessionUser(request: NextRequest): any | null {
  try {
    const sessionCookie = request.cookies.get("sigma_user_session")?.value;
    if (!sessionCookie) return null;
    const decoded = Buffer.from(sessionCookie, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await context.params;
    if (!playerId) {
      return NextResponse.json({ success: false, error: "Missing playerId" }, { status: 400 });
    }

    const allComments = readComments();
    const key = playerId.toLowerCase().trim();
    const list = allComments[key] || [];

    return NextResponse.json({
      success: true,
      comments: list
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await context.params;
    if (!playerId) {
      return NextResponse.json({ success: false, error: "Missing playerId" }, { status: 400 });
    }

    const sessionUser = getSessionUser(request);
    const body = await request.json().catch(() => ({}));
    const text = (body.text || "").trim();

    if (!sessionUser) {
      return NextResponse.json({ success: false, error: "Для отправки комментария необходимо войти через Steam" }, { status: 401 });
    }

    if (!text || text.length === 0) {
      return NextResponse.json({ success: false, error: "Текст комментария не может быть пустым" }, { status: 400 });
    }

    if (text.length > 500) {
      return NextResponse.json({ success: false, error: "Максимальная длина комментария 500 символов" }, { status: 400 });
    }

    const authorNickname = sessionUser.faceit?.nickname || sessionUser.steamName || "Anonymous";
    const authorAvatar = sessionUser.faceit?.avatar || sessionUser.steamAvatar || "/default-avatar.png";
    const authorSteamId = sessionUser.steamId || "";
    const authorFaceitId = sessionUser.faceit?.playerId || "";
    const authorRole = sessionUser.role || "USER";

    const newComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      authorNickname,
      authorAvatar,
      authorSteamId,
      authorFaceitId,
      authorRole,
      text,
      createdAt: new Date().toISOString()
    };

    const allComments = readComments();
    const key = playerId.toLowerCase().trim();
    if (!allComments[key]) {
      allComments[key] = [];
    }

    allComments[key].unshift(newComment); // newest first
    writeComments(allComments);

    return NextResponse.json({
      success: true,
      comment: newComment,
      comments: allComments[key]
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const commentId = body.commentId;
    const adminPasscode = body.passcode || "";

    if (!playerId || !commentId) {
      return NextResponse.json({ success: false, error: "Missing playerId or commentId" }, { status: 400 });
    }

    const sessionUser = getSessionUser(request);
    const isAdminPass = (adminPasscode === "chillout" || adminPasscode === "demon323161");

    const allComments = readComments();
    const key = playerId.toLowerCase().trim();
    const list = allComments[key] || [];

    const targetIndex = list.findIndex(c => c.id === commentId);
    if (targetIndex === -1) {
      return NextResponse.json({ success: false, error: "Комментарий не найден" }, { status: 404 });
    }

    const targetComment = list[targetIndex];

    // Authorization check: author by steamId / faceitId, or admin passcode, or admin session
    const isAuthor = Boolean(
      sessionUser && (
        (sessionUser.steamId && sessionUser.steamId === targetComment.authorSteamId) ||
        (sessionUser.faceit?.playerId && sessionUser.faceit.playerId === targetComment.authorFaceitId)
      )
    );

    const isAuthorized = isAuthor || isAdminPass || (sessionUser?.role === "ADMIN" || sessionUser?.role === "EVENT_MAKER");

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "У вас нет прав для удаления этого комментария" }, { status: 403 });
    }

    list.splice(targetIndex, 1);
    allComments[key] = list;
    writeComments(allComments);

    return NextResponse.json({
      success: true,
      comments: list
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
