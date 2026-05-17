/**
 * ImageProcessor - 画像のアップロード、バリデーション、リサイズを担当する
 *
 * 画像ファイルを受け取り、フォーマット・サイズのバリデーション後に
 * 長辺1280px以下にリサイズし、Base64エンコードして返す。
 */

import type { ProcessedImage, ValidationResult } from './types';

/** 許可されるMIMEタイプ */
const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
]);

/** 最大ファイルサイズ (10MB) */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** 最小画像長辺 (50px) */
const MIN_LONG_SIDE_PX = 50;

/** リサイズ後の最大長辺 (1280px) */
const MAX_LONG_SIDE_PX = 1280;

/**
 * MIMEタイプを検証する
 * JPEG, PNG, HEIC のみ許可
 */
export function validateFormat(file: File): ValidationResult {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      errorMessage: '対応形式: JPEG, PNG, HEIC',
    };
  }
  return { valid: true };
}

/**
 * ファイルサイズを検証する（10MB以下）
 */
export function validateFileSize(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      errorMessage: 'ファイルサイズが10MBを超えています',
    };
  }
  return { valid: true };
}

/**
 * 画像寸法を検証する（長辺50px以上）
 */
export function validateDimensions(width: number, height: number): ValidationResult {
  const longSide = Math.max(width, height);
  if (longSide < MIN_LONG_SIDE_PX) {
    return {
      valid: false,
      errorMessage: '画像が小さすぎます。長辺50px以上の画像を選択してください',
    };
  }
  return { valid: true };
}

/**
 * ファイルサイズと画像寸法を統合検証する
 * ファイルサイズ検証（10MB以下）→ 画像寸法検証（長辺50px以上）
 */
export function validateSize(file: File, width: number, height: number): ValidationResult {
  const fileSizeResult = validateFileSize(file);
  if (!fileSizeResult.valid) {
    return fileSizeResult;
  }

  return validateDimensions(width, height);
}

/**
 * リサイズ後の寸法を計算する（純粋関数）
 *
 * 長辺が1280pxを超える場合、アスペクト比を保持しながら
 * 長辺を1280px以下にリサイズする。
 * 長辺が1280px以下の場合はリサイズしない。
 *
 * @param width - 元画像の幅
 * @param height - 元画像の高さ
 * @returns リサイズ後の { width, height }
 */
export function calculateResizedDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  const longSide = Math.max(width, height);

  // 長辺が1280px以下ならリサイズ不要
  if (longSide <= MAX_LONG_SIDE_PX) {
    return { width, height };
  }

  // アスペクト比を保持してリサイズ
  const scale = MAX_LONG_SIDE_PX / longSide;
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  return { width: newWidth, height: newHeight };
}

/**
 * Canvas APIを使用して画像をリサイズし、Base64文字列を返す
 *
 * ブラウザ環境でのみ動作する。テスト時は calculateResizedDimensions() を使用。
 *
 * @param imageBitmap - リサイズ対象のImageBitmap
 * @returns リサイズ済みBase64文字列（data URI prefix なし）
 */
export async function resizeImage(imageBitmap: ImageBitmap): Promise<{
  base64: string;
  width: number;
  height: number;
}> {
  const { width: newWidth, height: newHeight } = calculateResizedDimensions(
    imageBitmap.width,
    imageBitmap.height
  );

  // Canvas APIでリサイズ描画
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2Dコンテキストの取得に失敗しました');
  }

  ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);

  // PNG形式でBlobに変換
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Base64エンコード
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);

  return { base64, width: newWidth, height: newHeight };
}

/**
 * 画像ファイルの統合処理
 *
 * バリデーション → リサイズ → Base64変換 を一括で実行する。
 * バリデーションエラー時は ValidationResult の errorMessage を含む Error をスローする。
 *
 * @param file - アップロードされた画像ファイル
 * @returns ProcessedImage（リサイズ済みBase64、寸法、メタデータ）
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  // 1. フォーマット検証
  const formatResult = validateFormat(file);
  if (!formatResult.valid) {
    throw new Error(formatResult.errorMessage);
  }

  // 2. ファイルサイズ検証
  const fileSizeResult = validateFileSize(file);
  if (!fileSizeResult.valid) {
    throw new Error(fileSizeResult.errorMessage);
  }

  // 3. 画像をImageBitmapとして読み込み
  const imageBitmap = await createImageBitmap(file);

  // 4. 画像寸法検証
  const dimensionsResult = validateDimensions(imageBitmap.width, imageBitmap.height);
  if (!dimensionsResult.valid) {
    imageBitmap.close();
    throw new Error(dimensionsResult.errorMessage);
  }

  // 5. リサイズ + Base64変換
  const { base64, width, height } = await resizeImage(imageBitmap);
  imageBitmap.close();

  return {
    base64,
    width,
    height,
    originalName: file.name,
    mimeType: file.type,
  };
}
