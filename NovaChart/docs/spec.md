# NovaChart 仕様書

LoL（League of Legends）のレート推移を可視化・分析するWebアプリケーションの現在の仕様です。

---

## 1. 概要

| 項目 | 内容 |
|------|------|
| アプリ名 | NovaChart |
| 目的 | LoL ソロキュー（RANKED_SOLO_5x5）のレート推移の可視化・分析 |
| 対象キュー | **ソロキューのみ**（フレックス等は非対応） |
| 技術スタック | Next.js 14 (App Router), TypeScript, Tailwind CSS, IndexedDB (Dexie), Recharts, Zustand, Riot Games API |

---

## 2. 機能一覧

### 2.1 サマナー・アカウント

- **サマナー検索**
  - サマナー名 + リージョンで検索（Riot API 要）
  - サマナーIDで検索（DBにあればAPIキー不要）
  - PUUIDで検索（DBにあればAPIキー不要）
- **サマナー名の入力仕様**
  - 3〜16文字、英数字・スペース・`.` / `_` / `-` のみ
  - タグ（`#XXXX`）は含めない
- **Riot ID**
  - 表示用に Riot ID（ゲーム名#タグ）を localStorage に保存可能
- **APIキー設定**
  - 画面上でAPIキー・リージョンを設定（localStorage に保存）
  - 未設定時は `.env.local` の `RIOT_API_KEY` / `RIOT_API_REGION` を参照

### 2.2 レート・ランク

- **現在のランク表示**
  - ティア・ランク・LP・勝敗（ソロキューのみ）
- **レート更新（Update）**
  - サマナー情報の更新
  - ソロキュー League Entry の取得・保存
  - レート履歴の取得（最大100試合分）・保存
  - 試合詳細の取得（最大20試合）・保存
- **レート履歴**
  - 試合ごとの日付・ティア・ランク・LP・勝敗を時系列で保存
  - 当日・未来日付のエントリは保存しない（APIの「現在値」用は除外）
  - `matchId` が `current-` で始まるエントリは保存しない

### 2.3 目標・予測

- **目標設定（Goal）**
  - 目標日・目標ティア・ランク・LP を設定
  - 複数目標の有効/無効の切り替え
- **到達予測**
  - 線形回帰による目標LP到達日予測
  - 移動平均による補助表示
- **進捗率**
  - 現在LPと目標LPから達成率を算出
- **必要試合数**
  - 勝率・プレイ頻度から目標到達に必要な試合数を算出（時間加重勝率を使用）

### 2.4 試合・統計

- **試合詳細（Match）**
  - 勝敗・ロール・チャンピオン・KDA・CS@10・ビジョンスコア・キル関与率
  - レーン・与ダメ・被ダメ・チャンピオンへのダメ・獲得ゴールド・CS/分・試合時間など
- **統計パネル**
  - 勝率・総試合数・LP変動・ティア推移などのサマリー
- **勝敗分析（WinLossAnalysis）**
  - 勝利時と敗北時の指標比較（ダメージ・CS・ビジョン等）
  - レーン別勝敗分析
- **時間帯分析（TimeOfDayAnalysis）**
  - 朝・昼・夕・夜の時間帯別成績
- **レーン統計（LaneStatsPanel）**
  - レーン別試合数・勝率・主要指標
- **スキル目標（SkillGoal）**
  - 種類: CS_AT_10, KDA, VISION_SCORE, DAMAGE, CSPERMIN, DAMAGE_PER_MIN
  - 目標値・対象レーン（任意）を設定し、達成状況を表示
- **モチベーションパネル（MotivationPanel）**
  - 直近の成績・連勝/連敗・モチベーションに紐づく表示

### 2.5 グラフ

- **レート推移チャート（RateChart）**
  - LP または ティア+ランク+LP を時系列で表示
  - 予測線・移動平均の表示
  - 時間範囲フィルタ・表示項目の切り替え

### 2.6 データ管理

