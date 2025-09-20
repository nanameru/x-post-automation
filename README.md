# 🤖 X Auto Post - GitHub Trending Bot

GitHubのトレンドリポジトリを自動でX（旧Twitter）に投稿するBot

## ✨ 機能

- 📊 **GitHubトレンド取得**: https://github.com/trending から最新のトレンドリポジトリを自動取得
- 🔄 **重複チェック**: GitHub Issuesを活用した簡易データベースで投稿済みコンテンツを管理  
- 🧠 **AI文章生成**: ChatGPT APIでリポジトリの魅力を伝える投稿文を自動生成
- 📸 **自動スクリーンショット**: READMEページを自動撮影して画像付きで投稿
- ⏰ **定期実行**: GitHub Actionsで毎日朝6:30・夜18:00に自動実行
- 🐦 **X API投稿**: 文章と画像を組み合わせた魅力的なツイートを自動投稿

## 🚀 セットアップ

### 1. 必要なAPIキーの取得

#### X (Twitter) API
1. [X Developer Portal](https://developer.twitter.com/) にアクセス
2. 無料プランでも動作する場合があります（制限が厳しめ・投稿可否はアプリ権限に依存）。安定運用や高頻度の投稿は Basic（$100/月）以上を推奨
3. 以下を取得/準備:
   - Client ID（`X_CLIENT_ID`）
   - Client Secret（`X_CLIENT_SECRET`）※機密クライアントで使用。PKCEのみの場合は不要
   - OAuth2 Refresh Token（`X_OAUTH2_REFRESH_TOKEN`）※同梱スクリプト（例: `pkce-helper.js`）等で取得可能

#### OpenAI API
1. [OpenAI Platform](https://platform.openai.com/) でAPIキーを取得
2. 従量課金（1回数円程度）

### 2. GitHub Secretsの設定

リポジトリの「Settings」→「Secrets and variables」→「Actions」で以下を設定:

```bash
# 必須
OPENAI_API_KEY=your_openai_api_key
GITHUB_TOKEN=github_actions_token   # Actionsが自動注入（ローカルはPATでも可）
X_CLIENT_ID=your_x_client_id
X_OAUTH2_REFRESH_TOKEN=your_oauth2_refresh_token

# 任意（ある場合のみ）
OPENAI_ORG=your_openai_org
OPENAI_PROJECT=your_openai_project
X_CLIENT_SECRET=your_x_client_secret   # 機密クライアントで使用
SECRET_UPDATE_TOKEN=github_token_with_repo_admin   # 秘密情報の自動ローテーション用（未設定ならスキップ）
```

環境変数の説明:
- **OPENAI_API_KEY**: OpenAIのAPIキー。Responses API（`/v1/responses`）に使用
- **OPENAI_ORG / OPENAI_PROJECT**: OpenAIのOrg/Projectスコープ（任意）
- **GITHUB_TOKEN**: GitHub Actionsが注入。Octokit呼び出しやIssue記録、必要に応じてSecrets更新に利用
- **X_CLIENT_ID / X_CLIENT_SECRET**: XアプリのOAuth2クレデンシャル。`X_CLIENT_SECRET`は機密クライアントで必要
- **X_OAUTH2_REFRESH_TOKEN**: 投稿ユーザーのリフレッシュトークン。実行時にアクセストークンを自動更新
- **SECRET_UPDATE_TOKEN**: 新しいリフレッシュトークンを取得した際にレポジトリSecretsを自動更新するためのトークン（`repo`権限）。未設定なら更新はスキップ

### 3. リポジトリ情報の更新

`src/auto-post.js` の以下の部分を自分のGitHubユーザー名に変更:

```javascript
owner: 'kimurataiyou', // ← あなたのGitHubユーザー名に変更
repo: 'x-post-automation',
```

### 4. 手動テスト実行

```bash
npm install
npm start
```

### 5. 自動実行の開始

- GitHub Actionsが毎日自動で実行されます
- 手動実行も「Actions」タブから可能

## 📁 ファイル構成

```
x-post-automation/
├── .github/workflows/
│   └── hoge.yaml           # GitHub Actions設定
├── src/
│   └── auto-post.js        # メインスクリプト
├── screenshots/            # スクリーンショット保存先
├── package.json           # 依存関係
└── README.md             # このファイル
```

## 🔧 カスタマイズ

### 実行時間の変更
`.github/workflows/hoge.yaml` のcron設定を編集:

```yaml
schedule:
  # 朝6:30 (UTC 21:30)
  - cron: '30 21 * * *'
  # 夜18:00 (UTC 9:00)  
  - cron: '0 9 * * *'
```

### 投稿文のカスタマイズ
`src/auto-post.js` の `generateTweetText` メソッド内のプロンプトを編集

### 取得リポジトリ数の変更
`getTrendingRepositories` メソッドの `.slice(0, 10)` の数値を変更

## 🛠️ トラブルシューティング

### よくある問題

1. **X API エラー**
   - Basic プランに加入していますか？
   - APIキーは正しく設定されていますか？

2. **GitHub Actions実行エラー**  
   - Secretsは正しく設定されていますか？
   - リポジトリの書き込み権限はありますか？

3. **重複投稿の問題**
   - GitHub Issuesに `posted` ラベルが作成されているか確認

### ログの確認
GitHub Actionsの「Actions」タブで実行ログを確認できます

## 📊 コスト目安

- **X API**: 無料プランでも動作する場合あり（制限あり・投稿権限は審査/設定に依存）。安定運用は Basic（$100/月）以上推奨
- **OpenAI API**: 1回あたり数円（月間60円程度）
- **GitHub Actions**: 無料枠内で十分

## 🤝 貢献

バグ報告や機能追加のPRを歓迎します！

## 📄 ライセンス

MIT License