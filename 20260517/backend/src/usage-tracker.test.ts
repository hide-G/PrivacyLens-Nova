/**
 * UsageTracker 単体テスト
 *
 * buildUsageRecord の正確性と saveUsageRecord のエラーハンドリングを検証する。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// DynamoDB クライアントをモック
vi.mock('@aws-sdk/client-dynamodb', () => {
  const mockSend = vi.fn().mockResolvedValue({});
  return {
    DynamoDBClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutItemCommand: vi.fn(),
    __mockSend: mockSend,
  };
});

import { buildUsageRecord, saveUsageRecord } from './usage-tracker.js';

describe('buildUsageRecord', () => {
  it('パーティションキーがYYYY-MM-DD形式（UTC）で生成される', () => {
    const date = new Date('2025-07-15T10:30:00.000Z');
    const record = buildUsageRecord('550e8400-e29b-41d4-a716-446655440000', 3, date);

    expect(record.date).toBe('2025-07-15');
  });

  it('ソートキーが{ISO8601}#{sessionId}形式で生成される', () => {
    const date = new Date('2025-07-15T10:30:00.000Z');
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const record = buildUsageRecord(sessionId, 2, date);

    expect(record.timestampSession).toBe('2025-07-15T10:30:00.000Z#550e8400-e29b-41d4-a716-446655440000');
  });

  it('TTLが記録日+365日のepoch秒で設定される', () => {
    const date = new Date('2025-07-15T10:30:00.000Z');
    const record = buildUsageRecord('test-session-id', 1, date);

    // 365日後のepoch秒を計算
    const expectedTtlDate = new Date('2025-07-15T10:30:00.000Z');
    expectedTtlDate.setUTCDate(expectedTtlDate.getUTCDate() + 365);
    const expectedTtl = Math.floor(expectedTtlDate.getTime() / 1000);

    expect(record.ttl).toBe(expectedTtl);
  });

  it('faceCountが正しく保存される', () => {
    const date = new Date('2025-01-01T00:00:00.000Z');
    const record = buildUsageRecord('session-123', 5, date);

    expect(record.faceCount).toBe(5);
  });

  it('faceCountが0の場合も正しく保存される', () => {
    const date = new Date('2025-01-01T00:00:00.000Z');
    const record = buildUsageRecord('session-123', 0, date);

    expect(record.faceCount).toBe(0);
  });

  it('UTC日付境界を正しく処理する（日本時間で翌日でもUTCでは当日）', () => {
    // 日本時間 2025-07-16 01:00 = UTC 2025-07-15 16:00
    const date = new Date('2025-07-15T16:00:00.000Z');
    const record = buildUsageRecord('session-123', 1, date);

    expect(record.date).toBe('2025-07-15');
  });

  it('レコードに画像データ・IPアドレス・端末情報が含まれない', () => {
    const date = new Date('2025-07-15T10:30:00.000Z');
    const record = buildUsageRecord('session-123', 2, date);

    // UsageRecord型のプロパティのみが存在することを確認
    const keys = Object.keys(record);
    expect(keys).toHaveLength(4);
    expect(keys).toContain('date');
    expect(keys).toContain('timestampSession');
    expect(keys).toContain('faceCount');
    expect(keys).toContain('ttl');
  });

  it('年末の日付境界を正しく処理する', () => {
    const date = new Date('2025-12-31T23:59:59.999Z');
    const record = buildUsageRecord('session-123', 1, date);

    expect(record.date).toBe('2025-12-31');
  });

  it('年始の日付境界を正しく処理する', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const record = buildUsageRecord('session-123', 1, date);

    expect(record.date).toBe('2026-01-01');
  });
});

describe('saveUsageRecord', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('関数が例外をスローしない（fire-and-forget）', () => {
    // saveUsageRecord は void を返し、例外をスローしない
    expect(() => saveUsageRecord('session-123', 3)).not.toThrow();
  });

  it('DynamoDB保存失敗時にconsole.errorが呼ばれる', async () => {
    // モックを失敗させる
    const { __mockSend } = await import('@aws-sdk/client-dynamodb') as unknown as { __mockSend: ReturnType<typeof vi.fn> };
    __mockSend.mockRejectedValueOnce(new Error('DynamoDB connection failed'));

    saveUsageRecord('session-456', 2);

    // 非同期処理が完了するのを待つ
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Usage record save failed:',
      'DynamoDB connection failed',
    );
  });
});
