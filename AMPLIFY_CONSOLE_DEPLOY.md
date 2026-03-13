# Amplify Console デプロイガイド

## ローカルディスク容量不足の場合の代替デプロイ方法

ローカルでのnpm installやデプロイが失敗する場合、AWS Amplify Consoleから直接デプロイできます。

## 手順

### 1. AWS Amplify Consoleにアクセス

1. AWS Management Consoleにログイン
2. Amplify サービスを検索して開く
3. 「Get Started」または「New app」をクリック

### 2. GitHubリポジトリを接続

1. 「Host web app」を選択
2. 「GitHub」を選択
3. GitHubアカウントを認証
4. リポジトリ: `hide-G/PrivacyLens-Nova`を選択
5. ブランチ: `main`を選択
6. 「Next」をクリック

### 3. ビルド設定

amplify.ymlが自動検出されます。以下の内容を確認:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - echo "Building frontend..."
  artifacts:
    baseDirectory: public
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

「Next」をクリック

### 4. 環境変数の設定（オプション）

必要に応じて環境変数を追加:
- `AWS_PROFILE`: nagata

「Next」をクリック

### 5. デプロイ開始

「Save and deploy」をクリック

ビルドとデプロイが自動的に開始されます（10-15分）。

### 6. バックエンドのデプロイ

フロントエンドのデプロイが完了したら、バックエンドを別途デプロイする必要があります。

#### オプション1: AWS CloudShellを使用

1. AWS Management Consoleで「CloudShell」を開く
2. 以下のコマンドを実行:

```bash
# リポジトリをクローン
git clone https://github.com/hide-G/PrivacyLens-Nova.git
cd PrivacyLens-Nova

# 依存関係をインストール
npm install

# Lambda関数の依存関係をインストール
npm run install-functions

# デプロイ
npx @aws-amplify/backend-cli deploy --branch main
```

#### オプション2: AWS CDKを直接使用

```bash
# CDKをインストール
npm install -g aws-cdk

# バックエンドをデプロイ
cd amplify
cdk deploy --all --profile nagata
```

### 7. Lambda Function URLの取得

```bash
aws lambda list-function-url-configs --profile nagata
```

### 8. DynamoDB初期化

```bash
aws dynamodb put-item \
  --table-name ProcessedCounter \
  --item '{"pk": {"S": "global"}, "processed_count": {"N": "0"}}' \
  --profile nagata
```

### 9. フロントエンド設定

1. Amplify Hosting URLにアクセス
2. Settings > 各エンドポイントにFunction URLを入力
3. Save

## トラブルシューティング

### ビルドエラー

Amplify Consoleのビルドログを確認:
1. Amplify Console > アプリを選択
2. 「Build history」タブ
3. 失敗したビルドをクリック
4. ログを確認

### バックエンドデプロイエラー

CloudShellまたはローカルのログを確認:
```bash
# CloudWatch Logsを確認
aws logs tail /aws/amplify/YOUR_APP_ID --follow --profile nagata
```

## 完了

フロントエンドとバックエンドのデプロイが完了したら、アプリケーションが使用可能になります。

Amplify Hosting URL: https://main.YOUR_APP_ID.amplifyapp.com
