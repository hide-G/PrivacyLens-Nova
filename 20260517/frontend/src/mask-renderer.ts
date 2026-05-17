/**
 * MaskRenderer - Canvas APIを使用したマスク描画エンジン
 *
 * 非破壊的にぼかしマスクを描画し、60fpsの描画ループで
 * リアルタイムプレビューを提供する。
 *
 * 設計方針:
 * - 元画像のピクセルデータは常に保持（非破壊描画）
 * - requestAnimationFrameによる60fps描画ループ
 * - ガウシアンぼかし3段階（4px/10px/20px）
 * - 選択中マスクの視覚的フィードバック（破線ボーダー）
 */

import { Mask, BlurLevel, Rect } from './types';

/** ぼかし強度とピクセル値のマッピング */
const BLUR_LEVELS: Record<BlurLevel, number> = {
  low: 4,
  medium: 10,
  high: 20,
};

/**
 * MaskRendererクラス
 *
 * Canvas APIを使用してマスクの描画・操作を管理する。
 * 元画像のピクセルデータを保持し、非破壊的にマスクを適用する。
 */
export class MaskRenderer {
  /** メインキャンバス */
  private canvas: HTMLCanvasElement | null = null;
  /** メインキャンバスの2Dコンテキスト */
  private ctx: CanvasRenderingContext2D | null = null;
  /** 元画像要素 */
  private imageElement: HTMLImageElement | null = null;
  /** 元画像のピクセルデータ（非破壊描画用） */
  private originalImageData: ImageData | null = null;
  /** 描画ループのアニメーションフレームID */
  private animationFrameId: number | null = null;
  /** 描画ループが実行中かどうか */
  private isRunning: boolean = false;
  /** 現在のマスクリスト */
  private currentMasks: Mask[] = [];
  /** 現在のぼかし強度 */
  private currentBlurLevel: BlurLevel = 'medium';
  /** 現在のズームレベル */
  private currentZoomLevel: number = 1.0;

  constructor() {
    // 初期状態は空
  }

  /**
   * キャンバスと画像を初期化する。
   * 元画像のピクセルデータを保存し、描画ループを開始する。
   *
   * @param canvas - 描画先のHTMLCanvasElement
   * @param imageElement - 描画する画像のHTMLImageElement
   */
  initialize(canvas: HTMLCanvasElement, imageElement: HTMLImageElement): void {
    this.canvas = canvas;
    this.imageElement = imageElement;
    this.ctx = canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Canvas 2Dコンテキストの取得に失敗しました');
    }

    // キャンバスサイズを画像サイズに合わせる
    canvas.width = imageElement.naturalWidth || imageElement.width;
    canvas.height = imageElement.naturalHeight || imageElement.height;

