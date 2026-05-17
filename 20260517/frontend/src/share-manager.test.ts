/**
 * ShareManager ユニットテスト
 *
 * - buildXIntentUrl: 純粋関数のためフルテスト
 * - downloadImage / copyToClipboard / openXIntent: ブラウザAPI依存のためモック検証
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildXIntentUrl, downloadImage, copyToClipboard, openXIntent } from './share-manager';

describe('buildXIntentUrl', () => {
  it('デフォルトパラメータで正しいURLを生成する', () => {
    const url = buildXIntentUrl();

    expect(url).toContain('https://twitter.com/intent/tweet?');
    expect(url).toContain('hashtags=PrivacyLensNova');
    // URLSearchParams はスペースを + でエンコードする
    const urlObj = new URL(url);
    expect(urlObj.searchParams.get('text')).toBe('PrivacyLens Novaでプライバシー保護しました');
  });

  it('カスタムテキストを指定した場合、textパラメータに反映される', () => {
    const url = buildXIntentUrl('テスト投稿');

    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('text=テスト投稿');
  });

  it('カスタムハッシュタグを指定した場合、hashtagsパラメータに反映される', () => {
    const url = buildXIntentUrl(undefined, 'MyTag');

    expect(url).toContain('hashtags=MyTag');
  });

  it('テキストとハッシュタグの両方を指定できる', () => {
    const url = buildXIntentUrl('カスタムテキスト', 'Tag1,Tag2');

    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('text=カスタムテキスト');
    expect(url).toContain('hashtags=Tag1%2CTag2');
  });

  it('ベースURLが https://twitter.com/intent/tweet で始まる', () => {
    const url = buildXIntentUrl();

    expect(url.startsWith('https://twitter.com/intent/tweet?')).toBe(true);
  });

  it('特殊文字を含むテキストが正しくエンコードされる', () => {
    const url = buildXIntentUrl('Hello & World <script>');

    // URLSearchParams が自動的にエンコードする（生の特殊文字は含まれない）
    expect(url).not.toContain('<script>');
    // URLSearchParams.get() でデコードして検証
    const urlObj = new URL(url);
    expect(urlObj.searchParams.get('text')).toBe('Hello & World <script>');
  });

  it('空文字列を指定した場合もURLが生成される', () => {
    const url = buildXIntentUrl('', '');

    expect(url).toBe('https://twitter.com/intent/tweet?text=&hashtags=');
  });
});

describe('downloadImage', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let appendChildMock: ReturnType<typeof vi.fn>;
  let removeChildMock: ReturnType<typeof vi.fn>;
  let clickMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURLMock = vi.fn();
    appendChildMock = vi.fn();
    removeChildMock = vi.fn();
    clickMock = vi.fn();

    // グローバルオブジェクトのモック
    globalThis.URL.createObjectURL = createObjectURLMock;
    globalThis.URL.revokeObjectURL = revokeObjectURLMock;

    // document.body のモック
    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: vi.fn().mockReturnValue({
          href: '',
          download: '',
          style: { display: '' },
          click: clickMock,
        }),
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock,
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Blobからダウンロードリンクを作成してクリックする', () => {
    const blob = new Blob(['test'], { type: 'image/png' });

    downloadImage(blob);

    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(clickMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });

  it('デフォルトファイル名が privacylens-nova-{timestamp}.png 形式である', () => {
    const blob = new Blob(['test'], { type: 'image/png' });
    const anchor = {
      href: '',
      download: '',
      style: { display: '' },
      click: clickMock,
    };
    (document.createElement as ReturnType<typeof vi.fn>).mockReturnValue(anchor);

    downloadImage(blob);

    expect(anchor.download).toMatch(/^privacylens-nova-\d+\.png$/);
  });

  it('カスタムファイル名を指定できる', () => {
    const blob = new Blob(['test'], { type: 'image/png' });
    const anchor = {
      href: '',
      download: '',
      style: { display: '' },
      click: clickMock,
    };
    (document.createElement as ReturnType<typeof vi.fn>).mockReturnValue(anchor);

    downloadImage(blob, 'custom-name.png');

    expect(anchor.download).toBe('custom-name.png');
  });
});

describe('copyToClipboard', () => {
  beforeEach(() => {
    // navigator.clipboard のモック
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          write: vi.fn().mockResolvedValue(undefined),
        },
      },
      writable: true,
    });

    // ClipboardItem のモック
    Object.defineProperty(globalThis, 'ClipboardItem', {
      value: vi.fn().mockImplementation((items) => ({ items })),
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('成功時に true を返す', async () => {
    const blob = new Blob(['test'], { type: 'image/png' });

    const result = await copyToClipboard(blob);

    expect(result).toBe(true);
    expect(navigator.clipboard.write).toHaveBeenCalled();
  });

  it('失敗時に false を返す', async () => {
    (navigator.clipboard.write as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Clipboard write failed')
    );

    const blob = new Blob(['test'], { type: 'image/png' });

    const result = await copyToClipboard(blob);

    expect(result).toBe(false);
  });
});

describe('openXIntent', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        open: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buildXIntentUrl の結果を新しいタブで開く', () => {
    openXIntent();

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('https://twitter.com/intent/tweet?'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('カスタムパラメータが window.open に渡される', () => {
    openXIntent('カスタム', 'Tag');

    const calledUrl = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const decoded = decodeURIComponent(calledUrl);
    expect(decoded).toContain('text=カスタム');
    expect(calledUrl).toContain('hashtags=Tag');
  });
});
