import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { Summoner, LeagueEntry, Match } from '@/types';
import { API_ENDPOINTS, DEFAULTS } from '@/lib/constants';
import { extractLeagueEntry } from '@/lib/utils/leagueEntry';
import { StorageService } from '@/lib/utils/storage';
import { getDateKey } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import { handleRiotApiError } from '@/lib/utils/errorHandler';

interface UseSummonerSearchReturn {
  isSearching: boolean;
  search: (riotId: string, region: string) => Promise<void>;
}

export function useSummonerSearch(
  onSuccess?: () => void
): UseSummonerSearchReturn {
  const { setCurrentSummoner, setCurrentLeagueEntry, setLoading, setError } = useAppStore();
  const [isSearching, setIsSearching] = useState(false);

  const fetchAndSaveRateHistory = useCallback(async (puuid: string, region: string, apiKey: string | null) => {
    try {
      if (!apiKey) {
        logger.warn('[SummonerSearch] API key not available for rate history fetch');
        return;
      }

      const response = await fetch(API_ENDPOINTS.RIOT.FETCH_RATE_HISTORY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          puuid,
          region,
          apiKey,
          maxMatches: 100,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || 'レート履歴の取得に失敗しました';
        logger.warn('[SummonerSearch] Failed to fetch rate history:', errorMessage);
        return;
      }

      const result = await response.json();

      // Save rate history to database
      // ⚠️ CRITICAL: Only save entries based on match history
      // currentEntry is provided for display purposes only and should NOT be saved
      if (result.rateHistory && result.rateHistory.length > 0) {
        const { addRateHistory, rateHistory: currentRateHistory } = useAppStore.getState();
        const { rateHistoryService } = await import('@/lib/db');
        
        // Get existing matchIds to avoid re-fetching and re-saving
        const existingMatchIds = new Set(
          currentRateHistory.map(r => r.matchId).filter((id): id is string => !!id)
        );
        
        let addedCount = 0;
        let updatedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        
        // Get today's date for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        
        for (const entry of result.rateHistory) {
          try {
            // Skip if matchId is missing
            if (!entry.matchId) {
              skippedCount++;
              continue;
            }
            
            // Skip if already exists (avoid re-fetching and re-saving)
            if (existingMatchIds.has(entry.matchId)) {
              skippedCount++;
              continue;
            }
            
            // ⚠️ CRITICAL: Skip entries with matchId starting with "current-"
            // These are current entry data for display purposes only and should NOT be saved to database
            if (entry.matchId && entry.matchId.startsWith('current-')) {
              skippedCount++;
              continue;
            }
            
            const entryDate = new Date(entry.date);
            if (isNaN(entryDate.getTime())) {
              failedCount++;
              continue;
            }
            const entryDateOnly = new Date(entryDate);
            entryDateOnly.setHours(0, 0, 0, 0);
            const entryDateOnlyTime = entryDateOnly.getTime();
            
            // ⚠️ CRITICAL: Skip entries for today or future dates
            // These are not based on match history and should not be saved
            if (entryDateOnlyTime >= todayTime) {
              skippedCount++;
              continue;
            }
            
            // Check if entry exists by matchId
            const existing = await rateHistoryService.getByMatchId(entry.matchId);
            const existedBefore = !!existing;
            
            await addRateHistory({
              matchId: entry.matchId,
              date: entryDate,
              tier: entry.tier,
              rank: entry.rank,
              lp: entry.lp,
              wins: entry.wins,
              losses: entry.losses,
            });
            
            // Reload state to get accurate count
            await useAppStore.getState().loadRateHistory();
            
            // Check if entry was added or updated based on whether it existed before
            if (existedBefore) {
              updatedCount++;
            } else {
              addedCount++;
              existingMatchIds.add(entry.matchId);
            }
          } catch (error) {
            failedCount++;
            logger.error('[SummonerSearch] Error saving rate history entry:', error);
          }
        }
        
        logger.info(`[SummonerSearch] Rate history saved: ${addedCount} added, ${updatedCount} updated, ${failedCount} failed, ${skippedCount} skipped (${skippedCount - failedCount} already existed or missing matchId)`);
        
        // Save the latest entry from rateHistory (most recent match data from API)
        // This is the actual latest data from match history, not the currentEntry
        // ⚠️ CRITICAL: Skip entries with matchId starting with "current-" (current entry for display only)
        if (result.rateHistory && result.rateHistory.length > 0) {
          const latestEntry = result.rateHistory[result.rateHistory.length - 1]; // Last entry is the most recent
          if (latestEntry && latestEntry.matchId && !latestEntry.matchId.startsWith('current-')) {
            try {
              const { addRateHistory } = useAppStore.getState();
              await addRateHistory({
                matchId: latestEntry.matchId,
                date: new Date(latestEntry.date),
                tier: latestEntry.tier,
                rank: latestEntry.rank,
                lp: latestEntry.lp,
                wins: latestEntry.wins || 0,
                losses: latestEntry.losses || 0,
              });
              logger.info('[SummonerSearch] Saved latest rateHistory entry (most recent match data)');
            } catch (error) {
              logger.error('[SummonerSearch] Failed to save latest rateHistory entry:', error);
            }
          }
        }
      }

      // ⚠️ CRITICAL: Update current league entry if not already set
      // Note: fetch-rate-history API already returns only solo queue data,
      // but we explicitly set queueType to DEFAULTS.QUEUE_TYPE (RANKED_SOLO_5x5) for safety.
      // setCurrentLeagueEntry will also validate that it's solo queue.
      const currentState = useAppStore.getState();
      if (result.currentEntry && !currentState.currentLeagueEntry) {
        const entry: LeagueEntry = {
          leagueId: result.currentEntry.leagueId || '',
          queueType: DEFAULTS.QUEUE_TYPE, // Explicitly set to RANKED_SOLO_5x5
          tier: result.currentEntry.tier,
          rank: result.currentEntry.rank,
          leaguePoints: result.currentEntry.lp,
          wins: result.currentEntry.wins,
          losses: result.currentEntry.losses,
          veteran: false,
          inactive: false,
          freshBlood: false,
          hotStreak: false,
        };
        setCurrentLeagueEntry(entry); // This will validate it's solo queue
        
        // Save to database (solo queue only)
        // ⚠️ NOTE: Only save if leagueId is present (required for primary key)
        if (entry.leagueId && entry.leagueId.trim() !== '') {
          try {
            const { leagueEntryService } = await import('@/lib/db');
            await leagueEntryService.addOrUpdate(puuid, entry);
            logger.info('[SummonerSearch] Saved solo queue league entry from rate history to database');
          } catch (dbError) {
            logger.error('[SummonerSearch] Failed to save league entry from rate history to database:', dbError);
            // Don't throw - we still have the entry in memory
          }
        } else {
          logger.warn('[SummonerSearch] Skipping save of league entry - leagueId is missing');
        }
      }

      logger.info(`[SummonerSearch] Rate history fetched and saved: ${result.rateHistory?.length || 0} entries`);
    } catch (error) {
      logger.warn('[SummonerSearch] Error fetching rate history, but continuing:', error);
    }
  }, [setCurrentLeagueEntry]);

  const fetchAndSaveMatchDetails = useCallback(async (puuid: string, region: string, apiKey: string | null) => {
    try {
      if (!apiKey) {
        logger.warn('[SummonerSearch] API key not available for match details fetch');
        return;
      }

      // 既存の試合データを読み込んで、既存のmatchIdを取得
      const { loadMatches } = useAppStore.getState();
      await loadMatches();
      const existingMatches = useAppStore.getState().matches;
      const existingMatchIds = new Set(
        existingMatches.map(m => m.matchId).filter((id): id is string => !!id)
      );

      // マッチIDを取得
      const { RiotApiClient } = await import('@/lib/riot/client');
      const client = new RiotApiClient(apiKey, region);
      const allMatchIds = await client.getAllRankedMatchIds(puuid, 20);
      
      if (allMatchIds.length === 0) {
        return;
      }

      // 既存のmatchIdを除外
      const newMatchIds = allMatchIds.filter(matchId => !existingMatchIds.has(matchId));
      
      if (newMatchIds.length === 0) {
        logger.info('[SummonerSearch] All matches already exist in database, skipping fetch');
        return;
      }

      // 新しいmatchIdだけを詳細取得
      const response = await fetch(API_ENDPOINTS.RIOT.FETCH_MATCH_DETAILS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          puuid,
          region,
          apiKey,
          matchIds: newMatchIds, // 既存でないmatchIdのみを指定
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || '試合詳細の取得に失敗しました';
        logger.warn('[SummonerSearch] Failed to fetch match details:', errorMessage);
        return;
      }

      const result = await response.json();

      // Save match details to database
      if (result.matches && result.matches.length > 0) {
        const { addMatch } = useAppStore.getState();
        let addedCount = 0;
        let failedCount = 0;

        for (const matchData of result.matches) {
          try {
            // Skip if matchId is missing
            if (!matchData.matchId) {
              logger.warn('[SummonerSearch] Skipping match - missing matchId:', matchData);
              failedCount++;
              continue;
            }

            // 日付をDateオブジェクトに変換
            const match: Match = {
              ...matchData,
              matchId: matchData.matchId,
              date: new Date(matchData.date),
            };

            await addMatch(match);
            addedCount++;
          } catch (error) {
            logger.error('[SummonerSearch] Error saving match:', error);
            failedCount++;
          }
        }

        // データを再読み込み
        await loadMatches();

        logger.info(`[SummonerSearch] Match details saved: ${addedCount} added, ${failedCount} failed, ${allMatchIds.length - newMatchIds.length} already existed`);
      }
    } catch (error) {
      logger.warn('[SummonerSearch] Error fetching match details, but continuing:', error);
    }
  }, []);

  const search = useCallback(async (riotId: string, region: string) => {
    // Parse Riot ID (gameName#tagLine)
    const parts = riotId.split('#');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      const errorMsg = 'Riot IDを「ゲーム名#タグライン」の形式で入力してください（例: PlayerName#JP1）';
      logger.error('[SummonerSearch] Validation error:', errorMsg);
      throw new Error(errorMsg);
    }
    
    const gameName = parts[0].trim();
    const tagLine = parts[1].trim();

    setIsSearching(true);
    setLoading(true);
    setError(null);

    try {
      // Get API key from localStorage
      const apiKey = StorageService.getApiKey();
      const currentRegion = StorageService.getApiRegion() || region;
      
      if (!apiKey) {
        const errorMsg = 'APIキーが必要です。右上の「APIキー設定」からAPIキーを設定してください。';
        logger.error('[SummonerSearch] API key required:', errorMsg);
        throw new Error(errorMsg);
      }
      
      const url = `${API_ENDPOINTS.RIOT.ACCOUNT_BY_RIOT_ID}?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}&region=${currentRegion}&apiKey=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if data has summoner property or is the summoner itself
        const summonerData = data?.summoner || data;
        
        if (!summonerData) {
          logger.error('[SummonerSearch] Summoner data is null or undefined');
          logger.error('[SummonerSearch] Full response data:', JSON.stringify(data, null, 2));
          throw new Error('サマナー情報が不正です。レスポンスにサマナー情報が含まれていません。');
        }
        
        // Check if puuid exists (required)
        if (!summonerData.puuid) {
          logger.error('[SummonerSearch] Invalid summoner data - missing puuid');
          logger.error('[SummonerSearch] Summoner data:', JSON.stringify(summonerData, null, 2));
          throw new Error('サマナー情報が不正です。puuidが存在しません。');
        }
        
        // If name is missing, fetch from summoner API using puuid
        if (!summonerData.name) {
          logger.warn('[SummonerSearch] Summoner name is missing, fetching from API...');
          try {
            const { RiotApiClient } = await import('@/lib/riot/client');
            const apiKey = StorageService.getApiKey();
            const currentRegion = StorageService.getApiRegion() || region;
            if (apiKey) {
              const client = new RiotApiClient(apiKey, currentRegion);
              const fullSummonerData = await client.getSummonerByPuuid(summonerData.puuid);
              // Merge missing fields into summonerData
              if (fullSummonerData.name) {
                summonerData.name = fullSummonerData.name;
              }
              if (fullSummonerData.profileIconId) {
                summonerData.profileIconId = fullSummonerData.profileIconId;
              }
              if (fullSummonerData.summonerLevel) {
                summonerData.summonerLevel = fullSummonerData.summonerLevel;
              }
              if (fullSummonerData.id) {
                summonerData.id = fullSummonerData.id;
              }
            }
          } catch (error) {
            logger.warn('[SummonerSearch] Error fetching summoner name:', error);
          }
        }
        
        // Convert lastUpdated from string to Date if needed
        const summoner: Summoner = {
          ...summonerData,
          lastUpdated: summonerData.lastUpdated instanceof Date 
            ? summonerData.lastUpdated 
            : new Date(summonerData.lastUpdated),
        };
        
        setCurrentSummoner(summoner);
        
        // ⚠️ CRITICAL: Fetch league entry to display current rank (solo queue only)
        // This mistake has been made multiple times. DO NOT forget to:
        // 1. Specify queueType=RANKED_SOLO_5x5 in the API call
        // 2. Check that the returned entry is solo queue before setting it
        // 3. Save to database after validation
        try {
          // ⚠️ MUST specify queueType parameter explicitly - DO NOT rely on defaults
          const leagueResponse = await fetch(`${API_ENDPOINTS.RIOT.LEAGUE_BY_PUUID}?puuid=${encodeURIComponent(summoner.puuid)}&region=${currentRegion}&queueType=${DEFAULTS.QUEUE_TYPE}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`);
          if (leagueResponse.ok) {
            const leagueData = await leagueResponse.json();
            if (leagueData.entry) {
              const entry = extractLeagueEntry(leagueData.entry);
              // ⚠️ CRITICAL: Only set if it's solo queue (RANKED_SOLO_5x5)
              // This check has been missing multiple times. DO NOT REMOVE THIS CHECK.
              // DO NOT set flex queue or any other queue type entry.
              if (entry.queueType === 'RANKED_SOLO_5x5') {
                setCurrentLeagueEntry(entry);
                
                // Save to database (solo queue only)
                try {
                  const { leagueEntryService } = await import('@/lib/db');
                  await leagueEntryService.addOrUpdate(summoner.puuid, entry);
                  logger.info('[SummonerSearch] Saved solo queue league entry to database');
                } catch (dbError) {
                  logger.error('[SummonerSearch] Failed to save league entry to database:', dbError);
                  // Don't throw - we still have the entry in memory
                }
              } else {
                logger.warn('[SummonerSearch] Received non-solo queue entry, ignoring:', entry.queueType);
                // DO NOT set the entry - reject it
                // Also clear any existing non-solo queue entry from database
                try {
                  const { leagueEntryService } = await import('@/lib/db');
                  await leagueEntryService.delete(summoner.puuid);
                } catch (dbError) {
                  logger.error('[SummonerSearch] Failed to delete non-solo queue entry from database:', dbError);
                }
              }
            } else {
              // No entry found - clear from database
              try {
                const { leagueEntryService } = await import('@/lib/db');
                await leagueEntryService.delete(summoner.puuid);
                setCurrentLeagueEntry(null);
              } catch (dbError) {
                logger.error('[SummonerSearch] Failed to delete league entry from database:', dbError);
              }
            }
          }
        } catch (error) {
          logger.error('[SummonerSearch] Failed to fetch league entry:', error);
          // Don't throw - we can still use the summoner even if league fetch fails
        }
        
        // Save to database on client-side
        try {
          const { summonerService } = await import('@/lib/db');
          await summonerService.addOrUpdate(summoner);
        } catch (error) {
          logger.error('[SummonerSearch] Failed to save summoner to database:', error);
          // Don't throw - we can still use the summoner even if save fails
        }
        
        // Automatically fetch rate history from match history
        await fetchAndSaveRateHistory(summoner.puuid, currentRegion, apiKey);
        
        // Automatically fetch match details
        await fetchAndSaveMatchDetails(summoner.puuid, currentRegion, apiKey);
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
      } else {
        // Handle error response
        const errorData = await response.json();
        const errorMessage = errorData.error || 'サマナーが見つかりませんでした';
        
        // Create error object with status code for error handler
        const error = new Error(errorMessage);
        (error as any).statusCode = response.status;
        
        // Use error handler to get user-friendly message
        throw new Error(handleRiotApiError(error, API_ENDPOINTS.RIOT.ACCOUNT_BY_RIOT_ID));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '検索に失敗しました';
      logger.error('[SummonerSearch] Search error:', error);
      logger.error('[SummonerSearch] Error message:', errorMessage);
      setError(errorMessage);
      throw error; // Re-throw to let component handle it
    } finally {
      setIsSearching(false);
      setLoading(false);
    }
  }, [setCurrentSummoner, setCurrentLeagueEntry, setLoading, setError, fetchAndSaveRateHistory, fetchAndSaveMatchDetails, onSuccess]);

  return { isSearching, search };
}

