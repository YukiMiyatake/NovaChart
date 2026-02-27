'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { Match } from '@/types';
import { rateMatch, getRatingColor, getRatingBgColor, MatchRatingResult } from '@/lib/analytics/matchRating';

export default function MatchDetailsPanel() {
  const { matches, loadMatches } = useAppStore();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchRatings, setMatchRatings] = useState<Map<string, MatchRatingResult>>(new Map());
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    // 各試合の評価を計算
    const ratings = new Map<string, MatchRatingResult>();
    matches.forEach(match => {
      if (match.matchId) {
        ratings.set(match.matchId, rateMatch(match, match.lane));
      }
    });
    setMatchRatings(ratings);
  }, [matches]);

  // ページネーション計算
  const totalPages = Math.ceil(matches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMatches = matches.slice(startIndex, endIndex);

  // ページ変更時に先頭にスクロール
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  // 表示件数変更時にページをリセット
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleDeleteAllMatches = async () => {
    if (!confirm('すべての試合詳細データを削除しますか？この操作は取り消せません。')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { matchService } = await import('@/lib/db');
      await matchService.deleteAll();
      await loadMatches();
      alert('試合詳細データを削除しました');
    } catch (error) {
      console.error('Failed to delete matches:', error);
      alert('試合詳細データの削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // ページ変更時に選択をクリア
    setSelectedMatch(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">試合詳細</h2>
        <div className="flex items-center gap-3">
          {matches.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">表示件数:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10件</option>
                  <option value={20}>20件</option>
                  <option value={50}>50件</option>
                  <option value={100}>100件</option>
                </select>
              </div>
              <button
                onClick={handleDeleteAllMatches}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? '削除中...' : '試合データ削除'}
              </button>
            </>
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">試合データがありません</p>
          <p className="text-sm text-gray-400">サマナーを検索またはUpdateボタンでデータを取得してください</p>
        </div>
      ) : (
        <>
          {/* ページネーション情報 */}
          <div className="flex items-center justify-between mb-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              全{matches.length}試合中 {startIndex + 1}-{Math.min(endIndex, matches.length)}試合を表示
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  前へ
                </button>
                <span>
                  ページ {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  次へ
                </button>
              </div>
            )}
          </div>

          {/* スクロール可能な試合一覧 */}
          <div className="space-y-3 mb-6 max-h-[600px] overflow-y-auto pr-2">
            {paginatedMatches.map((match) => {
          const rating = match.matchId ? matchRatings.get(match.matchId) : null;
          const kda = match.kda;
          const kdaText = kda ? `${kda.kills}/${kda.deaths}/${kda.assists}` : '-';
          const kdaRatio = kda && kda.deaths > 0 
            ? ((kda.kills + kda.assists) / kda.deaths).toFixed(2)
            : kda && kda.deaths === 0
            ? 'Perfect'
            : '-';

          return (
            <div
              key={match.matchId}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                match.win
                  ? 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700'
                  : 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700'
              } ${selectedMatch?.matchId === match.matchId ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setSelectedMatch(match)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-sm font-bold ${
                    match.win ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {match.win ? '勝利' : '敗北'}
                  </span>
                  {rating && (
                    <span className={`px-3 py-1 rounded font-bold text-lg ${getRatingBgColor(rating.rating)} ${getRatingColor(rating.rating)}`}>
                      {rating.rating}
                    </span>
                  )}
                  <span className="font-semibold">{match.champion || '-'}</span>
                  {match.lane && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {match.lane}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(match.date)}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">KDA: </span>
                  <span className="font-semibold">{kdaText}</span>
                  <span className="text-gray-500 ml-1">({kdaRatio})</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">CS/分: </span>
                  <span className="font-semibold">{match.csPerMin?.toFixed(1) || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">ダメージ: </span>
                  <span className="font-semibold">
                    {match.damageToChampions ? Math.round(match.damageToChampions).toLocaleString() : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">時間: </span>
                  <span className="font-semibold">{formatDuration(match.gameDuration)}</span>
                </div>
              </div>
            </div>
          );
            })}
          </div>

          {/* ページネーション（下部） */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                最初
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                最後
              </button>
            </div>
          )}

          {selectedMatch && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">試合詳細情報</h3>
          
          {(() => {
            const rating = selectedMatch.matchId ? matchRatings.get(selectedMatch.matchId) : null;
            return (
              <div className="space-y-4">
                {rating && (
                  <div>
                    <h4 className="font-semibold mb-2">パフォーマンス評価</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-4 py-2 rounded text-2xl font-bold ${getRatingBgColor(rating.rating)} ${getRatingColor(rating.rating)}`}>
                        {rating.rating}
                      </span>
                      <span className="text-lg">総合スコア: {rating.score}/100</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">KDA: </span>
                        <span>{Math.round(rating.breakdown.kdaScore)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">CS: </span>
                        <span>{Math.round(rating.breakdown.csScore)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">ダメージ: </span>
                        <span>{Math.round(rating.breakdown.damageScore)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">ビジョン: </span>
                        <span>{Math.round(rating.breakdown.visionScore)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">参加率: </span>
                        <span>{Math.round(rating.breakdown.participationScore)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">基本情報</h4>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">チャンピオン: </span>
                        <span className="font-semibold">{selectedMatch.champion || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">レーン: </span>
                        <span className="font-semibold">{selectedMatch.lane || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">試合時間: </span>
                        <span className="font-semibold">{formatDuration(selectedMatch.gameDuration)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">日時: </span>
                        <span className="font-semibold">{formatDate(selectedMatch.date)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">戦績</h4>
                    <div className="space-y-1 text-sm">
                      {selectedMatch.kda && (
                        <>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">キル: </span>
                            <span className="font-semibold">{selectedMatch.kda.kills}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">デス: </span>
                            <span className="font-semibold">{selectedMatch.kda.deaths}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">アシスト: </span>
                            <span className="font-semibold">{selectedMatch.kda.assists}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">KDA: </span>
                            <span className="font-semibold">
                              {selectedMatch.kda.deaths > 0
                                ? ((selectedMatch.kda.kills + selectedMatch.kda.assists) / selectedMatch.kda.deaths).toFixed(2)
                                : 'Perfect'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">キル参加率: </span>
                            <span className="font-semibold">
                              {selectedMatch.killParticipation ? `${selectedMatch.killParticipation.toFixed(1)}%` : '-'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">統計</h4>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">CS/分: </span>
                        <span className="font-semibold">{selectedMatch.csPerMin?.toFixed(1) || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">10分時点CS: </span>
                        <span className="font-semibold">{selectedMatch.csAt10 || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">総CS: </span>
                        <span className="font-semibold">
                          {selectedMatch.totalMinionsKilled && selectedMatch.neutralMinionsKilled
                            ? (selectedMatch.totalMinionsKilled + selectedMatch.neutralMinionsKilled)
                            : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">ビジョンスコア: </span>
                        <span className="font-semibold">{selectedMatch.visionScore || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">ダメージ</h4>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">チャンピオンへのダメージ: </span>
                        <span className="font-semibold">
                          {selectedMatch.damageToChampions ? Math.round(selectedMatch.damageToChampions).toLocaleString() : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">受けたダメージ: </span>
                        <span className="font-semibold">
                          {selectedMatch.damageTaken ? Math.round(selectedMatch.damageTaken).toLocaleString() : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">経済</h4>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">獲得ゴールド: </span>
                        <span className="font-semibold">
                          {selectedMatch.goldEarned ? Math.round(selectedMatch.goldEarned).toLocaleString() : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedMatch.memo && (
                  <div>
                    <h4 className="font-semibold mb-2">メモ</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedMatch.memo}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
        </>
      )}
    </div>
  );
}

