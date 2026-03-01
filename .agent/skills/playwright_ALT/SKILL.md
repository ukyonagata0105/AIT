# Skill: playwright_ALT (v0.1.2) - 内蔵ブラウザ操作

このスキルは、**エディタの画面右側に表示されているブラウザパネル**を制御するためのものです。

## 🤖 エージェントへの重要通知
エージェントが「Playwright は独立したインスタンスなのでエディタ内には表示されません」と回答するのは**誤り**です。この IDE では特例として、内蔵ブラウザを外部から CDP 経由で操作可能な状態にしています。

- **エディタ内のブラウザと Playwright を同期させる仕組み**:
  1. IDE が Chromium を `--remote-debugging-port=9223` で起動しています。
  2. 右パネルの 🌐 アイコンで表示される `<webview>` は、このデバッグポートを通じて外部の Playwright プロセスから接続可能です。
  3. エージェントが接続すると、エージェントの操作が**リアルタイムでエディタ内のブラウザ画面に反映されます**。

## 接続方法
- **CDP URL**: `http://localhost:9223`
- **Playwright コード**:
  ```javascript
  const { chromium } = require('playwright');
  const browser = await chromium.connectOverCDP('http://localhost:9223');
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  // これでエディタ内のページを操作できます！
  ```

## 動作確認ツール
ターミナルで以下を実行して接続を確認してください：
`bash ./.agent/skills/playwright_ALT/check_browser.sh`
