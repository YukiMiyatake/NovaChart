'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { SkillGoal, SkillGoalType, Match } from '@/types';

const SKILL_GOAL_TYPES: { value: SkillGoalType; label: string; unit: string; description: string }[] = [
  { value: 'CS_AT_10', label: '10分時点のCS', unit: 'CS', description: '10分時点で達成するCS数' },
  { value: 'CSPERMIN', label: '平均CS/分', unit: 'CS/分', description: '試合全体の平均CS/分' },
  { value: 'KDA', label: '平均KDA', unit: 'KDA', description: '試合全体の平均KDA' },
  { value: 'VISION_SCORE', label: '平均ビジョンスコア', unit: 'スコア', description: '試合全体の平均ビジョンスコア' },
  { value: 'DAMAGE', label: '平均ダメージ', unit: 'ダメージ', description: '試合全体の平均ダメージ' },
  { value: 'DAMAGE_PER_MIN', label: '平均ダメージ/分', unit: 'ダメージ/分', description: '試合全体の平均ダメージ/分' },
];

const LANES = [
  { value: 'TOP', label: 'トップ' },
  { value: 'JUNGLE', label: 'ジャングル' },
  { value: 'MID', label: 'ミッド' },
  { value: 'ADC', label: 'ADC' },
  { value: 'SUPPORT', label: 'サポート' },
];

interface SkillGoalProgress {
  goal: SkillGoal;
  currentValue: number;
  targetValue: number;
  achievementRate: number; // 達成率（%）
  recentMatches: number; // 最近の試合数
  achievedMatches: number; // 目標を達成した試合数
}

function calculateSkillGoalProgress(goal: SkillGoal, matches: Match[]): SkillGoalProgress | null {
  // レーンでフィルタリング（後方互換性: 既存のlaneプロパティもサポート）
  const lanes = goal.lanes || (goal.lane ? [goal.lane] : []);
  const filteredMatches = lanes.length > 0
    ? matches.filter(m => m.lane && lanes.includes(m.lane))
    : matches;

  if (filteredMatches.length === 0) {
    return null;
  }

  // 最近の試合（直近20試合）を使用
  const recentMatches = filteredMatches.slice(0, 20);
  let currentValue = 0;
  let achievedMatches = 0;
  let validMatches = 0;

  recentMatches.forEach(match => {
    let value: number | undefined;

    switch (goal.type) {
      case 'CS_AT_10':
        value = match.csAt10;
        break;
      case 'CSPERMIN':
        value = match.csPerMin;
        break;
      case 'KDA':
        if (match.kda) {
          value = match.kda.deaths > 0
            ? (match.kda.kills + match.kda.assists) / match.kda.deaths
            : match.kda.kills + match.kda.assists;
        }
        break;
      case 'VISION_SCORE':
        value = match.visionScore;
        break;
      case 'DAMAGE':
        value = match.damageToChampions;
        break;
      case 'DAMAGE_PER_MIN':
        if (match.damageToChampions !== undefined && match.gameDuration) {
          const minutes = match.gameDuration / 60;
          value = match.damageToChampions / minutes;
        }
        break;
    }

    if (value !== undefined) {
      currentValue += value;
      validMatches++;
      if (value >= goal.targetValue) {
        achievedMatches++;
      }
    }
  });

  if (validMatches === 0) {
    return null;
  }

  currentValue = currentValue / validMatches;
  const achievementRate = (achievedMatches / validMatches) * 100;

  return {
    goal,
    currentValue: Math.round(currentValue * 100) / 100,
    targetValue: goal.targetValue,
    achievementRate: Math.round(achievementRate * 10) / 10,
    recentMatches: validMatches,
    achievedMatches,
  };
}

