# TermNexus E2E Testing - Current Summary

## Status

- Full Electron E2E suite: **35 / 35 passing**
- Entry point under test: `src/renderer/index.ts`
- Test command: `npm run test:e2e`
- Test mode launches use isolated fixture workspaces instead of native folder-picking flows

---

## What changed

- The suite no longer depends on native workspace-add dialogs for setup.
- Stale specs targeting inactive renderer paths were removed or rewritten to match the active UI.
- Electron test startup was stabilized by skipping non-essential sidecar behavior in `NODE_ENV=test`.
- Duplicate workspace-add behavior is covered by an E2E regression test.

---

## Current coverage areas

- Smoke / app shell
- Workspace management
- File explorer
- File viewer
- Terminal tabs
- Theme switching

---

## Known notes

- The app still includes an in-app browser panel as normal UI.
- The old Playwright MCP / skills bridge is no longer part of the runtime architecture.
- If new browser-panel behavior needs coverage, add dedicated E2E tests against the current renderer rather than reviving the removed MCP path.
