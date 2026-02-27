'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { Goal } from '@/types';

const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const RANKS = ['IV', 'III', 'II', 'I'];

export default function GoalSetting() {
  const { goals, addGoal, updateGoal, deleteGoal, loadGoals } = useAppStore();
  const [targetTier, setTargetTier] = useState('GOLD');
  const [targetRank, setTargetRank] = useState('I');
  const [targetLP, setTargetLP] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadGoals();
    // Set default target date to 30 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    setTargetDate(defaultDate.toISOString().split('T')[0]);
  }, [loadGoals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) {
      alert('目標日付を入力してください');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingGoal && editingGoal.id) {
        // Update existing goal
        await updateGoal(editingGoal.id, {
          targetDate: new Date(targetDate),
          targetTier: targetTier,
          targetRank: targetTier === 'MASTER' || targetTier === 'GRANDMASTER' || targetTier === 'CHALLENGER' ? '' : targetRank,
          targetLP: targetLP,
        });
        alert('目標を更新しました');
        setEditingGoal(null);
      } else {
        // Add new goal
        await addGoal({
          targetDate: new Date(targetDate),
          targetTier: targetTier,
          targetRank: targetTier === 'MASTER' || targetTier === 'GRANDMASTER' || targetTier === 'CHALLENGER' ? '' : targetRank,
          targetLP: targetLP,
          createdAt: new Date(),
          isActive: true,
        });
        alert('目標を設定しました');
      }
      // Reset form
      setTargetLP(0);
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setTargetDate(defaultDate.toISOString().split('T')[0]);
      setTargetTier('GOLD');
      setTargetRank('I');
    } catch (error) {
      alert(editingGoal ? '目標の更新に失敗しました' : '目標の設定に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setTargetTier(goal.targetTier);
    setTargetRank(goal.targetRank || 'I');
    setTargetLP(goal.targetLP);
    setTargetDate(new Date(goal.targetDate).toISOString().split('T')[0]);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この目標を削除しますか？')) {
      return;
    }
    try {
      await deleteGoal(id);
      alert('目標を削除しました');
    } catch (error) {
      alert('目標の削除に失敗しました');
    }
  };

  const handleCancelEdit = () => {
    setEditingGoal(null);
    setTargetTier('GOLD');
    setTargetRank('I');
    setTargetLP(0);
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    setTargetDate(defaultDate.toISOString().split('T')[0]);
  };

  // Sort goals by target date
  const sortedGoals = [...goals].sort((a, b) => 
    new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
  );

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${isExpanded ? 'p-4' : 'p-2'}`}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>目標設定</span>
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {sortedGoals.length > 0 && (
            <div>
              <button
                onClick={() => setIsGoalsExpanded(!isGoalsExpanded)}
                className="w-full flex justify-between items-center p-1.5 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs"
              >
                <span className="text-xs font-medium">
                  目標 ({sortedGoals.length})
                </span>
                <span className="text-gray-600 dark:text-gray-400 text-xs">
                  {isGoalsExpanded ? '▼' : '▶'}
                </span>
              </button>
              {isGoalsExpanded && (
                <div className="mt-1.5 space-y-1.5 max-h-64 overflow-y-auto">
                  {sortedGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="p-1.5 bg-blue-50 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-700"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs truncate">
                            {goal.targetTier} {goal.targetRank} {goal.targetLP}LP
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(goal.targetDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(goal)}
                            className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            title="編集"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => goal.id && handleDelete(goal.id)}
                            className="px-1.5 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            title="削除"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <select
                  value={targetTier}
                  onChange={(e) => setTargetTier(e.target.value)}
                  className="w-full px-1.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  title="ティア"
                >
                  {TIERS.map(tier => (
                    <option key={tier} value={tier}>{tier}</option>
                  ))}
                </select>
              </div>

              {targetTier !== 'MASTER' && targetTier !== 'GRANDMASTER' && targetTier !== 'CHALLENGER' && (
                <div>
                  <select
                    value={targetRank}
                    onChange={(e) => setTargetRank(e.target.value)}
                    className="w-full px-1.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    title="ランク"
                  >
                    {RANKS.map(rank => (
                      <option key={rank} value={rank}>{rank}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <input
                  type="number"
                  value={targetLP}
                  onChange={(e) => setTargetLP(parseInt(e.target.value) || 0)}
                  min="0"
                  max="100"
                  placeholder="LP"
                  className="w-full px-1.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="flex-1 px-1.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                {isSubmitting ? '...' : editingGoal ? '更新' : '追加'}
              </button>
              {editingGoal && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs"
                >
                  取消
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