export default function SkillGoalSetting() {
  const { skillGoals, matches, addSkillGoal, updateSkillGoal, deleteSkillGoal, loadSkillGoals } = useAppStore();
  const [goalType, setGoalType] = useState<SkillGoalType>('CSPERMIN');
  const [targetValue, setTargetValue] = useState<number>(7);
  const [selectedLanes, setSelectedLanes] = useState<string[]>([]);
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SkillGoal | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadSkillGoals();
  }, [loadSkillGoals]);

  const goalProgresses = useMemo(() => {
    return skillGoals
      .filter(g => g.isActive)
      .map(goal => calculateSkillGoalProgress(goal, matches))
      .filter((progress): progress is SkillGoalProgress => progress !== null)
      .sort((a, b) => b.goal.createdAt.getTime() - a.goal.createdAt.getTime());
  }, [skillGoals, matches]);

  const selectedGoalType = SKILL_GOAL_TYPES.find(t => t.value === goalType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetValue <= 0) {
      alert('目標値を入力してください');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingGoal && editingGoal.id) {
        await updateSkillGoal(editingGoal.id, {
          type: goalType,
          targetValue,
          lanes: selectedLanes.length > 0 ? selectedLanes : undefined,
          description: description || undefined,
        });
        alert('目標を更新しました');
        setEditingGoal(null);
      } else {
        await addSkillGoal({
          type: goalType,
          targetValue,
          lanes: selectedLanes.length > 0 ? selectedLanes : undefined,
          description: description || undefined,
          createdAt: new Date(),
          isActive: true,
        });
        alert('目標を設定しました');
      }
      // Reset form
      setTargetValue(7);
      setSelectedLanes([]);
      setDescription('');
      setGoalType('CSPERMIN');
    } catch (error) {
      alert(editingGoal ? '目標の更新に失敗しました' : '目標の設定に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (goal: SkillGoal) => {
    setEditingGoal(goal);
    setGoalType(goal.type);
    setTargetValue(goal.targetValue);
    // 後方互換性: 既存のlaneプロパティもサポート
    setSelectedLanes(goal.lanes || (goal.lane ? [goal.lane] : []));
    setDescription(goal.description || '');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この目標を削除しますか？')) {
      return;
    }
    try {
      await deleteSkillGoal(id);
      alert('目標を削除しました');
    } catch (error) {
      alert('目標の削除に失敗しました');
    }
  };

  const handleToggleActive = async (goal: SkillGoal) => {
    try {
      await updateSkillGoal(goal.id!, { isActive: !goal.isActive });
    } catch (error) {
      alert('目標の更新に失敗しました');
    }
  };

  const handleCancelEdit = () => {
    setEditingGoal(null);
    setGoalType('CSPERMIN');
    setTargetValue(7);
    setSelectedLanes([]);
    setDescription('');
  };

  const handleLaneToggle = (laneValue: string) => {
    setSelectedLanes(prev =>
      prev.includes(laneValue)
        ? prev.filter(l => l !== laneValue)
        : [...prev, laneValue]
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">スキル目標設定</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* 目標設定フォーム */}
          <form onSubmit={handleSubmit} className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">目標タイプ</label>
              <select
                value={goalType}
                onChange={(e) => {
                  setGoalType(e.target.value as SkillGoalType);
                  // デフォルト値を設定
                  const type = SKILL_GOAL_TYPES.find(t => t.value === e.target.value);
                  if (type) {
                    switch (type.value) {
                      case 'CS_AT_10':
                        setTargetValue(80);
                        break;
                      case 'CSPERMIN':
                        setTargetValue(7);
                        break;
                      case 'KDA':
                        setTargetValue(3);
                        break;
                      case 'VISION_SCORE':
                        setTargetValue(50);
                        break;
                      case 'DAMAGE':
                        setTargetValue(15000);
                        break;
                      case 'DAMAGE_PER_MIN':
                        setTargetValue(500);
                        break;
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {SKILL_GOAL_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label} ({type.unit})
                  </option>
                ))}
              </select>
              {selectedGoalType && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedGoalType.description}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">目標値</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                step={selectedGoalType?.value === 'KDA' || selectedGoalType?.value === 'CSPERMIN' || selectedGoalType?.value === 'DAMAGE_PER_MIN' ? 0.1 : 1}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                単位: {selectedGoalType?.unit}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">レーン（オプション、複数選択可）</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                選択しない場合は全レーンが対象になります
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {LANES.map(lane => (
                  <label
                    key={lane.value}
                    className="flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLanes.includes(lane.value)}
                      onChange={() => handleLaneToggle(lane.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">{lane.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">説明（オプション）</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: ミッドレーンでCS/分7.0以上を目指す"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingGoal ? '更新' : '追加'}
              </button>
              {editingGoal && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  キャンセル
                </button>
              )}
            </div>
          </form>

          {/* 目標一覧と達成状況 */}
          {goalProgresses.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">目標達成状況</h3>
              {goalProgresses.map((progress) => {
                const goalTypeLabel = SKILL_GOAL_TYPES.find(t => t.value === progress.goal.type)?.label || progress.goal.type;
                // 後方互換性: 既存のlaneプロパティもサポート
                const lanes = progress.goal.lanes || (progress.goal.lane ? [progress.goal.lane] : []);
                const laneLabel = lanes.length > 0
                  ? lanes.map(l => LANES.find(ln => ln.value === l)?.label || l).join('、')
                  : '全レーン';
                const isAchieved = progress.currentValue >= progress.targetValue;
                const progressPercentage = Math.min(100, (progress.currentValue / progress.targetValue) * 100);

                return (
                  <div
                    key={progress.goal.id}
                    className={`p-4 border rounded-lg ${
                      isAchieved
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{goalTypeLabel}</h4>
                          <span className="text-xs text-gray-500 dark:text-gray-400">({laneLabel})</span>
                        </div>
                        {progress.goal.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {progress.goal.description}
                          </p>
                        )}
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">現在の値</span>
                            <span className={`font-semibold ${isAchieved ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                              {progress.currentValue.toFixed(progress.goal.type === 'KDA' ? 2 : progress.goal.type === 'CSPERMIN' ? 1 : 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">目標値</span>
                            <span className="font-semibold">{progress.targetValue.toFixed(progress.goal.type === 'KDA' ? 2 : progress.goal.type === 'CSPERMIN' ? 1 : 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">達成率</span>
                            <span className="font-semibold">{progress.achievementRate}% ({progress.achievedMatches}/{progress.recentMatches}試合)</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                isAchieved ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(progress.goal)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleToggleActive(progress.goal)}
                          className={`px-2 py-1 text-xs rounded ${
                            progress.goal.isActive
                              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                              : 'bg-gray-400 text-white hover:bg-gray-500'
                          }`}
                        >
                          {progress.goal.isActive ? '無効化' : '有効化'}
                        </button>
                        <button
                          onClick={() => progress.goal.id && handleDelete(progress.goal.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {goalProgresses.length === 0 && skillGoals.length === 0 && (
            <p className="text-gray-500 text-center py-4">スキル目標が設定されていません</p>
          )}
        </>
      )}
    </div>
  );
}

