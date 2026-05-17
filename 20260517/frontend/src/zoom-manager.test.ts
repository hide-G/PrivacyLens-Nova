/**
 * ズーム管理モジュールのテスト
 */

import { describe, it, expect } from 'vitest';
import { ZoomManager, clampZoom } from './zoom-manager';

describe('clampZoom', () => {
  it('範囲内の値はそのまま返す', () => {
    expect(clampZoom(3.0)).toBe(3.0);
  });

  it('最小値未満の値を最小値にクランプする', () => {
    expect(clampZoom(0.5)).toBe(1.0);
  });

  it('最大値超過の値を最大値にクランプする', () => {
    expect(clampZoom(10.0)).toBe(5.0);
  });

  it('最小値ちょうどの値はそのまま返す', () => {
    expect(clampZoom(1.0)).toBe(1.0);
  });

  it('最大値ちょうどの値はそのまま返す', () => {
    expect(clampZoom(5.0)).toBe(5.0);
  });

  it('負の値を最小値にクランプする', () => {
    expect(clampZoom(-5.0)).toBe(1.0);
  });

  it('カスタム範囲でクランプする', () => {
    expect(clampZoom(3.0, 2.0, 4.0)).toBe(3.0);
    expect(clampZoom(1.0, 2.0, 4.0)).toBe(2.0);
    expect(clampZoom(5.0, 2.0, 4.0)).toBe(4.0);
  });

  it('min > max の場合は min を返す', () => {
    expect(clampZoom(3.0, 5.0, 1.0)).toBe(5.0);
  });
});

describe('ZoomManager', () => {
  describe('constructor', () => {
    it('デフォルト値で初期化される', () => {
      const zm = new ZoomManager();
      expect(zm.getZoom()).toBe(1.0);
    });

    it('カスタム範囲で初期化される', () => {
      const zm = new ZoomManager(2.0, 8.0);
      expect(zm.getZoom()).toBe(2.0);
    });
  });

  describe('getZoom', () => {
    it('現在のズームレベルを返す', () => {
      const zm = new ZoomManager();
      expect(zm.getZoom()).toBe(1.0);
    });
  });

  describe('setZoom', () => {
    it('範囲内の値を設定する', () => {
      const zm = new ZoomManager();
      const result = zm.setZoom(3.0);
      expect(result).toBe(3.0);
      expect(zm.getZoom()).toBe(3.0);
    });

    it('最小値未満の値をクランプする', () => {
      const zm = new ZoomManager();
      const result = zm.setZoom(0.5);
      expect(result).toBe(1.0);
      expect(zm.getZoom()).toBe(1.0);
    });

    it('最大値超過の値をクランプする', () => {
      const zm = new ZoomManager();
      const result = zm.setZoom(10.0);
      expect(result).toBe(5.0);
      expect(zm.getZoom()).toBe(5.0);
    });

    it('クランプされた値を返す', () => {
      const zm = new ZoomManager();
      expect(zm.setZoom(-1.0)).toBe(1.0);
      expect(zm.setZoom(100.0)).toBe(5.0);
    });
  });

  describe('zoomIn', () => {
    it('デフォルトのdelta（0.5）でズームインする', () => {
      const zm = new ZoomManager();
      const result = zm.zoomIn();
      expect(result).toBe(1.5);
      expect(zm.getZoom()).toBe(1.5);
    });

    it('カスタムdeltaでズームインする', () => {
      const zm = new ZoomManager();
      const result = zm.zoomIn(1.0);
      expect(result).toBe(2.0);
      expect(zm.getZoom()).toBe(2.0);
    });

    it('最大値を超えないようにクランプする', () => {
      const zm = new ZoomManager();
      zm.setZoom(4.8);
      const result = zm.zoomIn(0.5);
      expect(result).toBe(5.0);
      expect(zm.getZoom()).toBe(5.0);
    });

    it('連続ズームインで最大値に到達する', () => {
      const zm = new ZoomManager();
      for (let i = 0; i < 20; i++) {
        zm.zoomIn();
      }
      expect(zm.getZoom()).toBe(5.0);
    });
  });

  describe('zoomOut', () => {
    it('デフォルトのdelta（0.5）でズームアウトする', () => {
      const zm = new ZoomManager();
      zm.setZoom(3.0);
      const result = zm.zoomOut();
      expect(result).toBe(2.5);
      expect(zm.getZoom()).toBe(2.5);
    });

    it('カスタムdeltaでズームアウトする', () => {
      const zm = new ZoomManager();
      zm.setZoom(3.0);
      const result = zm.zoomOut(1.0);
      expect(result).toBe(2.0);
      expect(zm.getZoom()).toBe(2.0);
    });

    it('最小値を下回らないようにクランプする', () => {
      const zm = new ZoomManager();
      zm.setZoom(1.2);
      const result = zm.zoomOut(0.5);
      expect(result).toBe(1.0);
      expect(zm.getZoom()).toBe(1.0);
    });

    it('連続ズームアウトで最小値に到達する', () => {
      const zm = new ZoomManager();
      zm.setZoom(5.0);
      for (let i = 0; i < 20; i++) {
        zm.zoomOut();
      }
      expect(zm.getZoom()).toBe(1.0);
    });
  });

  describe('reset', () => {
    it('ズームレベルを初期値にリセットする', () => {
      const zm = new ZoomManager();
      zm.setZoom(4.0);
      zm.reset();
      expect(zm.getZoom()).toBe(1.0);
    });

    it('カスタム最小値にリセットする', () => {
      const zm = new ZoomManager(2.0, 8.0);
      zm.setZoom(6.0);
      zm.reset();
      expect(zm.getZoom()).toBe(2.0);
    });
  });
});