    // 元画像を描画してピクセルデータを保存
    this.ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    this.originalImageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 描画ループを開始
    this.startRenderLoop();
  }

  /**
   * マスクを描画する。
   * 元画像を再描画した上にマスクを適用する（非破壊描画）。
   *
   * @param masks - 描画するマスクのリスト
   * @param blurLevel - ぼかし強度
   * @param zoomLevel - ズームレベル（1.0〜5.0）
   */
  render(masks: Mask[], blurLevel: BlurLevel, zoomLevel: number): void {
    this.currentMasks = masks;
    this.currentBlurLevel = blurLevel;
    this.currentZoomLevel = zoomLevel;
  }

  /**
   * 実際の描画処理を実行する。
   * requestAnimationFrameから呼び出される内部メソッド。
   */
  private performRender(): void {
    if (!this.ctx || !this.canvas || !this.originalImageData) {
      return;
    }

    const ctx = this.ctx;

    // 元画像のピクセルデータを復元（非破壊描画の核心）
    ctx.putImageData(this.originalImageData, 0, 0);

    // ズーム変換を適用
    if (this.currentZoomLevel !== 1.0) {
      ctx.save();
      ctx.scale(this.currentZoomLevel, this.currentZoomLevel);
    }

    // 各マスクにぼかしを適用
    const blurRadius = BLUR_LEVELS[this.currentBlurLevel];

    for (const mask of this.currentMasks) {
      this.drawBlurMask(ctx, mask.rect, blurRadius);

      // すべてのマスクに緑色の枠線を描画
      this.drawMaskBorder(ctx, mask.rect);

      // 選択状態のマスクには追加の視覚的フィードバックを描画
      if (mask.selected) {
        this.drawSelectionBorder(ctx, mask.rect);
      }
    }

    // ズーム変換を元に戻す
    if (this.currentZoomLevel !== 1.0) {
      ctx.restore();
    }
  }

  /**
   * 指定された矩形領域にガウシアンぼかしを適用する。
   * CSS filterを使用してぼかし効果を実現する。
   *
   * @param ctx - 2Dコンテキスト
   * @param rect - ぼかしを適用する矩形領域
   * @param blurRadius - ぼかし半径（px）
   */
  private drawBlurMask(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    blurRadius: number
  ): void {
    // 矩形領域の元画像データを取得
    const { x, y, width, height } = rect;

    // 領域が有効かチェック
    if (width <= 0 || height <= 0) {
      return;
    }

    // キャンバス境界内にクリップ
    const clippedX = Math.max(0, Math.round(x));
    const clippedY = Math.max(0, Math.round(y));
    const clippedWidth = Math.min(
      Math.round(width),
      (this.canvas?.width ?? 0) - clippedX
    );
    const clippedHeight = Math.min(
      Math.round(height),
      (this.canvas?.height ?? 0) - clippedY
    );

    if (clippedWidth <= 0 || clippedHeight <= 0) {
      return;
    }

    // CSS filterを使用してぼかしを適用
    ctx.save();

    // クリッピング領域を設定
    ctx.beginPath();
    ctx.rect(clippedX, clippedY, clippedWidth, clippedHeight);
    ctx.clip();

    // ぼかしフィルターを適用して元画像を再描画
    ctx.filter = `blur(${blurRadius}px)`;

    if (this.imageElement) {
      ctx.drawImage(
        this.imageElement,
        0,
        0,
        this.canvas!.width,
        this.canvas!.height
      );
    }

    ctx.restore();
  }

  /**
   * マスク矩形に緑色の枠線を描画する（全マスク共通）。
   *
   * @param ctx - 2Dコンテキスト
   * @param rect - 枠線を描画する矩形領域
   */
  private drawMaskBorder(
    ctx: CanvasRenderingContext2D,
    rect: Rect
  ): void {
    ctx.save();
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  /**
   * 選択中マスクの視覚的フィードバックとして破線ボーダーを描画する。
   *
   * @param ctx - 2Dコンテキスト
   * @param rect - ボーダーを描画する矩形領域
   */
  private drawSelectionBorder(
    ctx: CanvasRenderingContext2D,
    rect: Rect
  ): void {
    ctx.save();

    // 濃い緑色の破線スタイル
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#006400';
    ctx.lineWidth = 4;

    // 矩形ボーダーを描画
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // リサイズハンドル（四隅の正方形）を描画
    const handleSize = 12;
    ctx.fillStyle = '#006400';
    ctx.setLineDash([]);

    // 左上
    ctx.fillRect(
      rect.x - handleSize / 2,
      rect.y - handleSize / 2,
      handleSize,
      handleSize
    );
    // 右上
    ctx.fillRect(
      rect.x + rect.width - handleSize / 2,
      rect.y - handleSize / 2,
      handleSize,
      handleSize
    );
    // 左下
    ctx.fillRect(
      rect.x - handleSize / 2,
      rect.y + rect.height - handleSize / 2,
      handleSize,
      handleSize
    );
    // 右下
    ctx.fillRect(
      rect.x + rect.width - handleSize / 2,
      rect.y + rect.height - handleSize / 2,
      handleSize,
      handleSize
    );

    ctx.restore();
  }

  /**
   * 60fps描画ループを開始する。
   * requestAnimationFrameを使用して毎フレーム描画を更新する。
   */
  private startRenderLoop(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    const loop = (): void => {
      if (!this.isRunning) {
        return;
      }

      this.performRender();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * 描画ループを停止する。
   */
  private stopRenderLoop(): void {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * マスク適用済み画像をBlobとして書き出す。
   * 書き出し用の一時キャンバスを使用し、メインキャンバスに影響を与えない。
   *
   * @param masks - 適用するマスクのリスト
   * @param blurLevel - ぼかし強度
   * @returns PNG形式のBlob
   */
  async exportImage(masks: Mask[], blurLevel: BlurLevel): Promise<Blob> {
    if (!this.canvas || !this.originalImageData || !this.imageElement) {
      throw new Error('MaskRendererが初期化されていません');
    }

    // 書き出し用の一時キャンバスを作成
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const exportCtx = exportCanvas.getContext('2d');

    if (!exportCtx) {
      throw new Error('書き出し用キャンバスのコンテキスト取得に失敗しました');
    }

    // 元画像を描画
    exportCtx.putImageData(this.originalImageData, 0, 0);

    // マスクを適用（ズームなし、選択ボーダーなし）
    const blurRadius = BLUR_LEVELS[blurLevel];

    for (const mask of masks) {
      // ぼかしマスクを描画
      const { x, y, width, height } = mask.rect;

      if (width <= 0 || height <= 0) {
        continue;
      }

      const clippedX = Math.max(0, Math.round(x));
      const clippedY = Math.max(0, Math.round(y));
      const clippedWidth = Math.min(
        Math.round(width),
        exportCanvas.width - clippedX
      );
      const clippedHeight = Math.min(
        Math.round(height),
        exportCanvas.height - clippedY
      );

      if (clippedWidth <= 0 || clippedHeight <= 0) {
        continue;
      }

      exportCtx.save();
      exportCtx.beginPath();
      exportCtx.rect(clippedX, clippedY, clippedWidth, clippedHeight);
      exportCtx.clip();
      exportCtx.filter = `blur(${blurRadius}px)`;
      exportCtx.drawImage(
        this.imageElement,
        0,
        0,
        exportCanvas.width,
        exportCanvas.height
      );
      exportCtx.restore();
    }

    // PNG形式でBlobに変換
    return new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('画像のBlob変換に失敗しました'));
          }
        },
        'image/png'
      );
    });
  }

  /**
   * 元画像のピクセルデータのコピーを返す。
   * Property 6（元画像保持）のテスト用メソッド。
   *
   * @returns 元画像のImageDataのコピー、または未初期化の場合null
   */
  getOriginalImageData(): ImageData | null {
    if (!this.originalImageData) {
      return null;
    }

    // コピーを返す（外部からの変更を防止）
    const copy = new ImageData(
      new Uint8ClampedArray(this.originalImageData.data),
      this.originalImageData.width,
      this.originalImageData.height
    );
    return copy;
  }

  /**
   * リソースを解放し、描画ループを停止する。
   */
  destroy(): void {
    this.stopRenderLoop();
    this.canvas = null;
    this.ctx = null;
    this.imageElement = null;
    this.originalImageData = null;
    this.currentMasks = [];
  }
}
