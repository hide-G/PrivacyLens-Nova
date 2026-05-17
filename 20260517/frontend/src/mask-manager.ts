/**
 * マスク管理ロジック
 *
 * マスクの追加・削除・移動・リサイズを管理し、
 * 画像境界内クランプとUndo履歴を提供する。
 */

import { Mask, Rect } from './types';
import { clampRect } from './coordinate-converter';

/** デフォルトマスクサイズ（px） */
const DEFAULT_MASK_SIZE = 100;

/** 最小マスクサイズ（px） */
const MIN_MASK_SIZE = 20;

/** Undo履歴の最大保持数 */
const MAX_HISTORY = 10;

/**
 * マスク管理クラス
 *
 * マスクの追加、削除、移動、リサイズ操作を提供し、
 * すべての操作結果を画像境界内にクランプする。
 * 操作履歴を保持し、最大10回のUndo操作をサポートする。
 */
export class MaskManager {
  private masks: Mask[] = [];
  private selectedMaskId: string | null = null;
  private history: Mask[][] = [];
  private imageWidth: number;
  private imageHeight: number;

  /**
   * @param imageWidth - 画像の幅（ピクセル）
   * @param imageHeight - 画像の高さ（ピクセル）
   */
  constructor(imageWidth: number, imageHeight: number) {
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;
  }

  /**
   * 現在のマスク状態を履歴に保存する。
   * 履歴がMAX_HISTORYを超える場合、最も古いエントリを削除する。
   */
  private saveHistory(): void {
    const snapshot = this.masks.map(m => ({
      id: m.id,
      rect: { ...m.rect },
      selected: m.selected,
    }));
    this.history.push(snapshot);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  /**
   * 指定位置を中心にデフォルトサイズ（100x100px）のマスクを追加する。
   * マスクは画像境界内にクランプされる。
   *
   * @param centerX - マスク中心のX座標
   * @param centerY - マスク中心のY座標
   * @returns 追加されたマスク
   */
  addMask(centerX: number, centerY: number): Mask {
    this.saveHistory();

    const rect: Rect = {
      x: centerX - DEFAULT_MASK_SIZE / 2,
      y: centerY - DEFAULT_MASK_SIZE / 2,
      width: DEFAULT_MASK_SIZE,
      height: DEFAULT_MASK_SIZE,
    };

    const clampedRect = clampRect(rect, this.imageWidth, this.imageHeight, MIN_MASK_SIZE);

    const mask: Mask = {
      id: crypto.randomUUID(),
      rect: clampedRect,
      selected: false,
    };

    this.masks.push(mask);
    return mask;
  }

  /**
   * 指定IDのマスクを削除する。
   *
   * @param maskId - 削除対象のマスクID
   */
  removeMask(maskId: string): void {
    const index = this.masks.findIndex(m => m.id === maskId);
    if (index === -1) return;

    this.saveHistory();
    this.masks.splice(index, 1);

    if (this.selectedMaskId === maskId) {
      this.selectedMaskId = null;
    }
  }

  /**
   * 指定IDのマスクを移動する。
   * 移動後の位置は画像境界内にクランプされる。
   *
   * @param maskId - 移動対象のマスクID
   * @param deltaX - X方向の移動量
   * @param deltaY - Y方向の移動量
   */
  moveMask(maskId: string, deltaX: number, deltaY: number): void {
    const mask = this.masks.find(m => m.id === maskId);
    if (!mask) return;

    this.saveHistory();

    const newRect: Rect = {
      x: mask.rect.x + deltaX,
      y: mask.rect.y + deltaY,
      width: mask.rect.width,
      height: mask.rect.height,
    };

    mask.rect = clampRect(newRect, this.imageWidth, this.imageHeight, MIN_MASK_SIZE);
  }

  /**
   * 指定IDのマスクをリサイズする。
   * リサイズ後のサイズは最小20x20px以上、画像境界内にクランプされる。
   *
   * @param maskId - リサイズ対象のマスクID
   * @param newRect - 新しい矩形
   */
  resizeMask(maskId: string, newRect: Rect): void {
    const mask = this.masks.find(m => m.id === maskId);
    if (!mask) return;

    this.saveHistory();

    mask.rect = clampRect(newRect, this.imageWidth, this.imageHeight, MIN_MASK_SIZE);
  }

  /**
   * 指定IDのマスクを選択状態にする。
   * 他のマスクの選択状態は解除される。
   *
   * @param maskId - 選択対象のマスクID
   */
  selectMask(maskId: string): void {
    this.masks.forEach(m => {
      m.selected = m.id === maskId;
    });
    this.selectedMaskId = maskId;
  }

  /**
   * すべてのマスクの選択状態を解除する。
   */
  deselectAll(): void {
    this.masks.forEach(m => {
      m.selected = false;
    });
    this.selectedMaskId = null;
  }

  /**
   * 現在のマスクリストを取得する。
   *
   * @returns マスクの配列
   */
  getMasks(): Mask[] {
    return this.masks;
  }

  /**
   * 現在選択中のマスクを取得する。
   *
   * @returns 選択中のマスク、または null
   */
  getSelectedMask(): Mask | null {
    if (!this.selectedMaskId) return null;
    return this.masks.find(m => m.id === this.selectedMaskId) || null;
  }

  /**
   * 直前の操作を取り消す（Undo）。
   * 履歴がない場合は何もしない。
   */
  undo(): void {
    if (this.history.length === 0) return;

    const previousState = this.history.pop()!;
    this.masks = previousState;
    this.selectedMaskId = null;
  }

  /**
   * Undo操作が可能かどうかを返す。
   *
   * @returns Undo可能な場合 true
   */
  canUndo(): boolean {
    return this.history.length > 0;
  }
}
