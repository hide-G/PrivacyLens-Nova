# クイックスタートガイド

## 最速デプロイ手順（5ステップ）

### 1. GitHubリポジトリ作成

```bash
# GitHubで新しいリポジトリ「PrivacyLens-Nova」を作成（public）
# 次に、ローカルからプッシュ

cd PrivacyLens-Nova
git remote add origin https://github.com/YOUR_USERNAME/PrivacyLens-Nova.git
git branch -M main
git push -u origin main
```

### 2. Amplifyデプロイ

```bash
# AWS_PROFILEを設定
$env:AWS_PROFILE="nagata"

# デプロイ（初回は時間がかかります）
npx ampx deploy --branch main
```

### 3. DynamoDB初期化

```bash
aws dynamodb put-item \
  --table-name ProcessedCounter \
  --item '{"pk": {"S": "global"}, "processed_count": {"N": "0"}}' \
  --profile nagata
```

### 4. Lambda Function URL取得

```bash
aws lambda list-function-url-configs --profile nagata
```

出力例:
```json
{
  "FunctionUrlConfigs": [
    {
      "FunctionUrl": "https://xxxxx.lambda-url.us-east-1.on.aws/",
      "FunctionArn": "arn:aws:lambda:us-east-1:285336573977:function:rekognition-detect-faces"
    }
  ]
}
```

### 5. フロントエンド設定

1. Amplify Hosting URLにアクセス
2. Settings > 各エンドポイントにFunction URLを入力
3. Save

## 完了！

アプリケーションが使用可能になりました。

## 注意事項

- Bedrock Model Accessの有効化を忘れずに（AWS Console > Bedrock > Model access）
- 初回デプロイは10-15分程度かかります
- Lambda関数のコールドスタートで初回実行は遅くなります

## 次のステップ

- [ ] 動作確認（画像アップロード → 顔検出）
- [ ] GitHubリポジトリのREADMEにデモURLを追加
- [ ] 10,000 AIdeas Competitionに応募
- [ ] Xで共有（#PrivacyLensNova #10000AIdeas #AmazonNova）
