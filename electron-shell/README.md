# AI-Native Terminal IDE

A terminal-first, tab-based IDE wrapper around an AI agentic development environment (e.g. OpenCode, Claude Code). This leverages Electron, xterm.js, and modern web technologies to create a seamless developer experience heavily focused on CLI workflows and multi-project management.

## Key Features & UI Layout

1. **Left Workspace Bar (Activity Bar)**:
   - A vertical list of your workspaces (projects).
   - Click to switch between different project contexts instantly. The central terminal and right explorer will immediately re-focus on the selected project directory.
   - Use the `+` button at the bottom to add a new workspace folder.
   - Right-click workspaces to change their color tag, rename them, or remove them.

2. **Central Terminal (Main Area)**:
   - The primary interactive area of the IDE, built on `xterm.js` and `node-pty`. 
   - Tab minimal design ensures you can focus on terminal outputs rather than managing dozens of tabs.

3. **Bottom Broadcast Bar**:
   - The broadcast bar is located at the bottom of the Terminal area.
   - **"Broadcast" Checkbox**: When checked, keystrokes typed into the currently active terminal are instantly mirrored and sent to *all* other active workspace terminals. This is extremely useful if you need to run the same background task, build command, or Git operation across multiple microservice repositories simultaneously.
   - Remember to turn "Broadcast" off when you wish to type a command meant only for the current workspace.

4. **Right Activity & Panel**:
   - The far-right icon bar lets you toggle the contents of the right-hand panel.
   - **Explorer (📂)**: Displays a file tree of the active workspace. Clicking a file previews it in the viewer directly above the tree.
   - **Extensions (🧩)**: Embeds the official VS Code marketplace, allowing you to seamlessly search and install extensions in the background without opening a browser.

5. **Settings & Themes**:
   - Access the Settings (gear icon) in the top-left area to manage workspaces manually or switch visual themes.
   - Full support for unified themes, altering the UI panels, borders, and term colors seamlessly (e.g. Dark, Tokyo Night, Light, Solarized Light).

## Setting up locally
```bash
# 1. Install dependencies
npm install

# 2. Build the app
npm run build

# 3. Start the application
npm run start
```
