/**
 * UsageTracker - 利用統計をDynamoDBに非同期保存する
 *
 * 顔検出リクエストが正常に処理された際に、利用記録を非同期で保存する。
 * 保存失敗時はログ出力のみ行い、顔検出結果には影響を与えない。
 *
 * プライバシー保護: 画像データ、IPアドレス、端末情報は一切保存しない。
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import type { UsageRecord } from './types.js';

/** DynamoDB クライアント（Lambda実行環境で再利用） */
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

/** テーブル名（環境変数から取得） */
const TABLE_NAME = process.env.USAGE_TABLE_NAME ?? 'PrivacyLensNovaUsage';

/**
 * 利用記録オブジェクトを構築する（テスト可能な純粋関数）
 *
 * @param sessionId - UUIDv4 セッションID
 * @param faceCount - 検出顔数（0以上の整数）
 * @param date - 記録日時
 * @returns UsageRecord オブジェクト
 */
export function buildUsageRecord(
  sessionId: string,
  faceCount: number,
  date: Date,
): UsageRecord {
  // パーティションキー: YYYY-MM-DD (UTC)
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  // ソートキー: {ISO8601}#{sessionId}
  const timestampSession = `${date.toISOString()}#${sessionId}`;

  // TTL: 記録日+365日のepoch秒
  const ttlDate = new Date(date.getTime());
  ttlDate.setUTCDate(ttlDate.getUTCDate() + 365);
  const ttl = Math.floor(ttlDate.getTime() / 1000);

  return {
    date: dateKey,
    timestampSession,
    faceCount,
    ttl,
  };
}

/**
 * 利用記録をDynamoDBに非同期保存する（fire-and-forget）
 *
 * この関数はawaitせずに呼び出すことを想定している。
 * 保存失敗時はconsole.errorでログ出力のみ行い、例外をスローしない。
 *
 * @param sessionId - UUIDv4 セッションID
 * @param faceCount - 検出顔数（0以上の整数）
 * @param filename - 保存されたファイル名（任意）
 */
export function saveUsageRecord(sessionId: string, faceCount: number, filename?: string): void {
  const now = new Date();
  const record = buildUsageRecord(sessionId, faceCount, now);

  // DynamoDBアイテムを構築
  const item: Record<string, { S: string } | { N: string }> = {
    date: { S: record.date },
    timestampSession: { S: record.timestampSession },
    faceCount: { N: String(record.faceCount) },
    ttl: { N: String(record.ttl) },
  };

  // ファイル名が指定されている場合は追加
  if (filename) {
    item.filename = { S: filename };
  }

  // 非同期でDynamoDBに保存（awaitしない）
  dynamoClient
    .send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: item,
      }),
    )
    .catch((error: Error) => {
      // 保存失敗時はログ出力のみ（顔検出結果に影響なし）
      console.error('Usage record save failed:', error.message);
    });
}
