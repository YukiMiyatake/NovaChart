'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { calculateLaneStatisticsWithHistory, getLaneName, Lane } from '@/lib/analytics/laneStats';

export default function LaneStatsPanel() {
  const { matches } = useAppStore();
  const [selectedLane, setSelectedLane] = useState<Lane | null>(null);

  const laneStats = useMemo(() => {
    return calculateLaneStatisticsWithHistory(matches);
  }, [matches]);

  const lanes: Lane[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

  if (laneStats.size === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">レーン別統計</h2>
        <p className="text-gray-500">レーン別の試合データがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">レーン別統計</h2>

      {/* レーン選択タブ */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {lanes.map(lane => {
          const stats = laneStats.get(lane);
          if (!stats || stats.totalGames === 0) return null;

          return (
            <button
              key={lane}
              onClick={() => setSelectedLane(selectedLane === lane ? null : lane)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                selectedLane === lane
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {getLaneName(lane)} ({stats.totalGames})
            </button>
          );
        })}
      </div>

      {/* 全レーンの概要 */}
      {!selectedLane && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from(laneStats.entries()).map(([lane, stats]) => (
            <div
              key={lane}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={() => setSelectedLane(lane)}
            >
              <h3 className="text-lg font-semibold mb-3">{getLaneName(lane)}</h3>
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
                  <span className="text-gray-600 dark:text-gray-400">平均KDA</span>
                  <span className="font-semibold">{stats.averageKDA}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">平均CS/分</span>
                  <span className="font-semibold">{stats.averageCSPerMin}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 選択されたレーンの詳細 */}
      {selectedLane && laneStats.has(selectedLane) && (() => {
        const stats = laneStats.get(selectedLane)!;
        return (
          <div className="space-y-6">
            {/* 基本統計 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded">
                <p className="text-sm text-gray-600 dark:text-gray-400">試合数</p>
                <p className="text-2xl font-bold">{stats.totalGames}</p>
                <p className="text-sm">{stats.wins}勝 {stats.losses}敗</p>
              </div>

              <div className={`p-4 rounded ${stats.winRate >= 50 ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'}`}>
                <p className="text-sm text-gray-600 dark:text-gray-400">勝率</p>
                <p className="text-2xl font-bold">{stats.winRate}%</p>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-900 rounded">
                <p className="text-sm text-gray-600 dark:text-gray-400">平均KDA</p>
                <p className="text-2xl font-bold">{stats.averageKDA}</p>
                <p className="text-sm">
                  {stats.averageKills.toFixed(1)} / {stats.averageDeaths.toFixed(1)} / {stats.averageAssists.toFixed(1)}
                </p>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900 rounded">
                <p className="text-sm text-gray-600 dark:text-gray-400">平均CS/分</p>
                <p className="text-2xl font-bold">{stats.averageCSPerMin}</p>
              </div>
            </div>

            {/* 詳細統計 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
                <h3 className="text-lg font-semibold mb-3">ダメージ統計</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">平均ダメージ</span>
                    <span className="font-semibold">{stats.averageDamage.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">平均ダメージ/分</span>
                    <span className="font-semibold">{stats.averageDamagePerMin.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
                <h3 className="text-lg font-semibold mb-3">その他統計</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">平均ビジョンスコア</span>
                    <span className="font-semibold">{stats.averageVisionScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">平均ゴールド</span>
                    <span className="font-semibold">{stats.averageGoldEarned.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">平均試合時間</span>
                    <span className="font-semibold">
                      {Math.floor(stats.averageGameDuration / 60)}分{stats.averageGameDuration % 60}秒
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">平均キル参加率</span>
                    <span className="font-semibold">{stats.averageKillParticipation}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 推移グラフ（簡易版） */}
            {stats.history.length > 0 && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
                <h3 className="text-lg font-semibold mb-3">最近の試合推移</h3>
                <div className="space-y-2">
                  {stats.history.slice(-10).reverse().map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${entry.win ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(entry.date).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span>KDA: {entry.kda}</span>
                        <span>CS/分: {entry.csPerMin}</span>
                        <span>DMG/分: {entry.damagePerMin}</span>
                        <span>視野: {entry.visionScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

