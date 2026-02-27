import { NextRequest, NextResponse } from 'next/server';
import { RiotApiClient, fetchAndParseMatchDetails } from '@/lib/riot/client';

export async function POST(request: NextRequest) {
  const { puuid, region = 'jp1', apiKey: apiKeyFromRequest, matchIds, maxMatches = 20 } = await request.json();

  if (!puuid) {
    return NextResponse.json(
      { error: 'PUUID is required' },
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

  try {
    const client = new RiotApiClient(apiKey, region);

    let matchIdsToFetch: string[];

    // マッチIDが指定されている場合はそれを使用、そうでなければ取得
    if (matchIds && Array.isArray(matchIds) && matchIds.length > 0) {
      matchIdsToFetch = matchIds;
    } else {
      // マッチIDを取得
      const allMatchIds = await client.getAllRankedMatchIds(puuid, maxMatches);
      if (allMatchIds.length === 0) {
        return NextResponse.json(
          { error: 'No ranked matches found' },
          { status: 404 }
        );
      }
      matchIdsToFetch = allMatchIds;
    }

    // マッチ詳細を取得して解析（レート制限対策のため50ms遅延）
    const matches = await fetchAndParseMatchDetails(client, matchIdsToFetch, puuid, 50);

    if (matches.length === 0) {
      return NextResponse.json(
        { error: 'No match details could be parsed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Match details retrieved',
      matches: matches,
      count: matches.length,
    });
  } catch (error) {
    console.error('Riot API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch match details' },
      { status: 500 }
    );
  }
}

