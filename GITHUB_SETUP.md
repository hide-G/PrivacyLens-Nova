# GitHub セットアップガイド

## 手順

### 1. GitHubで新しいリポジトリを作成

1. https://github.com/new にアクセス
2. Repository name: `PrivacyLens-Nova`
3. Description: `顔マスクWebアプリケーション - Amazon Nova物体検出活用`
4. Public を選択（コンテスト応募のため）
5. 「Create repository」をクリック

### 2. ローカルリポジトリをプッシュ

```bash
# PrivacyLens-Novaディレクトリで実行
git remote add origin https://github.com/YOUR_USERNAME/PrivacyLens-Nova.git
git branch -M main
git push -u origin main
```

YOUR_USERNAMEを実際のGitHubユーザー名に置き換えてください。

### 3. リポジトリの設定

#### README.mdの更新
- デモURLを追加（デプロイ後）
- スクリーンショットを追加

#### Topicsの追加
- `amazon-nova`
- `aws-amplify`
- `face-detection`
- `privacy`
- `10000-aideas`

#### Licenseの設定
- MIT Licenseを選択

### 4. GitHub Actionsの設定（オプション）

将来的にCI/CDを追加する場合:
- `.github/workflows/deploy.yml` を作成
- Amplify自動デプロイを設定

## 完了

GitHubリポジトリが公開され、コードが共有可能になりました。

次のステップ: QUICKSTART.mdを参照してAmplifyデプロイを実行してください。
