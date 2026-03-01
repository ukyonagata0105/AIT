# Skill: browser (v0.1.1)

このスキルは `playwright_ALT` のエイリアスです。
エージェントは内蔵ブラウザを操作するために、このスキルまたは `playwright_ALT` を使用してください。

## 接続指示
**新しいブラウザを起動しないでください。** 代わりに以下を使用してください：
- **CDP URL**: `http://localhost:9223`
- **接続方法**: `playwright.chromium.connectOverCDP('http://localhost:9223')`

## 提供ツール
MCP サーバー `playwright-alt` を通じて `browser_navigate`, `browser_screenshot`, `browser_click` 等を利用可能です。
