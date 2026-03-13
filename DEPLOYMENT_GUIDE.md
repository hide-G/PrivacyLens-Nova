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


### 4. DynamoDBテーブルの初期化

```bash
# テーブルが作成されたことを確認
aws dynamodb describe-table --table-name ProcessedCounter --profile nagata

# 初期レコードを作成
aws dynamodb put-item \
  --table-name ProcessedCounter \
  --item '{"pk": {"S": "global"}, "processed_count": {"N": "0"}}' \
  --profile nagata
```

### 5. Lambda Function URLの取得

```bash
# 各Lambda関数のFunction URLを取得
aws lambda list-function-url-configs --profile nagata

# または個別に取得
aws lambda get-function-url-config --function-name rekognition-detect-faces --profile nagata
aws lambda get-function-url-config --function-name nova-lite-detect-faces --profile nagata
aws lambda get-function-url-config --function-name nova-pro-detect-faces --profile nagata
aws lambda get-function-url-config --function-name nova-premier-detect-faces --profile nagata
```

### 6. フロントエンドの設定

1. Amplify Hosting URLにアクセス
2. 「Settings」ボタンをクリック
3. 取得したLambda Function URLを各フィールドに入力
4. 「Save」をクリック

### 7. Bedrock Model Accessの有効化

AWS Consoleから以下を実行:
1. Amazon Bedrock > Model access
2. 以下のモデルへのアクセスをリクエスト:
   - Amazon Nova Lite v2
   - Amazon Nova Pro v1
   - Amazon Nova Premier v1

### 8. 動作確認

1. 画像をアップロード
2. 各サービスボタンをクリックして顔検出を実行
3. 結果が正しく表示されることを確認

## トラブルシューティング

### ディスク容量不足エラー

ローカルでnpm installが失敗する場合:
- GitHubにプッシュしてAmplify Hostingでビルド
- または、Cドライブの空き容量を確保

### Amplifyデプロイエラー

```bash
# ログを確認
aws amplify list-apps --profile nagata
aws amplify get-app --app-id YOUR_APP_ID --profile nagata
```

### Lambda関数エラー

```bash
# CloudWatch Logsを確認
aws logs tail /aws/lambda/rekognition-detect-faces --follow --profile nagata
```

## GitHubへのプッシュ

```bash
# リモートリポジトリを追加（初回のみ）
git remote add origin https://github.com/YOUR_USERNAME/PrivacyLens-Nova.git

# ブランチ名をmainに変更
git branch -M main

# プッシュ
git push -u origin main
```

## 次のステップ

1. GitHubリポジトリをpublicに設定
2. README.mdにデモURLを追加
3. 10,000 AIdeas Competitionに応募
4. Community Buildersで記事を執筆
