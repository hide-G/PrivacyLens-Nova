/**
 * UIController ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UIController } from './ui-controller';

describe('UIController', () => {
  let controller: UIController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new UIController();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('画面遷移', () => {
    it('初期画面はuploadである', () => {
      expect(controller.getCurrentScreen()).toBe('upload');
    });

    it('setScreenで画面を切り替えられる', () => {
      controller.setScreen('edit');
      expect(controller.getCurrentScreen()).toBe('edit');

      controller.setScreen('share');
      expect(controller.getCurrentScreen()).toBe('share');

      controller.setScreen('upload');
      expect(controller.getCurrentScreen()).toBe('upload');
    });

    it('画面変更時にリスナーが呼ばれる', () => {
      const listener = vi.fn();
      controller.onScreenChange(listener);

      controller.setScreen('edit');
      expect(listener).toHaveBeenCalledWith('edit');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('同じ画面に遷移してもリスナーは呼ばれない', () => {
      const listener = vi.fn();
      controller.onScreenChange(listener);

      controller.setScreen('upload'); // 既にuploadなので変更なし
      expect(listener).not.toHaveBeenCalled();
    });

    it('複数のリスナーが登録できる', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      controller.onScreenChange(listener1);
      controller.onScreenChange(listener2);

      controller.setScreen('edit');
      expect(listener1).toHaveBeenCalledWith('edit');
      expect(listener2).toHaveBeenCalledWith('edit');
    });
  });

  describe('ローディング状態', () => {
    it('初期状態はローディングなし', () => {
      expect(controller.isLoading()).toBe(false);
    });

    it('setLoadingでローディング状態を変更できる', () => {
      controller.setLoading(true);
      expect(controller.isLoading()).toBe(true);

      controller.setLoading(false);
      expect(controller.isLoading()).toBe(false);
    });

    it('ローディング変更時にリスナーが呼ばれる', () => {
      const listener = vi.fn();
      controller.onLoadingChange(listener);

      controller.setLoading(true);
      expect(listener).toHaveBeenCalledWith(true);

      controller.setLoading(false);
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('同じ状態に設定してもリスナーは呼ばれない', () => {
      const listener = vi.fn();
      controller.onLoadingChange(listener);

      controller.setLoading(false); // 既にfalseなので変更なし
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('エラー表示', () => {
    it('初期状態はエラーなし', () => {
      expect(controller.getError()).toBeNull();
    });

    it('showErrorでエラーを表示できる', () => {
      controller.showError('ネットワーク接続を確認してください');
      const error = controller.getError();
      expect(error).not.toBeNull();
      expect(error!.message).toBe('ネットワーク接続を確認してください');
      expect(error!.retryAction).toBeUndefined();
    });

    it('showErrorで再試行アクション付きエラーを表示できる', () => {
      const retry = vi.fn();
      controller.showError('処理がタイムアウトしました。再試行してください', retry);
      const error = controller.getError();
      expect(error).not.toBeNull();
      expect(error!.message).toBe('処理がタイムアウトしました。再試行してください');
      expect(error!.retryAction).toBe(retry);
    });

    it('hideErrorでエラーを非表示にできる', () => {
      controller.showError('エラーが発生しました');
      controller.hideError();
      expect(controller.getError()).toBeNull();
    });

    it('エラーがない状態でhideErrorを呼んでもリスナーは呼ばれない', () => {
      const listener = vi.fn();
      controller.onErrorChange(listener);

      controller.hideError();
      expect(listener).not.toHaveBeenCalled();
    });

    it('エラー変更時にリスナーが呼ばれる', () => {
      const listener = vi.fn();
      controller.onErrorChange(listener);

      controller.showError('エラーメッセージ');
      expect(listener).toHaveBeenCalledWith({
        message: 'エラーメッセージ',
        retryAction: undefined,
      });

      controller.hideError();
      expect(listener).toHaveBeenCalledWith(null);
    });

    it('エラーメッセージはユーザーが閉じるまで表示し続ける', () => {
      controller.showError('エラーが発生しました。再試行してください');

      // 時間が経過してもエラーは消えない
      vi.advanceTimersByTime(10000);
      expect(controller.getError()).not.toBeNull();
      expect(controller.getError()!.message).toBe('エラーが発生しました。再試行してください');
    });
  });

  describe('通知表示', () => {
    it('初期状態は通知なし', () => {
      expect(controller.getNotification()).toBeNull();
    });

    it('showNotificationで通知を表示できる', () => {
      controller.showNotification('保存が完了しました');
      expect(controller.getNotification()).toBe('保存が完了しました');
    });

    it('通知はデフォルト3秒後に自動消去される', () => {
      controller.showNotification('保存が完了しました');
      expect(controller.getNotification()).toBe('保存が完了しました');

      vi.advanceTimersByTime(2999);
      expect(controller.getNotification()).toBe('保存が完了しました');

      vi.advanceTimersByTime(1);
      expect(controller.getNotification()).toBeNull();
    });

    it('カスタム表示時間を指定できる', () => {
      controller.showNotification('コピーしました', 5000);
      expect(controller.getNotification()).toBe('コピーしました');

      vi.advanceTimersByTime(4999);
      expect(controller.getNotification()).toBe('コピーしました');

      vi.advanceTimersByTime(1);
      expect(controller.getNotification()).toBeNull();
    });

    it('通知変更時にリスナーが呼ばれる', () => {
      const listener = vi.fn();
      controller.onNotificationChange(listener);

      controller.showNotification('通知メッセージ');
      expect(listener).toHaveBeenCalledWith('通知メッセージ');

      vi.advanceTimersByTime(3000);
      expect(listener).toHaveBeenCalledWith(null);
    });

    it('新しい通知が表示されると前の通知タイマーはキャンセルされる', () => {
      const listener = vi.fn();
      controller.onNotificationChange(listener);

      controller.showNotification('最初の通知');
      vi.advanceTimersByTime(2000); // 2秒経過

      controller.showNotification('2番目の通知');
      expect(controller.getNotification()).toBe('2番目の通知');

      // 最初の通知の残り1秒が経過しても消えない
      vi.advanceTimersByTime(1000);
      expect(controller.getNotification()).toBe('2番目の通知');

      // 2番目の通知の3秒が経過すると消える
      vi.advanceTimersByTime(2000);
      expect(controller.getNotification()).toBeNull();
    });
  });

  describe('ダークモード検出', () => {
    it('matchMediaが利用できない場合はfalseを返す', () => {
      // デフォルトのテスト環境ではmatchMediaが未定義
      const ctrl = new UIController();
      expect(ctrl.isDarkMode()).toBe(false);
    });

    it('matchMediaでダークモードが検出される場合はtrueを返す', () => {
      const originalMatchMedia = globalThis.matchMedia;
      globalThis.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof globalThis.matchMedia;

      const ctrl = new UIController();
      expect(ctrl.isDarkMode()).toBe(true);

      globalThis.matchMedia = originalMatchMedia;
    });

    it('matchMediaでライトモードの場合はfalseを返す', () => {
      const originalMatchMedia = globalThis.matchMedia;
      globalThis.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof globalThis.matchMedia;

      const ctrl = new UIController();
      expect(ctrl.isDarkMode()).toBe(false);

      globalThis.matchMedia = originalMatchMedia;
    });
  });
});
