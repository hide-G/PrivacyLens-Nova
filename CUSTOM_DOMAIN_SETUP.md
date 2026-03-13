# カスタムドメイン設定ガイド

## 概要

取得済みの `privacylens-nova.com` ドメインをAWS Amplifyアプリに紐づける手順です。

## 前提条件

- ✅ ドメイン `privacylens-nova.com` を取得済み
- ✅ Amplifyアプリがデプロイ済み
- ドメインレジストラ（Route 53、お名前.com、ムームードメイン等）の管理画面にアクセス可能

## 設定手順

### ステップ1: Amplify Consoleでカスタムドメインを追加

1. **AWS Management Console** にログイン
2. **Amplify** サービスを開く
3. デプロイ済みの **PrivacyLens-Nova** アプリを選択
4. 左メニューから **「Hosting」** > **「Custom domains」** をクリック
5. **「Add domain」** ボタンをクリック

### ステップ2: ドメイン情報を入力

1. **Domain name**: `privacylens-nova.com` を入力
2. Amplifyが自動的にドメインの所有権を確認
3. 以下のサブドメイン設定を確認:
   - `privacylens-nova.com` (ルートドメイン)
   - `www.privacylens-nova.com` (wwwサブドメイン)
4. **「Configure domain」** をクリック

### ステップ3: SSL証明書の自動発行

Amplifyが自動的に以下を実行します:
- AWS Certificate Manager (ACM) でSSL証明書を発行
- CloudFrontディストリビューションを設定
- HTTPS通信を有効化

### ステップ4: DNS設定情報を取得

Amplifyが表示するDNS設定情報をメモします:

**パターンA: Route 53を使用している場合**
- Amplifyが自動的にDNSレコードを作成（推奨）
- 「Update DNS records automatically」を選択

**パターンB: 外部レジストラを使用している場合**
- 以下のレコード情報が表示されます:

```
Type: CNAME
Name: _xxxxxxxxxxxxxx.privacylens-nova.com
Value: _yyyyyyyyyyyy.acm-validations.aws.
```

```
Type: CNAME (または A/ALIAS)
Name: privacylens-nova.com
Value: xxxxxx.cloudfront.net
```

```
Type: CNAME
Name: www
Value: xxxxxx.cloudfront.net
```

### ステップ5: ドメインレジストラでDNS設定

#### Route 53の場合（推奨）

Amplifyが自動設定するため、手動設定は不要です。

#### お名前.comの場合

1. お名前.com管理画面にログイン
2. **「DNS設定」** > **「DNSレコード設定」** を選択
3. `privacylens-nova.com` を選択
4. 以下のレコードを追加:

| タイプ | ホスト名 | VALUE | TTL |
|--------|----------|-------|-----|
| CNAME | _xxxxxxxxxxxxxx | _yyyyyyyyyyyy.acm-validations.aws. | 3600 |
| CNAME | www | xxxxxx.cloudfront.net | 3600 |
| A | @ | (Amplify提供のIPアドレス) | 3600 |

5. **「確認画面へ進む」** > **「設定する」** をクリック

#### ムームードメインの場合

1. ムームードメイン管理画面にログイン
2. **「ドメイン操作」** > **「ムームーDNS」** を選択
3. `privacylens-nova.com` の **「変更」** をクリック
4. **「カスタム設定」** を選択
5. 以下のレコードを追加:

| サブドメイン | 種別 | 内容 | 優先度 |
|-------------|------|------|--------|
| _xxxxxxxxxxxxxx | CNAME | _yyyyyyyyyyyy.acm-validations.aws. | - |
| www | CNAME | xxxxxx.cloudfront.net | - |
| (空欄) | A | (Amplify提供のIPアドレス) | - |

6. **「セットアップ情報変更」** をクリック

#### Cloudflareの場合

1. Cloudflare管理画面にログイン
2. `privacylens-nova.com` を選択
3. **「DNS」** タブを開く
4. 以下のレコードを追加:

| Type | Name | Content | Proxy status |
|------|------|---------|--------------|
| CNAME | _xxxxxxxxxxxxxx | _yyyyyyyyyyyy.acm-validations.aws. | DNS only |
| CNAME | www | xxxxxx.cloudfront.net | DNS only |
| CNAME | @ | xxxxxx.cloudfront.net | DNS only |

**重要**: Proxy statusは必ず **「DNS only」** に設定してください（オレンジ雲マークをグレーに）

### ステップ6: DNS伝播を待つ

- DNS設定が反映されるまで **5分〜48時間** かかります
- 通常は **15分〜1時間** で完了します
- 以下のコマンドで確認できます:

```bash
# CNAMEレコードの確認
nslookup -type=CNAME www.privacylens-nova.com

# Aレコードの確認
nslookup privacylens-nova.com
```

### ステップ7: SSL証明書の検証完了を確認

1. Amplify Console > Custom domains に戻る
2. ステータスが以下のように変化します:
   - **「Pending verification」** → DNS設定待ち
   - **「Pending deployment」** → 証明書発行中
   - **「Available」** → 設定完了 ✅

### ステップ8: 動作確認

1. ブラウザで `https://privacylens-nova.com` にアクセス
2. ブラウザで `https://www.privacylens-nova.com` にアクセス
3. 両方のURLでアプリが表示されることを確認
4. HTTPSで接続されていることを確認（鍵マーク）

## トラブルシューティング

### DNS設定が反映されない

```bash
# DNS伝播状況を確認
nslookup privacylens-nova.com
nslookup www.privacylens-nova.com

# または
dig privacylens-nova.com
dig www.privacylens-nova.com
```

### SSL証明書の検証が失敗する

1. DNSレコードが正しく設定されているか確認
2. TTL（Time To Live）を短く設定（300秒など）
3. DNS伝播を待つ（最大48時間）

### Cloudflareでエラーが出る

- Proxy status（オレンジ雲マーク）を **「DNS only」** に変更
- CloudflareのSSL/TLS設定を **「Full」** に変更

### Route 53以外でAPEXドメイン（@）が設定できない

一部のレジストラではAPEXドメインにCNAMEを設定できません。以下の対処法:

1. **ALIASレコード**を使用（対応している場合）
2. **Aレコード**でAmplify提供のIPアドレスを設定
3. Route 53にネームサーバーを移行（推奨）

## Route 53への移行（推奨）

より確実な設定のため、Route 53への移行を推奨します:

### 手順

1. **Route 53でホストゾーンを作成**:
```bash
aws route53 create-hosted-zone \
  --name privacylens-nova.com \
  --caller-reference $(date +%s) \
  --profile nagata
```

2. **ネームサーバー情報を取得**:
```bash
aws route53 get-hosted-zone \
  --id /hostedzone/XXXXXXXXXXXXXX \
  --profile nagata
```

3. **現在のレジストラでネームサーバーを変更**:
   - Route 53が提供する4つのネームサーバーを設定
   - 例: `ns-123.awsdns-12.com`

4. **Amplifyで自動DNS設定を有効化**:
   - Amplify Console > Custom domains
   - 「Update DNS records automatically」を選択

## 次のステップ

1. ✅ カスタムドメイン設定完了
2. README.mdにドメインURLを追加
3. GitHubリポジトリのAboutセクションにURLを追加
4. コンテスト応募記事にドメインURLを記載
5. SNSでドメイン付きURLを共有

## 参考リンク

- [Amplify Custom Domain Guide](https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html)
- [Route 53 Documentation](https://docs.aws.amazon.com/route53/)
- [ACM Certificate Validation](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html)
