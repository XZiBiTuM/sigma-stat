import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const ANNOUNCEMENT_FILE = path.join(process.cwd(), "src/lib/event_announcement.json");
const PERSISTENT_ANNOUNCEMENT_FILE = path.join(process.cwd(), "..", "sigma_persistent_event_announcement.json");

interface Announcement {
  id: string;
  text: string;
  prize?: string;
  createdAt: number;
  expiresAt: number;
  author: string;
}

function getAnnouncement(): Announcement | null {
  try {
    let fileToRead = ANNOUNCEMENT_FILE;
    if (fs.existsSync(PERSISTENT_ANNOUNCEMENT_FILE)) {
      fileToRead = PERSISTENT_ANNOUNCEMENT_FILE;
    }
    if (fs.existsSync(fileToRead)) {
      const data = fs.readFileSync(fileToRead, "utf8");
      const ann: Announcement = JSON.parse(data || "{}");
      if (ann && ann.expiresAt && Date.now() < ann.expiresAt) {
        ann.author = "MrChillout61";
        return ann;
      }
    }
  } catch (e) {
    console.error("Error reading announcement:", e);
  }
  return null;
}

function saveAnnouncement(ann: Announcement | null) {
  try {
    const dir = path.dirname(ANNOUNCEMENT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(ann, null, 2), "utf8");
  } catch (e) {
    console.error("Error saving announcement:", e);
  }
  try {
    fs.writeFileSync(PERSISTENT_ANNOUNCEMENT_FILE, JSON.stringify(ann, null, 2), "utf8");
  } catch (e) {
    console.error("Error saving persistent announcement:", e);
  }
}

export async function GET() {
  const activeAnn = getAnnouncement();
  return NextResponse.json({ success: true, announcement: activeAnn });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { passcode = "", text = "", prize = "" } = body;

    const p = (passcode || "").toString().trim().toLowerCase();
    if (p !== "chillout" && p !== "mrchillout" && p !== "demon323161" && p !== "admin" && p !== "sigmaadmin") {
      return NextResponse.json({ error: "Доступ запрещен. Только для Mr.Chillout и Администратора!" }, { status: 403 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "Текст события не может быть пустым" }, { status: 400 });
    }

    const now = Date.now();
    // Auto-expire in 3 days (72 hours)
    const expiresAt = now + 3 * 24 * 60 * 60 * 1000;

    const ann: Announcement = {
      id: `ann_${now}`,
      text: text.trim(),
      prize: prize.trim() || "Knife",
      createdAt: now,
      expiresAt,
      author: "MrChillout61"
    };

    saveAnnouncement(ann);

    return NextResponse.json({
      success: true,
      message: "Анонс события опубликован! Он будет автоматически виден на сайте 3 дня.",
      announcement: ann
    });
  } catch (error: any) {
    console.error("Error in announcement POST:", error);
    return NextResponse.json({ error: error.message || "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const passcode = searchParams.get("passcode") || "";

    const p = (passcode || "").toString().trim().toLowerCase();
    if (p !== "chillout" && p !== "mrchillout" && p !== "demon323161" && p !== "admin" && p !== "sigmaadmin") {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    saveAnnouncement(null);
    return NextResponse.json({ success: true, message: "Анонс события удален" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Ошибка при сбросе события" }, { status: 500 });
  }
}
