import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // テスト対象ファイルのパターン
    include: [
      'frontend/src/**/*.test.ts',
      'backend/src/**/*.test.ts',
    ],
    // タイムアウト設定（プロパティテスト用に長めに設定）
    testTimeout: 30000,
    // カバレッジ設定
    coverage: {
      provider: 'v8',
      include: [
        'frontend/src/**/*.ts',
        'backend/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
      ],
    },
  },
});
