/**
 * タッチイベントハンドリングモジュール
 *
 * Canvas上でのタッチ操作を検出し、以下のジェスチャーを識別する:
 * - マスクのタップ（選択）
 * - マスクのドラッグ移動（touchmove）
 * - マスクのリサイズ（角ドラッグ）
 * - 新規マスク追加（500ms長押し）
 * - ピンチズーム検出（2本指）
 */

/** リサイズハンドルの位置 */
export type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** タッチイベントコールバックインターフェース */
export interface TouchCallbacks {
  /** マスクタップ時（選択） */
  onMaskTap(x: number, y: number): void;
  /** ドラッグ開始 */
  onMaskDragStart(x: number, y: number): void;
  /** ドラッグ中（差分座標） */
  onMaskDrag(deltaX: number, deltaY: number): void;
  /** ドラッグ終了 */
  onMaskDragEnd(): void;
  /** リサイズ開始 */
  onMaskResizeStart(x: number, y: number, handle: ResizeHandle): void;
  /** リサイズ中（差分座標） */
  onMaskResize(deltaX: number, deltaY: number): void;
  /** リサイズ終了 */
  onMaskResizeEnd(): void;
  /** 長押し（500ms保持後に発火） */
  onLongPress(x: number, y: number): void;
  /** ピンチズーム（スケール差分） */
  onPinchZoom(scaleDelta: number): void;
}

/** ドラッグ判定の移動閾値（px） */
const DRAG_THRESHOLD = 5;

/** 長押し判定時間（ms） */
const LONG_PRESS_DURATION = 500;

/**
 * タッチハンドラークラス
 *
 * Canvas要素にタッチイベントリスナーを登録し、
 * ジェスチャーを識別してコールバックを呼び出す。
 */
export class TouchHandler {
  private canvas: HTMLCanvasElement;
  private callbacks: TouchCallbacks;

  /** タッチ開始位置 */
  private startX = 0;
  private startY = 0;

  /** 前回のタッチ位置（差分計算用） */
  private lastX = 0;
  private lastY = 0;

  /** 現在の操作状態 */
  private isDragging = false;
  private isResizing = false;
  private isPinching = false;
  private longPressTriggered = false;

  /** リサイズ中のハンドル */
  private activeHandle: ResizeHandle | null = null;

  /** 長押しタイマー */
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  /** ピンチズーム用: 前回の2点間距離 */
  private lastPinchDistance = 0;

  /** バインド済みイベントハンドラー（removeEventListener用） */
  private boundHandleTouchStart: (e: TouchEvent) => void;
  private boundHandleTouchMove: (e: TouchEvent) => void;
  private boundHandleTouchEnd: (e: TouchEvent) => void;
  private boundHandleTouchCancel: (e: TouchEvent) => void;

