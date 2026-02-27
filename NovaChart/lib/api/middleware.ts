import { NextRequest } from 'next/server';
import { ERROR_MESSAGES } from '@/lib/constants';
import { errorResponse } from './response';

export function validateApiKeyFromSearchParams(searchParams: URLSearchParams) {
  const apiKeyFromRequest = searchParams.get('apiKey');
  const apiKey = apiKeyFromRequest || process.env.RIOT_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
    return { apiKey: null, error: errorResponse(ERROR_MESSAGES.API_KEY_NOT_CONFIGURED, 500) };
  }

  return { apiKey };
}

export function ensureGameNameAndTag(searchParams: URLSearchParams) {
  const gameName = searchParams.get('gameName');
  const tagLine = searchParams.get('tagLine');

  if (!gameName || !tagLine) {
    return {
      gameName: null,
      tagLine: null,
      error: errorResponse(ERROR_MESSAGES.GAME_NAME_TAG_LINE_REQUIRED, 400),
    };
  }

  return { gameName, tagLine };
}

