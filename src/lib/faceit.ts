export async function faceitFetch(endpoint: string, searchParams?: Record<string, string | number>) {
  const apiKey = process.env.FACEIT_API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const baseUrl = "https://open.faceit.com/data/v4";
  const url = new URL(`${baseUrl}${endpoint}`);
  
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    // We can disable caching or set a low cache revalidation limit (e.g. 10 seconds)
    // so players see real-time updates when games finish or leaderboard changes.
    next: { revalidate: 10 },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { message: errorText };
    }
    
    const error: any = new Error(parsedError.message || `FACEIT API Error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function getPlayerProfile(playerId: string) {
  if (uuidRegex.test(playerId)) {
    return faceitFetch(`/players/${playerId}`);
  } else {
    return faceitFetch("/players", { nickname: playerId });
  }
}
