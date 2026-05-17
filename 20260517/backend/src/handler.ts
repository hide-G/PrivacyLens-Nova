/**
 * PrivacyLens Nova - Lambda Function URL ハンドラー
 *
 * 顔検出APIのエントリポイント。リクエストのバリデーション、
 * 顔検出処理の呼び出し、利用統計の記録を行う。
 * 画像データはメモリ上でのみ処理し、レスポンス返却後に即座に解放する。
 */

import { detectFaces } from './face-detector.js';
import { saveUsageRecord } from './usage-tracker.js';
import type {
  DetectFacesRequest,
  DetectFacesResponse,
  ErrorResponse,
} from './types.js';

/** 許可するオリジン */
const ALLOWED_ORIGIN = 'https://privacylens-nova.com';

/** リクエストボディの最大サイズ (10MB) */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

/** Lambda Function URL イベント型 */
interface LambdaFunctionURLEvent {
  version: string;
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string>;
  requestContext: {
    accountId: string;
    apiId: string;
    domainName: string;
    domainPrefix: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    requestId: string;
    routeKey: string;
    stage: string;
    time: string;
    timeEpoch: number;
  };
  body?: string;
  isBase64Encoded: boolean;
}

/** Lambda Function URL レスポンス型 */
interface LambdaFunctionURLResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * 共通レスポンスヘッダーを生成する
 */
function buildResponseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}

/**
 * エラーレスポンスを生成する
 * 内部情報（スタックトレース、ファイルパス、サービス名）を含めない
 */
function buildErrorResponse(
  statusCode: number,
  message: string,
  code: string,
  retryAfter?: number
): LambdaFunctionURLResponse {
  const errorBody: ErrorResponse = {
    success: false,
    error: message,
    code,
    ...(retryAfter !== undefined && { retryAfter }),
  };

  return {
    statusCode,
    headers: buildResponseHeaders(),
    body: JSON.stringify(errorBody),
  };
}

/**
 * リクエストボディのサイズを検証する
 */
function validateBodySize(body: string | undefined): boolean {
  if (!body) return false;
  return Buffer.byteLength(body, 'utf-8') <= MAX_BODY_SIZE;
}

/**
 * Content-Typeヘッダーを検証する
 */
function validateContentType(headers: Record<string, string>): boolean {
  const contentType = headers['content-type'] || headers['Content-Type'] || '';
  return contentType.includes('application/json');
}

/**
 * リクエストボディをパースしバリデーションする
 */
function parseAndValidateBody(body: string): DetectFacesRequest | null {
  try {
    const parsed = JSON.parse(body);

    // image と sessionId が必須
    if (!parsed.image || typeof parsed.image !== 'string') {
      return null;
    }
    if (!parsed.sessionId || typeof parsed.sessionId !== 'string') {
      return null;
    }

    return {
      image: parsed.image,
      sessionId: parsed.sessionId,
    };
  } catch {
    return null;
  }
}

/**
 * Lambda Function URL ハンドラー
 *
 * 処理フロー:
 * 1. OPTIONSリクエスト（CORS preflight）の処理
 * 2. リクエストバリデーション（Content-Type、ボディサイズ、JSON形式）
 * 3. 顔検出処理の実行
 * 4. 利用統計の非同期保存
 * 5. レスポンス返却
 * 6. 画像データの参照解放
 */
export async function handler(
  event: LambdaFunctionURLEvent
): Promise<LambdaFunctionURLResponse> {
  // CORS preflight リクエストの処理
  if (event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: buildResponseHeaders(),
      body: '',
    };
  }

  // POSTメソッドのみ許可
  if (event.requestContext.http.method !== 'POST') {
    return buildErrorResponse(405, 'メソッドが許可されていません', 'METHOD_NOT_ALLOWED');
  }

  // Content-Type検証
  if (!validateContentType(event.headers)) {
    return buildErrorResponse(400, 'Content-Typeはapplication/jsonを指定してください', 'INVALID_CONTENT_TYPE');
  }

  // ボディの存在確認とサイズ検証
  const rawBody = event.isBase64Encoded && event.body
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;

  if (!rawBody) {
    return buildErrorResponse(400, 'リクエストボディが空です', 'EMPTY_BODY');
  }

  if (!validateBodySize(rawBody)) {
    return buildErrorResponse(400, 'リクエストボディが10MBを超えています', 'BODY_TOO_LARGE');
  }

  // リクエストボディのパースとバリデーション
  const request = parseAndValidateBody(rawBody);
  if (!request) {
    return buildErrorResponse(400, 'リクエスト形式が不正です。image（Base64文字列）とsessionId（文字列）が必要です', 'INVALID_REQUEST');
  }

  // リクエストログ出力（画像データを含めない）
  console.log(JSON.stringify({
    action: 'detect-faces',
    sessionId: request.sessionId,
    imageSize: request.image.length,
    timestamp: new Date().toISOString(),
  }));

  const startTime = Date.now();
  let imageData: string | null = request.image;

  try {
    // 顔検出処理の実行
    const result = await detectFaces(imageData);
    const processingTime = Date.now() - startTime;

    // コスト計算（Nova Lite: input $0.00006/1K tokens, output $0.00024/1K tokens）
    const inputCost = (result.inputTokens / 1000) * 0.00006;
    const outputCost = (result.outputTokens / 1000) * 0.00024;
    const totalCost = inputCost + outputCost;

    // ファイル名を生成（西暦年月日-時分秒-ユニーク6文字）
    const now = new Date();
    const y = now.getUTCFullYear();
    const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const h = String(now.getUTCHours()).padStart(2, '0');
    const mi = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    const unique = Math.random().toString(36).substring(2, 8);
    const filename = `privacylens-nova-${y}${mo}${d}-${h}${mi}${s}-${unique}.png`;

    // 利用統計の非同期保存（ファイル名含む）
    saveUsageRecord(request.sessionId, result.faces.length, filename);

    // 成功レスポンスの生成
    const response = {
      success: true,
      faces: result.faces,
      faceCount: result.faces.length,
      processingTime,
      filename,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost: totalCost,
    };

    return {
      statusCode: 200,
      headers: buildResponseHeaders(),
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    // Bedrock API エラーのハンドリング
    const err = error as { statusCode?: number; message?: string };

    if (err.statusCode === 429) {
      return buildErrorResponse(503, 'サービスが混雑しています。しばらく待ってから再試行してください', 'SERVICE_BUSY');
    }
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return buildErrorResponse(502, 'エラーが発生しました。再試行してください', 'UPSTREAM_ERROR');
    }
    if (err.statusCode && err.statusCode >= 500) {
      return buildErrorResponse(503, 'サービスが一時的に利用できません。再試行してください', 'SERVICE_UNAVAILABLE');
    }

    // 予期しないエラー（内部情報を含めない）
    console.error('予期しないエラー:', err.message || 'unknown error');
    return buildErrorResponse(500, 'エラーが発生しました。再試行してください', 'INTERNAL_ERROR');
  } finally {
    // 画像データの参照を解放（メモリ上の画像データをクリア）
    imageData = null;
    // request.image の参照も解放
    (request as { image: string | null }).image = null;
  }
}
