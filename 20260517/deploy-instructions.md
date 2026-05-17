# PrivacyLens Nova デプロイ手順

## 概要

PrivacyLens Nova は既存の Amplify Hosting アプリ（App ID: `d25izynbipns16`）のサブディレクトリ `/20260517/` として配置されます。既存のルート `/` コンテンツには影響を与えません。

## 公開URL

- **本番URL**: `https://privacylens-nova.com/20260517/`
- **Amplify URL**: `https://main.d25izynbipns16.amplifyapp.com/20260517/`

## フロントエンドのビルド

### 前提条件

- Node.js 20.x 以上
- npm がインストール済み

### ビルド手順

```bash
cd 20260517

# 依存関係のインストール
npm install

# フロントエンドのビルド（TypeScript → JavaScript バンドル）
npm run build:frontend

# または、ビルドスクリプトを使用（deploy/ ディレクトリも構築）
bash build-frontend.sh
```

### ビルド成果物

`npm run build:frontend` を実行すると、以下のファイルが生成されます:

```
frontend/dist/main.js    # バンドル済み・ミニファイ済みJavaScript (ESM)
```

## デプロイ方法

### 自動デプロイ（推奨）

`main` ブランチにプッシュするだけで Amplify が自動的にデプロイします:

```bash
git add .
git commit -m "feat: PrivacyLens Nova フロントエンド更新"
git push origin main
```

Amplify は GitHub リポジトリの `main` ブランチを監視しており、プッシュをトリガーにビルド＆デプロイが実行されます。

### デプロイの流れ

1. `git push origin main` を実行
2. Amplify がリポジトリの変更を検出
3. `amplify.yml` に基づいてビルドが実行される
4. ビルド成果物がホスティングに配置される
5. `https://privacylens-nova.com/20260517/` でアクセス可能になる

## ディレクトリ構造

### リポジトリ構造（Amplify が配信する内容）

```
PrivacyLens-Nova/          (リポジトリルート)
├── public/                (既存のルートコンテンツ → / で配信)
│   ├── index.html
│   ├── app.js
│   ├── canvas-renderer.js
│   ├── config.js
│   ├── i18n.js
│   └── styles.css
├── 20260517/              (PrivacyLens Nova → /20260517/ で配信)
│   ├── frontend/
│   │   ├── index.html     ← エントリポイント
│   │   ├── src/
│   │   │   └── styles.css
│   │   └── dist/
│   │       └── main.js    ← ビルド済みJS
│   ├── backend/           (Lambda用、Amplifyでは配信しない)
│   ├── package.json
│   └── build-frontend.sh
└── amplify.yml            (ビルド設定)
```

### Amplify が配信するURL対応

| URL パス | 配信元ファイル |
|----------|---------------|
| `/` | `public/index.html` |
| `/app.js` | `public/app.js` |
| `/20260517/` | `20260517/frontend/index.html` |
| `/20260517/src/styles.css` | `20260517/frontend/src/styles.css` |
| `/20260517/dist/main.js` | `20260517/frontend/dist/main.js` |

## 既存コンテンツへの影響

- ルート `/` の既存コンテンツ（`public/` ディレクトリ）は**一切変更されません**
- `20260517/` ディレクトリの追加は、既存のルーティングに影響を与えません
- Amplify の `amplify.yml` は `public/` と `20260517/frontend/` の両方を配信するよう設定されています

## amplify.yml の設定

Amplify のビルド設定（`amplify.yml`）では:

1. `20260517/` 配下の `npm install` と `npm run build:frontend` を実行
2. アーティファクトとして `public/` の全ファイルと `20260517/frontend/` の配信対象ファイルを含める
3. 既存のバックエンド（Lambda関数）のビルドも維持

## トラブルシューティング

### ビルドが失敗する場合

```bash
# ローカルでビルドを確認
cd 20260517
npm install
npm run build:frontend
```

### デプロイ後にページが表示されない場合

1. Amplify Console でビルドログを確認
2. `amplify.yml` のアーティファクト設定を確認
3. `<base href="/20260517/">` タグが `index.html` に含まれていることを確認

### CSSやJSが読み込まれない場合

- `index.html` の `<base href="/20260517/">` により、相対パスは `/20260517/` を基準に解決されます
- `./src/styles.css` → `/20260517/src/styles.css`
- `./dist/main.js` → `/20260517/dist/main.js`

## 注意事項

- バックエンド（Lambda関数）は Amplify Hosting とは独立してデプロイします（SAM/CloudFormation）
- 画像データはサーバーに一切保存されません（プライバシーファースト設計）
- `20260517/node_modules/` と `20260517/frontend/dist/` は `.gitignore` に追加してください