  /**
   * @param canvas - タッチイベントを監視するCanvas要素
   * @param callbacks - ジェスチャー検出時に呼び出すコールバック群
   */
  constructor(canvas: HTMLCanvasElement, callbacks: TouchCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    // イベントハンドラーをバインド
    this.boundHandleTouchStart = this.handleTouchStart.bind(this);
    this.boundHandleTouchMove = this.handleTouchMove.bind(this);
    this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
    this.boundHandleTouchCancel = this.handleTouchCancel.bind(this);

    // イベントリスナー登録（passive: false でpreventDefault可能にする）
    this.canvas.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundHandleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.boundHandleTouchCancel, { passive: false });
  }

  /**
   * すべてのイベントリスナーを削除し、リソースを解放する
   */
  destroy(): void {
    this.cancelLongPress();
    this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart);
    this.canvas.removeEventListener('touchmove', this.boundHandleTouchMove);
    this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.boundHandleTouchCancel);
  }

  /**
   * タッチ座標をCanvas相対座標に変換する
   */
  private getCanvasCoordinates(touch: Touch): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  /**
   * 2点間の距離を計算する（ピンチズーム用）
   */
  private getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 長押しタイマーをキャンセルする
   */
  private cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /**
   * 状態をリセットする
   */
  private resetState(): void {
    this.isDragging = false;
    this.isResizing = false;
    this.isPinching = false;
    this.longPressTriggered = false;
    this.activeHandle = null;
    this.lastPinchDistance = 0;
    this.cancelLongPress();
  }

  /**
   * touchstart イベントハンドラー
   */
  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    if (e.touches.length === 2) {
      // 2本指: ピンチズーム開始
      this.cancelLongPress();
      this.isPinching = true;
      this.isDragging = false;
      this.isResizing = false;
      this.lastPinchDistance = this.getDistance(e.touches[0], e.touches[1]);
      return;
    }

    if (e.touches.length !== 1) return;

    // 1本指タッチ開始
    const { x, y } = this.getCanvasCoordinates(e.touches[0]);
    this.startX = x;
    this.startY = y;
    this.lastX = x;
    this.lastY = y;
    this.isDragging = false;
    this.isResizing = false;
    this.longPressTriggered = false;

    // 長押しタイマー開始
    this.longPressTimer = setTimeout(() => {
      if (!this.isDragging && !this.isResizing) {
        this.longPressTriggered = true;
        this.callbacks.onLongPress(this.startX, this.startY);
      }
    }, LONG_PRESS_DURATION);
  }

  /**
   * touchmove イベントハンドラー
   */
  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    // ピンチズーム処理
    if (this.isPinching && e.touches.length === 2) {
      const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
      if (this.lastPinchDistance > 0) {
        const scaleDelta = currentDistance / this.lastPinchDistance;
        this.callbacks.onPinchZoom(scaleDelta);
      }
      this.lastPinchDistance = currentDistance;
      return;
    }

    if (e.touches.length !== 1) return;

    const { x, y } = this.getCanvasCoordinates(e.touches[0]);
    const deltaFromStart = Math.sqrt(
      (x - this.startX) ** 2 + (y - this.startY) ** 2
    );

    // 移動閾値を超えたら長押しをキャンセル
    if (deltaFromStart > DRAG_THRESHOLD) {
      this.cancelLongPress();
    }

    // ドラッグ/リサイズ開始判定
    if (!this.isDragging && !this.isResizing && !this.longPressTriggered) {
      if (deltaFromStart > DRAG_THRESHOLD) {
        // ドラッグ開始（リサイズハンドルの判定はコールバック側で行う）
        this.isDragging = true;
        this.callbacks.onMaskDragStart(this.startX, this.startY);
      }
    }

    // ドラッグ中の差分通知
    if (this.isDragging) {
      const deltaX = x - this.lastX;
      const deltaY = y - this.lastY;
      this.callbacks.onMaskDrag(deltaX, deltaY);
      this.lastX = x;
      this.lastY = y;
    }

    // リサイズ中の差分通知
    if (this.isResizing) {
      const deltaX = x - this.lastX;
      const deltaY = y - this.lastY;
      this.callbacks.onMaskResize(deltaX, deltaY);
      this.lastX = x;
      this.lastY = y;
    }
  }

  /**
   * touchend イベントハンドラー
   */
  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();

    // ピンチズーム終了
    if (this.isPinching) {
      if (e.touches.length < 2) {
        this.isPinching = false;
        this.lastPinchDistance = 0;
      }
      return;
    }

    this.cancelLongPress();

    // ドラッグ終了
    if (this.isDragging) {
      this.isDragging = false;
      this.callbacks.onMaskDragEnd();
      return;
    }

    // リサイズ終了
    if (this.isResizing) {
      this.isResizing = false;
      this.activeHandle = null;
      this.callbacks.onMaskResizeEnd();
      return;
    }

    // タップ判定（ドラッグ/リサイズ/長押しでなかった場合）
    if (!this.longPressTriggered) {
      this.callbacks.onMaskTap(this.startX, this.startY);
    }
  }

  /**
   * touchcancel イベントハンドラー
   */
  private handleTouchCancel(e: TouchEvent): void {
    e.preventDefault();

    if (this.isDragging) {
      this.callbacks.onMaskDragEnd();
    }
    if (this.isResizing) {
      this.callbacks.onMaskResizeEnd();
    }

    this.resetState();
  }

  /**
   * 現在アクティブなリサイズハンドルを取得する
   * @returns アクティブなリサイズハンドル、またはリサイズ中でない場合は null
   */
  getActiveHandle(): ResizeHandle | null {
    return this.activeHandle;
  }

  /**
   * 外部からリサイズモードを開始する
   * （コールバック側でタッチ位置がリサイズハンドル上と判定された場合に呼び出す）
   *
   * @param handle - リサイズハンドルの位置
   */
  startResize(handle: ResizeHandle): void {
    this.isDragging = false;
    this.isResizing = true;
    this.activeHandle = handle;
    this.cancelLongPress();
    this.callbacks.onMaskResizeStart(this.startX, this.startY, handle);
  }
}
