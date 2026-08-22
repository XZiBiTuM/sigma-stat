import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import crypto from "crypto";
import { getStoragePath, getPersistentPath } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface DailyStat {
  views: number;
  uniques: string[]; // array of visitor hashes
}

interface AnalyticsData {
  totalViews: number;
  uniqueVisitors: string[]; // all-time unique visitor hashes
  pageViews: Record<string, number>; // path -> view count
  daily: Record<string, DailyStat>; // YYYY-MM-DD -> { views, uniques }
}

const LOCAL_FILE = getStoragePath("visitors_stats.json");
const PERSISTENT_FILE = getPersistentPath("sigma_persistent_visitors_stats.json");

async function readAnalytics(): Promise<AnalyticsData> {
  let data: AnalyticsData = {
    totalViews: 0,
    uniqueVisitors: [],
    pageViews: {},
    daily: {}
  };

  try {
    let content = "";
    try {
      content = await fs.readFile(LOCAL_FILE, "utf8");
    } catch {
      content = await fs.readFile(PERSISTENT_FILE, "utf8");
    }
    if (content) {
      data = JSON.parse(content);
    }
  } catch (e) {}

  if (!data.totalViews) data.totalViews = 0;
  if (!Array.isArray(data.uniqueVisitors)) data.uniqueVisitors = [];
  if (!data.pageViews) data.pageViews = {};
  if (!data.daily) data.daily = {};

  return data;
}

async function saveAnalytics(data: AnalyticsData) {
  const jsonStr = JSON.stringify(data, null, 2);
  try {
    await fs.writeFile(LOCAL_FILE, jsonStr, "utf8");
  } catch (e) {}
  try {
    await fs.writeFile(PERSISTENT_FILE, jsonStr, "utf8");
  } catch (e) {}
}

function getClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  return "127.0.0.1";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const page = typeof body.path === "string" ? body.path : "/";

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Generate anonymous hash for unique visitor counting
    const salt = "sigma_visitor_salt_2026";
    const visitorHash = crypto
      .createHash("sha256")
      .update(`${ip}_${userAgent}_${salt}`)
      .digest("hex")
      .slice(0, 16);

    const data = await readAnalytics();

    // 1. Increment total views
    data.totalViews = (data.totalViews || 0) + 1;

    // 2. All-time unique
    if (!data.uniqueVisitors.includes(visitorHash)) {
      data.uniqueVisitors.push(visitorHash);
    }

    // 3. Page views
    data.pageViews[page] = (data.pageViews[page] || 0) + 1;

    // 4. Daily stats
    if (!data.daily[today]) {
      data.daily[today] = { views: 0, uniques: [] };
    }
    data.daily[today].views = (data.daily[today].views || 0) + 1;
    if (!data.daily[today].uniques.includes(visitorHash)) {
      data.daily[today].uniques.push(visitorHash);
    }

    // Keep only last 60 days of daily stats to prevent file bloat
    const sortedDays = Object.keys(data.daily).sort();
    if (sortedDays.length > 60) {
      const toRemove = sortedDays.slice(0, sortedDays.length - 60);
      for (const day of toRemove) {
        delete data.daily[day];
      }
    }

    await saveAnalytics(data);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const passcode = searchParams.get("passcode") || "";
    const p = passcode.trim().toLowerCase();

    // Admin passcode check
    if (p !== "demon323161" && p !== "admin" && p !== "sigmaadmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await readAnalytics();
    const today = new Date().toISOString().slice(0, 10);
    const todayStat = data.daily[today] || { views: 0, uniques: [] };

    // Format daily breakdown for charts (last 14 days)
    const sortedDays = Object.keys(data.daily).sort();
    const last14Days = sortedDays.slice(-14).map(day => ({
      date: day,
      views: data.daily[day].views,
      uniques: data.daily[day].uniques.length
    }));

    return NextResponse.json(
      {
        totalViews: data.totalViews,
        totalUniques: data.uniqueVisitors.length,
        todayViews: todayStat.views,
        todayUniques: todayStat.uniques.length,
        topPages: data.pageViews,
        dailyHistory: last14Days
      },
      {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
      }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
