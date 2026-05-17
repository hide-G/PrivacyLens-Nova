/**
 * RateLimiter ユニットテスト
 *
 * IPアドレスベースのレート制限が正しく動作することを検証する。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('デフォルト設定で10リクエストまで許可する', () => {
    const limiter = new RateLimiter();
    const ip = '192.168.1.1';

    for (let i = 0; i < 10; i++) {
      const result = limiter.checkLimit(ip);
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    }
  });

  it('11回目のリクエストで制限される', () => {
    const limiter = new RateLimiter();
    const ip = '192.168.1.1';

    // 10リクエスト送信
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit(ip);
    }

    // 11回目は拒否
    const result = limiter.checkLimit(ip);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('異なるIPアドレスは独立してカウントされる', () => {
    const limiter = new RateLimiter();
    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';

    // IP1で10リクエスト
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit(ip1);
    }

    // IP1は制限される
    expect(limiter.checkLimit(ip1).allowed).toBe(false);

    // IP2はまだ許可される
    expect(limiter.checkLimit(ip2).allowed).toBe(true);
  });

  it('ウィンドウ経過後にリクエストが再び許可される', () => {
    const limiter = new RateLimiter();
    const ip = '192.168.1.1';

    // 10リクエスト送信
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit(ip);
    }

    // 制限される
    expect(limiter.checkLimit(ip).allowed).toBe(false);

    // 1分経過
    vi.advanceTimersByTime(60001);

    // 再び許可される
    const result = limiter.checkLimit(ip);
    expect(result.allowed).toBe(true);
  });

  it('retryAfterは正しい待機秒数を返す', () => {
    const limiter = new RateLimiter();
    const ip = '192.168.1.1';

    // 10リクエスト送信
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit(ip);
    }

    // 30秒経過
    vi.advanceTimersByTime(30000);

    // 制限チェック: 最も古いリクエストがウィンドウから外れるまで約30秒
    const result = limiter.checkLimit(ip);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeLessThanOrEqual(31);
    expect(result.retryAfter).toBeGreaterThanOrEqual(29);
  });

  it('カスタム設定で動作する', () => {
    const limiter = new RateLimiter({
      windowMs: 10000, // 10秒
      maxRequests: 3,  // 3リクエスト
    });
    const ip = '10.0.0.1';

    // 3リクエストまで許可
    for (let i = 0; i < 3; i++) {
      expect(limiter.checkLimit(ip).allowed).toBe(true);
    }

    // 4回目は拒否
    expect(limiter.checkLimit(ip).allowed).toBe(false);

    // 10秒経過後に許可
    vi.advanceTimersByTime(10001);
    expect(limiter.checkLimit(ip).allowed).toBe(true);
  });

  it('retryAfterは最低1秒を返す', () => {
    const limiter = new RateLimiter();
    const ip = '192.168.1.1';

    // 10リクエスト送信
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit(ip);
    }

    // ほぼ1分経過（59.9秒）
    vi.advanceTimersByTime(59900);

    const result = limiter.checkLimit(ip);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('古いタイムスタンプがクリーンアップされる', () => {
    const limiter = new RateLimiter();
    const ip = '192.168.1.1';

    // 5リクエスト送信
    for (let i = 0; i < 5; i++) {
      limiter.checkLimit(ip);
    }

    // 1分経過
    vi.advanceTimersByTime(60001);

    // さらに10リクエスト送信可能（古いものはクリーンアップ済み）
    for (let i = 0; i < 10; i++) {
      expect(limiter.checkLimit(ip).allowed).toBe(true);
    }

    // 11回目は拒否
    expect(limiter.checkLimit(ip).allowed).toBe(false);
  });
});
