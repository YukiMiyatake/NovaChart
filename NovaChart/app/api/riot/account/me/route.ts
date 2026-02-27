import { NextRequest } from 'next/server';
import { RiotApiClient } from '@/lib/riot/client';
import { logger } from '@/lib/utils/logger';
import { handleRiotApiError, getErrorStatusCode } from '@/lib/utils/errorHandler';
import { validateApiKeyFromSearchParams } from '@/lib/api/middleware';
import { success, errorResponse } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || 'jp1';
  const { apiKey, error: apiKeyError } = validateApiKeyFromSearchParams(searchParams);
  if (apiKeyError || !apiKey) return apiKeyError;

  try {
    logger.debug(`[API Route] /api/riot/account/me - Region: ${region}`);
    const client = new RiotApiClient(apiKey, region);
    const summoner = await client.getSummonerByMe();
    return success({ summoner });
  } catch (error) {
    logger.error('[API Route] Riot API Error:', error);
    const errorMessage = handleRiotApiError(error, '/api/riot/account/me');
    const statusCode = getErrorStatusCode(error);
    
    return errorResponse(errorMessage, statusCode);
  }
}

