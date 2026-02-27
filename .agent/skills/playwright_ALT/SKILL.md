# Skill: playwright_ALT (v0.1.0)

このスキルは、AI ターミナル IDE 内の「内蔵ブラウザパネル」を直接操作するための機能を提供します。
ターミナル上で動くエージェントは、以下のツール群を使用して DOM の取得、クリック、入力、スクリーンショット撮影などが可能です。

## 接続情報
このスキルが有効な環境では、以下の環境変数が設定されています：
- `BROWSER_CDP_URL`: ブラウザの CDP エンドポイント (例: `http://localhost:9223`)
- `BROWSER_TYPE`: `internal-browser`

## ツールセット (MCP)
以下のツールを MCP サーバー `playwright-alt` 経由で利用できます。

### `browser_navigate`
指定した URL に遷移します。
- `url`: 遷移先の URL (例: `http://localhost:3000`)

### `browser_screenshot`
現在の表示内容をスクリーンショットとして撮影します。
- 戻り値: Base64 エンコードされた PNG データ

### `browser_click`
指定したセレクタの要素をクリックします。
- `selector`: CSS セレクタ

### `browser_get_dom`
現在の URL とページタイトルを取得します。

---

## 使い方 (エージェント向け指示)
1. ユーザーが「ブラウザを確認して」「このサイトを操作して」と依頼した場合、内蔵ブラウザパネル（🌐）が開いていることを確認してください。
2. `playwright-alt` MCP サーバーに接続し、必要なツールを呼び出してください。
3. デフォルトでは `http://localhost:3000` をプレビュー対象として想定しています。
