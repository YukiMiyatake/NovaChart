import { NextRequest, NextResponse } from 'next/server';
import { RiotApiClient } from '@/lib/riot/client';
import { LeagueEntry } from '@/types';
import { DEFAULTS, QUEUE_TYPES, ERROR_MESSAGES } from '@/lib/constants';
import { extractLeagueEntry } from '@/lib/utils/leagueEntry';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const puuid = searchParams.get('puuid');
  const region = searchParams.get('region') || DEFAULTS.REGION;
  const queueType = searchParams.get('queueType') || DEFAULTS.QUEUE_TYPE;
  const apiKeyFromRequest = searchParams.get('apiKey');

  if (!puuid) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.PUUID_REQUIRED },
      { status: 400 }
    );
  }

  // Try to get API key from request first, then environment variable
  const apiKey = apiKeyFromRequest || process.env.RIOT_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return NextResponse.json(
      { error: ERROR_MESSAGES.API_KEY_NOT_CONFIGURED },
      { status: 500 }
    );
  }

  try {
    const client = new RiotApiClient(apiKey, region);
    let entry;
    
    if (queueType === 'RANKED_SOLO_5x5') {
      entry = await client.getRankedSoloQueueEntryByPuuid(puuid);
    } else if (queueType === 'RANKED_FLEX_SR') {
      entry = await client.getRankedFlexEntryByPuuid(puuid);
    } else {
      const entries = await client.getLeagueEntriesByPuuid(puuid);
      entry = entries.find(e => e.queueType === queueType) || null;
    }

    if (!entry) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.NO_LEAGUE_ENTRY_FOUND },
        { status: 404 }
      );
    }

    // Extract only LeagueEntry fields to avoid including extra fields like puuid
    const leagueEntry = extractLeagueEntry(entry);

    return NextResponse.json({ entry: leagueEntry });
  } catch (error) {
    logger.error('Riot API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_FETCH_LEAGUE },
      { status: 500 }
    );
  }
}

