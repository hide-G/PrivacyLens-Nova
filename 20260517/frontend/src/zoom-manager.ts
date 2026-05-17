/**
 * ズーム管理モジュール
 * 
 * ピンチズーム検出とズームレベル管理（1.0〜5.0）を提供する。
 * ズームレベルは常に[min, max]の範囲にクランプされる。
 */

/**
 * ズーム値を指定範囲にクランプする純粋関数
 * @param value - クランプ対象のズーム値
 * @param min - 最小ズーム値（デフォルト: 1.0）
 * @param max - 最大ズーム値（デフォルト: 5.0）
 * @returns クランプされたズーム値
 */
export function clampZoom(value: number, min: number = 1.0, max: number = 5.0): number {
  if (min > max) {
    // min > max の場合は min を優先する
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * ズーム管理クラス
 * 
 * ピンチズームのレベル管理を行い、ズーム値を常に有効範囲内に保つ。
 */
export class ZoomManager {
  private currentZoom: number;
  private readonly minZoom: number;
  private readonly maxZoom: number;

  /**
   * @param minZoom - 最小ズームレベル（デフォルト: 1.0）
   * @param maxZoom - 最大ズームレベル（デフォルト: 5.0）
   */
  constructor(minZoom: number = 1.0, maxZoom: number = 5.0) {
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.currentZoom = minZoom;
  }

  /**
   * 現在のズームレベルを取得する
   */
  getZoom(): number {
    return this.currentZoom;
  }

  /**
   * ズームレベルを設定する（範囲外の値はクランプされる）
   * @param level - 設定するズームレベル
   * @returns クランプ後のズームレベル
   */
  setZoom(level: number): number {
    this.currentZoom = clampZoom(level, this.minZoom, this.maxZoom);
    return this.currentZoom;
  }

  /**
   * ズームインする（ズームレベルを増加させる）
   * @param delta - 増加量（デフォルト: 0.5）
   * @returns クランプ後のズームレベル
   */
  zoomIn(delta: number = 0.5): number {
    return this.setZoom(this.currentZoom + delta);
  }

  /**
   * ズームアウトする（ズームレベルを減少させる）
   * @param delta - 減少量（デフォルト: 0.5）
   * @returns クランプ後のズームレベル
   */
  zoomOut(delta: number = 0.5): number {
    return this.setZoom(this.currentZoom - delta);
  }

  /**
   * ズームレベルを初期値（1.0）にリセットする
   */
  reset(): void {
    this.currentZoom = this.minZoom;
  }
}
