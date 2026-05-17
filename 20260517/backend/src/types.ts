/**
 * PrivacyLens Nova - バックエンド型定義
 * 
 * 顔検出API、エラーレスポンス、利用統計に関するインターフェースを定義する。
 */

/** バウンディングボックス座標 [0, 1000]スケール */
export interface BoundingBox {
  /** 左 [0, 1000] */
  x1: number;
  /** 上 [0, 1000] */
  y1: number;
  /** 右 [0, 1000] */
  x2: number;
  /** 下 [0, 1000] */
  y2: number;
}

/** 顔検出リクエスト */
export interface DetectFacesRequest {
  /** Base64エンコード画像 */
  image: string;
  /** UUIDv4 セッションID */
  sessionId: string;
}

/** 顔検出成功レスポンス */
export interface DetectFacesResponse {
  /** 処理成否 */
  success: boolean;
  /** 検出された顔のバウンディングボックス */
  faces: BoundingBox[];
  /** 検出顔数 */
  faceCount: number;
  /** 処理時間 (ms) */
  processingTime: number;
}

/** エラーレスポンス */
export interface ErrorResponse {
  /** 常にfalse */
  success: false;
  /** 日本語エラーメッセージ */
  error: string;
  /** エラーコード */
  code: string;
  /** レート制限時の待機秒数 */
  retryAfter?: number;
}

/** DynamoDB利用記録 */
export interface UsageRecord {
  /** パーティションキー: YYYY-MM-DD (UTC) */
  date: string;
  /** ソートキー: {ISO8601}#{sessionId} */
  timestampSession: string;
  /** 検出顔数 */
  faceCount: number;
  /** TTL: epoch秒 (記録日+365日) */
  ttl: number;
}
