/**
 * PrivacyLens Nova - APIクライアント
 *
 * Lambda Function URL への POST /detect-faces 呼び出しを管理する。
 * - 10秒タイムアウト処理 (AbortController)
 * - ネットワークエラー検出 (navigator.onLine + fetch catch)
 * - 再試行ロジック（直前のリクエスト再送信）
 * - セッションID生成（UUIDv4）
 */

import type { BoundingBox } from './types';

/** 顔検出APIのレスポンス型 */
export interface DetectFacesResult {
  /** 処理成否 */
  success: boolean;
  /** 検出された顔のバウンディングボックス */
  faces?: BoundingBox[];
  /** 検出顔数 */
  faceCount?: number;
  /** 処理時間 (ms) */
  processingTime?: number;
  /** ファイル名 */
  filename?: string;
  /** 入力トークン数 */
  inputTokens?: number;
  /** 出力トークン数 */
  outputTokens?: number;
  /** コスト (USD) */
  cost?: number;
  /** エラーメッセージ（日本語） */
  error?: string;
  /** エラーコード */
  code?: string;
  /** レート制限時の待機秒数 */
  retryAfter?: number;
}

/** タイムアウト時間（ミリ秒）- モバイルの大きな画像アップロードを考慮して30秒 */
const TIMEOUT_MS = 30000;

/**
 * APIクライアントクラス
 *
 * Lambda Function URL への顔検出リクエストを管理する。
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly sessionId: string;
  private lastBase64Image: string | null = null;

  /**
   * @param baseUrl Lambda Function URL のベースURL
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.sessionId = crypto.randomUUID();
  }

  /**
   * セッションIDを取得する
   * @returns UUIDv4形式のセッションID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 顔検出APIを呼び出す
   * @param base64Image Base64エンコードされた画像データ（data URI prefix なし）
   * @returns 顔検出結果
   */
  async detectFaces(base64Image: string): Promise<DetectFacesResult> {
    this.lastBase64Image = base64Image;
    return this.sendRequest(base64Image);
  }

  /**
   * 直前のリクエストを再試行する
   * @returns 顔検出結果
   * @throws 再試行可能なリクエストがない場合
   */
  async retry(): Promise<DetectFacesResult> {
    if (this.lastBase64Image === null) {
      return {
        success: false,
        error: 'エラーが発生しました。再試行してください',
      };
    }
    return this.sendRequest(this.lastBase64Image);
  }

  /**
   * 実際のHTTPリクエストを送信する
   * @param base64Image Base64エンコードされた画像データ
   * @returns 顔検出結果
   */
  private async sendRequest(base64Image: string): Promise<DetectFacesResult> {
    // ネットワーク接続チェック
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        error: 'ネットワーク接続を確認してください',
      };
    }

    // AbortController でタイムアウト制御
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/detect-faces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          sessionId: this.sessionId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // レスポンスのパース
      const data = await response.json();

      // レート制限 (429)
      if (response.status === 429) {
        const retryAfter = data.retryAfter || 60;
        return {
          success: false,
          error: `リクエストが集中しています。${retryAfter}秒後に再試行してください`,
          code: data.code,
          retryAfter,
        };
      }

      // その他のエラーレスポンス
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'エラーが発生しました。再試行してください',
          code: data.code,
        };
      }

      // 成功レスポンス
      return {
        success: true,
        faces: data.faces,
        faceCount: data.faceCount,
        processingTime: data.processingTime,
        filename: data.filename,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cost: data.cost,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      // AbortError = タイムアウト
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          success: false,
          error: '処理がタイムアウトしました。再試行してください',
        };
      }

      // TypeError = ネットワークエラー（fetch が失敗した場合）
      if (err instanceof TypeError) {
        return {
          success: false,
          error: 'ネットワーク接続を確認してください',
        };
      }

      // その他の予期しないエラー
      return {
        success: false,
        error: 'エラーが発生しました。再試行してください',
      };
    }
  }
}
