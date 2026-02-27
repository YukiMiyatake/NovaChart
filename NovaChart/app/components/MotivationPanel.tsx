'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { calculateMotivationData } from '@/lib/analytics/motivation';
import { getRatingColor, getRatingBgColor } from '@/lib/analytics/matchRating';

export default function MotivationPanel() {
  const { matches, rateHistory, currentLeagueEntry } = useAppStore();

  const motivationData = useMemo(() => {
    // LP履歴を準備
    const lpHistory = rateHistory.map(r => ({
      date: r.date,
      lp: r.lp,
    }));

    // 現在のLPを取得
    const currentLP = currentLeagueEntry?.leaguePoints;

    return calculateMotivationData(matches, currentLP, lpHistory);
  }, [matches, rateHistory, currentLeagueEntry]);

  if (matches.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">モチベーション</h2>
        <p className="text-gray-500">試合データがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">モチベーション</h2>

      <div className="space-y-6">
        {/* 連勝記録 */}
        <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h3 className="text-lg font-semibold mb-3">連勝記録</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">現在の連勝</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {motivationData.winStreak.current}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">最長連勝</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {motivationData.winStreak.longest}
              </p>
              {motivationData.winStreak.longestStartDate && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(motivationData.winStreak.longestStartDate).toLocaleDateString('ja-JP')}
                  {motivationData.winStreak.longestEndDate && 
                    ` - ${new Date(motivationData.winStreak.longestEndDate).toLocaleDateString('ja-JP')}`
                  }
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ベストパフォーマンス */}
        {motivationData.bestPerformance && (
          <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="text-lg font-semibold mb-3">ベストパフォーマンス</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">評価</span>
                <span
                  className={`px-3 py-1 rounded-full text-lg font-bold ${getRatingBgColor(motivationData.bestPerformance.rating.rating)} ${getRatingColor(motivationData.bestPerformance.rating.rating)}`}
                >
                  {motivationData.bestPerformance.rating.rating}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">スコア</span>
                <span className="font-semibold">{motivationData.bestPerformance.rating.score}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">日付</span>
                <span className="text-sm">
                  {new Date(motivationData.bestPerformance.date).toLocaleDateString('ja-JP')}
                </span>
              </div>
              {motivationData.bestPerformance.match.champion && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">チャンピオン</span>
                  <span className="font-semibold">{motivationData.bestPerformance.match.champion}</span>
                </div>
              )}
              {motivationData.bestPerformance.match.lane && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">レーン</span>
                  <span className="font-semibold">{motivationData.bestPerformance.match.lane}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 週間/月間の進捗 */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">週間/月間の進捗</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-blue-600 dark:text-blue-400">週間</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">試合数</span>
                  <span className="font-semibold">{motivationData.weeklyMonthlyProgress.weekly.matchesPlayed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">勝率</span>
                  <span className="font-semibold">{motivationData.weeklyMonthlyProgress.weekly.winRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">LP変動</span>
                  <span className={`font-semibold ${motivationData.weeklyMonthlyProgress.weekly.lpGained >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {motivationData.weeklyMonthlyProgress.weekly.lpGained >= 0 ? '+' : ''}
                    {motivationData.weeklyMonthlyProgress.weekly.lpGained}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2 text-green-600 dark:text-green-400">月間</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">試合数</span>
                  <span className="font-semibold">{motivationData.weeklyMonthlyProgress.monthly.matchesPlayed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">勝率</span>
                  <span className="font-semibold">{motivationData.weeklyMonthlyProgress.monthly.winRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">LP変動</span>
                  <span className={`font-semibold ${motivationData.weeklyMonthlyProgress.monthly.lpGained >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {motivationData.weeklyMonthlyProgress.monthly.lpGained >= 0 ? '+' : ''}
                    {motivationData.weeklyMonthlyProgress.monthly.lpGained}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 達成バッジ */}
        <div>
          <h3 className="text-lg font-semibold mb-3">達成バッジ</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {motivationData.achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-3 rounded-lg border-2 ${
                  achievement.achieved
                    ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700'
                }`}
              >
                <div className="text-2xl mb-1">{achievement.icon}</div>
                <div className="text-sm font-semibold mb-1">{achievement.name}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {achievement.description}
                </div>
                {!achievement.achieved && achievement.progress !== undefined && (
                  <div className="space-y-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${achievement.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {achievement.current}/{achievement.target}
                    </div>
                  </div>
                )}
                {achievement.achieved && achievement.achievedDate && (
                  <div className="text-xs text-yellow-600 dark:text-yellow-400">
                    {new Date(achievement.achievedDate).toLocaleDateString('ja-JP')} 達成
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

