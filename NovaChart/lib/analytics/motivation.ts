/**
 * Motivation Analytics
 * 
 * モチベーション向上のための指標を計算します。
 * 連勝記録、ベストパフォーマンス、達成バッジなどを提供します。
 */

import { Match } from '@/types';
import { rateMatch, MatchRatingResult } from './matchRating';

export interface WinStreak {
  current: number;
  longest: number;
  longestStartDate: Date | null;
  longestEndDate: Date | null;
}

export interface BestPerformance {
  match: Match;
  rating: MatchRatingResult;
  date: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  achieved: boolean;
  achievedDate?: Date;
  progress?: number; // 0-100
  target?: number;
  current?: number;
}

export interface WeeklyMonthlyProgress {
  weekly: {
    wins: number;
    losses: number;
    winRate: number;
    matchesPlayed: number;
    lpGained: number;
  };
  monthly: {
    wins: number;
    losses: number;
    winRate: number;
    matchesPlayed: number;
    lpGained: number;
  };
}

export interface MotivationData {
  winStreak: WinStreak;
  bestPerformance: BestPerformance | null;
  achievements: Achievement[];
  weeklyMonthlyProgress: WeeklyMonthlyProgress;
}

/**
 * モチベーションデータを計算
 * @param matches 試合データの配列（日付順にソート済みを想定）
 * @param currentLP 現在のLP（週間/月間のLP変動計算用）
 * @param lpHistory 過去のLP履歴（週間/月間のLP変動計算用）
 * @returns モチベーションデータ
 */
export function calculateMotivationData(
  matches: Match[],
  currentLP?: number,
  lpHistory?: Array<{ date: Date; lp: number }>
): MotivationData {
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const winStreak = calculateWinStreak(sortedMatches);
  const bestPerformance = findBestPerformance(sortedMatches);
  const achievements = calculateAchievements(sortedMatches, winStreak);
  const weeklyMonthlyProgress = calculateWeeklyMonthlyProgress(
    sortedMatches,
    currentLP,
    lpHistory
  );

  return {
    winStreak,
    bestPerformance,
    achievements,
    weeklyMonthlyProgress,
  };
}

/**
 * 連勝記録を計算
 */
function calculateWinStreak(matches: Match[]): WinStreak {
  if (matches.length === 0) {
    return {
      current: 0,
      longest: 0,
      longestStartDate: null,
      longestEndDate: null,
    };
  }

  // 最新の試合から逆順に処理
  const reversedMatches = [...matches].reverse();
  
  // 現在の連勝を計算
  let currentStreak = 0;
  for (const match of reversedMatches) {
    if (match.win) {
      currentStreak++;
    } else {
      break;
    }
  }

  // 最長連勝を計算
  let longestStreak = 0;
  let longestStartDate: Date | null = null;
  let longestEndDate: Date | null = null;
  let currentStreakCount = 0;
  let streakStartDate: Date | null = null;

  for (const match of matches) {
    if (match.win) {
      if (currentStreakCount === 0) {
        streakStartDate = match.date;
      }
      currentStreakCount++;
      
      if (currentStreakCount > longestStreak) {
        longestStreak = currentStreakCount;
        longestStartDate = streakStartDate;
        longestEndDate = match.date;
      }
    } else {
      currentStreakCount = 0;
      streakStartDate = null;
    }
  }

  return {
    current: currentStreak,
    longest: longestStreak,
    longestStartDate,
    longestEndDate,
  };
}

/**
 * ベストパフォーマンス試合を検出
 */
function findBestPerformance(matches: Match[]): BestPerformance | null {
  if (matches.length === 0) {
    return null;
  }

  let bestMatch: Match | null = null;
  let bestRating: MatchRatingResult | null = null;
  let bestScore = -1;

  for (const match of matches) {
    const rating = rateMatch(match, match.lane);
    if (rating.score > bestScore) {
      bestScore = rating.score;
      bestMatch = match;
      bestRating = rating;
    }
  }

  if (!bestMatch || !bestRating) {
    return null;
  }

  return {
    match: bestMatch,
    rating: bestRating,
    date: bestMatch.date,
  };
}

/**
 * 達成バッジを計算
 */
