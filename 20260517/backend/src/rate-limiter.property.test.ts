/**
 * Property 12: レート制限は1IPあたり1分間10リクエストを超過した場合に429を返す
 *
 * fast-check によるプロパティテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { RateLimiter } from './rate-limiter';

describe('Property 12: レート制限は1IPあたり1分間10リクエストを超過した場合に429を返す', () => {
  /**
   * **Validates: Requirements 11.6**
   */

  it('最初の10リクエストはすべて許可される', () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.integer({ min: 1, max: 10 }),
        (ip, requestCount) => {
          const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 10 });

          for (let i = 0; i < requestCount; i++) {
            const result = limiter.checkLimit(ip);
            expect(result.allowed).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('11番目以降のリクエストはウィンドウ内で拒否される', () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.integer({ min: 11, max: 30 }),
        (ip, totalRequests) => {
          const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 10 });

          // 最初の10リクエストを送信
          for (let i = 0; i < 10; i++) {
            const result = limiter.checkLimit(ip);
            expect(result.allowed).toBe(true);
          }

          // 11番目以降は拒否される
          for (let i = 10; i < totalRequests; i++) {
            const result = limiter.checkLimit(ip);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeDefined();
            expect(result.retryAfter!).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('異なるIPアドレスは独立してレート制限される', () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.ipV4(),
        (ip1, ip2) => {
          // 同じIPの場合はスキップ
          fc.pre(ip1 !== ip2);

          const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 10 });

          // ip1で10リクエスト送信（上限到達）
          for (let i = 0; i < 10; i++) {
            limiter.checkLimit(ip1);
          }

          // ip1は拒否される
          const result1 = limiter.checkLimit(ip1);
          expect(result1.allowed).toBe(false);

          // ip2はまだ許可される
          const result2 = limiter.checkLimit(ip2);
          expect(result2.allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ウィンドウ期間経過後はリクエストが再び許可される', () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.integer({ min: 61000, max: 120000 }),
        (ip, elapsedMs) => {
          // カスタムウィンドウサイズでテスト（短いウィンドウ）
          const windowMs = 1000; // 1秒ウィンドウ
          const limiter = new RateLimiter({ windowMs, maxRequests: 10 });

          // 10リクエスト送信
          for (let i = 0; i < 10; i++) {
            limiter.checkLimit(ip);
          }

          // 上限到達を確認
          const blocked = limiter.checkLimit(ip);
          expect(blocked.allowed).toBe(false);

          // Date.nowをモックしてウィンドウ経過をシミュレート
          const originalNow = Date.now;
          const baseTime = originalNow();
          Date.now = () => baseTime + elapsedMs;

          try {
            // ウィンドウ経過後は許可される
            const result = limiter.checkLimit(ip);
            expect(result.allowed).toBe(true);
          } finally {
            Date.now = originalNow;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('retryAfterは1以上の整数秒を返す', () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        (ip) => {
          const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 10 });

          // 10リクエスト送信して上限到達
          for (let i = 0; i < 10; i++) {
            limiter.checkLimit(ip);
          }

          // 11番目のリクエスト
          const result = limiter.checkLimit(ip);
          expect(result.allowed).toBe(false);
          expect(result.retryAfter).toBeDefined();
          expect(result.retryAfter!).toBeGreaterThanOrEqual(1);
          expect(Number.isInteger(result.retryAfter!)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
