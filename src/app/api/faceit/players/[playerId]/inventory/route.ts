export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/faceit";

const inventoryCache: Record<string, { data: any; ts: number }> = {};
const priceCache: Record<string, { steamPrice: number; ts: number }> = {};

function parsePriceRub(priceStr?: string): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/\s+/g, "").replace("руб.", "").replace("₽", "").replace("pуб.", "").trim();
  const normalized = cleaned.replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? null : Math.round(num);
}

async function fetchItemPrice(marketHashName: string): Promise<number | null> {
  const now = Date.now();
  if (priceCache[marketHashName] && (now - priceCache[marketHashName].ts < 3600000)) {
    return priceCache[marketHashName].steamPrice;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(
      `https://steamcommunity.com/market/priceoverview/?appid=730&currency=5&market_hash_name=${encodeURIComponent(marketHashName)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const price = parsePriceRub(data.lowest_price || data.median_price);
      if (price) {
        priceCache[marketHashName] = { steamPrice: price, ts: Date.now() };
        return price;
      }
    }
  } catch (e) {}
  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    if (!playerId) return NextResponse.json({ error: "Missing playerId" }, { status: 400 });

    const now = Date.now();
    if (inventoryCache[playerId] && now - inventoryCache[playerId].ts < 600000) {
      return NextResponse.json(inventoryCache[playerId].data);
    }

    const profile = await getPlayerProfile(playerId);
    const steam64Id = profile?.steam_id_64 || profile?.games?.cs2?.game_player_id || profile?.games?.csgo?.game_player_id;
    if (!steam64Id) return NextResponse.json({ success: false, error: "Steam ID не привязан" }, { status: 404 });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const invRes = await fetch(`https://steamcommunity.com/inventory/${steam64Id}/730/2?l=russian&count=1000`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!invRes.ok) {
        const privateResult = { success: true, isPrivate: true, steam64Id, profileUrl: `https://steamcommunity.com/profiles/${steam64Id}` };
        inventoryCache[playerId] = { data: privateResult, ts: Date.now() };
        return NextResponse.json(privateResult);
      }

      const invData = await invRes.json();
      const descriptions = Array.isArray(invData?.descriptions) ? invData.descriptions : [];
      if (descriptions.length === 0) {
        const emptyResult = { success: true, isPrivate: false, steam64Id, totalItems: 0, topItem: null, otherTopItems: [], profileUrl: `https://steamcommunity.com/profiles/${steam64Id}` };
        inventoryCache[playerId] = { data: emptyResult, ts: Date.now() };
        return NextResponse.json(emptyResult);
      }

      const candidateItems = descriptions.filter((d: any) => {
        const hash = d.market_hash_name || "";
        const name = d.name || "";
        if (!hash || !d.icon_url) return false;
        if (hash.startsWith("Sealed Graffiti") || hash.startsWith("Graffiti |")) return false;
        if (hash.includes("Coin") || hash.includes("Medal") || hash.includes("Trophy") || hash.includes("Pin")) return false;
        if (name.includes("Граффити") || name.includes("Медаль") || name.includes("Монета") || name.includes("Значок")) return false;
        if (d.type?.includes("Граффити") || d.type?.includes("Инструмент")) return false;
        return true;
      });

      const scoredItems = candidateItems.map((d: any) => {
        const rarityTag = (d.tags || []).find((t: any) => t.category === "Rarity");
        const typeTag = (d.tags || []).find((t: any) => t.category === "Type");
        const exteriorTag = (d.tags || []).find((t: any) => t.category === "Exterior");
        const hash = d.market_hash_name || "";
        const isKnife = hash.includes("Knife") || hash.includes("Bayonet") || hash.includes("Karambit") || hash.includes("Daggers") || d.name?.includes("Нож") || d.name?.includes("Керамбит") || d.name?.includes("Штык-нож");
        const isGlove = hash.includes("Gloves") || hash.includes("Wraps") || d.name?.includes("Перчатки") || d.name?.includes("Обмотки");
        const isStatTrak = hash.includes("StatTrak™") || d.name?.includes("StatTrak™");
        let rarityScore = 1;
        const rarityName = rarityTag?.localized_tag_name || rarityTag?.name || "Обычное";
        if (isKnife || isGlove) rarityScore = 1000;
        else if (rarityName.includes("Тайное") || rarityName.includes("Covert")) rarityScore = 500;
        else if (rarityName.includes("Засекреченное") || rarityName.includes("Classified")) rarityScore = 250;
        else if (rarityName.includes("Запрещённое") || rarityName.includes("Restricted")) rarityScore = 120;
        else if (rarityName.includes("Армейское") || rarityName.includes("Mil-Spec")) rarityScore = 50;
        else if (rarityName.includes("Промышленное") || rarityName.includes("Industrial")) rarityScore = 20;
        if (isStatTrak) rarityScore += 60;
        return {
          name: d.name,
          marketName: d.market_name || d.name,
          marketHashName: hash,
          iconUrl: d.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${d.icon_url}` : null,
          type: typeTag?.localized_tag_name || d.type || "Скин",
          rarityName,
          rarityColor: rarityTag?.color ? `#${rarityTag.color}` : isKnife || isGlove ? "#ffd700" : "#b0c3d9",
          exterior: exteriorTag?.localized_tag_name || null,
          isKnife,
          isGlove,
          isStatTrak,
          rarityScore,
        };
      });

      scoredItems.sort((a: any, b: any) => b.rarityScore - a.rarityScore);
      const topCandidates = scoredItems.slice(0, 5);
      const pricedItems = await Promise.all(
        topCandidates.map(async (item: any) => {
          const steamPrice = await fetchItemPrice(item.marketHashName);
          const lisSkinsPrice = steamPrice ? Math.round(steamPrice * 0.72) : null;
          const queryClean = (item.name || item.marketHashName).split(" (")[0].trim();
          const lisSkinsUrl = `https://lis-skins.ru/market/csgo/?query=${encodeURIComponent(queryClean)}`;
          return { ...item, steamPrice, lisSkinsPrice, lisSkinsUrl };
        })
      );

      pricedItems.sort((a, b) => (b.steamPrice || 0) - (a.steamPrice || 0) || b.rarityScore - a.rarityScore);
      const topItem = pricedItems.length > 0 ? pricedItems[0] : null;
      const otherTopItems = pricedItems.slice(1, 4);

      const result = {
        success: true,
        isPrivate: false,
        steam64Id,
        profileUrl: `https://steamcommunity.com/profiles/${steam64Id}`,
        totalItems: candidateItems.length,
        topItem,
        otherTopItems,
      };
      inventoryCache[playerId] = { data: result, ts: Date.now() };
      return NextResponse.json(result);
    } catch (err: any) {
      const errResult = { success: true, isPrivate: true, steam64Id, profileUrl: `https://steamcommunity.com/profiles/${steam64Id}` };
      return NextResponse.json(errResult);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
