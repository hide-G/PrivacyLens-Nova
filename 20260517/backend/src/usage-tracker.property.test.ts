/**
 * Property 13: 利用記録は正しい構造とキー形式で生成される
 *
 * fast-check によるプロパティテスト
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildUsageRecord } from './usage-tracker';

describe('Property 13: 利用記録は正しい構造とキー形式で生成される', () => {
  /**
   * **Validates: Requirements 12.2, 12.3, 12.4, 12.6**
   */

  /** UUIDv4形式の文字列ジェネレータ */
  const uuidV4Arb = fc.uuid().filter((uuid) => {
    // UUIDv4: バージョン4（13文字目が'4'）、バリアント（17文字目が'8','9','a','b'）
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
  });

  /** 顔数ジェネレータ（0〜100） */
  const faceCountArb = fc.integer({ min: 0, max: 100 });

  /** 日付ジェネレータ（2020年〜2030年の範囲） */
  const dateArb = fc.date({
    min: new Date('2020-01-01T00:00:00Z'),
    max: new Date('2030-12-31T23:59:59Z'),
  });

  it('dateフィールドはYYYY-MM-DD形式である', () => {
    fc.assert(
      fc.property(uuidV4Arb, faceCountArb, dateArb, (sessionId, faceCount, date) => {
        const record = buildUsageRecord(sessionId, faceCount, date);
        // YYYY-MM-DD形式の正規表現
        expect(record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // 日付の各部分が有効な範囲であることを確認
        const [year, month, day] = record.date.split('-').map(Number);
        expect(year).toBeGreaterThanOrEqual(2020);
        expect(year).toBeLessThanOrEqual(2030);
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31);
      }),
      { numRuns: 100 },
    );
  });

  it('timestampSessionは{ISO8601}#{sessionId}形式である', () => {
    fc.assert(
      fc.property(uuidV4Arb, faceCountArb, dateArb, (sessionId, faceCount, date) => {
        const record = buildUsageRecord(sessionId, faceCount, date);

        // {ISO8601}#{sessionId} 形式を検証
        const parts = record.timestampSession.split('#');
        expect(parts.length).toBe(2);

        // ISO8601部分の検証
        const isoTimestamp = parts[0];
        expect(isoTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        // パース可能であることを確認
        const parsedDate = new Date(isoTimestamp);
        expect(parsedDate.getTime()).not.toBeNaN();

        // sessionId部分の検証
        const recordSessionId = parts[1];
        expect(recordSessionId).toBe(sessionId);
      }),
      { numRuns: 100 },
    );
  });

  it('TTLは記録日+365日のepoch秒である', () => {
    fc.assert(
      fc.property(uuidV4Arb, faceCountArb, dateArb, (sessionId, faceCount, date) => {
        const record = buildUsageRecord(sessionId, faceCount, date);

        // TTLの期待値を計算
        const expectedTtlDate = new Date(date.getTime());
        expectedTtlDate.setUTCDate(expectedTtlDate.getUTCDate() + 365);
        const expectedTtl = Math.floor(expectedTtlDate.getTime() / 1000);

        expect(record.ttl).toBe(expectedTtl);

        // TTLが元の日付より365日後であることを確認
        const ttlDate = new Date(record.ttl * 1000);
        const diffDays = (ttlDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        // 365日±1日の範囲（うるう年やタイムゾーンの影響を考慮）
        expect(diffDays).toBeGreaterThanOrEqual(364);
        expect(diffDays).toBeLessThanOrEqual(366);
      }),
      { numRuns: 100 },
    );
  });

  it('レコードは正確に4つのキーのみを持つ（画像データ・IP・端末情報なし）', () => {
    fc.assert(
      fc.property(uuidV4Arb, faceCountArb, dateArb, (sessionId, faceCount, date) => {
        const record = buildUsageRecord(sessionId, faceCount, date);

        // レコードのキーを取得
        const keys = Object.keys(record);

        // 正確に4つのキーのみ
        expect(keys.length).toBe(4);
        expect(keys).toContain('date');
        expect(keys).toContain('timestampSession');
        expect(keys).toContain('faceCount');
        expect(keys).toContain('ttl');

        // 個人情報に関連するキーが含まれないことを確認
        const forbiddenKeys = ['image', 'imageData', 'ip', 'ipAddress', 'device', 'userAgent', 'deviceInfo'];
        for (const key of forbiddenKeys) {
          expect(keys).not.toContain(key);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('faceCountは入力値と一致する', () => {
    fc.assert(
      fc.property(uuidV4Arb, faceCountArb, dateArb, (sessionId, faceCount, date) => {
        const record = buildUsageRecord(sessionId, faceCount, date);
        expect(record.faceCount).toBe(faceCount);
      }),
      { numRuns: 100 },
    );
  });
});
