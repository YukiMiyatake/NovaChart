import { NextRequest, NextResponse } from 'next/server';
import { RiotApiClient } from '@/lib/riot/client';
import { logger } from '@/lib/utils/logger';
import { handleRiotApiError, getErrorStatusCode } from '@/lib/utils/errorHandler';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const summonerName = searchParams.get('name');
  const region = searchParams.get('region') || 'jp1';
  const apiKeyFromRequest = searchParams.get('apiKey');

  if (!summonerName) {
    return NextResponse.json(
      { error: 'Summoner name is required' },
      { status: 400 }
    );
  }

  // Try to get API key from request parameter first, then environment variable
  const apiKey = apiKeyFromRequest || process.env.RIOT_API_KEY;
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
    return NextResponse.json(
      { 
        error: 'Riot API key is not configured. Please set API key in the app settings or .env.local file.',
      },
      { status: 500 }
    );
  }

  try {
    logger.debug(`[API Route] /api/riot/summoner - Summoner: ${summonerName}, Region: ${region}`);
    
    // Parse Riot ID format (gameName#tagLine) or treat as gameName
    let gameName = summonerName;
    let tagLine = '';
    
    if (summonerName.includes('#')) {
      const parts = summonerName.split('#');
      gameName = parts[0];
      tagLine = parts.slice(1).join('#'); // In case tagLine contains #
    } else {
      // If no tagLine provided, return error
      return NextResponse.json(
        { 
          error: 'Riot ID形式（ゲーム名#タグライン）で入力してください。例: PlayerName#JP1',
          hint: 'サマナー名検索は非推奨のため、Riot ID検索を使用してください。'
        },
        { status: 400 }
      );
    }

    if (!tagLine) {
      return NextResponse.json(
        { 
          error: 'タグラインが必要です。Riot ID形式（ゲーム名#タグライン）で入力してください。例: PlayerName#JP1',
        },
        { status: 400 }
      );
    }

    // Use by-riot-id endpoint instead of by-name
    const client = new RiotApiClient(apiKey, region);
    const account = await client.getAccountByRiotId(gameName, tagLine);
    
    // Get summoner info using PUUID
    const summoner = await client.getSummonerByPuuid(account.puuid);
    
    // Note: Database save should be done on client-side
    return NextResponse.json(summoner);
  } catch (error) {
    logger.error('[API Route] Riot API Error:', error);
    const errorMessage = handleRiotApiError(error, '/api/riot/summoner');
    const statusCode = getErrorStatusCode(error);
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

