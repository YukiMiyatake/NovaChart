import { NextRequest } from 'next/server';
import { RiotApiClient } from '@/lib/riot/client';
import { logger } from '@/lib/utils/logger';
import { handleRiotApiError, getErrorStatusCode } from '@/lib/utils/errorHandler';
import { validateApiKeyFromSearchParams, ensureGameNameAndTag } from '@/lib/api/middleware';
import { success, errorResponse } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || 'jp1';
  const { gameName, tagLine, error: nameError } = ensureGameNameAndTag(searchParams);
  if (nameError) return nameError;

  const { apiKey, error: apiKeyError } = validateApiKeyFromSearchParams(searchParams);
  if (apiKeyError || !apiKey) return apiKeyError;

  try {
    logger.debug(`[API Route] /api/riot/account/by-riot-id - GameName: ${gameName}, TagLine: ${tagLine}, Region: ${region}`);
    const client = new RiotApiClient(apiKey, region);
    const account = await client.getAccountByRiotId(gameName, tagLine);
    
    const summoner = await client.getSummonerByPuuid(account.puuid);
    
    logger.debug('[API Route] /api/riot/account/by-riot-id - Summoner data:', JSON.stringify(summoner, null, 2));
    logger.debug('[API Route] /api/riot/account/by-riot-id - Summoner id:', summoner.id);
    logger.debug('[API Route] /api/riot/account/by-riot-id - Summoner name:', summoner.name);
    logger.debug('[API Route] /api/riot/account/by-riot-id - Summoner puuid:', summoner.puuid);
    
    return success({ account, summoner });
  } catch (error) {
    logger.error('[API Route] Riot API Error:', error);
    const errorMessage = handleRiotApiError(error, '/api/riot/account/by-riot-id');
    const statusCode = getErrorStatusCode(error);
    
    return errorResponse(errorMessage, statusCode);
  }
}

