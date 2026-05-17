/**
 * 座標変換ユーティリティ
 *
 * Amazon Nova 2 Liteが返す[0,1000]スケールの座標を
 * 画像のピクセル座標に変換し、画像境界内にクランプする。
 */

import { BoundingBox, Rect } from './types';

/**
 * [0,1000]スケールの座標値を画像ピクセル座標に変換する。
 * 変換誤差は±1px以内（Math.roundによる整数丸めのみ）。
 *
 * @param novaCoord - [0,1000]スケールの座標値
 * @param imageDimension - 画像の幅または高さ（ピクセル）
 * @returns ピクセル座標
 */
export function convertCoordinate(novaCoord: number, imageDimension: number): number {
  return Math.round(novaCoord * imageDimension / 1000);
}

/**
 * バウンディングボックス（[0,1000]スケール）をピクセル座標のRectに変換する。
 *
 * @param box - Amazon Nova 2 Liteが返すバウンディングボックス
 * @param imageWidth - 画像の幅（ピクセル）
 * @param imageHeight - 画像の高さ（ピクセル）
 * @returns ピクセル座標のRect
 */
export function convertBoundingBox(box: BoundingBox, imageWidth: number, imageHeight: number): Rect {
  const x = convertCoordinate(box.x1, imageWidth);
  const y = convertCoordinate(box.y1, imageHeight);
  const x2 = convertCoordinate(box.x2, imageWidth);
  const y2 = convertCoordinate(box.y2, imageHeight);

  return {
    x,
    y,
    width: x2 - x,
    height: y2 - y,
  };
}

/**
 * Rectを画像境界内にクランプし、最小サイズを保証する。
 *
 * 制約:
 * - 0 <= x, 0 <= y
 * - x + width <= imageWidth
 * - y + height <= imageHeight
 * - width >= minSize, height >= minSize
 *
 * @param rect - クランプ対象のRect
 * @param imageWidth - 画像の幅（ピクセル）
 * @param imageHeight - 画像の高さ（ピクセル）
 * @param minSize - 最小サイズ（デフォルト: 20px）
 * @returns クランプ済みのRect
 */
export function clampRect(
  rect: Rect,
  imageWidth: number,
  imageHeight: number,
  minSize: number = 20
): Rect {
  // 幅と高さの最小サイズを保証
  let width = Math.max(rect.width, minSize);
  let height = Math.max(rect.height, minSize);

  // 画像サイズを超えないように幅と高さを制限
  width = Math.min(width, imageWidth);
  height = Math.min(height, imageHeight);

  // x, y を 0 以上にクランプ
  let x = Math.max(rect.x, 0);
  let y = Math.max(rect.y, 0);

  // x + width が imageWidth を超えないように調整
  if (x + width > imageWidth) {
    x = imageWidth - width;
  }

  // y + height が imageHeight を超えないように調整
  if (y + height > imageHeight) {
    y = imageHeight - height;
  }

  // 最終的に x, y が 0 以上であることを再確認
  x = Math.max(x, 0);
  y = Math.max(y, 0);

  return { x, y, width, height };
}
