# NovaChart 設計書

アーキテクチャ・データフロー・ディレクトリ構成・主要モジュールの設計です。

---

## 1. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App Router (React)                                      │
│  ├── app/page.tsx (Home)                                         │
│  ├── app/components/* (UI)                                       │
│  └── Zustand (useAppStore) ←→ IndexedDB (Dexie)                  │
├─────────────────────────────────────────────────────────────────┤
│  Next.js API Routes (/api/riot/*)                                 │
│  └── Riot Games API (API Key はサーバー側で使用)                  │
└─────────────────────────────────────────────────────────────────┘
```

- **フロント**: Next.js 14 App Router + React。状態は Zustand、永続化は IndexedDB（Dexie）。
- **API**: 同一 Next アプリ内の API Route が Riot API を中継。APIキーはクライアントに露出しない。

---

## 2. ディレクトリ構成

```
NovaChart/
├── app/
│   ├── api/                    # API Routes（Riot 中継）
│   │   ├── riot/
│   │   │   ├── account/        # by-riot-id, me
│   │   │   ├── summoner.ts, summoner-by-puuid
│   │   │   ├── league-by-puuid
│   │   │   ├── fetch-rate-history, fetch-match-details
│   │   │   └── update
│   │   └── debug/env/          # 環境変数確認用（開発時）
│   ├── components/             # ページ用UIコンポーネント
│   │   ├── SummonerSearch/
│   │   ├── RateChart/
│   │   ├── GoalSetting, SkillGoalSetting
│   │   ├── StatsPanel, MotivationPanel
│   │   ├── MatchDetailsPanel, LaneStatsPanel
│   │   ├── WinLossAnalysis, TimeOfDayAnalysis
│   │   └── ApiKeySettings
│   ├── layout.tsx
│   ├── page.tsx                 # メイン画面・初期化・Update処理
│   └── globals.css
├── lib/
│   ├── analytics/               # 分析・計算ロジック（純粋関数）
│   │   ├── progress.ts          # 進捗・必要試合数・統計
│   │   ├── prediction.ts       # 線形回帰・移動平均・予測
│   │   ├── matchRating.ts      # 試合評価
│   │   ├── winLossAnalysis.ts
│   │   ├── timeOfDayStats.ts
│   │   ├── laneStats.ts
│   │   └── motivation.ts
│   ├── api/                     # API 共通（middleware, response）
│   ├── db/                      # IndexedDB スキーマ・サービス・マイグレーション
│   ├── hooks/                   # useLocalStorage, useRiotApi 等
│   ├── riot/                    # RiotApiClient（マッチID取得・マッチ詳細等）
│   ├── store/                   # useAppStore (Zustand)
│   ├── utils/                   # date, errorHandler, logger, storage, leagueEntry
│   └── constants/              # STORAGE_KEYS, API_ENDPOINTS, DEFAULTS
├── types/                       # RateHistory, Goal, Match, Summoner, LeagueEntry, SkillGoal
├── __tests__/
├── docs/                        # 本ドキュメント
├── package.json, tsconfig.json, next.config.js
├── tailwind.config.ts, postcss.config.js
├── vitest.config.ts, vitest.setup.ts
└── .env.local.example, .gitignore
```

---

## 3. データフロー

### 3.1 起動時

1. `app/page.tsx` の `useEffect` で `runMigrationIfNeeded()` を実行（旧DB → v6 の一度きりマイグレーション）。
2. `loadRateHistory`, `loadGoals`, `loadMatches`, `loadSkillGoals` で IndexedDB から Zustand に投入。
3. `loadSavedSummoner()` で「直近更新のサマナー」を DB から取得し `currentSummoner` に設定。
4. そのサマナーの **ソロキュー** League Entry を DB から取得。無ければ API（league-by-puuid, queueType=RANKED_SOLO_5x5）で取得し DB 保存後 `currentLeagueEntry` に設定。

### 3.2 レート更新（Update）

1. サマナー情報を API で更新し DB に保存。
2. **ソロキュー** League Entry を API で取得し、`queueType === 'RANKED_SOLO_5x5'` のみ DB 保存・store に反映。
3. レート履歴 API で履歴を取得。既存 `matchId` はスキップ。当日分・`matchId` が `current-` 始まりのものは保存しない。新規分を `addRateHistory` で DB に追加。
4. マッチID一覧を取得し、未取得の matchId のみ試合詳細 API で取得。Match を DB に追加。
5. 必要に応じて `currentLeagueEntry` を表示用に更新。

### 3.3 ソロキュー一貫性（設計上の拘束）

- **Store**: `setCurrentLeagueEntry` は `queueType === 'RANKED_SOLO_5x5'` のみ受け付ける。
- **DB**: `leagueEntryService.addOrUpdate` はソロキュー以外を拒否。`getByPuuid` / `getByLeagueId` はソロキュー以外を削除してから返す。
- **API 利用**: `league-by-puuid` 呼び出し時に `queueType=RANKED_SOLO_5x5` を明示。レスポンスもソロキューかどうか検証してから保存・表示。

---

## 4. 状態管理（Zustand）

- **useAppStore** で保持する主な状態:
  - `rateHistory`, `goals`, `matches`, `skillGoals`
  - `currentSummoner`, `currentLeagueEntry`（表示中のサマナー・ランク）
  - `isLoading`, `error`
- 永続データは Store のアクション経由で IndexedDB の各 Service を呼び出し、書き込み後に `load*` で再読み込みして Store を更新。
- セレクタ: `useSoloQueueStats`, `useActiveGoals` など。

---

## 5. データベース（IndexedDB / Dexie）

- **DB 名**: `NovaChartDB_v6`
- **スキーマ（version 1）**:
  - `rateHistory`: `&matchId, date, tier, rank, lp`
  - `goals`: `++id, targetDate, createdAt, isActive`
  - `matches`: `&matchId, date, win, role, champion`
  - `summoners`: `&puuid, id, name, region, lastUpdated`
  - `leagueEntries`: `&leagueId, puuid, queueType, lastUpdated`
  - `skillGoals`: `++id, type, lane, createdAt, isActive`
- **サービス**: `lib/db/index.ts` に `rateHistoryService`, `goalService`, `matchService`, `summonerService`, `leagueEntryService`, `skillGoalService` を定義。追加・更新・重複時は「主キーで存在チェック → あれば update」で一意を保つ。
- **マイグレーション**: 旧 DB 名リストから v6 へ一度だけデータ移行。旧 DB は削除しない。完了フラグを localStorage に保存。

---

## 6. API Routes と Riot クライアント

- **API Routes**: `app/api/riot/*` で Riot の Platform / Regional エンドポイントを中継。APIキーはリクエスト body または query で受け取りサーバー側でのみ使用。
- **RiotApiClient** (`lib/riot/client.ts`):
  - Platform: `{region}.api.riotgames.com`（サマナー・リーグ情報など）。
  - Regional: `{asia|americas|europe}.api.riotgames.com`（アカウント・マッチなど）。
  - リージョンからルーティングを決める `getRegionalRouting(platformRegion)` を使用。
- マッチID一覧取得・マッチ詳細取得はクライアント側で `RiotApiClient` を利用する場合と、API Route 経由の両方があり、Update フローでは API Route（fetch-match-details 等）を利用。

---

## 7. 分析モジュール（lib/analytics）

- **progress.ts**: 進捗率、必要試合数（時間加重勝率）、統計（勝率・試合数・LP変動など）。ソロキュー前提。
- **prediction.ts**: 線形回帰、移動平均、目標LP到達日予測。
- **matchRating.ts**: 試合の評価・レーティング・色分け。
- **winLossAnalysis.ts**: 勝敗比較・レーン別勝敗。
- **timeOfDayStats.ts**: 時間帯別成績。
- **laneStats.ts**: レーン別統計・履歴付き統計。
- **motivation.ts**: モチベーション用の集計。

これらは原則として Zustand や DB を直接参照せず、引数で渡された `RateHistory` / `Match` / `Goal` 等を入力に純粋関数として計算する設計。

---

## 8. 定数・設定

- **lib/constants**: `STORAGE_KEYS`, `API_ENDPOINTS`, `DEFAULTS`（REGION, **QUEUE_TYPE = RANKED_SOLO_5x5**）, `QUEUE_TYPES`, `ERROR_MESSAGES`。
- キュー種別はアプリ全体で `DEFAULTS.QUEUE_TYPE` を参照し、ソロキューに固定。

---

## 9. コンポーネント責務（要約）

| コンポーネント | 責務 |
|----------------|------|
| SummonerSearch | サマナー名/ID/PUUID 検索・選択・Riot ID 保存 |
| RateChart | レート推移グラフ・予測線・時間範囲・表示切替 |
| GoalSetting | 目標の追加・編集・有効/無効 |
| SkillGoalSetting | スキル目標の追加・編集・有効/無効 |
| StatsPanel | 進捗・必要試合数・統計の表示（progress 等を利用） |
| MotivationPanel | モチベーション用表示（motivation を利用） |
| MatchDetailsPanel | 試合一覧・詳細表示 |
| LaneStatsPanel | レーン別統計（laneStats を利用） |
| WinLossAnalysis | 勝敗比較（winLossAnalysis を利用） |
| TimeOfDayAnalysis | 時間帯別分析（timeOfDayStats を利用） |
| ApiKeySettings | APIキー・リージョンの設定（localStorage） |

---

## 10. テスト

- **Vitest** + **@testing-library/react** + **jsdom**。
- 設定: `vitest.config.ts`, `vitest.setup.ts`。
- 実行: `npm test`（watch）/ `npm test -- --run`（1回のみ）。
- **テスト一覧**（`__tests__/`）:
  - `storage.test.ts` — StorageService（APIキー・リージョン・Riot ID・マイグレーション）
  - `leagueEntry.test.ts` — extractLeagueEntry（抽出・デフォルト・leagueId・null 時 throw）
  - `errorHandler.test.ts` — handleRiotApiError, extractStatusCodeFromError, isRiotApiError
  - `dateUtils.test.ts` — 日付フォーマット・getDateKey・isSameDay・start/end of day
  - `prediction.test.ts` — 線形回帰・到達予測・移動平均・予測ポイント
  - `progress.test.ts` — calculateProgress, calculateRequiredMatches, calculateStatistics（ソロキュー制約含む）
  - `matchRating.test.ts` — rateMatch, getRatingColor, getRatingBgColor
  - `riotClient.test.ts` — tierRankToLP, lpToTierRank（往復変換）
  - `useChartData.test.ts` — チャートデータ・目標・時間範囲（モック利用）
  - `useYAxisConfig.test.ts` — Y軸ドメイン・brush・yAxisZoom
  - `ChartContainer.test.tsx` — BaseChartContainer のスモーク（props 受け取り）

---

*最終更新: コードベースに基づく設計の要約*
