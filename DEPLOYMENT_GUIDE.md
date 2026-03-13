# デプロイガイド

## 前提条件

- GitHubアカウント
- AWS CLIが設定済み（プロファイル: nagata）
- Amplify CLIがインストール済み

## 手順

### 1. GitHubリポジトリの作成

1. GitHubで新しいリポジトリを作成: `PrivacyLens-Nova`
2. リポジトリをpublicに設定（コンテスト応募のため）

### 2. ローカルリポジトリの設定

```bash
cd PrivacyLens-Nova

# 初回コミット
git add .
git commit -m "Initial commit: PrivacyLens Nova implementation"

# リモートリポジトリを追加
git remote add origin https://github.com/YOUR_USERNAME/PrivacyLens-Nova.git

# プッシュ
git branch -M main
git push -u origin main
```

### 3. Amplifyバックエンドのデプロイ

```bash
# AWS_PROFILEを設定
$env:AWS_PROFILE="nagata"

# Amplifyデプロイ
npx ampx deploy --branch main
```
