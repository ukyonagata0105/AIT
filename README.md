<p align="center">
  <img src="./electron-shell/assets/screenshot-main.png" alt="AI Terminal IDE" width="100%">
</p>

<h1 align="center">AI Terminal IDE</h1>

<p align="center">
  A terminal-first IDE for agentic coding workflows
</p>

<p align="center">
  <a href="https://github.com/ukyonagata0105/AIT/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"></a>
  <a href="https://github.com/ukyonagata0105/AIT/releases"><img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg" alt="Platform"></a>
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#日本語">日本語</a>
</p>

---

## English

AI Terminal IDE is a terminal-first IDE designed for developers who use agentic coding tools like OpenCode and Claude Code CLI. It provides a stress-free, terminal-focused coding environment with remote access capabilities.

### Features

- **Terminal-First Design** — Built on `xterm.js` and `node-pty` for native terminal experience
- **Multi-Project Management** — Slack-like workspace bar for instant project switching
- **Remote Access** — Web mode allows controlling the IDE from external devices
- **Broadcast Mode** — Send keystrokes to all workspace terminals simultaneously
- **Integrated File Explorer** — Browse and preview files directly in the IDE
- **Built-in Browser Panel** — Embedded webview for documentation without leaving the IDE
- **Theme Support** — Dark, Tokyo Night, Light, Solarized and more

### Installation

#### Download (Recommended)

Download the latest DMG installer from [Releases](https://github.com/ukyonagata0105/AIT/releases).

#### Build from Source

```bash
# Clone the repository
git clone https://github.com/ukyonagata0105/AIT.git
cd AIT/electron-shell

# Install dependencies
npm install

# Build and run
npm run build && npm run start
```

### Development

```bash
npm run dev      # Development mode with hot reload
npm test         # Run tests
```

### Remote Access

Start with web mode to enable remote access:

```bash
npm run start:web
```

Then access from any browser: `http://YOUR_IP:4096`

---

## 日本語

AI Terminal IDE は、OpenCode や Claude Code CLI などのエージェンティックコーディングツールを使用する開発者のために設計されたターミナルファーストのIDEです。ストレスなくターミナルに集中したコーディングを行いながら、外部からもホストマシンを操作できるリモートアクセス機能を提供します。

### 機能

- **ターミナルファーストデザイン** — `xterm.js` と `node-pty` によるネイティブなターミナル体験
- **マルチプロジェクト管理** — Slackライクなワークスペースバーで瞬時にプロジェクト切替
- **リモートアクセス** — ブラウザ経由で外部デバイスからIDEを操作可能
- **ブロードキャストモード** — 全ワークスペースのターミナルに同時にキーストロークを送信
- **統合ファイルエクスプローラー** — IDE内でファイルをブラウズ・プレビュー
- **内蔵ブラウザパネル** — IDEを離れずにドキュメントやリサーチが可能
- **テーマ対応** — ダーク、Tokyo Night、ライト、Solarized など

### インストール

#### ダウンロード（推奨）

[Releases](https://github.com/ukyonagata0105/AIT/releases) から最新のDMGインストーラーをダウンロードしてください。

#### ソースからビルド

```bash
# リポジトリをクローン
git clone https://github.com/ukyonagata0105/AIT.git
cd AIT/electron-shell

# 依存関係をインストール
npm install

# ビルドして起動
npm run build && npm run start
```

### 開発

```bash
npm run dev      # ホットリロード付き開発モード
npm test         # テスト実行
```

### リモートアクセス

Webモードで起動するとリモートアクセスが有効になります：

```bash
npm run start:web
```

任意のブラウザからアクセス: `http://YOUR_IP:4096`

---

## Tech Stack

| Technology | Description |
|------------|-------------|
| Electron | Cross-platform desktop apps |
| xterm.js | Terminal emulator component |
| node-pty | Pseudo terminal for Node.js |
| esbuild | Fast bundler |
| TypeScript | Type-safe JavaScript |

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

