'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import SummonerSearch from './components/SummonerSearch';
import RateChart from './components/RateChart';
import GoalSetting from './components/GoalSetting';
import StatsPanel from './components/StatsPanel';
import MatchDetailsPanel from './components/MatchDetailsPanel';
import LaneStatsPanel from './components/LaneStatsPanel';
import WinLossAnalysis from './components/WinLossAnalysis';
import TimeOfDayAnalysis from './components/TimeOfDayAnalysis';
import SkillGoalSetting from './components/SkillGoalSetting';
import MotivationPanel from './components/MotivationPanel';
import ApiKeySettings from './components/ApiKeySettings';
import { Summoner, LeagueEntry, Match } from '@/types';
import { STORAGE_KEYS, API_ENDPOINTS, DEFAULTS } from '@/lib/constants';
import { extractLeagueEntry } from '@/lib/utils/leagueEntry';
import { StorageService } from '@/lib/utils/storage';
import { logger } from '@/lib/utils/logger';

export default function Home() {
  const { loadRateHistory, loadGoals, loadMatches, loadSkillGoals, currentSummoner, currentLeagueEntry, setCurrentSummoner, setCurrentLeagueEntry, setLoading, setError, addRateHistory, addMatch } = useAppStore();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isApiKeyExpanded, setIsApiKeyExpanded] = useState(false);
  const [riotId, setRiotId] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Migrate from legacy DBs once (old DBs are kept, not deleted)
      const { runMigrationIfNeeded } = await import('@/lib/db');
      await runMigrationIfNeeded();

      // Load initial data
      loadRateHistory();
      loadGoals();
      loadMatches();
      loadSkillGoals();
    };

    // Load saved summoner from database and fetch solo queue league entry
    const loadSavedSummoner = async () => {
      try {
        const { summonerService } = await import('@/lib/db');
        const summoners = await summonerService.getAll();
        if (summoners.length > 0) {
          // Get the most recently updated summoner
          const latestSummoner = summoners.sort((a, b) => 
            new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
          )[0];
          setCurrentSummoner(latestSummoner);
          
          // ⚠️ CRITICAL: Load solo queue league entry on startup
          // First try to load from database, then fetch from API if not available
          // This ensures we always have solo queue data, not cached flex queue data
          try {
            // Try to load from database first
            const { leagueEntryService } = await import('@/lib/db');
            const savedEntry = await leagueEntryService.getByPuuid(latestSummoner.puuid);
            
            if (savedEntry && savedEntry.queueType === 'RANKED_SOLO_5x5') {
              // Use saved entry (already validated as solo queue by getByPuuid)
              setCurrentLeagueEntry(savedEntry);
              logger.info('[Home] Loaded solo queue league entry from database on startup');
            } else {
              // No valid entry in database, fetch from API
              const apiKey = StorageService.getApiKey();
              const region = latestSummoner.region || StorageService.getApiRegion() || 'jp1';
              
              if (apiKey) {
                // Fetch solo queue league entry
                const leagueResponse = await fetch(`${API_ENDPOINTS.RIOT.LEAGUE_BY_PUUID}?puuid=${encodeURIComponent(latestSummoner.puuid)}&region=${region}&queueType=${DEFAULTS.QUEUE_TYPE}&apiKey=${encodeURIComponent(apiKey)}`);
                if (leagueResponse.ok) {
                  const leagueData = await leagueResponse.json();
                  if (leagueData.entry) {
                    const entry = extractLeagueEntry(leagueData.entry);
                    // ⚠️ CRITICAL: Only set if it's solo queue (RANKED_SOLO_5x5)
                    // This check has been missing multiple times. DO NOT REMOVE THIS CHECK.
                    if (entry.queueType === 'RANKED_SOLO_5x5') {
                      setCurrentLeagueEntry(entry);
                      // Save to database
                      await leagueEntryService.addOrUpdate(latestSummoner.puuid, entry);
                      logger.info('[Home] Fetched and saved solo queue league entry on startup');
                    } else {
                      logger.warn('[Home] Received non-solo queue entry on startup, ignoring:', entry.queueType);
                      // Display: rank none. Do NOT delete from DB - keep history for past rank graph.
                      setCurrentLeagueEntry(null);
                    }
                  } else {
                    // No league entry found - display as rank none. Do NOT delete from DB - keep history.
                    setCurrentLeagueEntry(null);
                  }
                } else {
                  logger.warn('[Home] Failed to fetch league entry on startup');
                  // Clear any cached entry
                  setCurrentLeagueEntry(null);
                }
              } else {
                logger.warn('[Home] API key not available, cannot fetch league entry on startup');
                // Clear any cached entry
                setCurrentLeagueEntry(null);
              }
            }
          } catch (error) {
            logger.error('[Home] Error loading league entry on startup:', error);
            // Clear any cached entry on error
            setCurrentLeagueEntry(null);
          }
        }
      } catch (error) {
        logger.error('[Home] Failed to load saved summoner:', error);
      }
    };

    void init().then(() => loadSavedSummoner());
  }, [loadRateHistory, loadGoals, loadMatches, loadSkillGoals, setCurrentSummoner, setCurrentLeagueEntry]);

  useEffect(() => {
    // Load Riot ID from localStorage
    const savedRiotId = StorageService.getRiotId();
    if (savedRiotId) {
      setRiotId(savedRiotId);
    }
  }, []); // Load once on mount

  // Update Riot ID when currentSummoner changes (if not already set)
  useEffect(() => {
    if (currentSummoner && !riotId) {
      // If Riot ID is not in localStorage, try to get it from currentSummoner.name
      // But ideally it should be saved from the search
      const savedRiotId = StorageService.getRiotId();
      if (savedRiotId) {
        setRiotId(savedRiotId);
      }
    }
  }, [currentSummoner, riotId]);
  
  // Close both panels when search is successful
  const handleSearchSuccess = () => {
    setIsSearchExpanded(false);
    setIsApiKeyExpanded(false);
  };

  // Handle update button click
  const handleUpdate = async () => {
    if (!currentSummoner) {
      alert('サマナーが選択されていません');
      return;
    }

    setIsUpdating(true);
    setLoading(true);
    setError(null);

    try {
      const apiKey = StorageService.getApiKey();
      const region = StorageService.getApiRegion() || currentSummoner.region;
      
      if (!apiKey) {
        alert('APIキーが必要です。右上の「APIキー設定」からAPIキーを設定してください。');
        setIsUpdating(false);
        setLoading(false);
        return;
      }

      // 1. Update summoner info
      try {
        const summonerResponse = await fetch(`${API_ENDPOINTS.RIOT.SUMMONER_BY_PUUID}?puuid=${encodeURIComponent(currentSummoner.puuid)}&region=${region}&apiKey=${encodeURIComponent(apiKey)}`);
        if (summonerResponse.ok) {
          const summonerData = await summonerResponse.json();
          const updatedSummoner: Summoner = {
            ...summonerData,
            lastUpdated: new Date(),
          };
          setCurrentSummoner(updatedSummoner);
          
          // Save to database
          const { summonerService } = await import('@/lib/db');
          await summonerService.addOrUpdate(updatedSummoner);
        }
      } catch (error) {
        logger.warn('[Update] Failed to update summoner info:', error);
      }

      // ⚠️ CRITICAL: Update league entry (solo queue only)
      // This mistake has been made multiple times. DO NOT forget to:
      // 1. Specify queueType=RANKED_SOLO_5x5 in the API call
      // 2. Check that the returned entry is solo queue before setting it
      // 3. Save to database after validation
      try {
        // ⚠️ MUST specify queueType parameter explicitly - DO NOT rely on defaults
        const leagueResponse = await fetch(`${API_ENDPOINTS.RIOT.LEAGUE_BY_PUUID}?puuid=${encodeURIComponent(currentSummoner.puuid)}&region=${region}&queueType=${DEFAULTS.QUEUE_TYPE}&apiKey=${encodeURIComponent(apiKey)}`);
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
                await leagueEntryService.addOrUpdate(currentSummoner.puuid, entry);
                logger.info('[Update] Saved solo queue league entry to database');
              } catch (dbError) {
                logger.error('[Update] Failed to save league entry to database:', dbError);
                // Don't throw - we still have the entry in memory
              }
            } else {
              logger.warn('[Update] Received non-solo queue entry, ignoring:', entry.queueType);
              // Display: rank none. Do NOT delete from DB - keep history for past rank graph.
              setCurrentLeagueEntry(null);
            }
          } else {
            // No entry found - display as rank none. Do NOT delete from DB - keep history.
            setCurrentLeagueEntry(null);
          }
        }
      } catch (error) {
        logger.warn('[Update] Failed to update league entry:', error);
      }

      // 3. Fetch and update rate history
      try {
        const rateHistoryResponse = await fetch(API_ENDPOINTS.RIOT.FETCH_RATE_HISTORY, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            puuid: currentSummoner.puuid,
            region: region,
            apiKey: apiKey,
            maxMatches: 100,
          }),
        });

        if (rateHistoryResponse.ok) {
          const result = await rateHistoryResponse.json();

          if (result.rateHistory && Array.isArray(result.rateHistory)) {
            const { rateHistoryService } = await import('@/lib/db');
            const { rateHistory: currentRateHistory } = useAppStore.getState();

            // Get existing matchIds to avoid re-fetching and re-saving
            const existingMatchIds = new Set(
              currentRateHistory.map(r => r.matchId).filter((id): id is string => !!id)
            );

            let successCount = 0;
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
                const entryDateOnly = new Date(entryDate);
                entryDateOnly.setHours(0, 0, 0, 0);
                const entryDateOnlyTime = entryDateOnly.getTime();
                
                // ⚠️ CRITICAL: Skip entries for today or future dates
                // These are not based on match history and should not be saved
                if (entryDateOnlyTime >= todayTime) {
                  skippedCount++;
                  continue;
                }
                
                await addRateHistory({
                  matchId: entry.matchId,
                  date: entryDate,
                  tier: entry.tier,
                  rank: entry.rank,
                  lp: entry.lp,
                  wins: entry.wins || 0,
                  losses: entry.losses || 0,
                });
                successCount++;
                existingMatchIds.add(entry.matchId);
              } catch (error) {
                logger.error('[Update] Failed to add rate history entry:', error);
                failedCount++;
              }
            }

            logger.info(`[Update] Rate history updated: ${successCount} added/updated, ${failedCount} failed, ${skippedCount} skipped (${skippedCount - failedCount} already existed or missing matchId)`);
            
            // Save the latest entry from rateHistory (most recent match data from API)
            // This is the actual latest data from match history, not the currentEntry
            // ⚠️ CRITICAL: Skip entries with matchId starting with "current-" (current entry for display only)
            if (result.rateHistory && result.rateHistory.length > 0) {
              const latestEntry = result.rateHistory[result.rateHistory.length - 1]; // Last entry is the most recent
              if (latestEntry && latestEntry.matchId && !latestEntry.matchId.startsWith('current-')) {
                try {
                  await addRateHistory({
                    matchId: latestEntry.matchId,
                    date: new Date(latestEntry.date),
                    tier: latestEntry.tier,
                    rank: latestEntry.rank,
                    lp: latestEntry.lp,
                    wins: latestEntry.wins || 0,
                    losses: latestEntry.losses || 0,
                  });
                  logger.info('[Update] Saved latest rateHistory entry (most recent match data)');
                } catch (error) {
                  logger.error('[Update] Failed to save latest rateHistory entry:', error);
                }
              }
            }
          } else {
          }

          // Update league entry for display
          // Note: update API doesn't return leagueId, so we can't save it to database
          // The league entry should already be saved from the earlier update step
          if (result.currentEntry) {
            const entry: LeagueEntry = {
              leagueId: result.currentEntry.leagueId || '',
              queueType: 'RANKED_SOLO_5x5', // Explicitly set to solo queue
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
          }
        }
        if (!rateHistoryResponse.ok) {
          const errBody = await rateHistoryResponse.text();
          if (rateHistoryResponse.status === 404) {
            try {
              const errJson = JSON.parse(errBody) as { error?: string };
              if (errJson.error === 'No ranked solo queue entry found') {
                const msg = 'ソロキューでランクがありません。LP履歴を表示するにはソロキューでランクを取得してください。';
                setError(msg);
                alert(msg);
              } else {
                const msg = errJson.error ?? 'レート履歴の取得に失敗しました';
                setError(msg);
                alert(msg);
              }
            } catch {
              const msg = 'レート履歴の取得に失敗しました';
              setError(msg);
              alert(msg);
            }
          }
        }
      } catch (error) {
        logger.warn('[Update] Failed to fetch rate history:', error);
      }

      // 4. Fetch and update match details
      try {
        // 既存の試合データを読み込んで、既存のmatchIdを取得
        await loadMatches();
        const existingMatches = useAppStore.getState().matches;
        const existingMatchIds = new Set(
          existingMatches.map(m => m.matchId).filter((id): id is string => !!id)
        );

        // マッチIDを取得
        const { RiotApiClient } = await import('@/lib/riot/client');
        const client = new RiotApiClient(apiKey, region);
        const allMatchIds = await client.getAllRankedMatchIds(currentSummoner.puuid, 20);
        
        if (allMatchIds.length > 0) {
          // 既存のmatchIdを除外
          const newMatchIds = allMatchIds.filter(matchId => !existingMatchIds.has(matchId));
          
          if (newMatchIds.length === 0) {
            logger.info('[Update] All matches already exist in database, skipping fetch');
          } else {
            // 新しいmatchIdだけを詳細取得
            const matchDetailsResponse = await fetch(API_ENDPOINTS.RIOT.FETCH_MATCH_DETAILS, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                puuid: currentSummoner.puuid,
                region: region,
                apiKey: apiKey,
                matchIds: newMatchIds, // 既存でないmatchIdのみを指定
              }),
            });

            if (matchDetailsResponse.ok) {
              const result = await matchDetailsResponse.json();
              
              if (result.matches && Array.isArray(result.matches)) {
                let addedCount = 0;
                let failedCount = 0;

                for (const matchData of result.matches) {
                  try {
                    // Skip if matchId is missing
                    if (!matchData.matchId) {
                      logger.warn('[Update] Skipping match - missing matchId:', matchData);
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
                    logger.error('[Update] Failed to add match:', error);
                    failedCount++;
                  }
                }

                // データを再読み込み
                await loadMatches();

                logger.info(`[Update] Match details updated: ${addedCount} added, ${failedCount} failed, ${allMatchIds.length - newMatchIds.length} already existed`);
              }
            }
          }
        }
      } catch (error) {
        logger.warn('[Update] Failed to fetch match details:', error);
      }

      alert('データを更新しました');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新に失敗しました';
      logger.error('[Update] Update error:', error);
      alert(errorMessage);
    } finally {
      setIsUpdating(false);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            NovaChart
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            LoL レート推移トラッカー & 分析ツール
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="lg:col-span-3">
            <SummonerSearch 
              isExpanded={isSearchExpanded} 
              setIsExpanded={setIsSearchExpanded}
              onSearchSuccess={handleSearchSuccess}
            />
          </div>
          <div>
            <ApiKeySettings 
              isExpanded={isApiKeyExpanded} 
              setIsExpanded={setIsApiKeyExpanded}
            />
          </div>
        </div>

        {(currentSummoner || riotId) && (
          <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Player Icon with Level Overlay - Always show if we have summoner data */}
                {currentSummoner ? (
                  <div className="relative">
                    <img
                      src={`https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${currentSummoner.profileIconId}.png`}
                      alt="Profile Icon"
                      className="w-16 h-16 rounded-full border-2 border-gray-300 dark:border-gray-600"
                      onError={(e) => {
                        // Fallback to a default icon if the image fails to load
                        (e.target as HTMLImageElement).src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/0.png`;
                      }}
                    />
                    {/* Level Badge */}
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-gray-800">
                      {currentSummoner.summonerLevel}
                    </div>
                  </div>
                ) : (
                  // Placeholder icon when summoner data is not available
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-400 dark:text-gray-500 text-xs">?</span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-semibold text-lg">{riotId || currentSummoner?.name || 'サマナー未選択'}</p>
                    {currentSummoner && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {currentSummoner.region}
                      </p>
                    )}
                  </div>
                  {currentSummoner && (
                    <button
                      onClick={handleUpdate}
                      disabled={isUpdating}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? '更新中...' : 'Update'}
                    </button>
                  )}
                </div>
              </div>
              
              {currentLeagueEntry && (
                <div className="text-right">
                  <p className="font-bold text-xl">
                    {currentLeagueEntry.tier} {currentLeagueEntry.rank}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentLeagueEntry.leaguePoints} LP | {currentLeagueEntry.wins}勝 {currentLeagueEntry.losses}敗
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <RateChart />
            <MatchDetailsPanel />
            <LaneStatsPanel />
            <WinLossAnalysis />
            <TimeOfDayAnalysis />
          </div>
          <div className="space-y-6">
            <GoalSetting />
            <SkillGoalSetting />
            <StatsPanel />
            <MotivationPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
