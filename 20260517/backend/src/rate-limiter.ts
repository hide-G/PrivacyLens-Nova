/**
 * PrivacyLens Nova - レート制限
 *
 * IPアドレスベースのレート制限を実装する。
 * Lambda関数内のインメモリMapでリクエストタイムスタンプを管理し、
 * 1分間あたりのリクエスト数を制限する。
 *
 * コールドスタート時にMapはリセットされるが、本ユースケースでは許容範囲とする。
 */

/** レート制限の設定 */
export interface RateLimiterConfig {
  /** ウィンドウサイズ（ミリ秒）。デフォルト: 60000（1分） */
  windowMs: number;
  /** ウィンドウ内の最大リクエスト数。デフォルト: 10 */
  maxRequests: number;
}

/** レート制限チェック結果 */
export interface RateLimitResult {
  /** リクエストが許可されるかどうか */
  allowed: boolean;
  /** 超過時、次のリクエストが可能になるまでの待機秒数 */
  retryAfter?: number;
}

/** デフォルト設定 */
const DEFAULT_CONFIG: RateLimiterConfig = {
  windowMs: 60000,
  maxRequests: 10,
};

/**
 * IPアドレスベースのレート制限クラス
 *
 * インメモリMapでIPごとのリクエストタイムスタンプを追跡し、
 * ウィンドウ内のリクエスト数が上限を超えた場合に制限する。
 */
export class RateLimiter {
  private readonly config: RateLimiterConfig;
  /** IPアドレスごとのリクエストタイムスタンプ配列 */
  private readonly requests: Map<string, number[]>;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.requests = new Map();
  }

  /**
   * 指定IPのレート制限をチェックする
   *
   * @param ip - クライアントのIPアドレス
   * @returns レート制限チェック結果（許可/拒否と待機秒数）
   */
  checkLimit(ip: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // 該当IPのタイムスタンプ配列を取得（なければ空配列）
    const timestamps = this.requests.get(ip) || [];

    // ウィンドウ外の古いタイムスタンプを除去
    const validTimestamps = timestamps.filter((ts) => ts > windowStart);

    // リクエスト数が上限以内の場合は許可
    if (validTimestamps.length < this.config.maxRequests) {
      // 現在のタイムスタンプを追加して保存
      validTimestamps.push(now);
      this.requests.set(ip, validTimestamps);
      return { allowed: true };
    }

    // 上限超過: 最も古いタイムスタンプがウィンドウから外れるまでの待機秒数を計算
    const oldestTimestamp = validTimestamps[0];
    const retryAfterMs = oldestTimestamp + this.config.windowMs - now;
    const retryAfter = Math.ceil(retryAfterMs / 1000);

    // クリーンアップ済みのタイムスタンプを保存（現在のリクエストは追加しない）
    this.requests.set(ip, validTimestamps);

    return {
      allowed: false,
      retryAfter: Math.max(retryAfter, 1), // 最低1秒
    };
  }
}
