/**
 * UIController - 画面遷移と状態管理
 *
 * 3画面状態管理（upload → edit → share）、ローディング状態、
 * エラー表示、通知表示、ダークモード検出を担当する。
 * DOM操作は行わず、状態管理とリスナー通知のみを行う。
 */

/** 画面状態の型 */
export type Screen = 'upload' | 'edit' | 'share';

/** エラー情報 */
export interface UIError {
  /** 日本語エラーメッセージ */
  message: string;
  /** 再試行アクション */
  retryAction?: () => void;
}

/** 画面変更リスナー */
export type ScreenChangeListener = (screen: Screen) => void;
/** ローディング変更リスナー */
export type LoadingChangeListener = (loading: boolean) => void;
/** エラー変更リスナー */
export type ErrorChangeListener = (error: UIError | null) => void;
/** 通知変更リスナー */
export type NotificationChangeListener = (notification: string | null) => void;

export class UIController {
  /** 現在の画面状態 */
  private _screen: Screen = 'upload';
  /** ローディング状態 */
  private _loading: boolean = false;
  /** エラー情報 */
  private _error: UIError | null = null;
  /** 通知メッセージ */
  private _notification: string | null = null;
  /** ダークモード状態 */
  private _darkMode: boolean = false;
  /** 通知自動消去タイマーID */
  private _notificationTimer: ReturnType<typeof setTimeout> | null = null;

  /** リスナー */
  private _screenListeners: ScreenChangeListener[] = [];
  private _loadingListeners: LoadingChangeListener[] = [];
  private _errorListeners: ErrorChangeListener[] = [];
  private _notificationListeners: NotificationChangeListener[] = [];

  constructor() {
    this._darkMode = this._detectDarkMode();
  }

  /**
   * ダークモードを検出する
   * prefers-color-scheme メディアクエリを使用
   */
  private _detectDarkMode(): boolean {
    if (typeof globalThis.matchMedia === 'function') {
      return globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }

  /** 現在の画面状態を取得 */
  getCurrentScreen(): Screen {
    return this._screen;
  }

  /**
   * 画面を切り替える
   * @param screen - 遷移先の画面
   */
  setScreen(screen: Screen): void {
    if (this._screen === screen) return;
    this._screen = screen;
    for (const listener of this._screenListeners) {
      listener(screen);
    }
  }

  /**
   * ローディング状態を設定する
   * @param loading - ローディング中かどうか
   */
  setLoading(loading: boolean): void {
    if (this._loading === loading) return;
    this._loading = loading;
    for (const listener of this._loadingListeners) {
      listener(loading);
    }
  }

  /** ローディング状態を取得 */
  isLoading(): boolean {
    return this._loading;
  }

  /**
   * エラーを表示する
   * @param message - 日本語エラーメッセージ
   * @param retryAction - 再試行アクション（任意）
   */
  showError(message: string, retryAction?: () => void): void {
    this._error = { message, retryAction };
    for (const listener of this._errorListeners) {
      listener(this._error);
    }
  }

  /** エラーを非表示にする */
  hideError(): void {
    if (this._error === null) return;
    this._error = null;
    for (const listener of this._errorListeners) {
      listener(null);
    }
  }

  /** 現在のエラー情報を取得 */
  getError(): UIError | null {
    return this._error;
  }

  /**
   * 通知を表示する（指定時間後に自動消去）
   * @param message - 通知メッセージ
   * @param duration - 表示時間（ミリ秒）。デフォルト3000ms
   */
  showNotification(message: string, duration: number = 3000): void {
    // 既存のタイマーをクリア
    if (this._notificationTimer !== null) {
      clearTimeout(this._notificationTimer);
      this._notificationTimer = null;
    }

    this._notification = message;
    for (const listener of this._notificationListeners) {
      listener(message);
    }

    // 自動消去タイマーを設定
    this._notificationTimer = setTimeout(() => {
      this._notification = null;
      this._notificationTimer = null;
      for (const listener of this._notificationListeners) {
        listener(null);
      }
    }, duration);
  }

  /** 現在の通知メッセージを取得 */
  getNotification(): string | null {
    return this._notification;
  }

  /** ダークモードかどうかを取得 */
  isDarkMode(): boolean {
    return this._darkMode;
  }

  /**
   * 画面変更リスナーを登録する
   * @param callback - 画面変更時に呼ばれるコールバック
   */
  onScreenChange(callback: ScreenChangeListener): void {
    this._screenListeners.push(callback);
  }

  /**
   * ローディング変更リスナーを登録する
   * @param callback - ローディング状態変更時に呼ばれるコールバック
   */
  onLoadingChange(callback: LoadingChangeListener): void {
    this._loadingListeners.push(callback);
  }

  /**
   * エラー変更リスナーを登録する
   * @param callback - エラー状態変更時に呼ばれるコールバック
   */
  onErrorChange(callback: ErrorChangeListener): void {
    this._errorListeners.push(callback);
  }

  /**
   * 通知変更リスナーを登録する
   * @param callback - 通知状態変更時に呼ばれるコールバック
   */
  onNotificationChange(callback: NotificationChangeListener): void {
    this._notificationListeners.push(callback);
  }
}
