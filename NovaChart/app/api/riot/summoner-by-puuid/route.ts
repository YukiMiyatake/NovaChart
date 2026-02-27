import { NextRequest, NextResponse } from 'next/server';
import { RiotApiClient } from '@/lib/riot/client';
import { Summoner } from '@/types';
import { logger } from '@/lib/utils/logger';
import { handleRiotApiError, getErrorStatusCode } from '@/lib/utils/errorHandler';
import { validateApiKeyFromSearchParams } from '@/lib/api/middleware';
import { success, errorResponse } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const puuid = searchParams.get('puuid');
  const region = searchParams.get('region') || 'jp1';
  const { apiKey, error: apiKeyError } = validateApiKeyFromSearchParams(searchParams);

  if (!puuid) {
    return errorResponse('PUUID is required', 400);
  }

  if (apiKeyError || !apiKey) return apiKeyError;

  try {
    const client = new RiotApiClient(apiKey, region);
    const summoner = await client.getSummonerByPuuid(puuid);
    
    return success<Summoner>(summoner);
  } catch (error) {
    logger.error('[API Route] Riot API Error:', error);
    const errorMessage = handleRiotApiError(error, '/api/riot/summoner-by-puuid');
    const statusCode = getErrorStatusCode(error);
    
    return errorResponse(errorMessage, statusCode);
  }
}

