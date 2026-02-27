import { useState, useCallback } from 'react';
import { Summoner, LeagueEntry } from '@/types';
import { API_ENDPOINTS, DEFAULTS } from '@/lib/constants';
import { StorageService } from '@/lib/utils/storage';
import { extractLeagueEntry } from '@/lib/utils/leagueEntry';
import { handleRiotApiError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

interface UseRiotApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseRiotApiReturn<T> extends UseRiotApiState<T> {
  fetch: () => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for fetching summoner data by PUUID
 */
export function useFetchSummoner(
  puuid: string | null,
  region?: string
): UseRiotApiReturn<Summoner> {
  const [state, setState] = useState<UseRiotApiState<Summoner>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetch = useCallback(async () => {
    if (!puuid) {
      setState({ data: null, loading: false, error: 'PUUID is required' });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const apiKey = StorageService.getApiKey();
      const currentRegion = region || StorageService.getApiRegion() || DEFAULTS.REGION;

      if (!apiKey) {
        throw new Error('APIキーが必要です。右上の「APIキー設定」からAPIキーを設定してください。');
      }

      const response = await globalThis.fetch(
        `${API_ENDPOINTS.RIOT.SUMMONER_BY_PUUID}?puuid=${encodeURIComponent(puuid)}&region=${currentRegion}&apiKey=${encodeURIComponent(apiKey)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error || 'Failed to fetch summoner data');
        (error as any).statusCode = response.status;
        throw error;
      }

      const summonerData = await response.json();
      const summoner: Summoner = {
        ...summonerData,
        lastUpdated: summonerData.lastUpdated instanceof Date
          ? summonerData.lastUpdated
          : new Date(summonerData.lastUpdated),
      };

      setState({ data: summoner, loading: false, error: null });
    } catch (error) {
      const errorMessage = handleRiotApiError(error, API_ENDPOINTS.RIOT.SUMMONER_BY_PUUID);
      logger.error('[useFetchSummoner] Error:', error);
      setState({ data: null, loading: false, error: errorMessage });
    }
  }, [puuid, region]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, fetch, reset };
}

/**
 * Custom hook for fetching league entry by PUUID
 */
export function useFetchLeagueEntry(
  puuid: string | null,
  region?: string,
  queueType: string = DEFAULTS.QUEUE_TYPE
): UseRiotApiReturn<LeagueEntry> {
  const [state, setState] = useState<UseRiotApiState<LeagueEntry>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetch = useCallback(async () => {
    if (!puuid) {
      setState({ data: null, loading: false, error: 'PUUID is required' });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const apiKey = StorageService.getApiKey();
      const currentRegion = region || StorageService.getApiRegion() || DEFAULTS.REGION;

      if (!apiKey) {
        throw new Error('APIキーが必要です。右上の「APIキー設定」からAPIキーを設定してください。');
      }

      const response = await globalThis.fetch(
        `${API_ENDPOINTS.RIOT.LEAGUE_BY_PUUID}?puuid=${encodeURIComponent(puuid)}&region=${currentRegion}&queueType=${queueType}&apiKey=${encodeURIComponent(apiKey)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error || 'Failed to fetch league data');
        (error as any).statusCode = response.status;
        throw error;
      }

      const leagueData = await response.json();
      if (leagueData.entry) {
        const entry = extractLeagueEntry(leagueData.entry);
        setState({ data: entry, loading: false, error: null });
      } else {
        setState({ data: null, loading: false, error: 'No league entry found' });
      }
    } catch (error) {
      const errorMessage = handleRiotApiError(error, API_ENDPOINTS.RIOT.LEAGUE_BY_PUUID);
      logger.error('[useFetchLeagueEntry] Error:', error);
      setState({ data: null, loading: false, error: errorMessage });
    }
  }, [puuid, region, queueType]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, fetch, reset };
}

/**
 * Custom hook for fetching rate history
 */
export function useFetchRateHistory(
  puuid: string | null,
  region?: string,
  maxMatches: number = 100
): UseRiotApiReturn<{ rateHistory: any[]; currentEntry: any }> {
  const [state, setState] = useState<UseRiotApiState<{ rateHistory: any[]; currentEntry: any }>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetch = useCallback(async () => {
    if (!puuid) {
      setState({ data: null, loading: false, error: 'PUUID is required' });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const apiKey = StorageService.getApiKey();
      const currentRegion = region || StorageService.getApiRegion() || DEFAULTS.REGION;

      if (!apiKey) {
        throw new Error('APIキーが必要です。右上の「APIキー設定」からAPIキーを設定してください。');
      }

      const response = await globalThis.fetch(API_ENDPOINTS.RIOT.FETCH_RATE_HISTORY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          puuid,
          region: currentRegion,
          apiKey,
          maxMatches,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error || 'Failed to fetch rate history');
        (error as any).statusCode = response.status;
        throw error;
      }

      const result = await response.json();
      setState({
        data: {
          rateHistory: result.rateHistory || [],
          currentEntry: result.currentEntry || null,
        },
        loading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = handleRiotApiError(error, API_ENDPOINTS.RIOT.FETCH_RATE_HISTORY);
      logger.error('[useFetchRateHistory] Error:', error);
      setState({ data: null, loading: false, error: errorMessage });
    }
  }, [puuid, region, maxMatches]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, fetch, reset };
}