function calculateAchievements(matches: Match[], winStreak: WinStreak): Achievement[] {
  const achievements: Achievement[] = [];
  const totalMatches = matches.length;
  const totalWins = matches.filter(m => m.win).length;
  const sRatedMatches = matches.filter(m => {
    const rating = rateMatch(m, m.lane);
    return rating.rating === 'S';
  }).length;

  // 連勝バッジ
  achievements.push({
    id: 'win_streak_5',
    name: '5連勝達成',
    description: '5連勝を達成しました',
    icon: '🔥',
    achieved: winStreak.longest >= 5,
    achievedDate: winStreak.longest >= 5 ? winStreak.longestEndDate || undefined : undefined,
    progress: Math.min(100, (winStreak.longest / 5) * 100),
    target: 5,
    current: winStreak.longest,
  });

  achievements.push({
    id: 'win_streak_10',
    name: '10連勝達成',
    description: '10連勝を達成しました',
    icon: '🔥🔥',
    achieved: winStreak.longest >= 10,
    achievedDate: winStreak.longest >= 10 ? winStreak.longestEndDate || undefined : undefined,
    progress: Math.min(100, (winStreak.longest / 10) * 100),
    target: 10,
    current: winStreak.longest,
  });

  // 試合数バッジ
  achievements.push({
    id: 'matches_50',
    name: '50試合達成',
    description: '50試合をプレイしました',
    icon: '🎮',
    achieved: totalMatches >= 50,
    progress: Math.min(100, (totalMatches / 50) * 100),
    target: 50,
    current: totalMatches,
  });

  achievements.push({
    id: 'matches_100',
    name: '100試合達成',
    description: '100試合をプレイしました',
    icon: '🎮🎮',
    achieved: totalMatches >= 100,
    progress: Math.min(100, (totalMatches / 100) * 100),
    target: 100,
    current: totalMatches,
  });

  achievements.push({
    id: 'matches_200',
    name: '200試合達成',
    description: '200試合をプレイしました',
    icon: '🎮🎮🎮',
    achieved: totalMatches >= 200,
    progress: Math.min(100, (totalMatches / 200) * 100),
    target: 200,
    current: totalMatches,
  });

  // 勝利数バッジ
  achievements.push({
    id: 'wins_50',
    name: '50勝達成',
    description: '50勝を達成しました',
    icon: '🏆',
    achieved: totalWins >= 50,
    progress: Math.min(100, (totalWins / 50) * 100),
    target: 50,
    current: totalWins,
  });

  achievements.push({
    id: 'wins_100',
    name: '100勝達成',
    description: '100勝を達成しました',
    icon: '🏆🏆',
    achieved: totalWins >= 100,
    progress: Math.min(100, (totalWins / 100) * 100),
    target: 100,
    current: totalWins,
  });

  // S評価バッジ
  achievements.push({
    id: 's_rating_10',
    name: 'S評価10回',
    description: 'S評価を10回獲得しました',
    icon: '⭐',
    achieved: sRatedMatches >= 10,
    progress: Math.min(100, (sRatedMatches / 10) * 100),
    target: 10,
    current: sRatedMatches,
  });

  achievements.push({
    id: 's_rating_25',
    name: 'S評価25回',
    description: 'S評価を25回獲得しました',
    icon: '⭐⭐',
    achieved: sRatedMatches >= 25,
    progress: Math.min(100, (sRatedMatches / 25) * 100),
    target: 25,
    current: sRatedMatches,
  });

  return achievements;
}

/**
 * 週間/月間の進捗を計算
 */
function calculateWeeklyMonthlyProgress(
  matches: Match[],
  currentLP?: number,
  lpHistory?: Array<{ date: Date; lp: number }>
): WeeklyMonthlyProgress {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 週間の試合
  const weeklyMatches = matches.filter(m => new Date(m.date) >= oneWeekAgo);
  const weeklyWins = weeklyMatches.filter(m => m.win).length;
  const weeklyLosses = weeklyMatches.length - weeklyWins;
  const weeklyWinRate = weeklyMatches.length > 0
    ? (weeklyWins / weeklyMatches.length) * 100
    : 0;

  // 月間の試合
  const monthlyMatches = matches.filter(m => new Date(m.date) >= oneMonthAgo);
  const monthlyWins = monthlyMatches.filter(m => m.win).length;
  const monthlyLosses = monthlyMatches.length - monthlyWins;
  const monthlyWinRate = monthlyMatches.length > 0
    ? (monthlyWins / monthlyMatches.length) * 100
    : 0;

  // LP変動の計算（LP履歴がある場合）
  let weeklyLpGained = 0;
  let monthlyLpGained = 0;

  if (lpHistory && currentLP !== undefined) {
    const sortedLpHistory = [...lpHistory].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 週間のLP変動
    const weeklyLpEntry = sortedLpHistory.find(
      e => new Date(e.date) <= oneWeekAgo
    );
    if (weeklyLpEntry) {
      weeklyLpGained = currentLP - weeklyLpEntry.lp;
    }

    // 月間のLP変動
    const monthlyLpEntry = sortedLpHistory.find(
      e => new Date(e.date) <= oneMonthAgo
    );
    if (monthlyLpEntry) {
      monthlyLpGained = currentLP - monthlyLpEntry.lp;
    }
  }

  return {
    weekly: {
      wins: weeklyWins,
      losses: weeklyLosses,
      winRate: Math.round(weeklyWinRate * 10) / 10,
      matchesPlayed: weeklyMatches.length,
      lpGained: Math.round(weeklyLpGained),
    },
    monthly: {
      wins: monthlyWins,
      losses: monthlyLosses,
      winRate: Math.round(monthlyWinRate * 10) / 10,
      matchesPlayed: monthlyMatches.length,
      lpGained: Math.round(monthlyLpGained),
    },
  };
}

