/**
 * タッチイベントハンドリングのテスト
 *
 * ブラウザ専用コードのため、クラスのインスタンス化と
 * 基本的なインターフェース確認のみ実施する。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TouchHandler, TouchCallbacks, ResizeHandle } from './touch-handler';

/**
 * モックCanvas要素を作成する
 */
function createMockCanvas(): HTMLCanvasElement {
  const listeners: Record<string, EventListener> = {};
  const canvas = {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      listeners[type] = handler;
    }),
    removeEventListener: vi.fn((type: string, _handler: EventListener) => {
      delete listeners[type];
    }),
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 400,
      height: 600,
      right: 400,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    })),
  } as unknown as HTMLCanvasElement;
  return canvas;
}

/**
 * モックコールバックを作成する
 */
function createMockCallbacks(): TouchCallbacks {
  return {
    onMaskTap: vi.fn(),
    onMaskDragStart: vi.fn(),
    onMaskDrag: vi.fn(),
    onMaskDragEnd: vi.fn(),
    onMaskResizeStart: vi.fn(),
    onMaskResize: vi.fn(),
    onMaskResizeEnd: vi.fn(),
    onLongPress: vi.fn(),
    onPinchZoom: vi.fn(),
  };
}

describe('TouchHandler', () => {
  let canvas: HTMLCanvasElement;
  let callbacks: TouchCallbacks;

  beforeEach(() => {
    canvas = createMockCanvas();
    callbacks = createMockCallbacks();
  });

  describe('constructor', () => {
    it('インスタンスが正常に生成される', () => {
      const handler = new TouchHandler(canvas, callbacks);
      expect(handler).toBeInstanceOf(TouchHandler);
    });

    it('4つのタッチイベントリスナーが登録される', () => {
      new TouchHandler(canvas, callbacks);
      expect(canvas.addEventListener).toHaveBeenCalledTimes(4);
      expect(canvas.addEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { passive: false }
      );
      expect(canvas.addEventListener).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function),
        { passive: false }
      );
      expect(canvas.addEventListener).toHaveBeenCalledWith(
        'touchend',
        expect.any(Function),
        { passive: false }
      );
      expect(canvas.addEventListener).toHaveBeenCalledWith(
        'touchcancel',
        expect.any(Function),
        { passive: false }
      );
    });
  });

  describe('destroy', () => {
    it('すべてのイベントリスナーが削除される', () => {
      const handler = new TouchHandler(canvas, callbacks);
      handler.destroy();
      expect(canvas.removeEventListener).toHaveBeenCalledTimes(4);
      expect(canvas.removeEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function)
      );
      expect(canvas.removeEventListener).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function)
      );
      expect(canvas.removeEventListener).toHaveBeenCalledWith(
        'touchend',
        expect.any(Function)
      );
      expect(canvas.removeEventListener).toHaveBeenCalledWith(
        'touchcancel',
        expect.any(Function)
      );
    });
  });

  describe('startResize', () => {
    it('リサイズモードを外部から開始できる', () => {
      const handler = new TouchHandler(canvas, callbacks);
      const handle: ResizeHandle = 'top-left';
      handler.startResize(handle);
      expect(callbacks.onMaskResizeStart).toHaveBeenCalledWith(0, 0, handle);
    });
  });
});
