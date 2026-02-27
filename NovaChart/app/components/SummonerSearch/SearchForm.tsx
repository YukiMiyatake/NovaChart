'use client';

import { DEFAULTS } from '@/lib/constants';

interface SearchFormProps {
  riotId: string;
  region: string;
  isSearching: boolean;
  onRiotIdChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SearchForm({
  riotId,
  region,
  isSearching,
  onRiotIdChange,
  onRegionChange,
  onSubmit,
}: SearchFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 mt-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Riot ID</label>
          <input
            type="text"
            value={riotId}
            onChange={(e) => onRiotIdChange(e.target.value)}
            placeholder="ゲーム名#タグライン（例: PlayerName#JP1）"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">リージョン</label>
          <select
            value={region}
            onChange={(e) => onRegionChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="jp1">JP</option>
            <option value="kr">KR</option>
            <option value="na1">NA</option>
            <option value="euw1">EUW</option>
            <option value="eun1">EUN</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSearching}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isSearching ? '検索中...' : '検索'}
      </button>
    </form>
  );
}