- **保存先**
  - ブラウザの IndexedDB（Dexie.js）
  - データベース名: `NovaChartDB_v6`
- **マイグレーション**
  - 旧DB（NovaChartDB, v2〜v5）から v6 への初回マイグレーションを実行（旧DBは削除しない）
- **エクスポート/インポート**
  - `lib/db/exportImport.ts` で一括エクスポート・インポートが可能（UI要確認）

---

## 3. データ仕様

### 3.1 主要エンティティ

| エンティティ | 主キー | 説明 |
|-------------|--------|------|
| RateHistory | matchId | 試合単位のLP履歴（日付・ティア・ランク・LP・勝敗） |
| Goal | id (auto) | 目標日・目標ティア/ランク/LP・有効フラグ |
| Match | matchId | 試合詳細（勝敗・ロール・チャンピオン・KDA・CS・ダメージ等） |
| Summoner | puuid | サマナー情報（名前・アイコン・レベル・リージョン） |
| LeagueEntry | leagueId | ランク情報（**ソロキュー専用**・ティア・ランク・LP・勝敗） |
| SkillGoal | id (auto) | スキル目標（種類・目標値・対象レーン・有効フラグ） |

### 3.2 ティア・ランク

- ティア: IRON, BRONZE, SILVER, GOLD, PLATINUM, EMERALD, DIAMOND, MASTER, GRANDMASTER, CHALLENGER
- ランク: IV, III, II, I（MASTER以上はランクなし）

### 3.3 レーン

- TOP, JUNGLE, MID, ADC, SUPPORT

### 3.4 制約・ビジネスルール

- **ソロキュー限定**
  - League Entry・レート履歴・統計はすべて RANKED_SOLO_5x5 のみ。フレックス等は保存・表示しない。
- **レート履歴**
  - 同一 `matchId` は更新で上書き。当日分・`current-` プレフィックス付きは保存しない。
- **試合詳細**
  - 同一 `matchId` は更新で上書き。更新時に既存 matchId は除外し新規分のみ取得。

---

## 4. API（Riot 連携）

- すべて Next.js の API Route（`/api/riot/*`）経由で呼び出し、APIキーはサーバー側で扱う。
- **使用エンドポイント例**
  - アカウント: `/api/riot/account/by-riot-id`, `/api/riot/account/me`
  - サマナー: `/api/riot/summoner`, `/api/riot/summoner-by-puuid`
  - ランク: `/api/riot/league-by-puuid`（**queueType=RANKED_SOLO_5x5 を明示**）
  - レート履歴: `/api/riot/fetch-rate-history`（POST）
  - 試合詳細: `/api/riot/fetch-match-details`（POST）
- **リージョン**
  - デフォルト: `jp1`。プラットフォーム（jp1, kr, na1 等）とリージョナル（asia, americas, europe）のマッピングは `lib/riot/client.ts` で実施。

---

## 5. 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| RIOT_API_KEY | レート取得時は必須 | Riot Developer Portal で取得 |
| RIOT_API_REGION | 任意 | デフォルト `jp1` |

- サマナー情報はDBに一度保存されていれば、APIキーなしでも検索可能。
- `.env.local` 変更時は開発サーバーの再起動が必要。

---

## 6. エラーハンドリング

- **403 Forbidden**: APIキー不正・未設定・再起動未実施を案内
- **404**: サマナー/アカウントが見つからない、またはソロキューでランク未取得
- **429**: レート制限。再試行は時間をおく
- ソロキュー未取得時: 「ソロキューでランクがありません」等のメッセージを表示

---

## 7. 非機能・制限

- データは端末の IndexedDB のみ。ブラウザ・端末を変えるとデータは別管理。
- 将来の Vercel / S3 等への移行を想定した記述あり（README）。
- 開発用APIキーは24時間で期限切れ。本番では適切なキーとレート制限の考慮が必要。

---

*最終更新: 仕様に基づき作成（コードベース参照）*
