'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { calculateTimeOfDayStatistics, getTimeOfDayName, TimeOfDay } from '@/lib/analytics/timeOfDayStats';

export default function TimeOfDayAnalysis() {
  const { matches } = useAppStore();

  const comparison = useMemo(() => {
    return calculateTimeOfDayStatistics(matches);
  }, [matches]);

  const timeOfDays: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

  // データがある時間帯のみをフィルタ
  const timeOfDaysWithData = timeOfDays.filter(timeOfDay => {
    const stats = comparison.statistics.get(timeOfDay);
    return stats && stats.totalGames > 0;
  });

  if (timeOfDaysWithData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">時間帯別パフォーマンス分析</h2>
        <p className="text-gray-500">時間帯別の試合データがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">時間帯別パフォーマンス分析</h2>

      {/* 概要カード */}
      {comparison.bestTimeOfDay && comparison.worstTimeOfDay && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">パフォーマンス分析</p>
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">最高勝率: </span>
              <span className="font-semibold text-green-600">
                {getTimeOfDayName(comparison.bestTimeOfDay)} ({comparison.statistics.get(comparison.bestTimeOfDay)?.winRate}%)
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">最低勝率: </span>
              <span className="font-semibold text-red-600">
                {getTimeOfDayName(comparison.worstTimeOfDay)} ({comparison.statistics.get(comparison.worstTimeOfDay)?.winRate}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 時間帯別統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {timeOfDaysWithData.map(timeOfDay => {
          const stats = comparison.statistics.get(timeOfDay)!;
          const isBest = comparison.bestTimeOfDay === timeOfDay;
          const isWorst = comparison.worstTimeOfDay === timeOfDay;

          return (
            <div
              key={timeOfDay}
              className={`p-4 border rounded-lg ${
                isBest
                  ? 'border-green-500 bg-green-50 dark:bg-green-900'
                  : isWorst
                  ? 'border-red-500 bg-red-50 dark:bg-red-900'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <h3 className="text-lg font-semibold mb-3">
                {getTimeOfDayName(timeOfDay)}
                {isBest && <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">最高</span>}
                {isWorst && <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded">最低</span>}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">試合数</span>
                  <span className="font-semibold">{stats.totalGames}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">勝率</span>
                  <span className={`font-semibold ${stats.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.winRate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">勝敗</span>
                  <span className="font-semibold">{stats.wins}勝 {stats.losses}敗</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平均KDA</span>
                  <span className="font-semibold">{stats.averageKDA}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平均CS/分</span>
                  <span className="font-semibold">{stats.averageCSPerMin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平均ダメージ/分</span>
                  <span className="font-semibold">{stats.averageDamagePerMin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平均ビジョンスコア</span>
                  <span className="font-semibold">{stats.averageVisionScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">キル参加率</span>
                  <span className="font-semibold">{stats.averageKillParticipation}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 詳細統計テーブル */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left p-2">時間帯</th>
              <th className="text-right p-2">試合数</th>
              <th className="text-right p-2">勝率</th>
              <th className="text-right p-2">KDA</th>
              <th className="text-right p-2">K/D/A</th>
              <th className="text-right p-2">CS/分</th>
              <th className="text-right p-2">ダメージ/分</th>
              <th className="text-right p-2">ビジョン</th>
              <th className="text-right p-2">キル参加率</th>
            </tr>
          </thead>
          <tbody>
            {timeOfDaysWithData.map(timeOfDay => {
              const stats = comparison.statistics.get(timeOfDay)!;
              return (
                <tr
                  key={timeOfDay}
                  className={`border-b border-gray-200 dark:border-gray-700 ${
                    comparison.bestTimeOfDay === timeOfDay
                      ? 'bg-green-50 dark:bg-green-900'
                      : comparison.worstTimeOfDay === timeOfDay
                      ? 'bg-red-50 dark:bg-red-900'
                      : ''
                  }`}
                >
                  <td className="p-2 font-medium">{getTimeOfDayName(timeOfDay)}</td>
                  <td className="p-2 text-right">{stats.totalGames}</td>
                  <td className={`p-2 text-right font-semibold ${stats.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.winRate}%
                  </td>
                  <td className="p-2 text-right">{stats.averageKDA}</td>
                  <td className="p-2 text-right text-sm">
                    {stats.averageKills.toFixed(1)} / {stats.averageDeaths.toFixed(1)} / {stats.averageAssists.toFixed(1)}
                  </td>
                  <td className="p-2 text-right">{stats.averageCSPerMin}</td>
                  <td className="p-2 text-right">{stats.averageDamagePerMin}</td>
                  <td className="p-2 text-right">{stats.averageVisionScore}</td>
                  <td className="p-2 text-right">{stats.averageKillParticipation}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

