/**
 * Analytics and Progress Calculation
 * 
 * ⚠️ CRITICAL: This module ONLY processes RANKED_SOLO_5x5 (solo queue) data.
 * 
 * IMPORTANT: Before modifying this file, read:
 * - docs/development/solo-queue-only-guidelines.md
 * 
 * This mistake has been made multiple times. DO NOT accept any other queue types.
 * All statistics, progress calculations, and required matches calculations
 * MUST only use solo queue data.
 */

import { RateHistory, Goal, Match } from '@/types';
import { tierRankToLP, lpToTierRank } from '@/lib/riot/client';

/**
 * Calculate time-weighted win rate from rate history
 * More recent entries have higher weight
 */
function calculateTimeWeightedWinRate(rateHistory: RateHistory[]): number {
  if (rateHistory.length === 0) {
    return 0.5; // Default 50%
  }

  const sorted = [...rateHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const now = Date.now();
  const firstDate = new Date(sorted[0].date).getTime();
  const timeRange = now - firstDate;

  if (timeRange === 0) {
    // All entries are at the same time, use simple average
    const totalWins = sorted.reduce((sum, r) => sum + r.wins, 0);
    const totalLosses = sorted.reduce((sum, r) => sum + r.losses, 0);
    const totalGames = totalWins + totalLosses;
    return totalGames > 0 ? totalWins / totalGames : 0.5;
  }

  // Calculate weighted wins and losses
  let weightedWins = 0;
  let weightedLosses = 0;

  for (const entry of sorted) {
    const entryTime = new Date(entry.date).getTime();
    // Weight: more recent = higher weight (linear decay)
    // Weight ranges from 0.1 (oldest) to 1.0 (newest)
    const age = (now - entryTime) / timeRange; // 0 (newest) to 1 (oldest)
    const weight = 0.1 + (1 - age) * 0.9; // Linear weight from 0.1 to 1.0
    
    weightedWins += entry.wins * weight;
    weightedLosses += entry.losses * weight;
  }

  const totalWeightedGames = weightedWins + weightedLosses;
  return totalWeightedGames > 0 ? weightedWins / totalWeightedGames : 0.5;
}

/**
 * Calculate time-weighted win rate from matches
 * More recent matches have higher weight
 */
function calculateTimeWeightedWinRateFromMatches(matches: Match[]): number {
  if (matches.length === 0) {
    return 0.5; // Default 50%
  }

  const now = Date.now();
  const firstDate = new Date(matches[0].date).getTime();
  const timeRange = now - firstDate;

  if (timeRange === 0) {
    // All matches are at the same time, use simple average
    const wins = matches.filter((m) => m.win).length;
    return wins / matches.length;
  }

  // Calculate weighted wins and losses
  let weightedWins = 0;
  let weightedLosses = 0;

  for (const match of matches) {
    const matchTime = new Date(match.date).getTime();
    // Weight: more recent = higher weight
    const age = (now - matchTime) / timeRange; // 0 (newest) to 1 (oldest)
    const weight = 0.1 + (1 - age) * 0.9; // Linear weight from 0.1 to 1.0
    
    if (match.win) {
      weightedWins += weight;
    } else {
      weightedLosses += weight;
    }
  }

  const totalWeightedGames = weightedWins + weightedLosses;
  return totalWeightedGames > 0 ? weightedWins / totalWeightedGames : 0.5;
}

export interface ProgressResult {
  currentLP: number;
  targetLP: number;
  progressPercentage: number;
  lpRemaining: number;
  daysRemaining: number;
  averageLPPerDay: number;
}

export interface RequiredMatchesResult {
  matchesNeeded: number;
  daysNeeded: number;
  winRate: number;
  matchesPerDay: number;
}

/**
 * Calculate progress towards a goal
 */
export function calculateProgress(
  rateHistory: RateHistory[],
  goal: Goal
): ProgressResult | null {
  if (rateHistory.length === 0) {
    return null;
  }

  const sortedHistory = [...rateHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const latest = sortedHistory[sortedHistory.length - 1];
  const currentLP = tierRankToLP(latest.tier, latest.rank, latest.lp);
  const targetLP = tierRankToLP(goal.targetTier, goal.targetRank, goal.targetLP);

  // Find the starting LP at the time the goal was created
  const createdAt = new Date(goal.createdAt).getTime();
  const entriesBeforeCreatedAt = sortedHistory.filter(e => new Date(e.date).getTime() <= createdAt);
  let startLP: number;
  
  if (entriesBeforeCreatedAt.length > 0) {
    // Get the latest entry before or equal to createdAt
    const closestEntry = entriesBeforeCreatedAt[entriesBeforeCreatedAt.length - 1];
    startLP = tierRankToLP(closestEntry.tier, closestEntry.rank, closestEntry.lp);
  } else if (sortedHistory.length > 0) {
    // If no entry before createdAt, use the first entry (earliest available)
    const firstEntry = sortedHistory[0];
    startLP = tierRankToLP(firstEntry.tier, firstEntry.rank, firstEntry.lp);
  } else {
    return null;
  }

  // Calculate progress based on start LP
  const totalLPNeeded = targetLP - startLP;
  const lpGained = currentLP - startLP;
  const lpRemaining = targetLP - currentLP;

  if (currentLP >= targetLP) {
    return {
      currentLP,
      targetLP,
      progressPercentage: 100,
      lpRemaining: 0,
      daysRemaining: 0,
      averageLPPerDay: 0,
    };
  }

  // If target is lower than start (downgrade goal), handle differently
  if (totalLPNeeded <= 0) {
    // This means target is actually lower than start, which doesn't make sense for progress
    // But we'll still calculate based on absolute difference
    const absoluteNeeded = Math.abs(totalLPNeeded);
    const absoluteGained = Math.abs(lpGained);
    const progressPercentage = absoluteNeeded > 0 
      ? Math.min(100, (absoluteGained / absoluteNeeded) * 100)
      : 0;
    
    return {
      currentLP,
      targetLP,
      progressPercentage: Math.round(progressPercentage * 100) / 100,
      lpRemaining,
      daysRemaining: 0,
      averageLPPerDay: 0,
    };
  }

  // Calculate progress percentage: (LP gained / LP needed) * 100
  const progressPercentage = Math.min(100, (lpGained / totalLPNeeded) * 100);

  // Calculate average LP change per day
  if (sortedHistory.length < 2) {
    return {
      currentLP,
      targetLP,
      progressPercentage: Math.round(progressPercentage * 100) / 100,
      lpRemaining,
      daysRemaining: Infinity,
      averageLPPerDay: 0,
    };
  }

  // Use recent trend (last 60 days or half of the data, whichever is smaller)
  // This gives more weight to recent performance
  const recentDays = 60;
  const lastDate = new Date(sortedHistory[sortedHistory.length - 1].date);
  const cutoffDate = new Date(lastDate);
  cutoffDate.setDate(cutoffDate.getDate() - recentDays);
  
  // Find the index of the first entry within the recent period
  let startIndex = 0;
  for (let i = sortedHistory.length - 1; i >= 0; i--) {
    const entryDate = new Date(sortedHistory[i].date);
    if (entryDate < cutoffDate) {
      startIndex = i + 1;
      break;
    }
  }
  
  // Use at least 2 entries, or use half of the data if we have less than 60 days of data
  const minEntries = Math.max(2, Math.floor(sortedHistory.length / 2));
  const effectiveStartIndex = Math.max(0, Math.min(startIndex, sortedHistory.length - minEntries));
  
  const firstLP = tierRankToLP(
    sortedHistory[effectiveStartIndex].tier,
    sortedHistory[effectiveStartIndex].rank,
    sortedHistory[effectiveStartIndex].lp
  );
  const lastLP = tierRankToLP(
    sortedHistory[sortedHistory.length - 1].tier,
    sortedHistory[sortedHistory.length - 1].rank,
    sortedHistory[sortedHistory.length - 1].lp
  );

  const firstDate = new Date(sortedHistory[effectiveStartIndex].date);
  const daysElapsed = Math.max(
    1,
    (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const averageLPPerDay = (lastLP - firstLP) / daysElapsed;

  const daysRemaining =
    averageLPPerDay > 0 ? Math.ceil(lpRemaining / averageLPPerDay) : Infinity;

  return {
    currentLP,
    targetLP,
    progressPercentage: Math.round(progressPercentage * 100) / 100,
    lpRemaining,
    daysRemaining: daysRemaining === Infinity ? 0 : daysRemaining,
    averageLPPerDay: Math.round(averageLPPerDay * 100) / 100,
  };
}

/**
 * Calculate required matches to reach goal based on win rate and play frequency
 * 
 * ⚠️ CRITICAL: This function ONLY accepts RANKED_SOLO_5x5 (solo queue) data.
 * This mistake has been made multiple times. DO NOT accept any other queue types.
 */
export function calculateRequiredMatches(
  rateHistory: RateHistory[],
  matches: Match[],
  goal: Goal,
  matchesPerDay: number = 3,
  currentLeagueEntry?: { queueType?: string; wins?: number; losses?: number; tier?: string; rank?: string; leaguePoints?: number } | null | undefined
): RequiredMatchesResult | null {
  if (rateHistory.length === 0 && !currentLeagueEntry) {
    return null;
  }

  // ⚠️ CRITICAL: Only calculate for solo queue (RANKED_SOLO_5x5)
  // This check has been missing multiple times. DO NOT REMOVE THIS CHECK.
  // If currentLeagueEntry exists, it must be solo queue. Otherwise, reject it.
  if (currentLeagueEntry && currentLeagueEntry.queueType !== 'RANKED_SOLO_5x5') {
    // DO NOT process flex queue or any other queue type data
    return null;
  }
  
  let currentLP: number;
  if (currentLeagueEntry && currentLeagueEntry.tier && currentLeagueEntry.rank !== undefined && currentLeagueEntry.leaguePoints !== undefined) {
    currentLP = tierRankToLP(currentLeagueEntry.tier, currentLeagueEntry.rank, currentLeagueEntry.leaguePoints);
  } else if (rateHistory.length > 0) {
    const latest = rateHistory[rateHistory.length - 1];
    currentLP = tierRankToLP(latest.tier, latest.rank, latest.lp);
  } else {
    return null;
  }
  
  const targetLP = tierRankToLP(goal.targetTier, goal.targetRank, goal.targetLP);
  const lpNeeded = targetLP - currentLP;

  if (lpNeeded <= 0) {
    return {
      matchesNeeded: 0,
      daysNeeded: 0,
      winRate: 0,
      matchesPerDay,
    };
  }

  // Calculate win rate with time-weighted average (more recent data has higher weight)
  let winRate = 0.5; // Default 50%
  
  if (currentLeagueEntry && currentLeagueEntry.wins !== undefined && currentLeagueEntry.losses !== undefined) {
    // Use currentLeagueEntry if available, but also consider recent rate history for better accuracy
    const totalGames = currentLeagueEntry.wins + currentLeagueEntry.losses;
    if (totalGames > 0 && rateHistory.length === 0) {
      // Only use currentLeagueEntry if we don't have rate history
      winRate = currentLeagueEntry.wins / totalGames;
    } else if (rateHistory.length > 0) {
      // Use time-weighted average from rate history (prefer recent data)
      winRate = calculateTimeWeightedWinRate(rateHistory);
    } else {
      winRate = currentLeagueEntry.wins / totalGames;
    }
  } else if (matches.length > 0) {
    // Use time-weighted average from matches
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    winRate = calculateTimeWeightedWinRateFromMatches(sortedMatches);
  } else if (rateHistory.length > 0) {
    // Use time-weighted average from rate history
    winRate = calculateTimeWeightedWinRate(rateHistory);
  }

  // Average LP gain per win (assuming +15 LP per win, -15 LP per loss)
  // This is a simplified model - actual LP gains vary
  const avgLPPerMatch = winRate * 15 - (1 - winRate) * 15;
  
  if (avgLPPerMatch <= 0) {
    return null; // Cannot reach goal with current win rate
  }

  const matchesNeeded = Math.ceil(lpNeeded / avgLPPerMatch);
  const daysNeeded = Math.ceil(matchesNeeded / matchesPerDay);

  return {
    matchesNeeded,
    daysNeeded,
    winRate: Math.round(winRate * 10000) / 100, // Percentage with 2 decimals
    matchesPerDay,
  };
}

/**
 * Calculate statistics from rate history
 * 
 * ⚠️ CRITICAL: This function ONLY accepts RANKED_SOLO_5x5 (solo queue) data.
 * This mistake has been made multiple times. DO NOT accept any other queue types.
 * 
 * Rules:
 * - If currentLeagueEntry exists, it MUST be RANKED_SOLO_5x5
 * - If currentLeagueEntry is not solo queue, return null immediately
 * - DO NOT use conditions like: !currentLeagueEntry || currentLeagueEntry.queueType === 'RANKED_SOLO_5x5'
 *   (This would return true when currentLeagueEntry is null, which is wrong)
 */
export interface RateStatistics {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  averageLPChange: number;
  totalLPChange: number;
  currentTier: string;
  currentRank: string;
  currentLP: number;
  peakLP: number;
  peakTier: string;
  peakRank: string;
}

export function calculateStatistics(rateHistory: RateHistory[], currentLeagueEntry?: { queueType?: string; wins?: number; losses?: number; tier?: string; rank?: string; leaguePoints?: number } | null | undefined): RateStatistics | null {
  // ⚠️ CRITICAL: Only calculate statistics for solo queue (RANKED_SOLO_5x5)
  // This check has been missing multiple times. DO NOT REMOVE THIS CHECK.
  // If currentLeagueEntry exists, it must be solo queue. Otherwise, reject it.
  if (currentLeagueEntry && currentLeagueEntry.queueType !== 'RANKED_SOLO_5x5') {
    // If currentLeagueEntry is not solo queue, return null immediately
    // DO NOT process flex queue or any other queue type data
    return null;
  }

  if (rateHistory.length === 0 && !currentLeagueEntry) {
    return null;
  }
  
  const sorted = [...rateHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Use currentLeagueEntry for current tier/rank/LP if available and it's solo queue
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const first = sorted.length > 0 ? sorted[0] : null;

  // Use currentLeagueEntry for wins/losses if available (solo queue only, no weighting)
  let totalWins: number;
  let totalLosses: number;
  let totalGames: number;
  
  if (currentLeagueEntry && currentLeagueEntry.wins !== undefined && currentLeagueEntry.losses !== undefined) {
    // Use currentLeagueEntry for current wins/losses (solo queue only, all-time total)
    totalWins = currentLeagueEntry.wins;
    totalLosses = currentLeagueEntry.losses;
    totalGames = totalWins + totalLosses;
  } else if (sorted.length > 0) {
    // Fallback to rateHistory (sum all wins/losses, no weighting)
    totalWins = sorted.reduce((sum, r) => sum + r.wins, 0);
    totalLosses = sorted.reduce((sum, r) => sum + r.losses, 0);
    totalGames = totalWins + totalLosses;
  } else {
    return null;
  }

  // Use currentLeagueEntry for current tier/rank/LP if available (must be solo queue)
  let currentTier: string;
  let currentRank: string;
  let currentLP: number;
  let currentLPTotal: number;
  
  if (currentLeagueEntry && currentLeagueEntry.tier && currentLeagueEntry.rank !== undefined && currentLeagueEntry.leaguePoints !== undefined) {
    currentTier = currentLeagueEntry.tier;
    currentRank = currentLeagueEntry.rank;
    currentLP = currentLeagueEntry.leaguePoints;
    currentLPTotal = tierRankToLP(currentTier, currentRank, currentLP);
  } else if (latest) {
    currentTier = latest.tier;
    currentRank = latest.rank;
    currentLP = latest.lp;
    currentLPTotal = tierRankToLP(currentTier, currentRank, currentLP);
  } else {
    return null;
  }

  const firstLP = first ? tierRankToLP(first.tier, first.rank, first.lp) : currentLPTotal;
  const totalLPChange = currentLPTotal - firstLP;

  // Find peak LP
  let peakLP = currentLPTotal;
  let peakTier = currentTier;
  let peakRank = currentRank;
  
  for (const entry of sorted) {
    const lp = tierRankToLP(entry.tier, entry.rank, entry.lp);
    if (lp > peakLP) {
      peakLP = lp;
      peakTier = entry.tier;
      peakRank = entry.rank;
    }
  }

  const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
  const averageLPChange = sorted.length > 1 ? totalLPChange / (sorted.length - 1) : 0;

  return {
    totalGames,
    wins: totalWins,
    losses: totalLosses,
    winRate: Math.round(winRate * 100) / 100,
    averageLPChange: Math.round(averageLPChange * 100) / 100,
    totalLPChange: Math.round(totalLPChange),
    currentTier,
    currentRank,
    currentLP,
    peakLP,
    peakTier,
    peakRank,
  };
}

