/**
 * PrivacyLens Nova - フロントエンド型定義
 * 
 * 画像処理、マスク管理、UI状態に関するインターフェースと型を定義する。
 */

/** リサイズ済み画像データ */
export interface ProcessedImage {
  /** リサイズ済みBase64 (data URI prefix なし) */
  base64: string;
  /** リサイズ後の幅 */
  width: number;
  /** リサイズ後の高さ */
  height: number;
  /** 元ファイル名 */
  originalName: string;
  /** MIME type */
  mimeType: string;
}

/** バリデーション結果 */
export interface ValidationResult {
  /** バリデーション成否 */
  valid: boolean;
  /** 日本語エラーメッセージ */
  errorMessage?: string;
}

/** Amazon Nova 2 Liteが返すバウンディングボックス座標 [0, 1000]スケール */
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

/** マスク情報 */
export interface Mask {
  /** マスクの一意識別子 */
  id: string;
  /** 画像ピクセル座標での矩形 */
  rect: Rect;
  /** 選択状態 */
  selected: boolean;
}

/** 矩形座標（画像ピクセル座標） */
export interface Rect {
  /** X座標 */
  x: number;
  /** Y座標 */
  y: number;
  /** 幅 */
  width: number;
  /** 高さ */
  height: number;
}

/**
 * ぼかし強度
 * - low: ガウシアンぼかし半径 4px
 * - medium: ガウシアンぼかし半径 10px
 * - high: ガウシアンぼかし半径 20px
 */
export type BlurLevel = 'low' | 'medium' | 'high';

/** アプリケーション全体の状態 */
export interface AppState {
  /** 画面状態 */
  screen: 'upload' | 'edit' | 'share';

  /** 画像データ (メモリ上のみ) */
  originalImage: ProcessedImage | null;

  /** マスク状態 */
  masks: Mask[];
  /** 選択中のマスクID */
  selectedMaskId: string | null;
  /** ぼかし強度 */
  blurLevel: BlurLevel;

  /** 操作履歴 (Undo用、最大10件) */
  history: MaskState[];
  /** 履歴インデックス */
  historyIndex: number;

  /** ローディング状態 */
  isLoading: boolean;
  /** ズームレベル (1.0〜5.0) */
  zoomLevel: number;
  /** ダークモード */
  isDarkMode: boolean;

  /** エラー状態 */
  error: ErrorState | null;
  /** 通知メッセージ */
  notification: string | null;
}

/** マスク操作のスナップショット（Undo用） */
export interface MaskState {
  /** マスクリスト */
  masks: Mask[];
  /** ぼかし強度 */
  blurLevel: BlurLevel;
}

/** エラー状態 */
export interface ErrorState {
  /** 日本語エラーメッセージ */
  message: string;
  /** 再試行アクション */
  retryAction?: () => void;
}
