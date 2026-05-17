#!/bin/bash
# PrivacyLens Nova フロントエンドビルドスクリプト
# 用途: TypeScriptをバンドルし、デプロイ用ディレクトリを構築する

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== PrivacyLens Nova フロントエンドビルド ==="

# 依存関係のインストール確認
if [ ! -d "node_modules" ]; then
  echo "📦 依存関係をインストール中..."
  npm install
fi

# TypeScriptをバンドル（esbuild）
echo "🔨 TypeScriptをバンドル中..."
npm run build:frontend

# デプロイディレクトリの作成
echo "📁 デプロイディレクトリを構築中..."
rm -rf deploy
mkdir -p deploy/dist

# ファイルのコピー
echo "📋 ファイルをコピー中..."
mkdir -p deploy/src
cp frontend/index.html deploy/index.html
cp frontend/src/styles.css deploy/src/styles.css
cp frontend/dist/main.js deploy/dist/main.js

echo ""
echo "✅ ビルド完了！"
echo ""
echo "デプロイディレクトリ構造:"
echo "  deploy/"
echo "  ├── index.html          (エントリポイント)"
echo "  ├── src/"
echo "  │   └── styles.css      (スタイルシート)"
echo "  └── dist/"
echo "      └── main.js         (バンドル済みJavaScript)"
echo ""
echo "このディレクトリの内容が https://privacylens-nova.com/20260517/ で配信されます。"
