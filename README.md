# PrivacyLens Nova

Amazon Novaの物体検出（image grounding）を活用した顔マスクWebアプリケーション

## 概要

PrivacyLens Novaは、スマートフォンブラウザから画像をアップロードし、顔を自動検出してマスクを適用することで、SNS投稿時のプライバシー保護を実現するWebアプリケーションです。

最大の特徴は「画像をどこにも保存しない」セキュリティファーストな設計です。画像はLambdaのメモリ上でのみ処理され、S3やDynamoDB、CloudWatch Logsに一切保存されません。

## 主な機能

- 📸 画像アップロード（カメラ撮影対応）
- 🤖 4つの顔検出サービス
  - Amazon Rekognition DetectFaces
  - Amazon Nova Lite v2
  - Amazon Nova Pro v1
  - Amazon Nova Premier v1
- 🎭 自動顔マスク適用
- 💰 リアルタイムコスト表示
- 🌐 多言語対応（日本語/英語）
- 📥 処理済み画像のダウンロード
- 🔒 プライバシーファースト設計（画像非保存）

## 技術スタック

### フロントエンド
- HTML5 / CSS3 / Vanilla JavaScript (ES6+)
- Canvas API
- LocalStorage API

### バックエンド
- AWS Lambda (Node.js 20.x)
- Amazon Rekognition
- Amazon Bedrock (Nova models)
- Amazon DynamoDB

### インフラ
- AWS Amplify Gen2
- AWS CDK
- Lambda Function URL

## セットアップ

### 前提条件

- Node.js 20.x以上
- AWS CLI設定済み
- AWS Amplify CLI (`npm install -g @aws-amplify/cli`)

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/YOUR_USERNAME/PrivacyLens-Nova.git
cd PrivacyLens-Nova

# 依存関係をインストール
npm install

# 各Lambda関数の依存関係をインストール
cd amplify/functions/rekognition-detect-faces && npm install && cd ../../..
cd amplify/functions/nova-lite-detect-faces && npm install && cd ../../..
cd amplify/functions/nova-pro-detect-faces && npm install && cd ../../..
cd amplify/functions/nova-premier-detect-faces && npm install && cd ../../..
```

### ローカル開発

```bash
# Amplify Sandboxを起動
npm run dev
```

### デプロイ

```bash
# 本番環境にデプロイ
npm run deploy

# Lambda Function URLを取得
aws lambda list-function-url-configs --profile nagata

# DynamoDBテーブルに初期レコードを作成
aws dynamodb put-item \
  --table-name ProcessedCounter \
  --item '{"pk": {"S": "global"}, "processed_count": {"N": "0"}}' \
  --profile nagata
```

### フロントエンド設定

1. デプロイ後、Lambda Function URLを取得
2. アプリケーションの「Settings」ボタンをクリック
3. 各サービスのFunction URLを入力して保存

## アーキテクチャ

```
ユーザー（ブラウザ）
    ↓ HTTPS
AWS Amplify Hosting (CloudFront + S3)
    ↓ HTTPS (Lambda Function URL)
AWS Lambda関数群
    ├─ Rekognition Lambda → Amazon Rekognition
    ├─ Nova Lite Lambda → Amazon Bedrock (Nova Lite v2)
    ├─ Nova Pro Lambda → Amazon Bedrock (Nova Pro v1)
    └─ Nova Premier Lambda → Amazon Bedrock (Nova Premier v1)
    ↓
Amazon DynamoDB (処理枚数カウンター)
```

## セキュリティ

- ✅ 画像データはLambdaメモリ上でのみ処理
- ✅ S3、DynamoDB、CloudWatch Logsに画像を保存しない
- ✅ HTTPS通信のみ
- ✅ CORS設定
- ✅ IAM最小権限ポリシー
- ✅ Lambda同時実行数制限（5）

## コスト

### 処理コスト（1画像あたり）

- Rekognition: $0.001
- Nova Lite v2: 約$0.00009
- Nova Pro v1: 約$0.0009
- Nova Premier v1: 約$0.002

### その他のコスト

- Lambda実行: 無料枠内で収まる可能性が高い
- DynamoDB: 読み書き操作は最小限
- Amplify Hosting: 無料枠あり

## ライセンス

MIT License

## 開発者

- X: [@nagata_aws](https://x.com/nagata_aws)
- AWS Community Builders

## 10,000 AIdeas Competition

このプロジェクトは10,000 AIdeas Competitionに応募しています。
投票をお願いします！

## トラブルシューティング

### Lambda Function URLが取得できない

```bash
# Function URLを確認
aws lambda get-function-url-config \
  --function-name rekognition-detect-faces \
  --profile nagata
```

### DynamoDBカウンターエラー

```bash
# テーブルの存在確認
aws dynamodb describe-table \
  --table-name ProcessedCounter \
  --profile nagata

# 初期レコードを作成
aws dynamodb put-item \
  --table-name ProcessedCounter \
  --item '{"pk": {"S": "global"}, "processed_count": {"N": "0"}}' \
  --profile nagata
```

### Bedrock権限エラー

Nova modelsへのアクセス権限を確認してください。
AWS Consoleから Bedrock > Model access で各モデルへのアクセスをリクエストする必要があります。

## 今後の改善予定

- [ ] インタラクティブマスク編集機能
- [ ] マスクスタイルのカスタマイズ
- [ ] Undo/Redo機能
- [ ] QRコード表示機能
- [ ] パフォーマンス最適化
