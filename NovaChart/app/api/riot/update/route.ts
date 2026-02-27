import { NextRequest, NextResponse } from 'next/server';
import { RiotApiClient, tierRankToLP } from '@/lib/riot/client';
import { Summoner } from '@/types';

export async function POST(request: NextRequest) {
  const { gameName, tagLine, region = 'jp1', apiKey: apiKeyFromRequest } = await request.json();

  // Note: IndexedDB is not available on server-side
  // Always use Riot ID (gameName + tagLine) to get summoner information
  
  if (!gameName || !tagLine) {
    return NextResponse.json(
      { error: 'Game name and tag line are required. Use Riot ID format (gameName#tagLine)' },
      { status: 400 }
    );
  }

  // Try to get API key from request first, then environment variable
  const apiKey = apiKeyFromRequest || process.env.RIOT_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.error('RIOT_API_KEY is not set or empty.');
    return NextResponse.json(
      { 
        error: 'Riot API key is not configured. Please set API key in the app settings or .env.local file.'
      },
      { status: 500 }
    );
  }

  let summoner: Summoner;
  
  try {
    // Use by-riot-id endpoint to get PUUID, then get summoner info
    const client = new RiotApiClient(apiKey, region);
    const account = await client.getAccountByRiotId(gameName, tagLine);
    summoner = await client.getSummonerByPuuid(account.puuid);
    // Note: Database save should be done on client-side
  } catch (error) {
    console.error('Riot API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch summoner data' },
      { status: 500 }
    );
  }

  // Now get league entry (requires API key)
  // Use the same API key from request or environment
  const leagueApiKey = apiKeyFromRequest || process.env.RIOT_API_KEY;
  if (!leagueApiKey || leagueApiKey.trim() === '') {
    console.error('RIOT_API_KEY is not set or empty.');
    return NextResponse.json(
      { 
        error: 'Riot API key is required to fetch league data. Please set API key in the app settings or .env.local file.'
      },
      { status: 500 }
    );
  }

  try {
    const client = new RiotApiClient(leagueApiKey, summoner.region || region);

    // Get ranked solo queue entry using puuid (not summonerId)
    const entry = await client.getRankedSoloQueueEntryByPuuid(summoner.puuid);

    if (!entry) {
      return NextResponse.json(
        { error: 'No ranked solo queue entry found' },
        { status: 404 }
      );
    }

    // Return the league entry data with current date
    // Note: Database operations (checking for existing entries, saving) should be done on client-side
    const currentDate = new Date();
    console.log('[Update API] Current rate data:', {
      tier: entry.tier,
      rank: entry.rank,
      lp: entry.leaguePoints,
      wins: entry.wins,
      losses: entry.losses,
      date: currentDate.toISOString(),
    });
    
    return NextResponse.json({
      message: 'League entry retrieved',
      entry: {
        leagueId: entry.leagueId || '',
        tier: entry.tier,
        rank: entry.rank,
        lp: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
        date: currentDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Riot API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update rating' },
      { status: 500 }
    );
  }
}

