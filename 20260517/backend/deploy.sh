#!/bin/bash
# PrivacyLens Nova - バックエンドデプロイスクリプト
#
# 使用方法:
#   ./deploy.sh [環境名]
#
# 引数:
#   環境名: production (デフォルト) または staging
#
# 前提条件:
#   - AWS CLI 設定済み
#   - SAM CLI インストール済み
#   - Node.js 20.x インストール済み
#   - esbuild インストール済み (npm install)

set -euo pipefail

# 設定
STACK_NAME="privacylens-nova-backend"
REGION="us-east-1"
ENVIRONMENT="${1:-production}"
S3_BUCKET="${STACK_NAME}-deploy-${REGION}"

echo "=========================================="
echo "PrivacyLens Nova - バックエンドデプロイ"
echo "=========================================="
echo "環境: ${ENVIRONMENT}"
echo "リージョン: ${REGION}"
echo "スタック名: ${STACK_NAME}"
echo ""

# プロジェクトルートに移動
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 1. TypeScript ビルド
echo "[1/4] TypeScript ビルド..."
cd "${PROJECT_ROOT}"
npm run build:backend
echo "  ✓ ビルド完了: backend/dist/handler.js"

# 2. SAM ビルド
echo "[2/4] SAM ビルド..."
cd "${SCRIPT_DIR}"
sam build --template-file template.yaml
echo "  ✓ SAM ビルド完了"

# 3. デプロイ用S3バケット作成（存在しない場合）
echo "[3/4] デプロイ用S3バケット確認..."
if ! aws s3 ls "s3://${S3_BUCKET}" 2>/dev/null; then
  echo "  S3バケット作成: ${S3_BUCKET}"
  aws s3 mb "s3://${S3_BUCKET}" --region "${REGION}"
fi
echo "  ✓ S3バケット準備完了"

# 4. SAM デプロイ
echo "[4/4] SAM デプロイ..."
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --s3-bucket "${S3_BUCKET}" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "Environment=${ENVIRONMENT}" \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

echo ""
echo "=========================================="
echo "デプロイ完了"
echo "=========================================="

# デプロイ結果の表示
echo ""
echo "スタック出力:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" \
  --output table
