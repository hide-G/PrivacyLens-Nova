# CI/CD セットアップガイド

このガイドでは、PrivacyLens NovaのバックエンドをGitHub Actionsで自動デプロイする設定方法を説明します。

## 概要

- **フロントエンド**: Amplify Hostingが自動デプロイ（既に設定済み）
- **バックエンド**: GitHub Actionsで自動デプロイ（このガイドで設定）

## 前提条件

- GitHubリポジトリ: https://github.com/hide-G/PrivacyLens-Nova
- AWS アカウント: 285336573977
- Amplify App ID: d25izynbipns16

## セットアップ手順

### 1. IAMロールの作成（GitHub Actions用）

GitHub ActionsがAWSリソースにアクセスするためのIAMロールを作成します。

```bash
# AWS CLIで実行
aws iam create-role \
  --role-name GitHubActionsAmplifyDeploy \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "arn:aws:iam::285336573977:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:hide-G/PrivacyLens-Nova:*"
          }
        }
      }
    ]
  }' \
  --profile nagata
```

### 2. IAMポリシーのアタッチ

作成したロールに必要な権限を付与します。

```bash
# Amplifyデプロイに必要な権限
aws iam attach-role-policy \
  --role-name GitHubActionsAmplifyDeploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess-Amplify \
  --profile nagata

# CloudFormationの権限
aws iam attach-role-policy \
  --role-name GitHubActionsAmplifyDeploy \
  --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess \
  --profile nagata

# Lambda、IAM、DynamoDBなどの権限（カスタムポリシー）
aws iam put-role-policy \
  --role-name GitHubActionsAmplifyDeploy \
  --policy-name AmplifyBackendDeploy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "lambda:*",
          "iam:*",
          "dynamodb:*",
          "apigateway:*",
          "s3:*",
          "cloudformation:*",
          "amplify:*"
        ],
        "Resource": "*"
      }
    ]
  }' \
  --profile nagata
```

### 3. GitHub OIDC Providerの作成（初回のみ）

GitHub ActionsがAWSにアクセスするためのOIDCプロバイダーを作成します。

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile nagata
```

**注意**: このコマンドは、既にOIDCプロバイダーが存在する場合はエラーになります（問題ありません）。

### 4. Amplify Webhookの作成

フロントエンドのビルドをトリガーするためのWebhookを作成します。

1. AWS Amplify Consoleにアクセス
2. PrivacyLens-Novaアプリを選択
3. 「Hosting」→「Build settings」→「Create webhook」
4. Webhook名: `backend-deploy-trigger`
5. ターゲットブランチ: `main`
6. Webhook URLをコピー

### 5. GitHubシークレットの設定

GitHubリポジトリにシークレットを追加します。

1. https://github.com/hide-G/PrivacyLens-Nova/settings/secrets/actions にアクセス
2. 以下のシークレットを追加:

| シークレット名 | 値 | 説明 |
|--------------|-----|------|
| `AWS_ROLE_ARN` | `arn:aws:iam::285336573977:role/GitHubActionsAmplifyDeploy` | IAMロールのARN |
| `AMPLIFY_WEBHOOK_URL` | （手順4でコピーしたURL） | Amplify Webhook URL |

### 6. ワークフローファイルの確認

`.github/workflows/deploy-backend.yml`が正しく作成されていることを確認します。

### 7. デプロイのテスト

```bash
cd PrivacyLens-Nova
git add .github/workflows/deploy-backend.yml CICD_SETUP.md
git commit -m "Add: GitHub Actions CI/CD for backend deployment"
git push origin main
```

GitHubの「Actions」タブでワークフローの実行状況を確認できます。

## トラブルシューティング

### エラー: "Error: Could not assume role"

**原因**: IAMロールの信頼ポリシーが正しく設定されていない

**解決策**: 
```bash
# ロールの信頼ポリシーを確認
aws iam get-role --role-name GitHubActionsAmplifyDeploy --profile nagata
```

### エラー: "AccessDenied"

**原因**: IAMロールに必要な権限がない

**解決策**: 手順2のポリシーアタッチを再実行

### ワークフローが実行されない

**原因**: `amplify/**`ディレクトリに変更がない

**解決策**: backend.tsを修正してプッシュ

## 代替方法: 手動デプロイ

CI/CDが設定できない場合、以下のコマンドで手動デプロイできます:

```bash
cd PrivacyLens-Nova
export AWS_PROFILE=nagata
npx ampx pipeline-deploy --branch main --app-id d25izynbipns16
```

## 参考資料

- [Amplify Gen2 Custom Pipelines](https://docs.amplify.aws/swift/deploy-and-host/fullstack-branching/custom-pipelines/)
- [GitHub Actions AWS認証](https://github.com/aws-actions/configure-aws-credentials)
- [Amplify Webhooks](https://docs.aws.amazon.com/amplify/latest/userguide/webhooks.html)

## 次のステップ

1. ✅ GitHub Actionsワークフローを作成（完了）
2. ⏳ IAMロールとOIDCプロバイダーを作成
3. ⏳ GitHubシークレットを設定
4. ⏳ Amplify Webhookを作成
5. ⏳ ワークフローをテスト
